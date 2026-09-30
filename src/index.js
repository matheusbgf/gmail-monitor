
'use strict';

const config = require('./config');
const logger = require('./logger');

const {
  registerGlobalErrorHandlers,
} = require('./errors');

const {
  createGmailClient,
} = require('./gmail/client');

const {
  fetchNewMessages,
  getMessage,
} = require('./gmail/service');

const {
  parseGmailMessage,
} = require('./parser/email');

const {
  sanitizeEmail,
} = require('./security/sanitizer');

const {
  loadState,
  saveState,
  hasProcessed,
  markProcessed,
} = require('./state/store');

const {
  formatAlert,
} = require('./formatter/alert');

const WhatsAppClient = require('./whatsapp/client');
const Scheduler = require('./scheduler');
const CheckpointScheduler = require('./scheduler/checkpoint');
const { createOperatingWindowGuard } = require('./scheduler/operating-window');

const {
  captureAll,
} = require('./checkpoint/capture');

const {
  formatCheckpointMessage,
} = require('./checkpoint/formatter');

const appLogger = logger.child('APP');

let scheduler;
let checkpointScheduler;
let shuttingDown = false;

/**
 * Processa as mensagens novas encontradas no Gmail.
 */
async function processEmails(gmail, whatsapp, state) {
  appLogger.debug('Iniciando ciclo de processamento.');

  try {
    const messages = await fetchNewMessages(gmail, {
      query: config.gmail.query,
      maxResults: config.gmail.maxResults,
    });

    if (!messages.length) {
      appLogger.debug('Nenhuma mensagem encontrada.');
      return;
    }

    appLogger.info(
      `Mensagens encontradas: ${messages.length}`
    );

    let stateChanged = false;

    for (const message of messages) {
      const messageId = message.id;

      if (!messageId) {
        appLogger.warn(
          'Mensagem recebida do Gmail sem ID. Ignorando.'
        );

        continue;
      }

      if (hasProcessed(state, messageId)) {
        appLogger.debug(
          'Mensagem já processada. Ignorando.',
          { messageId }
        );

        continue;
      }

      try {
        appLogger.info(
          'Processando nova mensagem.',
          { messageId }
        );

        /**
         * Busca o conteúdo completo da mensagem.
         */
        const rawMessage = await getMessage(
          gmail,
          messageId
        );

        /**
         * Faz o parsing do e-mail.
         */
        const parsedEmail = await parseGmailMessage(
          rawMessage
        );

        /**
         * Sanitiza o conteúdo antes de qualquer
         * processamento ou envio externo.
         */
        const sanitizedEmail = sanitizeEmail(
          parsedEmail
        );

        /**
         * Gera a mensagem final do alerta.
         */
        const alert = formatAlert(
          sanitizedEmail
        );

        /**
         * Envia para o bot WhatsApp existente.
         *
         * Se o WhatsApp estiver desabilitado,
         * o próprio cliente deve tratar essa condição.
         */
        const sendResult = await whatsapp.sendMessage(alert);

        /**
         * Não marca como processado quando o envio
         * foi ignorado por a integração estar desabilitada.
         */
        if (sendResult?.skipped) {
          appLogger.warn(
            'Mensagem não enviada ao WhatsApp. Mantida pendente.',
            { messageId }
          );

          continue;
        }

        /**
         * Só marca como processado depois que
         * o envio foi concluído com sucesso.
         */
        markProcessed(state, messageId);

        stateChanged = true;

        appLogger.info(
          'Mensagem processada com sucesso.',
          {
            messageId,
            subject: sanitizedEmail.subject,
          }
        );
      } catch (error) {
        /**
         * O erro de uma mensagem não deve interromper
         * o processamento das demais.
         */
        appLogger.error(
          'Erro ao processar mensagem.',
          {
            messageId,
            error: {
              name: error.name,
              message: error.message,
              stack: error.stack,
            },
          }
        );
      }
    }

    /**
     * Persiste o estado somente quando houve
     * alguma alteração.
     */
    if (stateChanged) {
      saveState(state);
    }
  } catch (error) {
    appLogger.error(
      'Erro durante o ciclo de processamento do Gmail.',
      error
    );
  }
}

/**
 * Captura as telas e prepara as mensagens dos checkpoints.
 *
 * Nesta etapa, as mensagens são registradas nos logs.
 * O envio pelo WhatsApp será integrado posteriormente.
 */
async function processCheckpoints(whatsapp) {
  if (!config.checkpoint.enabled) {
    return;
  }

  appLogger.info(
    'Iniciando processamento dos checkpoints.'
  );

  const results = await captureAll();

  const checkpoints = [
    {
      tool: 'gmail',
      screenshotPath: results.gmail,
    },
    {
      tool: 'grafana',
      screenshotPath: results.grafana,
    },
  ];

  for (const checkpoint of checkpoints) {
    if (!checkpoint.screenshotPath) {
      appLogger.warn(
        'Checkpoint sem screenshot. Ignorando mensagem.',
        {
          tool: checkpoint.tool,
        }
      );

      continue;
    }

    const message = formatCheckpointMessage(
      checkpoint.tool
    );

    appLogger.info(
      'Checkpoint preparado.',
      {
        tool: checkpoint.tool,
        screenshotPath: checkpoint.screenshotPath,
        message,
      }
    );

    try {
      appLogger.info(
        'Enviando checkpoint para o WhatsApp.',
        {
          tool: checkpoint.tool,
          screenshotPath: checkpoint.screenshotPath,
        }
      );

      const sendResult = await whatsapp.sendCheckpoint(
        message,
        checkpoint.screenshotPath
      );

      if (sendResult?.skipped) {
        appLogger.warn(
          'Checkpoint não enviado ao WhatsApp. Integração desabilitada.',
          {
            tool: checkpoint.tool,
          }
        );
      } else {
        appLogger.info(
          'Checkpoint enviado ao WhatsApp com sucesso.',
          {
            tool: checkpoint.tool,
          }
        );
      }
    } catch (error) {
      appLogger.error(
        'Erro ao enviar checkpoint ao WhatsApp.',
        {
          tool: checkpoint.tool,
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
        }
      );
    }
  }

  appLogger.info(
    'Processamento dos checkpoints concluído.'
  );
}

/**
 * Inicialização da aplicação.
 */
async function main() {
  registerGlobalErrorHandlers();

  appLogger.info(
    `Iniciando ${config.app.name}.`,
    {
      environment: config.app.environment,
      logLevel: config.log.level,
    }
  );

  /**
   * Inicializa o cliente Gmail.
   */
  const gmail = await createGmailClient();

  appLogger.info(
    'Cliente Gmail inicializado.'
  );

  /**
   * Inicializa o cliente HTTP do WhatsApp.
   */
  const whatsapp = new WhatsAppClient();

  if (config.whatsapp.enabled) {
    appLogger.info(
      'Integração com bot WhatsApp habilitada.',
      {
        apiUrl: config.whatsapp.apiUrl,
        groupId: config.whatsapp.groupId,
      }
    );
  } else {
    appLogger.warn(
      'Integração com bot WhatsApp desabilitada.'
    );
  }

  /**
   * Carrega o estado persistido.
   */
  const state = loadState();

  appLogger.info(
    'Estado da aplicação carregado.'
  );

  /**
   * Cria o agendador de monitoramento do Gmail.
   */
  scheduler = new Scheduler(
    createOperatingWindowGuard(
      () => processEmails(
        gmail,
        whatsapp,
        state
      ),
      'gmail'
    ),
    config.gmail.pollingInterval
  );

  /**
   * Inicia o monitoramento do Gmail.
   *
   * O Scheduler executa o primeiro ciclo imediatamente.
   */
  scheduler.start();

  /**
   * Cria e inicia o agendador de checkpoints.
   */
  if (config.checkpoint.enabled) {
    checkpointScheduler = new CheckpointScheduler(
      () => processCheckpoints(whatsapp),
      config.checkpoint.interval
    );

    /**
     * O CheckpointScheduler mantém os checkpoints
     * alinhados ao início de cada hora.
     */
    checkpointScheduler.start();

    appLogger.info(
      'Agendador de checkpoints iniciado.',
      {
        interval: config.checkpoint.interval,
      }
    );
  } else {
    appLogger.info(
      'Captura de checkpoints desabilitada.'
    );
  }

  appLogger.info(
    'MDG iniciado com sucesso.'
  );
}

/**
 * Encerramento controlado da aplicação.
 */
async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  appLogger.info(
    `Sinal ${signal} recebido. Encerrando aplicação.`
  );

  if (scheduler) {
    scheduler.stop();
  }

  if (checkpointScheduler) {
    checkpointScheduler.stop();
  }

  appLogger.info(
    'MDG encerrado.'
  );

  process.exit(0);
}

/**
 * Trata encerramento pelo systemd / terminal.
 */
process.once(
  'SIGTERM',
  () => shutdown('SIGTERM')
);

process.once(
  'SIGINT',
  () => shutdown('SIGINT')
);

/**
 * Inicia a aplicação.
 */
main().catch((error) => {
  appLogger.error(
    'Falha fatal durante a inicialização do MDG.',
    error
  );

  process.exit(1);
});
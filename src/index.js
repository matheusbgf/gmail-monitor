'use strict';

const config = require('./config');
const logger = require('./logger');

const {
  registerGlobalErrorHandlers,
} = require('./errors');

const WhatsAppClient = require('./whatsapp/client');
const CheckpointScheduler = require('./scheduler/checkpoint');

const {
  captureAll,
} = require('./checkpoint/capture');

const {
  formatCheckpointMessage,
} = require('./checkpoint/formatter');

const appLogger = logger.child('APP');

let checkpointScheduler;
let shuttingDown = false;

/**
 * Processa os checkpoints.
 *
 * Captura Gmail e Grafana e envia os screenshots
 * para o bot WhatsApp remoto.
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
      nodeEnv: config.app.nodeEnv,
      logLevel: config.log.level,
    }
  );

  /**
   * Inicializa o cliente HTTP do WhatsApp remoto.
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

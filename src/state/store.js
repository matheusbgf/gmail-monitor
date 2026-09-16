'use strict';

const fs = require('node:fs');
const path = require('node:path');

const config = require('../config');
const logger = require('../logger');

const stateLogger = logger.child('STATE');

const MAX_PROCESSED_MESSAGES = 1000;

/**
 * Garante que o diretório do arquivo de estado exista.
 */
function ensureDirectory() {
  const statePath = path.resolve(
    config.state.path
  );

  const directory = path.dirname(
    statePath
  );

  fs.mkdirSync(directory, {
    recursive: true,
  });

  return statePath;
}

/**
 * Cria o estado inicial.
 */
function createInitialState() {
  return {
    version: 1,
    processed: {},
  };
}

/**
 * Carrega o estado persistido.
 */
function loadState() {
  const statePath =
    ensureDirectory();

  if (!fs.existsSync(statePath)) {
    stateLogger.info(
      'Arquivo de estado não existe. Criando estado inicial.'
    );

    return createInitialState();
  }

  try {
    const content =
      fs.readFileSync(
        statePath,
        'utf8'
      );

    if (!content.trim()) {
      stateLogger.warn(
        'Arquivo de estado vazio. Usando estado inicial.'
      );

      return createInitialState();
    }

    const state =
      JSON.parse(content);

    if (
      !state ||
      typeof state !== 'object'
    ) {
      throw new Error(
        'Formato de estado inválido'
      );
    }

    if (
      !state.processed ||
      typeof state.processed !== 'object'
    ) {
      state.processed = {};
    }

    stateLogger.debug(
      'Estado carregado',
      {
        processed:
          Object.keys(
            state.processed
          ).length,
      }
    );

    return state;
  } catch (error) {
    stateLogger.error(
      'Falha ao carregar arquivo de estado',
      error
    );

    /*
     * Não interrompe a aplicação.
     * Um estado inválido significa que podemos
     * processar novamente mensagens antigas,
     * mas não devemos derrubar o monitor.
     */
    return createInitialState();
  }
}

/**
 * Salva o estado de forma atômica.
 *
 * Primeiro grava em .tmp e somente depois
 * substitui o arquivo original.
 */
function saveState(state) {
  const statePath =
    ensureDirectory();

  const temporaryPath =
    `${statePath}.tmp`;

  try {
    fs.writeFileSync(
      temporaryPath,
      JSON.stringify(
        state,
        null,
        2
      ),
      {
        encoding: 'utf8',
        mode: 0o600,
      }
    );

    fs.renameSync(
      temporaryPath,
      statePath
    );

    stateLogger.debug(
      'Estado salvo',
      {
        processed:
          Object.keys(
            state.processed
          ).length,
      }
    );
  } catch (error) {
    /*
     * Remove arquivo temporário caso
     * a gravação tenha falhado.
     */
    try {
      if (
        fs.existsSync(
          temporaryPath
        )
      ) {
        fs.unlinkSync(
          temporaryPath
        );
      }
    } catch {
      // Não sobrescreve o erro original.
    }

    stateLogger.error(
      'Falha ao salvar estado',
      error
    );

    throw error;
  }
}

/**
 * Verifica se uma mensagem já foi processada.
 */
function hasProcessed(
  state,
  messageId
) {
  if (
    !state ||
    !state.processed ||
    !messageId
  ) {
    return false;
  }

  return Object.prototype.hasOwnProperty.call(
    state.processed,
    messageId
  );
}

/**
 * Marca uma mensagem como processada.
 */
function markProcessed(
  state,
  messageId
) {
  if (!state) {
    throw new Error(
      'Estado não informado'
    );
  }

  if (!messageId) {
    throw new Error(
      'ID da mensagem não informado'
    );
  }

  if (!state.processed) {
    state.processed = {};
  }

  state.processed[messageId] =
    new Date().toISOString();

  cleanupState(state);
}

/**
 * Mantém somente os registros mais recentes.
 */
function cleanupState(state) {
  const entries =
    Object.entries(
      state.processed
    );

  if (
    entries.length <=
    MAX_PROCESSED_MESSAGES
  ) {
    return;
  }

  entries
    .sort(
      (a, b) =>
        new Date(a[1]).getTime() -
        new Date(b[1]).getTime()
    )
    .slice(
      0,
      entries.length -
        MAX_PROCESSED_MESSAGES
    )
    .forEach(
      ([messageId]) => {
        delete state.processed[
          messageId
        ];
      }
    );
}

module.exports = {
  loadState,
  saveState,
  hasProcessed,
  markProcessed,
};
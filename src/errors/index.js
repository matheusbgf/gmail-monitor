'use strict';

const logger = require('../logger');

const errorLogger = logger.child('ERROR_HANDLER');

let shuttingDown = false;

/**
 * Trata exceções síncronas não capturadas.
 */
function handleUncaughtException(error) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  errorLogger.error(
    'Exceção não capturada. Encerrando processo.',
    error
  );

  process.exitCode = 1;

  setImmediate(() => {
    process.exit(1);
  });
}

/**
 * Trata Promises rejeitadas sem tratamento.
 */
function handleUnhandledRejection(reason) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  if (reason instanceof Error) {
    errorLogger.error(
      'Promise rejeitada sem tratamento.',
      reason
    );
  } else {
    errorLogger.error(
      'Promise rejeitada sem tratamento.',
      {
        reason,
      }
    );
  }

  process.exitCode = 1;

  setImmediate(() => {
    process.exit(1);
  });
}

/**
 * Registra os handlers globais.
 */
function registerGlobalErrorHandlers() {
  process.on(
    'uncaughtException',
    handleUncaughtException
  );

  process.on(
    'unhandledRejection',
    handleUnhandledRejection
  );

  errorLogger.info(
    'Tratamento global de erros inicializado'
  );
}

module.exports = {
  registerGlobalErrorHandlers,
};

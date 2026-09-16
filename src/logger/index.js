'use strict';

const config = require('../config');

const LEVELS = Object.freeze({
  DEBUG: 10,
  INFO: 20,
  WARN: 30,
  ERROR: 40,
});

function shouldLog(level) {
  return (
    LEVELS[level] >=
    LEVELS[config.log.level]
  );
}

function normalizeError(error) {
  if (!(error instanceof Error)) {
    return null;
  }

  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };
}

function serializeMetadata(metadata) {
  if (
    metadata === undefined ||
    metadata === null
  ) {
    return '';
  }

  try {
    return ` ${JSON.stringify(metadata)}`;
  } catch {
    return ' {"metadata":"[unserializable]"}';
  }
}

function write(
  level,
  module,
  message,
  metadata
) {
  if (!shouldLog(level)) {
    return;
  }

  const timestamp =
    new Date().toISOString();

  let extra = metadata;

  if (metadata instanceof Error) {
    extra = {
      error: normalizeError(metadata),
    };
  }

  const line =
    `${timestamp} [${level}] ` +
    `[${module}] ${message}` +
    serializeMetadata(extra);

  if (level === 'ERROR') {
    process.stderr.write(
      `${line}\n`
    );

    return;
  }

  process.stdout.write(
    `${line}\n`
  );
}

function createLogger(moduleName = 'APP') {
  const module =
    String(moduleName).trim() || 'APP';

  return Object.freeze({
    debug(message, metadata) {
      write(
        'DEBUG',
        module,
        message,
        metadata
      );
    },

    info(message, metadata) {
      write(
        'INFO',
        module,
        message,
        metadata
      );
    },

    warn(message, metadata) {
      write(
        'WARN',
        module,
        message,
        metadata
      );
    },

    error(message, metadata) {
      write(
        'ERROR',
        module,
        message,
        metadata
      );
    },
  });
}

const logger = createLogger('APP');

module.exports = Object.freeze({
  debug: logger.debug,
  info: logger.info,
  warn: logger.warn,
  error: logger.error,

  child(moduleName) {
    return createLogger(moduleName);
  },
});
'use strict';

const path = require('node:path');

require('dotenv').config();

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `Variável de ambiente obrigatória não definida: ${name}`
    );
  }

  return value;
}

function getBooleanEnv(name, defaultValue = false) {
  const value = process.env[name];

  if (value === undefined || value === '') {
    return defaultValue;
  }

  return value.toLowerCase() === 'true';
}

function getNumberEnv(name, defaultValue) {
  const value = process.env[name];

  if (value === undefined || value === '') {
    return defaultValue;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new Error(
      `Variável de ambiente inválida: ${name}`
    );
  }

  return number;
}

const config = {
  app: {
    name: getRequiredEnv('APP_NAME'),
    nodeEnv: getRequiredEnv('NODE_ENV'),
  },

  log: {
    level: getRequiredEnv('LOG_LEVEL'),
  },

  gmail: {
    credentialsPath: path.resolve(
      getRequiredEnv('GMAIL_CREDENTIALS_PATH')
    ),

    tokenPath: path.resolve(
      getRequiredEnv('GMAIL_TOKEN_PATH')
    ),

    query: getRequiredEnv('GMAIL_QUERY'),

    maxResults: getNumberEnv(
      'GMAIL_MAX_RESULTS',
      20
    ),

    pollingInterval: getNumberEnv(
      'GMAIL_POLLING_INTERVAL',
      30000
    ),
  },

  whatsapp: {
    enabled: getBooleanEnv(
      'WHATSAPP_ENABLED',
      false
    ),

    apiUrl: getRequiredEnv(
      'WHATSAPP_API_URL'
    ),

    apiToken:
      process.env.WHATSAPP_API_TOKEN || '',

    groupId:
      process.env.WHATSAPP_GROUP_ID || '',

    messageType: getNumberEnv(
      'WHATSAPP_MESSAGE_TYPE',
      2
    ),

    apiTimeout: getNumberEnv(
      'WHATSAPP_API_TIMEOUT',
      10000
    ),
  },

  state: {
    path: path.resolve(
      getRequiredEnv('STATE_PATH')
    ),
  },

  checkpoint: {
    enabled: getBooleanEnv(
      'CHECKPOINT_ENABLED',
      true
    ),

    interval: getNumberEnv(
      'CHECKPOINT_INTERVAL',
      3600000
    ),

    gmailUrl: getRequiredEnv(
      'CHECKPOINT_GMAIL_URL'
    ),

    grafanaUrl:
      process.env.CHECKPOINT_GRAFANA_URL || '',

    browserHeadless: getBooleanEnv(
      'CHECKPOINT_BROWSER_HEADLESS',
      true
    ),

    browserDataDir: path.resolve(
      getRequiredEnv(
        'CHECKPOINT_BROWSER_DATA_DIR'
      )
    ),

    screenshotDir: path.resolve(
      getRequiredEnv(
        'CHECKPOINT_SCREENSHOT_DIR'
      )
    ),
  },
};

module.exports = config;
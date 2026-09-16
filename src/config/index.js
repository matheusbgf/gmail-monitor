'use strict';

const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config();

/**
 * Retorna uma variável de ambiente.
 */
function getEnv(name, defaultValue = undefined) {
  const value = process.env[name];

  if (value === undefined || value.trim() === '') {
    return defaultValue;
  }

  return value.trim();
}

/**
 * Retorna uma variável obrigatória.
 */
function getRequiredEnv(name) {
  const value = getEnv(name);

  if (!value) {
    throw new Error(
      `Variável de ambiente obrigatória não definida: ${name}`
    );
  }

  return value;
}

/**
 * Converte variável de ambiente para inteiro.
 */
function getIntegerEnv(name, defaultValue) {
  const value = getEnv(name);

  if (value === undefined) {
    return defaultValue;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed)) {
    throw new Error(
      `A variável ${name} deve ser um número inteiro. ` +
      `Valor recebido: "${value}"`
    );
  }

  return parsed;
}

/**
 * Converte variável de ambiente para boolean.
 */
function getBooleanEnv(name, defaultValue = false) {
  const value = getEnv(name);

  if (value === undefined) {
    return defaultValue;
  }

  const normalized = value.toLowerCase();

  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  throw new Error(
    `A variável ${name} deve ser "true" ou "false". ` +
    `Valor recebido: "${value}"`
  );
}

/**
 * Valida nível de log.
 */
function getLogLevel() {
  const value = getEnv(
    'LOG_LEVEL',
    'INFO'
  ).toUpperCase();

  const allowedLevels = [
    'DEBUG',
    'INFO',
    'WARN',
    'ERROR',
  ];

  if (!allowedLevels.includes(value)) {
    throw new Error(
      `LOG_LEVEL inválido: "${value}". ` +
      `Valores permitidos: ${allowedLevels.join(', ')}`
    );
  }

  return value;
}

/**
 * Valida intervalo de polling do Gmail.
 */
function getPollingInterval() {
  const value = getIntegerEnv(
    'GMAIL_POLLING_INTERVAL',
    30000
  );

  if (value < 1000) {
    throw new Error(
      'GMAIL_POLLING_INTERVAL deve ser no mínimo 1000 ms.'
    );
  }

  return value;
}

/**
 * Valida quantidade máxima de mensagens.
 */
function getMaxResults() {
  const value = getIntegerEnv(
    'GMAIL_MAX_RESULTS',
    20
  );

  if (value < 1 || value > 500) {
    throw new Error(
      'GMAIL_MAX_RESULTS deve estar entre 1 e 500.'
    );
  }

  return value;
}

/**
 * Valida tipo de mensagem aceito pelo bot WhatsApp.
 *
 * 1 = checkpoint/imagem
 * 2 = alerta de texto
 */
function getWhatsAppMessageType() {
  const value = getIntegerEnv(
    'WHATSAPP_MESSAGE_TYPE',
    2
  );

  if (![1, 2].includes(value)) {
    throw new Error(
      'WHATSAPP_MESSAGE_TYPE deve ser 1 ou 2.'
    );
  }

  return value;
}

/**
 * Valida timeout da API WhatsApp.
 */
function getWhatsAppApiTimeout() {
  const value = getIntegerEnv(
    'WHATSAPP_API_TIMEOUT',
    10000
  );

  if (value < 1000) {
    throw new Error(
      'WHATSAPP_API_TIMEOUT deve ser no mínimo 1000 ms.'
    );
  }

  return value;
}

const whatsappEnabled = getBooleanEnv(
  'WHATSAPP_ENABLED',
  false
);

const config = Object.freeze({
  /**
   * Configurações gerais da aplicação.
   */
  app: Object.freeze({
    name: getEnv(
      'APP_NAME',
      'gmail-monitor'
    ),

    environment: getEnv(
      'NODE_ENV',
      'production'
    ),
  }),

  /**
   * Configurações do logger.
   */
  log: Object.freeze({
    level: getLogLevel(),
  }),

  /**
   * Configurações do Gmail.
   */
  gmail: Object.freeze({
    credentialsPath: path.resolve(
      getEnv(
        'GMAIL_CREDENTIALS_PATH',
        './credentials/credentials.json'
      )
    ),

    tokenPath: path.resolve(
      getEnv(
        'GMAIL_TOKEN_PATH',
        './credentials/token.json'
      )
    ),

    query: getEnv(
      'GMAIL_QUERY',
      'is:unread'
    ),

    maxResults: getMaxResults(),

    pollingInterval: getPollingInterval(),
  }),

  /**
   * Configurações do bot WhatsApp existente.
   *
   * O MDG não mantém uma sessão própria do WhatsApp.
   * Ele utiliza a API HTTP do bot existente.
   */
  whatsapp: Object.freeze({
    enabled: whatsappEnabled,

    apiUrl: getEnv(
      'WHATSAPP_API_URL',
      'http://127.0.0.1:3241'
    ),

    apiToken: getEnv(
      'WHATSAPP_API_TOKEN'
    ),

    groupId: getEnv(
      'WHATSAPP_GROUP_ID'
    ),

    messageType: getWhatsAppMessageType(),

    apiTimeout: getWhatsAppApiTimeout(),
  }),

  /**
   * Persistência do estado de processamento.
   */
  state: Object.freeze({
    path: path.resolve(
      getEnv(
        'STATE_PATH',
        './data/state.json'
      )
    ),
  }),
});

module.exports = config;
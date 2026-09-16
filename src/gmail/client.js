'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { google } = require('googleapis');
const { authenticate } = require('@google-cloud/local-auth');

const config = require('../config');
const logger = require('../logger');

const gmailLogger = logger.child('GMAIL_CLIENT');

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
];

/**
 * Verifica se o arquivo de credenciais existe.
 */
function validateCredentials() {
  const credentialsPath = path.resolve(
    config.gmail.credentialsPath
  );

  if (!fs.existsSync(credentialsPath)) {
    throw new Error(
      `Credenciais do Gmail não encontradas: ${credentialsPath}`
    );
  }

  return credentialsPath;
}

/**
 * Cria um cliente autenticado da Gmail API.
 */
async function createGmailClient() {
  const credentialsPath =
    validateCredentials();

  const tokenPath = path.resolve(
    config.gmail.tokenPath
  );

  fs.mkdirSync(
    path.dirname(tokenPath),
    {
      recursive: true,
    }
  );

  gmailLogger.info(
    'Criando cliente da Gmail API'
  );

  gmailLogger.debug(
    'Configuração do cliente Gmail',
    {
      credentialsPath,
      tokenPath,
      scopes: SCOPES,
    }
  );

  try {
    const auth = await authenticate({
      scopes: SCOPES,
      keyfilePath: credentialsPath,
      tokenPath,
    });

    const gmail = google.gmail({
      version: 'v1',
      auth,
    });

    gmailLogger.info(
      'Cliente da Gmail API criado com sucesso'
    );

    return gmail;
  } catch (error) {
    gmailLogger.error(
      'Falha ao criar cliente da Gmail API',
      error
    );

    throw error;
  }
}

module.exports = {
  createGmailClient,
};
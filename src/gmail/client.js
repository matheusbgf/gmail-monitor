'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { google } = require('googleapis');

const config = require('../config');
const logger = require('../logger');
const { authenticateGmail } = require('./auth');

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
 *
 * A autenticação é realizada pelo módulo auth.js,
 * que utiliza o token OAuth salvo em credentials/token.json.
 */
async function createGmailClient() {
  const credentialsPath = validateCredentials();

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
    /**
     * O auth.js:
     * - carrega o credentials.json;
     * - reutiliza o token.json se existir;
     * - realiza OAuth somente se necessário.
     */
    const auth = await authenticateGmail();

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

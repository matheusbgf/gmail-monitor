'use strict';

const fs = require('node:fs');
const path = require('node:path');

const {
  authenticate,
} = require('@google-cloud/local-auth');

const config = require('../config');
const logger = require('../logger');

const authLogger = logger.child('GMAIL_AUTH');

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
];

/**
 * Verifica se o arquivo de credenciais existe.
 */
function validateCredentialsFile() {
  const credentialsPath = path.resolve(
    config.gmail.credentialsPath
  );

  if (!fs.existsSync(credentialsPath)) {
    throw new Error(
      `Arquivo de credenciais Gmail não encontrado: ${credentialsPath}`
    );
  }

  return credentialsPath;
}

/**
 * Autentica a aplicação na API do Gmail.
 *
 * Na primeira execução:
 * - abre o navegador;
 * - solicita autorização;
 * - gera o token OAuth.
 *
 * Nas próximas execuções:
 * - reutiliza o token salvo.
 */
async function authenticateGmail() {
  const credentialsPath =
    validateCredentialsFile();

  const tokenPath = path.resolve(
    config.gmail.tokenPath
  );

  const tokenDirectory =
    path.dirname(tokenPath);

  fs.mkdirSync(
    tokenDirectory,
    {
      recursive: true,
    }
  );

  authLogger.info(
    'Iniciando autenticação OAuth do Gmail'
  );

  authLogger.debug(
    'Configuração de autenticação',
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

    authLogger.info(
      'Autenticação OAuth do Gmail concluída'
    );

    return auth;
  } catch (error) {
    authLogger.error(
      'Falha durante autenticação OAuth do Gmail',
      error
    );

    throw error;
  }
}

/**
 * Executa autenticação diretamente pelo terminal.
 *
 * Uso:
 *
 * npm run auth:gmail
 */
async function main() {
  try {
    await authenticateGmail();

    authLogger.info(
      'Token Gmail disponível para a aplicação'
    );

    process.exitCode = 0;
  } catch (error) {
    authLogger.error(
      'Não foi possível autenticar no Gmail',
      error
    );

    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  authenticateGmail,
  SCOPES,
};
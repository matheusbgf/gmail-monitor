'use strict';

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { execFile } = require('node:child_process');
const { google } = require('googleapis');

const config = require('../config');
const logger = require('../logger');

const authLogger = logger.child('GMAIL_AUTH');

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
];

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

function loadCredentials() {
  const credentialsPath = validateCredentialsFile();

  const data = JSON.parse(
    fs.readFileSync(credentialsPath, 'utf8')
  );

  const keys = data.installed || data.web;

  if (!keys) {
    throw new Error(
      'credentials.json não possui configuração installed ou web.'
    );
  }

  if (!keys.client_id || !keys.client_secret) {
    throw new Error(
      'credentials.json não possui client_id ou client_secret.'
    );
  }

  return keys;
}

function loadSavedToken(tokenPath) {
  if (!fs.existsSync(tokenPath)) {
    return null;
  }

  try {
    return JSON.parse(
      fs.readFileSync(tokenPath, 'utf8')
    );
  } catch (error) {
    authLogger.warn(
      'Token existente inválido. Será realizada nova autenticação.',
      {
        error: error.message,
      }
    );

    return null;
  }
}

function saveToken(tokenPath, tokens) {
  fs.mkdirSync(
    path.dirname(tokenPath),
    {
      recursive: true,
    }
  );

  fs.writeFileSync(
    tokenPath,
    JSON.stringify(tokens, null, 2),
    {
      encoding: 'utf8',
      mode: 0o600,
    }
  );

  authLogger.info(
    'Token OAuth salvo com sucesso.',
    {
      tokenPath,
    }
  );
}

function openBrowser(url) {
  return new Promise((resolve, reject) => {
    let command;
    let args;

    if (process.platform === 'linux') {
      command = 'xdg-open';
      args = [url];
    } else if (process.platform === 'darwin') {
      command = 'open';
      args = [url];
    } else if (process.platform === 'win32') {
      command = 'cmd';
      args = ['/c', 'start', '', url];
    } else {
      reject(
        new Error(
          `Sistema operacional não suportado para abertura automática do navegador: ${process.platform}`
        )
      );
      return;
    }

    execFile(
      command,
      args,
      {
        windowsHide: true,
      },
      (error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      }
    );
  });
}

async function authenticateGmail() {
  const credentials = loadCredentials();

  const tokenPath = path.resolve(
    config.gmail.tokenPath
  );

  authLogger.info(
    'Iniciando autenticação OAuth do Gmail'
  );

  authLogger.debug(
    'Configuração de autenticação',
    {
      credentialsPath: path.resolve(
        config.gmail.credentialsPath
      ),
      tokenPath,
      scopes: SCOPES,
    }
  );

  const savedToken = loadSavedToken(tokenPath);

  const oauth2Client = new google.auth.OAuth2(
    credentials.client_id,
    credentials.client_secret
  );

  if (savedToken) {
    oauth2Client.setCredentials(savedToken);

    authLogger.info(
      'Token OAuth existente carregado.'
    );

    return oauth2Client;
  }

  return new Promise((resolve, reject) => {
    let finished = false;

    const server = http.createServer(
      async (req, res) => {
        try {
          const requestUrl = new URL(
            req.url,
            'http://localhost'
          );

          if (requestUrl.pathname !== '/') {
            res.writeHead(404);
            res.end('Not Found');
            return;
          }

          const error = requestUrl.searchParams.get(
            'error'
          );

          if (error) {
            res.writeHead(400);
            res.end(
              'Autorização rejeitada. Pode fechar esta aba.'
            );

            throw new Error(
              `Autorização do Gmail rejeitada: ${error}`
            );
          }

          const code = requestUrl.searchParams.get(
            'code'
          );

          if (!code) {
            res.writeHead(400);
            res.end(
              'Código de autorização não encontrado.'
            );

            throw new Error(
              'Código de autorização não encontrado no callback do Google.'
            );
          }

          const port = server.address().port;

          const redirectUri =
            `http://localhost:${port}`;

          oauth2Client.redirectUri = redirectUri;

          authLogger.info(
            'Callback OAuth recebido.',
            {
              redirectUri,
            }
          );

          const { tokens } =
            await oauth2Client.getToken({
              code,
              redirect_uri: redirectUri,
            });

          oauth2Client.setCredentials(tokens);

          saveToken(
            tokenPath,
            tokens
          );

          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
          });

          res.end(`
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
              <meta charset="UTF-8">
              <title>MDG Gmail Monitor</title>
            </head>
            <body>
              <h2>Autenticação concluída!</h2>
              <p>O Gmail foi autorizado para o MDG.</p>
              <p>Você pode fechar esta aba.</p>
            </body>
            </html>
          `);

          finished = true;

          authLogger.info(
            'Autenticação OAuth do Gmail concluída.'
          );

          server.close(() => {
            resolve(oauth2Client);
          });
        } catch (error) {
          if (!finished) {
            finished = true;

            authLogger.error(
              'Falha durante o callback OAuth.',
              error
            );

            try {
              res.writeHead(500);
              res.end(
                'Erro durante a autenticação. Consulte o terminal.'
              );
            } catch {}

            server.close(() => {
              reject(error);
            });
          }
        }
      }
    );

    server.on('error', (error) => {
      if (finished) {
        return;
      }

      finished = true;

      authLogger.error(
        'Erro no servidor local OAuth.',
        error
      );

      reject(error);
    });

    server.listen(
      0,
      '127.0.0.1',
      async () => {
        try {
          const port = server.address().port;

          const redirectUri =
            `http://localhost:${port}`;

          oauth2Client.redirectUri =
            redirectUri;

          const authorizeUrl =
            oauth2Client.generateAuthUrl({
              access_type: 'offline',
              scope: SCOPES,
              prompt: 'consent',
              redirect_uri: redirectUri,
            });

          authLogger.info(
            'Servidor OAuth iniciado.',
            {
              port,
              redirectUri,
            }
          );

          authLogger.info(
            'Abrindo navegador para autorização do Gmail.'
          );

          await openBrowser(authorizeUrl);
        } catch (error) {
          if (finished) {
            return;
          }

          finished = true;

          authLogger.error(
            'Não foi possível abrir o navegador.',
            error
          );

          server.close(() => {
            reject(error);
          });
        }
      }
    );
  });
}

async function main() {
  try {
    await authenticateGmail();

    authLogger.info(
      'Token Gmail disponível para a aplicação.'
    );

    process.exitCode = 0;
  } catch (error) {
    authLogger.error(
      'Não foi possível autenticar no Gmail.',
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

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');

const config = require('./config');
const logger = require('./logger');
const {
  ensurePrivateBrowserProfile,
} = require('./checkpoint/profile');

const startupLogger = logger.child('STARTUP');
const appEntry = path.join(__dirname, 'index.js');
let appProcess = null;
let chromeProcess = null;
let ownsChrome = false;
let shuttingDown = false;

function getCdpUrls() {
  const endpoint = new URL(
    config.checkpoint.browserCdpEndpoint
  );

  if (
    endpoint.protocol !== 'http:' ||
    endpoint.hostname !== '127.0.0.1'
  ) {
    throw new Error(
      'A porta de depuração do Chrome deve permanecer restrita a 127.0.0.1.'
    );
  }

  const versionUrl = new URL('/json/version', endpoint);

  if (!endpoint.port) {
    throw new Error(
      'O endpoint CDP precisa informar a porta local do Chrome.'
    );
  }

  return {
    endpoint: endpoint.toString().replace(/\/$/, ''),
    versionUrl: versionUrl.toString(),
    port: endpoint.port,
  };
}

async function readCdpVersion(versionUrl) {
  let response;

  try {
    response = await fetch(
      versionUrl,
      {
        signal: AbortSignal.timeout(1000),
      }
    );
  } catch {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `A porta de depuração respondeu com HTTP ${response.status}.`
    );
  }

  let details;

  try {
    details = await response.json();
  } catch {
    throw new Error(
      'A porta configurada respondeu, mas não retornou informações do Chrome DevTools.'
    );
  }

  if (typeof details.webSocketDebuggerUrl !== 'string') {
    throw new Error(
      'A porta 9222 está ocupada por um serviço que não é o Chrome DevTools.'
    );
  }

  return details;
}

async function waitForChrome(versionUrl, child) {
  const deadline = Date.now() + 30000;

  while (Date.now() < deadline) {
    if (hasExited(child)) {
      throw new Error(
        'O Chrome encerrou antes de disponibilizar a porta de depuração.'
      );
    }

    const details = await readCdpVersion(versionUrl);

    if (details) {
      return details;
    }

    await delay(500);
  }

  throw new Error(
    'O Chrome não disponibilizou a porta 9222 em 30 segundos.'
  );
}

async function launchChrome(endpoint, versionUrl, port) {
  const profileDir = config.checkpoint.browserDataDir;
  const profileLock = path.join(profileDir, 'SingletonLock');

  if (fs.existsSync(profileLock)) {
    throw new Error(
      'O perfil do Chrome já está aberto sem a porta de depuração. Feche essa janela do Chrome e rode npm start novamente.'
    );
  }

  ensurePrivateBrowserProfile(profileDir);

  startupLogger.info(
    'Iniciando o Chrome com o perfil persistente do monitor.',
    {
      executable: config.checkpoint.browserExecutable,
      profileDir,
    }
  );

  chromeProcess = spawn(
    config.checkpoint.browserExecutable,
    [
      '--remote-debugging-address=127.0.0.1',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      config.checkpoint.gmailUrl,
    ],
    {
      stdio: 'ignore',
    }
  );

  await new Promise((resolve, reject) => {
    const onSpawn = () => {
      chromeProcess.off('error', onError);
      resolve();
    };

    const onError = error => {
      chromeProcess.off('spawn', onSpawn);
      reject(error);
    };

    chromeProcess.once('spawn', onSpawn);
    chromeProcess.once('error', onError);
  });

  ownsChrome = true;

  const details = await waitForChrome(versionUrl, chromeProcess);

  startupLogger.info(
    'Chrome pronto para o monitor.',
    {
      endpoint,
      browser: details.Browser,
    }
  );
}

function hasExited(child) {
  return Boolean(
    child &&
    (child.exitCode !== null || child.signalCode !== null)
  );
}

function waitForExit(child, timeoutMs) {
  return new Promise(resolve => {
    if (hasExited(child)) {
      resolve(true);
      return;
    }

    const onExit = () => {
      clearTimeout(timer);
      resolve(true);
    };

    const timer = setTimeout(() => {
      child.off('exit', onExit);
      resolve(false);
    }, timeoutMs);

    child.once('exit', onExit);
  });
}

async function stopChrome() {
  if (!ownsChrome || hasExited(chromeProcess)) {
    return;
  }

  startupLogger.info(
    'Encerrando o Chrome iniciado pelo npm start.'
  );

  chromeProcess.kill('SIGTERM');

  const stopped = await waitForExit(chromeProcess, 5000);

  if (!stopped) {
    chromeProcess.kill('SIGKILL');
    await waitForExit(chromeProcess, 1000);
  }
}

async function startMonitor() {
  if (ownsChrome && hasExited(chromeProcess)) {
    throw new Error(
      'O Chrome foi encerrado antes de o monitor iniciar.'
    );
  }

  appProcess = spawn(
    process.execPath,
    [appEntry],
    {
      env: process.env,
      stdio: 'inherit',
    }
  );

  const child = appProcess;

  return new Promise((resolve, reject) => {
    const forwardSignal = signal => {
      shuttingDown = true;

      if (child.exitCode === null && child.signalCode === null) {
        child.kill(signal);
      }
    };

    const onInterrupt = () => forwardSignal('SIGINT');
    const onTerminate = () => forwardSignal('SIGTERM');

    const onChromeExit = () => {
      if (shuttingDown || child.exitCode !== null) {
        return;
      }

      startupLogger.error(
        'O Chrome encerrou durante a execução; encerrando o monitor.'
      );
      child.kill('SIGTERM');
    };

    const cleanup = () => {
      process.off('SIGINT', onInterrupt);
      process.off('SIGTERM', onTerminate);

      if (ownsChrome && chromeProcess) {
        chromeProcess.off('exit', onChromeExit);
      }

      appProcess = null;
    };

    process.once('SIGINT', onInterrupt);
    process.once('SIGTERM', onTerminate);

    if (ownsChrome && chromeProcess) {
      chromeProcess.once('exit', onChromeExit);
    }

    child.once('error', error => {
      cleanup();
      reject(error);
    });

    child.once('exit', (code, signal) => {
      cleanup();
      resolve({ code, signal });
    });
  });
}

async function main() {
  try {
    if (config.checkpoint.browserCdpEnabled) {
      const { endpoint, versionUrl, port } = getCdpUrls();
      let details = await readCdpVersion(versionUrl);

      if (details) {
        startupLogger.info(
          'Usando Chrome já disponível na porta de depuração.',
          {
            endpoint,
            browser: details.Browser,
          }
        );
      } else {
        await launchChrome(endpoint, versionUrl, port);
        details = await readCdpVersion(versionUrl);

        if (!details) {
          throw new Error(
            'A porta 9222 deixou de responder antes de o monitor iniciar.'
          );
        }
      }
    }

    const result = await startMonitor();
    process.exitCode = result.code ?? 1;
  } finally {
    await stopChrome();
  }
}

main().catch(error => {
  startupLogger.error(
    'Falha ao iniciar o monitor.',
    {
      message: error.message,
    }
  );
  process.exitCode = 1;
});

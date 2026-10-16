'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { chromium } = require('playwright');

const config = require('../config');
const logger = require('../logger');
const {
  ensurePrivateBrowserProfile,
} = require('./profile');

const checkpointLogger =
  logger.child('CHECKPOINT_CAPTURE');

let browserContext = null;

function getScreenshotDir() {
  return path.resolve(
    config.checkpoint.screenshotDir
  );
}

function ensureDirectories() {
  fs.mkdirSync(
    getScreenshotDir(),
    {
      recursive: true,
    }
  );
}

async function getBrowserContext() {
  if (browserContext) {
    return browserContext;
  }

  ensureDirectories();
  ensurePrivateBrowserProfile(
    config.checkpoint.browserDataDir
  );

  checkpointLogger.info(
    'Iniciando o perfil persistente do navegador.',
    {
      headless: config.checkpoint.browserHeadless,
      dataDir: config.checkpoint.browserDataDir,
    }
  );

  browserContext =
    await chromium.launchPersistentContext(
      config.checkpoint.browserDataDir,
      {
        headless: config.checkpoint.browserHeadless,
        viewport: {
          width: 1920,
          height: 1080,
        },
      }
    );

  checkpointLogger.info(
    'Perfil persistente do navegador iniciado.'
  );

  return browserContext;
}

async function capturePage(
  page,
  url,
  filename
) {
  if (!url) {
    throw new Error(
      `URL não configurada para captura: ${filename}`
    );
  }

  checkpointLogger.info(
    'Abrindo página para captura.',
    {
      url,
    }
  );

  await page.goto(
    url,
    {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    }
  );

  await page.waitForTimeout(3000);

  const currentUrl = new URL(page.url());
  if (
    currentUrl.hostname === 'accounts.google.com' ||
    /\/(login|signin)\/?$/i.test(currentUrl.pathname)
  ) {
    throw new Error(
      `Sessão não autenticada para ${filename}; o perfil salvo precisa de autorização.`
    );
  }

  const screenshotPath =
    path.join(
      getScreenshotDir(),
      filename
    );

  await page.screenshot({
    path: screenshotPath,
    fullPage: true,
    timeout: 60000,
    animations: 'disabled',
    style: '* { font-family: Arial, sans-serif !important; }',
  });

  checkpointLogger.info(
    'Screenshot capturada.',
    {
      url,
      screenshotPath,
    }
  );

  return screenshotPath;
}

async function captureGmail() {
  const context =
    await getBrowserContext();

  const pages = context.pages();
  const page = pages.find(
      currentPage =>
        currentPage
          .url()
          .includes(
            'mail.google.com/mail/'
          )
    ) || pages[0] || await context.newPage();

  checkpointLogger.info(
    'Abrindo Gmail com o perfil persistente.',
    {
      url: config.checkpoint.gmailUrl,
    }
  );

  await page.goto(
    config.checkpoint.gmailUrl,
    {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    }
  );

  checkpointLogger.info(
    'Página do Gmail carregada.'
  );

  await page.waitForTimeout(3000);

  const currentUrl = new URL(page.url());
  if (currentUrl.hostname !== 'mail.google.com') {
    throw new Error(
      'Sessão do Gmail não autenticada; o perfil salvo precisa de autorização.'
    );
  }

  const screenshotPath =
    path.join(
      getScreenshotDir(),
      'gmail.png'
    );

  await page.screenshot({
    path: screenshotPath,
    fullPage: true,
    timeout: 60000,
    animations: 'disabled',
    style: '* { font-family: Arial, sans-serif !important; }',
  });

  checkpointLogger.info(
    'Screenshot do Gmail capturada.',
    {
      screenshotPath,
    }
  );

  return screenshotPath;
}

async function captureGrafana() {
  const context =
    await getBrowserContext();

  const page =
    await context.newPage();

  try {
    return await capturePage(
      page,
      config.checkpoint.grafanaUrl,
      'grafana.png'
    );
  } finally {
    await page.close();
  }
}

async function captureAll() {
  checkpointLogger.info(
    'Iniciando captura do checkpoint.'
  );

  const results = {
    gmail: null,
    grafana: null,
  };

  try {
    results.gmail =
      await captureGmail();
  } catch (error) {
    checkpointLogger.error(
      'Falha ao capturar Gmail.',
      error
    );
  }

  try {
    results.grafana =
      await captureGrafana();
  } catch (error) {
    checkpointLogger.error(
      'Falha ao capturar Grafana.',
      error
    );
  }

  if (
    !results.gmail &&
    !results.grafana
  ) {
    throw new Error(
      'Nenhuma screenshot do checkpoint foi capturada.'
    );
  }

  checkpointLogger.info(
    'Captura do checkpoint concluída.',
    {
      gmail: results.gmail,
      grafana: results.grafana,
    }
  );

  return results;
}

async function closeBrowser() {
  const context = browserContext;
  browserContext = null;

  if (context) {
    await context.close();
  }

  checkpointLogger.info(
    'Perfil persistente do navegador encerrado.'
  );
}

module.exports = {
  captureGmail,
  captureGrafana,
  captureAll,
  closeBrowser,
};

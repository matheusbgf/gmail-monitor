'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { chromium } = require('playwright');

const config = require('../config');
const logger = require('../logger');

const checkpointLogger =
  logger.child('CHECKPOINT_CAPTURE');

const CHROME_CDP_URL =
  'http://127.0.0.1:9222';

let browser = null;
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

  checkpointLogger.info(
    'Conectando ao Chrome existente.',
    {
      endpoint: CHROME_CDP_URL,
    }
  );

  browser =
    await chromium.connectOverCDP(
      CHROME_CDP_URL
    );

  const contexts =
    browser.contexts();

  if (!contexts.length) {
    throw new Error(
      'Nenhum contexto encontrado no Chrome.'
    );
  }

  browserContext = contexts[0];

  checkpointLogger.info(
    'Conectado ao Chrome existente.'
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

  const pages =
    context.pages();

  const page =
    pages.find(
      currentPage =>
        currentPage
          .url()
          .includes(
            'mail.google.com/mail/'
          )
    );

  if (!page) {
    throw new Error(
      'Aba autenticada do Gmail não encontrada no Chrome.'
    );
  }

  checkpointLogger.info(
    'Aba autenticada do Gmail encontrada.',
    {
      url: page.url(),
      title: await page.title(),
    }
  );

  await page.waitForTimeout(3000);

  const screenshotPath =
    path.join(
      getScreenshotDir(),
      'gmail.png'
    );

  await page.screenshot({
    path: screenshotPath,
    fullPage: true,
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
  browserContext = null;
  browser = null;

  checkpointLogger.info(
    'Conexão com o Chrome encerrada.'
  );
}

module.exports = {
  captureGmail,
  captureGrafana,
  captureAll,
  closeBrowser,
};

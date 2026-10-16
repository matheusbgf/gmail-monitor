'use strict';

const { chromium } = require('playwright');

const config = require('../config');
const {
  ensurePrivateBrowserProfile,
} = require('./profile');

async function main() {
  if (!config.checkpoint.browserHeadless) {
    throw new Error(
      'Defina CHECKPOINT_BROWSER_HEADLESS=true para manter a autenticação sem interface gráfica.'
    );
  }

  ensurePrivateBrowserProfile(
    config.checkpoint.browserDataDir
  );

  const context =
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

  try {
    const page = context.pages()[0] || await context.newPage();

    await page.goto(
      config.checkpoint.gmailUrl,
      {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      }
    );

    await page.waitForTimeout(3000);

    if (new URL(page.url()).hostname !== 'mail.google.com') {
      throw new Error(
        'O perfil salvo não está autenticado no Gmail. Este script só valida sessões existentes; não automatiza o login do Google nem contorna MFA ou SSO.'
      );
    }

    console.log(
      'Sessão existente do Gmail validada sem interface gráfica.'
    );
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error(
    'Erro durante autenticação do navegador:',
    error
  );

  process.exit(1);
});

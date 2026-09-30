'use strict';

const { chromium } = require('playwright');

const config = require('../config');

async function main() {
  const context =
    await chromium.launchPersistentContext(
      config.checkpoint.browserDataDir,
      {
        headless: false,
        viewport: {
          width: 1920,
          height: 1080,
        },
      }
    );

  const page = await context.newPage();

  await page.goto(
    config.checkpoint.gmailUrl,
    {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    }
  );

  console.log(
    'Faça o login manualmente no Gmail.'
  );

  console.log(
    'Quando a caixa de entrada estiver aberta, pressione ENTER neste terminal.'
  );

  process.stdin.setEncoding('utf8');

  process.stdin.once(
    'data',
    async () => {
      await context.close();

      console.log(
        'Sessão do Gmail salva com sucesso.'
      );
    }
  );
}

main().catch((error) => {
  console.error(
    'Erro durante autenticação do navegador:',
    error
  );

  process.exit(1);
});
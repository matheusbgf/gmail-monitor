'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { parseGmailMessage } = require('../src/parser/email');
const { sanitizeEmail } = require('../src/security/sanitizer');
const { formatAlert } = require('../src/formatter/alert');

test('pipeline completo: e-mail simulado até alerta', async () => {
  const rawEmail = [
    'From: Sistema de Monitoramento <monitor@example.com>',
    'To: equipe@example.com',
    'Subject: Alerta crítico no servidor',
    'Date: Wed, 16 Sep 2026 09:00:00 -0300',
    'Message-ID: <alert-001@example.com>',
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    'Foi detectada uma alteração crítica no servidor.',
    'Host: servidor-01',
    'Severidade: Critical',
  ].join('\r\n');

  const raw = Buffer
    .from(rawEmail, 'utf8')
    .toString('base64url');

  const gmailMessage = {
    id: 'gmail-message-001',
    threadId: 'thread-001',
    raw,
  };

  const parsed = await parseGmailMessage(
    gmailMessage
  );

  assert.equal(
    parsed.id,
    'gmail-message-001'
  );

  assert.equal(
    parsed.subject,
    'Alerta crítico no servidor'
  );

  assert.match(
    parsed.text,
    /alteração crítica/
  );

  const sanitized = sanitizeEmail(parsed);

  assert.equal(
    sanitized.id,
    'gmail-message-001'
  );

  assert.equal(
    sanitized.subject,
    'Alerta crítico no servidor'
  );

  const alert = formatAlert(sanitized);

  assert.match(
    alert,
    /📧 \*NOVO E-MAIL\*/
  );

  assert.match(
    alert,
    /Sistema de Monitoramento/
  );

  assert.match(
    alert,
    /Alerta crítico no servidor/
  );

  assert.match(
    alert,
    /alteração crítica/
  );
});


test('pipeline remove conteúdo HTML perigoso', async () => {
  const rawEmail = [
    'From: atacante@example.com',
    'To: equipe@example.com',
    'Subject: Teste de segurança',
    'Content-Type: text/html; charset="UTF-8"',
    '',
    '<html>',
    '<body>',
    '<h1>Alerta</h1>',
    '<script>alert("XSS")</script>',
    '<p>Mensagem segura</p>',
    '</body>',
    '</html>',
  ].join('\r\n');

  const raw = Buffer
    .from(rawEmail, 'utf8')
    .toString('base64url');

  const gmailMessage = {
    id: 'gmail-message-002',
    threadId: 'thread-002',
    raw,
  };

  const parsed = await parseGmailMessage(
    gmailMessage
  );

  const sanitized = sanitizeEmail(parsed);

    assert.match(
    sanitized.body,
    /ALERTA/
    );

  assert.match(
    sanitized.body,
    /Mensagem segura/
  );

  assert.doesNotMatch(
    sanitized.body,
    /<script/i
  );

  assert.doesNotMatch(
    sanitized.body,
    /alert\(/i
  );
});
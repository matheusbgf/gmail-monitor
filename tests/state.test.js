'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const tempDir = fs.mkdtempSync(
  path.join(os.tmpdir(), 'mdg-state-test-')
);

const statePath = path.join(tempDir, 'state.json');

// Definido antes de importar o módulo de estado.
process.env.STATE_PATH = statePath;

const {
  loadState,
  saveState,
  hasProcessed,
  markProcessed,
} = require('../src/state/store');

test.after(() => {
  fs.rmSync(tempDir, {
    recursive: true,
    force: true,
  });
});

test.beforeEach(() => {
  for (const file of [
    statePath,
    `${statePath}.tmp`,
  ]) {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  }
});

test('cria estado inicial quando o arquivo não existe', () => {
  const state = loadState();

  assert.equal(state.version, 1);
  assert.deepEqual(state.processed, {});
});

test('salva e recarrega o estado', () => {
  const state = {
    version: 1,
    processed: {
      'message-001': '2026-09-28T10:00:00.000Z',
    },
  };

  saveState(state);

  const loaded = loadState();

  assert.deepEqual(loaded, state);
});

test('identifica mensagens processadas pelo ID', () => {
  const state = {
    version: 1,
    processed: {
      'message-001': '2026-09-28T10:00:00.000Z',
    },
  };

  assert.equal(hasProcessed(state, 'message-001'), true);
  assert.equal(hasProcessed(state, 'message-002'), false);
});

test('registra uma mensagem e mantém o limite de 1000 IDs', () => {
  const state = {
    version: 1,
    processed: {},
  };

  const baseTime = Date.UTC(2026, 0, 1);

  for (let i = 0; i < 1000; i++) {
    state.processed[`message-${i}`] =
      new Date(baseTime + i * 1000).toISOString();
  }

  markProcessed(state, 'message-new');

  assert.equal(Object.keys(state.processed).length, 1000);
  assert.equal(hasProcessed(state, 'message-0'), false);
  assert.equal(hasProcessed(state, 'message-999'), true);
  assert.equal(hasProcessed(state, 'message-new'), true);
});

test('rejeita ID de mensagem vazio', () => {
  const state = {
    version: 1,
    processed: {},
  };

  assert.throws(
    () => markProcessed(state, ''),
    /ID da mensagem não informado/
  );
});

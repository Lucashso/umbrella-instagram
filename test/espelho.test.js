import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONTAS } from '../src/contas.js';
import { ESPELHO, canaisAtuais, usarCanal } from '../src/servicos.js';

const comBotDoLucas = { [`TELEGRAM_BOT_TOKEN${ESPELHO}`]: 'x', [`TELEGRAM_CHAT_ID${ESPELHO}`]: '1' };

test('contas do bot de sempre também vão para o bot do Lucas', () => {
  for (const id of ['umbrella', 'leme', 'priscilla', 'arcana']) {
    usarCanal(CONTAS[id]);
    assert.deepEqual(canaisAtuais(comBotDoLucas), ['', ESPELHO], id);
  }
});

test('Leme Hub já está no bot do Lucas e não sai em dobro', () => {
  usarCanal(CONTAS.lemehub);
  assert.deepEqual(canaisAtuais(comBotDoLucas), [ESPELHO]);
});

test('sem o bot do Lucas configurado, segue só o bot da conta', () => {
  usarCanal(CONTAS.umbrella);
  assert.deepEqual(canaisAtuais({}), ['']);
});

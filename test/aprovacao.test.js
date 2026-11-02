import assert from 'node:assert/strict';
import { test } from 'node:test';
import { interpretarUpdate, marcaEdicao } from '../api/_logica.js';

const DONO = 1362962741;
const id = '2026-11-03-registro-pos-reuniao-dor';
const toque = (data, de = DONO) => ({ callback_query: { id: 'c1', data, from: { id: de }, message: { message_id: 9 } } });

test('botão Aprovar vira ação de executar', () => {
  const a = interpretarUpdate(toque(`aprovar:2:${id}`), DONO);
  assert.deepEqual([a.tipo, a.acao, a.versao, a.id], ['executar', 'aprovar', 2, id]);
});

test('botão Editar primeiro pergunta o que mudar', () => {
  assert.equal(interpretarUpdate(toque(`editar:1:${id}`), DONO).tipo, 'perguntar');
});

test('outra pessoa não consegue aprovar', () => {
  assert.equal(interpretarUpdate(toque(`aprovar:1:${id}`, 999), DONO), null);
});

test('resposta à pergunta vira edição com o pedido', () => {
  const a = interpretarUpdate({ message: { from: { id: DONO }, text: ' troque o título ', reply_to_message: { text: `O que mudar?\n\n${marcaEdicao(id, 3)}` } } }, DONO);
  assert.deepEqual([a.tipo, a.acao, a.id, a.versao, a.pedido], ['executar', 'editar', id, 3, 'troque o título']);
});

test('áudio na resposta pede texto', () => {
  const a = interpretarUpdate({ message: { from: { id: DONO }, voice: {}, reply_to_message: { text: marcaEdicao(id, 1) } } }, DONO);
  assert.equal(a.tipo, 'so-texto');
});

test('mensagem solta recebe ajuda e não edita nada', () => {
  assert.equal(interpretarUpdate({ message: { from: { id: DONO }, text: 'oi' } }, DONO).tipo, 'ajuda');
});

test('mensagem de outra pessoa é ignorada', () => {
  assert.equal(interpretarUpdate({ message: { from: { id: 999 }, text: 'oi', reply_to_message: { text: marcaEdicao(id, 1) } } }, DONO), null);
});

test('botão desconhecido é ignorado', () => {
  assert.equal(interpretarUpdate(toque(`publicar:1:${id}`), DONO), null);
});

test('botão cabe no limite de 64 bytes do Telegram', () => {
  assert.ok(Buffer.byteLength(`descartar:99:2026-11-03-registro-pos-reuniao-solucao`) <= 64);
});

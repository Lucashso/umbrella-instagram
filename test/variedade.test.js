import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CONTAS, temasDe } from '../src/contas.js';
import { GANCHOS, ganchoDe, pautaStory, postsRecentes, storiesRecentes } from '../src/plano.js';
import { montarPedido } from '../src/redator.js';

const dias = (n) => Array.from({ length: n }, (_, i) => new Date(Date.UTC(2026, 10, 20 + i)).toISOString().slice(0, 10));

test('story nunca fala do assunto do post da vez e não repete assunto em dias seguidos', () => {
  for (const conta of Object.values(CONTAS)) {
    const temas = temasDe(conta);
    const doPost = temas[2];
    const pautas = dias(14).map((d) => pautaStory(d, temas, doPost, conta));
    assert.ok(pautas.every((p) => p.assunto !== doPost.assunto), conta.id);
    assert.equal(new Set(pautas.map((p) => p.assunto)).size, 14, conta.id);
    assert.ok(pautas.every((p, i) => i === 0 || p.formato !== pautas[i - 1].formato), conta.id);
  }
});

test('a pauta do story é a mesma se o workflow rodar duas vezes no dia', () => {
  const temas = temasDe(CONTAS.umbrella);
  assert.deepEqual(pautaStory('2026-11-21', temas, temas[0], CONTAS.umbrella), pautaStory('2026-11-21', temas, temas[0], CONTAS.umbrella));
});

test('os três posts de um tema abrem com ganchos diferentes', () => {
  const publicados = (n) => Array.from({ length: n }, () => ({ status: 'publicado' }));
  const ganchos = [0, 1, 2].map((n) => ganchoDe(publicados(n)));
  assert.equal(new Set(ganchos).size, 3);
  // Story e post avulso não mexem no gancho da sequência.
  assert.equal(ganchoDe([{ tipo: 'story', status: 'publicado' }]), GANCHOS[0]);
});

test('story expirado entra na lista do que não repetir; post avulso e story não se misturam', () => {
  const h = [
    { tipo: 'story', status: 'expirado', frase: 'piada velha' },
    { tipo: 'story', status: 'publicado', frase: 'piada publicada' },
    { status: 'pendente', etapa: 'dor', frase: 'post parado' },
  ];
  assert.deepEqual(storiesRecentes(h).map((p) => p.frase), ['piada velha', 'piada publicada']);
  assert.deepEqual(postsRecentes(h).map((p) => p.frase), ['post parado']);
});

test('o pedido ao redator leva o gancho e as últimas frases do perfil', () => {
  const tema = { assunto: 'A', recurso: 'R' };
  const pedido = montarPedido({ tema, etapa: 'dor', anteriores: [], recentes: [{ etapa: 'dica', frase: 'Saiu da reunião?' }], gancho: GANCHOS[1] });
  assert.match(pedido, /GANCHO DE ABERTURA/);
  assert.match(pedido, /- dica: Saiu da reunião\?/);
  assert.match(pedido, /JÁ PUBLICADO SOBRE ISTO/);
  // Post avulso da social media continua funcionando sem lista nem gancho.
  assert.doesNotMatch(montarPedido({ tema, etapa: 'ideia', anteriores: [] }), /GANCHO|ÚLTIMAS FRASES/);
  assert.doesNotMatch(montarPedido({ tema, etapa: 'story', recentes: [{ etapa: 'story', frase: 'x' }] }), /JÁ PUBLICADO SOBRE ISTO/);
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ETAPAS, hojeBrasilia, proximoPost } from '../src/plano.js';
import { esc } from '../src/render.js';
import { cifrar, decifrar } from '../src/servicos.js';
import { montarLegenda, validarPost } from '../src/validar.js';

const temas = JSON.parse(readFileSync(new URL('../conteudo/temas.json', import.meta.url)));
const publicados = (n) => Array.from({ length: n }, (_, i) => ({ status: 'publicado', tema: temas[Math.floor(i / 3) % temas.length].id, etapa: ETAPAS[i % 3] }));
const valido = { eyebrow: 'Atrasos', titulo: 'Uma frase', destaque: 'curta', apoio: 'Apoio.', legenda: 'Legenda.', hashtags: ['#corretordeseguros'] };

test('segue dor, solução e dica no mesmo tema, depois troca de tema', () => {
  const seq = [0, 1, 2, 3].map((n) => proximoPost(publicados(n), temas));
  assert.deepEqual(seq.map((s) => s.etapa), ['dor', 'solucao', 'dica', 'dor']);
  assert.equal(seq[0].tema.id, seq[2].tema.id);
  assert.notEqual(seq[3].tema.id, seq[0].tema.id);
});

test('post vetado ou com falha não avança a sequência', () => {
  const h = [...publicados(1), { status: 'vetado', tema: temas[0].id }, { status: 'falhou', tema: temas[0].id }, { status: 'simulado', tema: temas[0].id }];
  assert.equal(proximoPost(h, temas).etapa, 'solucao');
});

test('volta ao primeiro tema e informa o que já foi publicado', () => {
  const s = proximoPost(publicados(temas.length * 3), temas);
  assert.equal(s.tema.id, temas[0].id);
  assert.equal(s.anteriores.length, 3);
});

test('data usa o fuso de Brasília', () => {
  assert.equal(hojeBrasilia(new Date('2026-11-03T01:00:00Z')), '2026-11-02');
});

test('validação aceita texto normal', () => assert.deepEqual(validarPost(valido, 'dor'), []));

for (const [campo, valor] of [['legenda', 'Aumente 30% das vendas'], ['legenda', 'A partir de R$ 99'], ['legenda', 'Venda garantida'], ['legenda', 'Parceiro da Prudential'], ['legenda', 'Somos o melhor CRM'], ['titulo', 'M'.repeat(35)]]) {
  test(`validação recusa ${campo}: ${valor.slice(0, 24)}`, () => assert.notEqual(validarPost({ ...valido, [campo]: valor }, 'dor').length, 0));
}

test('dica exige 3 passos', () => assert.notEqual(validarPost({ ...valido, passos: [] }, 'dica').length, 0));
test('legenda recebe as hashtags', () => assert.equal(montarLegenda({ legenda: ' Oi ', hashtags: ['#a', '#b'] }), 'Oi\n\n#a #b'));
test('texto gerado não vira HTML', () => assert.equal(esc('<img src=x>'), '&lt;img src=x&gt;'));

test('token cifrado volta igual e chave errada falha', () => {
  const k = Buffer.alloc(32, 7);
  assert.equal(decifrar(cifrar('segredo', k), k), 'segredo');
  assert.throws(() => decifrar(cifrar('segredo', k), Buffer.alloc(32, 8)));
});

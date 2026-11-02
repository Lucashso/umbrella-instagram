import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, test } from 'node:test';
import { montarSlides } from '../src/render.js';
import { proximoPost } from '../src/plano.js';
import { publicarNoInstagram, publicarStory } from '../src/servicos.js';
import { validarPost } from '../src/validar.js';

const temas = JSON.parse(readFileSync(new URL('../conteudo/temas.json', import.meta.url)));
const original = globalThis.fetch;
afterEach(() => { globalThis.fetch = original; });

// Simula a Meta e guarda as chamadas feitas.
function simularMeta(status = 'FINISHED') {
  const chamadas = [];
  let n = 0;
  globalThis.fetch = async (url, op) => {
    const corpo = op.body ? JSON.parse(op.body) : null;
    chamadas.push({ url, metodo: op.method, corpo, auth: op.headers.authorization });
    const resposta = op.method === 'GET' ? { status_code: status } : { id: `id${++n}` };
    return { ok: true, status: 200, json: async () => resposta };
  };
  return chamadas;
}

const criacoes = (c) => c.filter((x) => x.metodo === 'POST' && x.url.endsWith('/media')).map((x) => x.corpo);

test('uma imagem vira post simples com legenda', async () => {
  const c = simularMeta();
  assert.equal(await publicarNoInstagram('42', ['a.jpg'], 'oi', 'tk', 0), 'id2');
  assert.deepEqual(criacoes(c), [{ image_url: 'a.jpg', caption: 'oi' }]);
  assert.deepEqual(c.at(-1).corpo, { creation_id: 'id1' });
  assert.ok(c.every((x) => x.url.startsWith('https://graph.facebook.com/v26.0/') && x.auth === 'Bearer tk'));
});

test('várias imagens viram carrossel, com legenda só no container principal', async () => {
  const c = simularMeta();
  await publicarNoInstagram('42', ['a.jpg', 'b.jpg', 'c.jpg'], 'oi', 'tk', 0);
  assert.deepEqual(criacoes(c), [
    { image_url: 'a.jpg', is_carousel_item: true },
    { image_url: 'b.jpg', is_carousel_item: true },
    { image_url: 'c.jpg', is_carousel_item: true },
    { media_type: 'CAROUSEL', children: 'id1,id2,id3', caption: 'oi' },
  ]);
  assert.deepEqual(c.at(-1).corpo, { creation_id: 'id4' });
});

test('container com erro não é publicado', async () => {
  const c = simularMeta('ERROR');
  await assert.rejects(publicarNoInstagram('42', ['a.jpg'], 'oi', 'tk', 0), /Container ERROR/);
  assert.ok(!c.some((x) => x.url.endsWith('/media_publish')));
});

test('story vai com media_type STORIES e sem legenda', async () => {
  const c = simularMeta();
  await publicarStory('42', 's.jpg', 'tk', 0);
  assert.deepEqual(criacoes(c), [{ image_url: 's.jpg', media_type: 'STORIES' }]);
  assert.deepEqual(c.at(-1).corpo, { creation_id: 'id1' });
});

test('stories e posts avulsos publicados não avançam a sequência', () => {
  const h = [{ status: 'publicado', tema: temas[0].id }, { status: 'publicado', tipo: 'story' }, { status: 'publicado', tipo: 'post' }];
  assert.equal(proximoPost(h, temas).etapa, 'solucao');
});

const story = { frase: 'Você jurou que ia anotar. Eu vi.', detalhe: 'Eu sempre vejo.', pose: 'ok' };

test('story normal passa na validação sem hashtag', () => assert.deepEqual(validarPost(story, 'story'), []));

for (const palavra of ['morte', 'morreu', 'doença', 'sinistro', 'viúva', 'acidente']) {
  test(`story não brinca com "${palavra}"`, () => assert.notEqual(validarPost({ ...story, detalhe: `Piada com ${palavra}` }, 'story').length, 0));
}

test('story sobre o Umbi vira arte vertical', () => {
  const [html] = montarSlides(story, 'story', temas[0]);
  assert.ok(html.includes('<body class="story">') && html.includes('umbi-ok-parado.webp'));
});

const dica = { eyebrow: 'E', titulo: 'T', destaque: 'D', rodape: 'R', passos: [1, 2, 3].map((n) => ({ titulo: `P${n}`, texto: `X${n}` })) };

test('a dica é um carrossel: capa, 3 passos e encerramento', () => {
  assert.equal(montarSlides(dica, 'dica', temas[0]).length, 5);
});

test('dor e solução têm uma imagem só', () => {
  assert.equal(montarSlides({ ...dica, apoio: 'A' }, 'dor', temas[0]).length, 1);
  assert.equal(montarSlides({ ...dica, fala: 'F', resposta: 'R' }, 'solucao', temas[0]).length, 1);
});

test('o Umbi aparece em todas as artes', () => {
  const todos = [
    ...montarSlides(dica, 'dica', temas[0]),
    ...montarSlides({ ...dica, apoio: 'A' }, 'dor', temas[0]),
    ...montarSlides({ ...dica, fala: 'F', resposta: 'R' }, 'solucao', temas[0]),
    ...montarSlides(dica, 'solucao', temas.find((t) => t.visual === 'lista')),
  ];
  assert.ok(todos.every((h) => /umbi-[a-z]+-parado\.webp/.test(h)));
});

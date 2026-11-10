import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { botoesIdeia, interpretarUpdate, NOMES_CONTAS, textoIdeia } from '../api/_logica.js';
import { CONTAS, contaDe, contasAtivas, temasDe } from '../src/contas.js';
import { textoAprovacao } from '../src/fluxo.js';
import { proximoPost } from '../src/plano.js';
import { montarSlides } from '../src/render.js';
import { conferirConta, credenciais } from '../src/servicos.js';
import { validarPost } from '../src/validar.js';

const { umbrella, leme, priscilla, arcana } = CONTAS;
const original = globalThis.fetch;
afterEach(() => { globalThis.fetch = original; });

test('os botões do webhook conhecem as mesmas contas do gerador', () => {
  assert.deepEqual(Object.keys(NOMES_CONTAS).sort(), Object.keys(CONTAS).sort());
});

test('sem configuração só a Umbrella fica ligada', () => {
  assert.deepEqual(contasAtivas('').map((c) => c.id), ['umbrella']);
});

test('conta sem @ definido nunca fica ativa', () => {
  const original = arcana.usuario;
  arcana.usuario = '';
  assert.deepEqual(contasAtivas('umbrella,arcana').map((c) => c.id), ['umbrella']);
  arcana.usuario = original;
  assert.equal(contasAtivas('nada').length, 0);
});

test('entrada antiga sem conta é da Umbrella', () => {
  assert.equal(contaDe({ id: 'x' }), umbrella);
  assert.equal(contaDe({ id: 'x', conta: 'priscilla' }), priscilla);
});

test('cada conta tem a própria credencial', () => {
  const env = { IG_USER_ID: '1', IG_ACCESS_TOKEN: 'a', IG_USER_ID_PRISCILLA: '2', IG_ACCESS_TOKEN_PRISCILLA: 'b' };
  Object.assign(process.env, env);
  assert.deepEqual(credenciais(umbrella), { igId: '1', token: 'a' });
  assert.deepEqual(credenciais(priscilla), { igId: '2', token: 'b' });
  for (const k of Object.keys(env)) delete process.env[k];
  assert.throws(() => credenciais(priscilla), /IG_USER_ID_PRISCILLA/);
});

function respostaIg(username) {
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ username }) });
}

test('token de outro perfil bloqueia a publicação', async () => {
  respostaIg('umbrella.crm');
  await assert.rejects(conferirConta('2', 'tk', 'freitas.priscilla'), /@umbrella\.crm/);
});

test('token do perfil certo passa', async () => {
  respostaIg('Freitas.Priscilla');
  await conferirConta('2', 'tk', 'freitas.priscilla');
});

const publicados = (conta, n) => {
  const temas = temasDe(conta);
  return Array.from({ length: n }, (_, i) => ({ status: 'publicado', tema: temas[(conta.inicio + Math.floor(i / 3)) % temas.length].id }));
};

test('Priscilla e Arcana seguem a própria sequência, em assuntos diferentes', () => {
  const [p, a] = [priscilla, arcana].map((c) => proximoPost([], temasDe(c), c.etapas, c.inicio));
  assert.equal(p.etapa, 'situacao');
  assert.notEqual(p.tema.id, a.tema.id);
  const seq = [0, 1, 2, 3].map((n) => proximoPost(publicados(priscilla, n), temasDe(priscilla), priscilla.etapas, priscilla.inicio));
  assert.deepEqual(seq.map((s) => s.etapa), ['situacao', 'caminho', 'dica', 'situacao']);
  assert.notEqual(seq[3].tema.id, seq[0].tema.id);
});

test('os botões cabem nos 64 bytes do Telegram em todas as contas', () => {
  for (const conta of Object.values(CONTAS)) {
    for (const tema of temasDe(conta)) {
      for (const etapa of conta.etapas) {
        assert.ok(Buffer.byteLength(`descartar:99:${conta.prefixo}2026-11-03-${tema.id}-${etapa}`) <= 64, tema.id);
      }
    }
  }
});

test('ideia indica a conta escolhida', () => {
  const update = { callback_query: { id: 'c', data: 'ideia:priscilla:story', from: { id: 1 }, message: { text: textoIdeia('dia das mães') } } };
  const a = interpretarUpdate(update, 1);
  assert.deepEqual([a.acao, a.conta, a.pedido], ['ideia_story', 'priscilla', 'dia das mães']);
});

test('botão antigo de ideia continua indo para a Umbrella', () => {
  const update = { callback_query: { id: 'c', data: 'ideia:post', from: { id: 1 }, message: { text: '💡 x\n\nViro isso em quê?' } } };
  const a = interpretarUpdate(update, 1);
  assert.deepEqual([a.acao, a.conta, a.pedido], ['ideia_post', 'umbrella', 'x']);
});

test('conta desconhecida é ignorada', () => {
  const update = { callback_query: { id: 'c', data: 'ideia:outra:post', from: { id: 1 }, message: { text: textoIdeia('x') } } };
  assert.equal(interpretarUpdate(update, 1), null);
});

test('só aparecem botões das contas ligadas', () => {
  assert.equal(botoesIdeia('').length, 1);
  assert.deepEqual(botoesIdeia('umbrella,priscilla').flat().map((b) => b.callback_data), ['ideia:umbrella:story', 'ideia:umbrella:post', 'ideia:priscilla:story', 'ideia:priscilla:post']);
});

test('a mensagem de aprovação sempre diz o perfil', () => {
  assert.ok(textoAprovacao({}, 'situacao', 'Legenda', priscilla).startsWith('📸 @freitas.priscilla'));
  assert.ok(textoAprovacao({ frase: 'a', detalhe: 'b' }, 'story', '', umbrella).startsWith('🎬 Story do Umbi · @umbrella.crm'));
});

const base = { eyebrow: 'E', titulo: 'T', destaque: 'D', apoio: 'A', legenda: 'L', hashtags: ['#seguro'] };

test('a Leme usa os temas da Umbrella com o Timo no lugar do Umbi', () => {
  const temas = JSON.stringify(temasDe(leme));
  assert.ok(!/umbi|umbrella/i.test(temas));
  assert.ok(temas.includes('Timo'));
  assert.ok(JSON.stringify(temasDe(umbrella)).includes('Umbi'));
});

test('Leme e Umbrella começam em assuntos diferentes', () => {
  const [u, l] = [umbrella, leme].map((c) => proximoPost([], temasDe(c), c.etapas, c.inicio));
  assert.equal(l.etapa, 'dor');
  assert.notEqual(u.tema.id, l.tema.id);
});

test('uma marca de CRM nunca aparece no post da outra', () => {
  assert.notEqual(validarPost({ ...base, legenda: 'Fale com o Umbi' }, 'dor', 'timo').length, 0);
  assert.notEqual(validarPost({ ...base, legenda: 'Conheça o Umbrella CRM' }, 'solucao', 'timo').length, 0);
  assert.notEqual(validarPost({ ...base, legenda: 'Fale com o Timo' }, 'dor', 'umbi').length, 0);
  assert.notEqual(validarPost({ ...base, legenda: 'Conheça o Leme CRM' }, 'solucao', 'umbi').length, 0);
  assert.deepEqual(validarPost({ ...base, legenda: 'Conheça o Leme CRM e fale com o Timo' }, 'solucao', 'timo'), []);
});

test('story do Timo também não brinca com morte ou doença', () => {
  assert.notEqual(validarPost({ frase: 'Ninguém gosta de falar de morte.', detalhe: 'x' }, 'story', 'timo').length, 0);
});

test('artes da Leme têm Timo, logo e cores da Leme; as da Umbrella não mudam', () => {
  const dica = { ...base, rodape: 'R', passos: [1, 2, 3].map((n) => ({ titulo: `P${n}`, texto: `X${n}` })) };
  const chat = { visual: 'chat', confirmar: true };
  const todas = (conta) => [
    ...montarSlides(base, 'dor', {}, conta),
    ...montarSlides({ ...base, fala: 'f', resposta: 'r' }, 'solucao', chat, conta),
    ...montarSlides(dica, 'dica', {}, conta),
    ...montarSlides({ frase: 'F', detalhe: 'D', pose: 'ok' }, 'story', {}, conta),
    ...montarSlides(base, 'ideia', {}, conta),
  ];
  const artesLeme = todas(leme);
  assert.equal(artesLeme.length, 9);
  // Solução e carrossel usam o estilo neon (neon.css, classe n-leme); o resto, o layout da marca (leme.css).
  const marcaLeme = (h) => (h.includes('m-leme') && h.includes('leme.css')) || (h.includes('n-leme') && h.includes('neon.css'));
  assert.ok(artesLeme.every((h) => marcaLeme(h) && /timo-/.test(h) && !/umbi-|logo\.png|logo_dark|Umbrella|Umbi/.test(h)));
  assert.ok(artesLeme.find((h) => h.includes('class="m-leme story"')).includes('@leme.crm'));
  const artesUmbrella = todas(umbrella);
  assert.ok(artesUmbrella.every((h) => /umbi-/.test(h) && !/leme|timo/i.test(h)));
  assert.deepEqual(todas(undefined), artesUmbrella);
});

test('Leme Hub: botões de ideia só no bot dela, e o bot de sempre não mostra a Leme Hub', () => {
  const ativas = 'umbrella,leme,lemehub';
  assert.deepEqual(botoesIdeia(ativas, '_LEMEHUB').flat().map((b) => b.callback_data), ['ideia:lemehub:story', 'ideia:lemehub:post']);
  assert.ok(!botoesIdeia(ativas, '').flat().some((b) => b.callback_data.includes('lemehub')));
});

test('no grupo de aprovação qualquer membro aprova; fora dele, ninguém', () => {
  const grupo = -100123;
  const toque = (chat) => ({ callback_query: { id: 'c', data: 'aprovar:1:lemehub-x', from: { id: 77 }, message: { message_id: 5, chat: { id: chat } } } });
  assert.equal(interpretarUpdate(toque(grupo), grupo).acao, 'aprovar');
  assert.equal(interpretarUpdate(toque(-999), grupo), null);
});

test('no grupo a ideia chega pelo comando /ideia', () => {
  const grupo = -100123;
  const msg = (text) => ({ message: { text, from: { id: 77 }, chat: { id: grupo } } });
  assert.deepEqual(interpretarUpdate(msg('/ideia@instalemehubbot post sobre cobrança'), grupo), { tipo: 'ideia', pedido: 'post sobre cobrança' });
  assert.equal(interpretarUpdate(msg('/start'), grupo).tipo, 'ajuda');
});

test('Leme Hub não cita cliente nem produto de cliente', () => {
  for (const texto of ['Fizemos o Umbrella CRM', 'o LemeJur', 'clube AlegriaCard', 'a Arcana', 'o Leme CRM']) {
    assert.notEqual(validarPost({ ...base, legenda: texto }, 'problema', 'empresa').length, 0, texto);
  }
  assert.deepEqual(validarPost({ ...base, legenda: 'A Leme Hub faz softwares sob medida.' }, 'solucao', 'empresa'), []);
});

test('artes da Leme Hub: só texto, logo e cores dela, com a sequência problema → solução → dica', () => {
  const lemehub = CONTAS.lemehub;
  assert.deepEqual(lemehub.etapas, ['problema', 'solucao', 'dica']);
  const dica = { ...base, rodape: 'R', passos: [1, 2, 3].map((n) => ({ titulo: `P${n}`, texto: `X${n}` })) };
  const artes = [
    ...montarSlides(base, 'problema', {}, lemehub),
    ...montarSlides(base, 'solucao', {}, lemehub),
    ...montarSlides(dica, 'dica', {}, lemehub),
    ...montarSlides({ frase: 'F', detalhe: 'D' }, 'story', {}, lemehub),
  ];
  assert.equal(artes.length, 8);
  const marcaHub = (h) => (h.includes('m-lemehub') && h.includes('lemehub.css')) || (h.includes('n-lemehub') && h.includes('neon.css'));
  assert.ok(artes.every((h) => marcaHub(h) && !h.includes('cliente.css') && !/umbi-|timo-/.test(h)));
  assert.ok(artes[0].includes('Isso acontece aí?') && artes[1].includes('link na bio'));
  assert.ok(temasDe(lemehub).length >= 10);
});

test('aprovação de story da Leme diz que é do Timo', () => {
  assert.ok(textoAprovacao({ frase: 'a', detalhe: 'b' }, 'story', '', leme).startsWith('🎬 Story do Timo · @leme.crm'));
});

for (const texto of ['Conheça o Umbi', 'Use o Umbrella CRM', 'Contemplação garantida', 'Crédito aprovado em 24h', 'Consórcio sem juros', 'Sem análise de crédito']) {
  test(`conta de cliente recusa: ${texto}`, () => assert.notEqual(validarPost({ ...base, legenda: texto }, 'situacao', 'cliente').length, 0));
}

test('story de cliente pode citar o tema com seriedade, mas o do Umbi não', () => {
  const story = { frase: 'Falar de morte em família é difícil.', detalhe: 'Mas ajuda.' };
  assert.deepEqual(validarPost(story, 'story', 'cliente'), []);
  assert.notEqual(validarPost(story, 'story', 'umbi').length, 0);
});

test('artes das contas de cliente não têm Umbi e usam a marca certa', () => {
  const dica = { ...base, rodape: 'R', passos: [1, 2, 3].map((n) => ({ titulo: `P${n}`, texto: `X${n}` })) };
  for (const conta of [priscilla, arcana]) {
    const artes = [
      ...montarSlides(base, 'situacao', {}, conta),
      ...montarSlides(base, 'caminho', {}, conta),
      ...montarSlides(dica, 'dica', {}, conta),
      ...montarSlides({ frase: 'F', detalhe: 'D' }, 'story', {}, conta),
      ...montarSlides(base, 'ideia', {}, conta),
    ];
    assert.equal(artes.length, 9);
    assert.ok(artes.every((h) => !/umbi-|logo\.png|logo_dark|Umbrella/.test(h)));
    assert.ok(artes.every((h) => h.includes(`m-${conta.marca}`)));
  }
});

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { put } from '@vercel/blob';

const ESTADO = resolve(import.meta.dirname, '..', 'estado');
const HISTORICO = resolve(ESTADO, 'historico.json');
// O app usa a API com login unificado: host do Facebook e token de usuário do sistema, que não expira.
const GRAPH = 'https://graph.facebook.com';
const VERSAO = 'v26.0';

export const lerHistorico = () => JSON.parse(readFileSync(HISTORICO, 'utf8'));
export const salvarHistorico = (h) => writeFileSync(HISTORICO, JSON.stringify(h, null, 2) + '\n');

export function exigir(nome) {
  const v = process.env[nome];
  if (!v) throw new Error(`Falta a variável ${nome}`);
  return v;
}

// --- Telegram ---
// Cada conta é aprovada no chat do seu bot. Sem `bot`, vale o bot de sempre (Umbrella, Leme, Priscilla, Arcana).
// Tudo o que sai no bot de sempre também vai para o bot do Lucas (ESPELHO), com os mesmos botões:
// o toque lá chega ao webhook dele, e a ação acha a conta pelo id do post no histórico.
export const ESPELHO = '_LEMEHUB';
let canal = '';
let usuarioAtual = '';
export const usarCanal = (conta) => { canal = conta?.bot ?? ''; usuarioAtual = conta?.usuario ?? ''; };

export function canaisAtuais(ambiente = process.env) {
  const espelhar = canal !== ESPELHO && ambiente[`TELEGRAM_BOT_TOKEN${ESPELHO}`] && ambiente[`TELEGRAM_CHAT_ID${ESPELHO}`];
  return espelhar ? [canal, ESPELHO] : [canal];
}

async function telegramEm(sufixo, metodo, corpo) {
  const r = await fetch(`https://api.telegram.org/bot${exigir(`TELEGRAM_BOT_TOKEN${sufixo}`)}/${metodo}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(`Telegram ${metodo}: ${j.description}`);
  return j.result;
}

// Manda a mesma sequência de mensagens em cada canal. A cópia leva o @ da conta no topo, para o Lucas
// saber de qual perfil é; se ela falhar, só registra: o chat de aprovação da conta é o que vale.
async function emCadaCanal(montar) {
  const [principal, ...copias] = canaisAtuais();
  const resultado = await montar(principal, (t) => t);
  for (const sufixo of copias) {
    const marcar = (t) => (usuarioAtual ? `🔁 @${usuarioAtual}\n${t}` : t);
    await montar(sufixo, marcar).catch((erro) => console.error(`Cópia para o bot ${sufixo}: ${erro.message}`));
  }
  return resultado;
}

const botoes = (id, versao) => ({
  inline_keyboard: [
    [{ text: '✅ Aprovar e publicar', callback_data: `aprovar:${versao}:${id}` }],
    [{ text: '✏️ Editar', callback_data: `editar:${versao}:${id}` }, { text: '❌ Descartar', callback_data: `descartar:${versao}:${id}` }],
  ],
});

async function enviarImagens(sufixo, imagens) {
  const chat_id = exigir(`TELEGRAM_CHAT_ID${sufixo}`);
  if (imagens.length > 1) {
    await telegramEm(sufixo, 'sendMediaGroup', { chat_id, media: imagens.map((media) => ({ type: 'photo', media })) });
  } else {
    await telegramEm(sufixo, 'sendPhoto', { chat_id, photo: imagens[0] });
  }
}

const enviarTexto = (sufixo, text, extra = {}) => telegramEm(sufixo, 'sendMessage', { chat_id: exigir(`TELEGRAM_CHAT_ID${sufixo}`), text, ...extra });

export const avisar = (text) => emCadaCanal((s, marcar) => enviarTexto(s, marcar(text)));

export const enviarBotoes = (id, versao, text) =>
  emCadaCanal((s, marcar) => enviarTexto(s, marcar(text), { reply_markup: botoes(id, versao) }));

// Só mostra: imagens e texto, sem botões.
export const enviarPrevia = (imagens, texto) => emCadaCanal(async (s, marcar) => {
  await enviarImagens(s, imagens);
  await enviarTexto(s, marcar(texto));
});

export const enviarParaAprovacao = (id, versao, imagens, legenda) => emCadaCanal(async (s, marcar) => {
  await enviarImagens(s, imagens);
  const rotulo = versao > 1 ? `Versão ${versao}. ` : '';
  await enviarTexto(s, marcar(`${legenda}\n\n———\n${rotulo}Só publico depois que você aprovar.`), { reply_markup: botoes(id, versao) });
});

// --- Hospedagem: o Instagram baixa a imagem de uma URL pública ---
export async function hospedar(buffer, nome) {
  const { url } = await put(`instagram/${nome}.jpg`, buffer, {
    access: 'public', contentType: 'image/jpeg', addRandomSuffix: true, token: exigir('BLOB_READ_WRITE_TOKEN'),
  });
  return url;
}

// --- Instagram ---
async function ig(metodo, caminho, token, corpo) {
  const r = await fetch(`${GRAPH}/${VERSAO}/${caminho}`, {
    method: metodo,
    headers: { authorization: `Bearer ${token}`, ...(corpo && { 'content-type': 'application/json' }) },
    body: corpo && JSON.stringify(corpo),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`Instagram ${caminho}: ${j.error?.message ?? r.status}`);
  return j;
}

async function aguardarContainer(container, token, esperaMs) {
  for (let i = 0; i < 5; i++) {
    const { status_code } = await ig('GET', `${container}?fields=status_code`, token);
    if (status_code === 'FINISHED') return;
    if (status_code === 'ERROR' || status_code === 'EXPIRED') throw new Error(`Container ${status_code}`);
    if (i < 4) await new Promise((ok) => setTimeout(ok, esperaMs));
  }
  throw new Error('Container não ficou pronto em 5 tentativas');
}

export const credenciais = (conta) => ({
  igId: exigir(`IG_USER_ID${conta.sufixo}`),
  token: exigir(`IG_ACCESS_TOKEN${conta.sufixo}`),
});

export async function conferirConta(igId, token, esperado) {
  const { username } = await ig('GET', `${igId}?fields=username`, token);
  if (String(username).toLowerCase() !== esperado.toLowerCase()) {
    throw new Error(`o token aponta para @${username}, mas o esperado era @${esperado}`);
  }
}

// Story não aceita legenda nem link pela API.
export async function publicarStory(igId, imagem, token, esperaMs = 60000) {
  const { id: container } = await ig('POST', `${igId}/media`, token, { image_url: imagem, media_type: 'STORIES' });
  await aguardarContainer(container, token, esperaMs);
  const { id } = await ig('POST', `${igId}/media_publish`, token, { creation_id: container });
  return id;
}

// Uma imagem vira post simples; mais de uma vira carrossel, com a legenda só no container principal.
export async function publicarNoInstagram(igId, imagens, legenda, token, esperaMs = 60000) {
  let principal;
  if (imagens.length === 1) {
    ({ id: principal } = await ig('POST', `${igId}/media`, token, { image_url: imagens[0], caption: legenda }));
  } else {
    const itens = [];
    for (const image_url of imagens) {
      const { id } = await ig('POST', `${igId}/media`, token, { image_url, is_carousel_item: true });
      await aguardarContainer(id, token, esperaMs);
      itens.push(id);
    }
    ({ id: principal } = await ig('POST', `${igId}/media`, token, { media_type: 'CAROUSEL', children: itens.join(','), caption: legenda }));
  }
  await aguardarContainer(principal, token, esperaMs);
  const { id } = await ig('POST', `${igId}/media_publish`, token, { creation_id: principal });
  return id;
}

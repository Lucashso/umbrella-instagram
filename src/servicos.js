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
async function telegram(metodo, corpo) {
  const r = await fetch(`https://api.telegram.org/bot${exigir('TELEGRAM_BOT_TOKEN')}/${metodo}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(`Telegram ${metodo}: ${j.description}`);
  return j.result;
}

export const avisar = (text) => telegram('sendMessage', { chat_id: exigir('TELEGRAM_CHAT_ID'), text });

export const enviarBotoes = (id, versao, text) => telegram('sendMessage', {
  chat_id: exigir('TELEGRAM_CHAT_ID'),
  text,
  reply_markup: {
    inline_keyboard: [
      [{ text: '✅ Aprovar e publicar', callback_data: `aprovar:${versao}:${id}` }],
      [{ text: '✏️ Editar', callback_data: `editar:${versao}:${id}` }, { text: '❌ Descartar', callback_data: `descartar:${versao}:${id}` }],
    ],
  },
});

export async function enviarParaAprovacao(id, versao, imagens, legenda) {
  const chat_id = exigir('TELEGRAM_CHAT_ID');
  if (imagens.length > 1) {
    await telegram('sendMediaGroup', { chat_id, media: imagens.map((media) => ({ type: 'photo', media })) });
  } else {
    await telegram('sendPhoto', { chat_id, photo: imagens[0] });
  }
  const rotulo = versao > 1 ? `Versão ${versao}. ` : '';
  await enviarBotoes(id, versao, `${legenda}\n\n———\n${rotulo}Só publico depois que você aprovar.`);
}

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

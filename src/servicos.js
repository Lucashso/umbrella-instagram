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

export async function enviarParaAprovacao(id, versao, urlImagem, legenda) {
  await telegram('sendPhoto', { chat_id: exigir('TELEGRAM_CHAT_ID'), photo: urlImagem });
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

export async function publicarNoInstagram(igId, urlImagem, legenda, token, esperaMs = 60000) {
  const { id: container } = await ig('POST', `${igId}/media`, token, { image_url: urlImagem, caption: legenda });
  for (let i = 0; i < 5; i++) {
    const { status_code } = await ig('GET', `${container}?fields=status_code`, token);
    if (status_code === 'FINISHED') break;
    if (status_code === 'ERROR' || status_code === 'EXPIRED') throw new Error(`Container ${status_code}`);
    if (i === 4) throw new Error('Container não ficou pronto em 5 tentativas');
    await new Promise((ok) => setTimeout(ok, esperaMs));
  }
  const { id } = await ig('POST', `${igId}/media_publish`, token, { creation_id: container });
  return id;
}

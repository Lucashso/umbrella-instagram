import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { put } from '@vercel/blob';

const ESTADO = resolve(import.meta.dirname, '..', 'estado');
const HISTORICO = resolve(ESTADO, 'historico.json');
const TOKEN = resolve(ESTADO, 'token.enc');
const GRAPH = 'https://graph.instagram.com';
const VERSAO = 'v26.0';
const RENOVAR_DIAS = 30;

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

export async function enviarParaVeto(id, urlImagem, legenda, horario) {
  const chat_id = exigir('TELEGRAM_CHAT_ID');
  await telegram('sendPhoto', { chat_id, photo: urlImagem });
  await telegram('sendMessage', {
    chat_id,
    text: `${legenda}\n\n———\nPublica hoje às ${horario}, a menos que você vete.`,
    reply_markup: { inline_keyboard: [[{ text: '❌ Vetar este post', callback_data: `veto:${id}` }]] },
  });
}

export async function foiVetado(id) {
  const chat = String(exigir('TELEGRAM_CHAT_ID'));
  const updates = await telegram('getUpdates', { allowed_updates: ['callback_query'], timeout: 0 });
  const veto = updates.find((u) => u.callback_query?.data === `veto:${id}` && String(u.callback_query.from.id) === chat);
  if (veto) await telegram('answerCallbackQuery', { callback_query_id: veto.callback_query.id, text: 'Vetado' }).catch(() => {});
  if (updates.length) await telegram('getUpdates', { offset: updates.at(-1).update_id + 1, timeout: 0 });
  return Boolean(veto);
}

// --- Hospedagem: o Instagram baixa a imagem de uma URL pública ---
export async function hospedar(buffer, nome) {
  const { url } = await put(`instagram/${nome}.jpg`, buffer, {
    access: 'public', contentType: 'image/jpeg', addRandomSuffix: true, token: exigir('BLOB_READ_WRITE_TOKEN'),
  });
  return url;
}

// --- Token do Instagram: vale 60 dias e fica cifrado no repositório depois de renovado ---
const chave = () => createHash('sha256').update(exigir('IG_TOKEN_KEY')).digest();

export function cifrar(texto, k = chave()) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', k, iv);
  const dados = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), dados]).toString('base64');
}

export function decifrar(b64, k = chave()) {
  const b = Buffer.from(b64, 'base64');
  const d = createDecipheriv('aes-256-gcm', k, b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8');
}

export async function obterToken(agora = Date.now()) {
  const salvo = existsSync(TOKEN) ? JSON.parse(readFileSync(TOKEN, 'utf8')) : null;
  const atual = salvo ? decifrar(salvo.token) : exigir('IG_ACCESS_TOKEN');
  const idade = salvo ? (agora - salvo.renovado_em) / 86400000 : Infinity;
  if (idade < RENOVAR_DIAS) return atual;

  const q = new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: atual });
  const r = await fetch(`${GRAPH}/refresh_access_token?${q}`);
  const j = await r.json();
  if (!r.ok) {
    // Token recém-criado não renova nas primeiras 24 h; ele continua válido.
    if (!salvo) return atual;
    throw new Error(`Renovar token: ${j.error?.message ?? r.status}`);
  }
  writeFileSync(TOKEN, JSON.stringify({ token: cifrar(j.access_token), renovado_em: agora }) + '\n');
  return j.access_token;
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

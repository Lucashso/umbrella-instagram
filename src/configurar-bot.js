// Prepara um bot novo do Telegram sem que ninguém precise ver o token dele.
// MODO=descobrir: lista os chats que falaram com o bot (para achar o id do grupo de aprovação).
// MODO=ligar: aponta o webhook do bot para a Vercel, com o segredo próprio dele.
import { exigir } from './servicos.js';

const sufixo = process.env.SUFIXO ?? '';
const token = exigir(`TELEGRAM_BOT_TOKEN${sufixo}`);

async function tg(metodo, corpo) {
  const r = await fetch(`https://api.telegram.org/bot${token}/${metodo}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo ?? {}),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(`Telegram ${metodo}: ${j.description}`);
  return j.result;
}

const eu = await tg('getMe');
console.log(`Bot: @${eu.username}`);

if (process.env.MODO === 'ligar') {
  const url = exigir('WEBHOOK_URL');
  await tg('setWebhook', { url, secret_token: exigir(`TELEGRAM_WEBHOOK_SECRET${sufixo}`), allowed_updates: ['message', 'callback_query'] });
  const info = await tg('getWebhookInfo');
  console.log(`Webhook: ${info.url} (pendentes: ${info.pending_update_count})`);
} else {
  const updates = await tg('getUpdates', { allowed_updates: ['message', 'my_chat_member'] });
  const chats = new Map();
  for (const u of updates) {
    const chat = u.message?.chat ?? u.my_chat_member?.chat;
    if (chat) chats.set(chat.id, `${chat.type}: ${chat.title ?? chat.first_name ?? ''}`);
  }
  if (chats.size === 0) console.log('Nenhum chat ainda. Adicione o bot ao grupo e mande /start nele.');
  for (const [id, desc] of chats) console.log(`CHAT ${id} (${desc})`);
}

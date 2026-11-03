import { timingSafeEqual } from 'node:crypto';
import { botoesIdeia, interpretarUpdate, marcaEdicao, textoIdeia } from './_logica.js';

const REPO = 'Lucashso/umbrella-instagram';

async function telegram(metodo, corpo) {
  const r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${metodo}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo),
  });
  if (!r.ok) console.error(`Telegram ${metodo}: ${r.status}`);
}

// A arte precisa de navegador, então o trabalho pesado roda no GitHub Actions.
async function disparar({ acao, id, versao, pedido = '', conta = '' }) {
  const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/aprovacao.yml/dispatches`, {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.GH_DISPATCH_TOKEN}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' },
    body: JSON.stringify({ ref: 'main', inputs: { acao, id, versao: String(versao), pedido, conta } }),
  });
  if (!r.ok) throw new Error(`GitHub respondeu ${r.status}`);
}

function segredoConfere(recebido) {
  const a = Buffer.from(String(recebido ?? ''));
  const b = Buffer.from(process.env.TELEGRAM_WEBHOOK_SECRET ?? '');
  return b.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

const AVISO = { aprovar: '✅ Aprovado. Publicando…', descartar: '❌ Descartado.', ideia_story: '🎬 Criando o story…', ideia_post: '🖼️ Criando o post…' };
const AJUDA = 'Oi! Me mande uma ideia em texto e eu pergunto em qual conta ela entra e se vira story ou post. Tudo volta aqui para você aprovar, editar ou descartar antes de publicar.';

export default async function handler(req, res) {
  if (req.method !== 'POST' || !segredoConfere(req.headers['x-telegram-bot-api-secret-token'])) {
    return res.status(401).end();
  }
  const chat_id = process.env.TELEGRAM_CHAT_ID;
  const a = interpretarUpdate(req.body ?? {}, chat_id);
  try {
    if (a?.tipo === 'perguntar') {
      await telegram('answerCallbackQuery', { callback_query_id: a.callbackId });
      await telegram('sendMessage', {
        chat_id,
        text: `✏️ O que você quer mudar? Responda a esta mensagem.\nEx.: "troque o título por algo mais direto".\n\n${marcaEdicao(a.id, a.versao)}`,
        reply_markup: { force_reply: true },
      });
    } else if (a?.tipo === 'executar') {
      if (a.callbackId) {
        await telegram('answerCallbackQuery', { callback_query_id: a.callbackId, text: AVISO[a.acao] });
        await telegram('editMessageReplyMarkup', { chat_id, message_id: a.mensagemId, reply_markup: { inline_keyboard: [] } });
      } else {
        await telegram('sendMessage', { chat_id, text: '✏️ Editando. A nova versão chega em cerca de 1 minuto.' });
      }
      await disparar(a);
    } else if (a?.tipo === 'ideia') {
      await telegram('sendMessage', {
        chat_id,
        text: textoIdeia(a.pedido),
        reply_markup: { inline_keyboard: botoesIdeia() },
      });
    } else if (a?.tipo === 'so-texto') {
      await telegram('sendMessage', { chat_id, text: 'Por enquanto só entendo texto. Escreva a ideia ou o que quer mudar.' });
    } else if (a?.tipo === 'ajuda') {
      await telegram('sendMessage', { chat_id, text: AJUDA });
    }
  } catch (erro) {
    console.error(erro);
    await telegram('sendMessage', { chat_id, text: `⚠️ Não consegui processar seu pedido: ${erro.message}. Nada foi publicado.` });
  }
  // Sempre 200: outro código faria o Telegram reenviar o mesmo toque.
  return res.status(200).end();
}

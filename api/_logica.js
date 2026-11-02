// O prefixo "_" impede a Vercel de expor este arquivo como rota.
const MARCA_EDICAO = /\[editar (\S+) v(\d+)\]/;
const MAX_PEDIDO = 1000;

export const marcaEdicao = (id, versao) => `[editar ${id} v${versao}]`;

// Traduz um update do Telegram em uma ação. Ignora quem não for o dono do chat.
export function interpretarUpdate(update, chatId) {
  const dono = String(chatId);
  const cb = update.callback_query;
  if (cb) {
    if (String(cb.from?.id) !== dono) return null;
    const m = /^(aprovar|editar|descartar):(\d+):(.+)$/.exec(cb.data ?? '');
    if (!m) return null;
    return {
      acao: m[1], versao: Number(m[2]), id: m[3],
      callbackId: cb.id, mensagemId: cb.message?.message_id,
      tipo: m[1] === 'editar' ? 'perguntar' : 'executar',
    };
  }
  const msg = update.message;
  if (!msg || String(msg.from?.id) !== dono) return null;
  const marca = MARCA_EDICAO.exec(msg.reply_to_message?.text ?? '');
  if (!marca) return { tipo: 'ajuda' };
  const pedido = (msg.text ?? '').trim();
  if (!pedido) return { tipo: 'so-texto' };
  return { tipo: 'executar', acao: 'editar', id: marca[1], versao: Number(marca[2]), pedido: pedido.slice(0, MAX_PEDIDO) };
}

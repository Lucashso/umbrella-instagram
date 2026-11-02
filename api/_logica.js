// O prefixo "_" impede a Vercel de expor este arquivo como rota.
const MARCA_EDICAO = /\[editar (\S+) v(\d+)\]/;
const MAX_PEDIDO = 1000;
const PERGUNTA_IDEIA = 'Viro isso em quê?';

export const marcaEdicao = (id, versao) => `[editar ${id} v${versao}]`;
export const textoIdeia = (ideia) => `💡 ${ideia}\n\n${PERGUNTA_IDEIA}`;
const lerIdeia = (texto = '') => texto.replace(/^💡 /, '').replace(new RegExp(`\\n\\n${PERGUNTA_IDEIA.replace('?', '\\?')}$`), '').trim();

// Traduz um update do Telegram em uma ação. Ignora quem não for o dono do chat.
export function interpretarUpdate(update, chatId) {
  const dono = String(chatId);
  const cb = update.callback_query;
  if (cb) {
    if (String(cb.from?.id) !== dono) return null;
    const base = { callbackId: cb.id, mensagemId: cb.message?.message_id };
    const ideia = /^ideia:(story|post)$/.exec(cb.data ?? '');
    if (ideia) {
      const pedido = lerIdeia(cb.message?.text);
      return pedido ? { ...base, tipo: 'executar', acao: `ideia_${ideia[1]}`, id: 'nova', versao: 0, pedido: pedido.slice(0, MAX_PEDIDO) } : null;
    }
    const m = /^(aprovar|editar|descartar):(\d+):(.+)$/.exec(cb.data ?? '');
    if (!m) return null;
    return { ...base, acao: m[1], versao: Number(m[2]), id: m[3], tipo: m[1] === 'editar' ? 'perguntar' : 'executar' };
  }
  const msg = update.message;
  if (!msg || String(msg.from?.id) !== dono) return null;
  const pedido = (msg.text ?? '').trim();
  if (!pedido) return { tipo: 'so-texto' };
  if (pedido.startsWith('/')) return { tipo: 'ajuda' };
  const marca = MARCA_EDICAO.exec(msg.reply_to_message?.text ?? '');
  if (marca) return { tipo: 'executar', acao: 'editar', id: marca[1], versao: Number(marca[2]), pedido: pedido.slice(0, MAX_PEDIDO) };
  return { tipo: 'ideia', pedido: pedido.slice(0, MAX_PEDIDO) };
}

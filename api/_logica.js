// O prefixo "_" impede a Vercel de expor este arquivo como rota.
const MARCA_EDICAO = /\[editar (\S+) v(\d+)\]/;
const MAX_PEDIDO = 1000;
const PERGUNTA_IDEIA = 'Viro isso em quê?';
// A Vercel publica só api/, então os nomes dos botões ficam aqui; um teste confere com src/contas.js.
export const NOMES_CONTAS = { umbrella: 'Umbrella', leme: 'Leme', priscilla: 'Priscilla', arcana: 'Arcana' };

export const marcaEdicao = (id, versao) => `[editar ${id} v${versao}]`;
export const textoIdeia = (ideia) => `💡 ${ideia}\n\n${PERGUNTA_IDEIA}\n🎬 = story · 🖼️ = post`;

function lerIdeia(texto = '') {
  const fim = texto.lastIndexOf(`\n\n${PERGUNTA_IDEIA}`);
  return (fim === -1 ? texto : texto.slice(0, fim)).replace(/^💡 /, '').trim();
}

// Uma linha por conta ligada: story à esquerda, post à direita.
export function botoesIdeia(ativas = process.env.CONTAS_ATIVAS) {
  const ids = (ativas || 'umbrella').split(',').map((s) => s.trim()).filter((id) => id in NOMES_CONTAS);
  return ids.map((id) => [
    { text: `🎬 ${NOMES_CONTAS[id]}`, callback_data: `ideia:${id}:story` },
    { text: `🖼️ ${NOMES_CONTAS[id]}`, callback_data: `ideia:${id}:post` },
  ]);
}

// Traduz um update do Telegram em uma ação. Ignora quem não for o dono do chat.
export function interpretarUpdate(update, chatId) {
  const dono = String(chatId);
  const cb = update.callback_query;
  if (cb) {
    if (String(cb.from?.id) !== dono) return null;
    const base = { callbackId: cb.id, mensagemId: cb.message?.message_id };
    // Mensagens antigas têm "ideia:story", sem conta: valem para a Umbrella.
    const ideia = /^ideia:(?:(\w+):)?(story|post)$/.exec(cb.data ?? '');
    if (ideia) {
      const conta = ideia[1] ?? 'umbrella';
      const pedido = lerIdeia(cb.message?.text);
      if (!(conta in NOMES_CONTAS) || !pedido) return null;
      return { ...base, tipo: 'executar', acao: `ideia_${ideia[2]}`, conta, id: 'nova', versao: 0, pedido: pedido.slice(0, MAX_PEDIDO) };
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

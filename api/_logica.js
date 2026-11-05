// O prefixo "_" impede a Vercel de expor este arquivo como rota.
const MARCA_EDICAO = /\[editar (\S+) v(\d+)\]/;
const MAX_PEDIDO = 1000;
const PERGUNTA_IDEIA = 'Viro isso em quê?';
// A Vercel publica só api/, então os nomes dos botões ficam aqui; um teste confere com src/contas.js.
export const NOMES_CONTAS = { umbrella: 'Umbrella', leme: 'Leme', lemehub: 'Leme Hub', priscilla: 'Priscilla', arcana: 'Arcana' };
// Contas aprovadas em outro bot (sufixo das variáveis); as demais ficam no bot de sempre.
export const BOT_DA_CONTA = { lemehub: '_LEMEHUB' };

export const marcaEdicao = (id, versao) => `[editar ${id} v${versao}]`;
export const textoIdeia = (ideia) => `💡 ${ideia}\n\n${PERGUNTA_IDEIA}\n🎬 = story · 🖼️ = post`;

function lerIdeia(texto = '') {
  const fim = texto.lastIndexOf(`\n\n${PERGUNTA_IDEIA}`);
  return (fim === -1 ? texto : texto.slice(0, fim)).replace(/^💡 /, '').trim();
}

// Uma linha por conta ligada deste bot: story à esquerda, post à direita.
export function botoesIdeia(ativas = process.env.CONTAS_ATIVAS, bot = '') {
  const ids = (ativas || 'umbrella').split(',').map((s) => s.trim())
    .filter((id) => id in NOMES_CONTAS && (BOT_DA_CONTA[id] ?? '') === bot);
  return ids.map((id) => [
    { text: `🎬 ${NOMES_CONTAS[id]}`, callback_data: `ideia:${id}:story` },
    { text: `🖼️ ${NOMES_CONTAS[id]}`, callback_data: `ideia:${id}:post` },
  ]);
}

// Traduz um update do Telegram em uma ação. Só vale o que vem do chat de aprovação: a conversa
// privada com o dono ou o grupo de aprovação (onde qualquer membro aprova).
export function interpretarUpdate(update, chatId) {
  const dono = String(chatId);
  const cb = update.callback_query;
  if (cb) {
    if (String(cb.message?.chat?.id ?? cb.from?.id) !== dono) return null;
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
  if (!msg || String(msg.chat?.id ?? msg.from?.id) !== dono) return null;
  let pedido = (msg.text ?? '').trim();
  if (!pedido) return { tipo: 'so-texto' };
  // Em grupo o bot só recebe comandos e respostas a ele: a ideia vem como "/ideia texto".
  const comando = /^\/ideia(?:@\w+)?\s+([\s\S]+)$/i.exec(pedido);
  if (comando) pedido = comando[1].trim();
  else if (pedido.startsWith('/')) return { tipo: 'ajuda' };
  const marca = MARCA_EDICAO.exec(msg.reply_to_message?.text ?? '');
  if (marca) return { tipo: 'executar', acao: 'editar', id: marca[1], versao: Number(marca[2]), pedido: pedido.slice(0, MAX_PEDIDO) };
  return { tipo: 'ideia', pedido: pedido.slice(0, MAX_PEDIDO) };
}

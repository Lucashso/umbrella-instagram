import { mkdirSync, readFileSync } from 'node:fs';
import { rotulo } from './contas.js';
import { arteEstoura, montarSlides, renderizarJpeg } from './render.js';
import { enviarParaAprovacao, hospedar } from './servicos.js';
import { montarLegenda } from './validar.js';

// Verdadeiro se qualquer slide do post estourar.
export const conferidor = (etapa, tema, conta) => async (post) => {
  for (const html of montarSlides(post, etapa, tema, conta)) {
    if (await arteEstoura(html)) return true;
  }
  return false;
};

export const fraseDe = (post, etapa) => (etapa === 'story' ? post.frase : `${post.titulo} ${post.destaque}`);

// O @ abre a mensagem porque todas as contas são aprovadas no mesmo chat.
export function textoAprovacao(post, etapa, legenda, conta) {
  if (etapa !== 'story') return `📸 ${rotulo(conta)}\n\n${legenda}`;
  const titulo = conta.assistente ? `Story do ${conta.assistente}` : 'Story';
  return `🎬 ${titulo} · ${rotulo(conta)}\n\n${post.frase}\n${post.detalhe}`;
}

// Monta as artes, hospeda e manda para aprovação. Devolve os dados a guardar no histórico.
export async function prepararEEnviar({ id, versao, post, etapa, tema, conta }) {
  mkdirSync('saida', { recursive: true });
  const imagens = [];
  for (const [i, html] of montarSlides(post, etapa, tema, conta).entries()) {
    const arquivo = `saida/${id}-v${versao}-${i + 1}.jpg`;
    await renderizarJpeg(html, arquivo);
    imagens.push(await hospedar(readFileSync(arquivo), `${id}-v${versao}-${i + 1}`));
  }
  // Story não tem legenda: o texto vai só para quem aprova ler.
  const legenda = etapa === 'story' ? '' : montarLegenda(post);
  await enviarParaAprovacao(id, versao, imagens, textoAprovacao(post, etapa, legenda, conta));
  return { imagens, legenda };
}

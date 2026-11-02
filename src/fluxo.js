import { mkdirSync, readFileSync } from 'node:fs';
import { arteEstoura, montarSlides, renderizarJpeg } from './render.js';
import { enviarParaAprovacao, hospedar } from './servicos.js';
import { montarLegenda } from './validar.js';

// Verdadeiro se qualquer slide do post estourar.
export const conferidor = (etapa, tema) => async (post) => {
  for (const html of montarSlides(post, etapa, tema)) {
    if (await arteEstoura(html)) return true;
  }
  return false;
};

// Monta as artes, hospeda e manda para aprovação. Devolve os dados a guardar no histórico.
export async function prepararEEnviar({ id, versao, post, etapa, tema }) {
  mkdirSync('saida', { recursive: true });
  const imagens = [];
  for (const [i, html] of montarSlides(post, etapa, tema).entries()) {
    const arquivo = `saida/${id}-v${versao}-${i + 1}.jpg`;
    await renderizarJpeg(html, arquivo);
    imagens.push(await hospedar(readFileSync(arquivo), `${id}-v${versao}-${i + 1}`));
  }
  const legenda = montarLegenda(post);
  await enviarParaAprovacao(id, versao, imagens, legenda);
  return { imagens, legenda };
}

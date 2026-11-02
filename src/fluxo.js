import { mkdirSync, readFileSync } from 'node:fs';
import { arteEstoura, montarHtml, renderizarJpeg } from './render.js';
import { enviarParaAprovacao, hospedar } from './servicos.js';
import { montarLegenda } from './validar.js';

export const conferidor = (etapa, tema) => (post) => arteEstoura(montarHtml(post, etapa, tema));

// Monta a arte, hospeda e manda para aprovação. Devolve os dados a guardar no histórico.
export async function prepararEEnviar({ id, versao, post, etapa, tema }) {
  mkdirSync('saida', { recursive: true });
  const arquivo = `saida/${id}-v${versao}.jpg`;
  await renderizarJpeg(montarHtml(post, etapa, tema), arquivo);
  const imagem = await hospedar(readFileSync(arquivo), `${id}-v${versao}`);
  const legenda = montarLegenda(post);
  await enviarParaAprovacao(id, versao, imagem, legenda);
  return { imagem, legenda };
}

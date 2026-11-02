import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { hojeBrasilia, proximoPost } from './plano.js';
import { escreverPost } from './redator.js';
import { arteEstoura, montarHtml, renderizarJpeg } from './render.js';
import { avisar, enviarParaVeto, hospedar, lerHistorico, salvarHistorico } from './servicos.js';
import { montarLegenda } from './validar.js';

const temas = JSON.parse(readFileSync(resolve(import.meta.dirname, '..', 'conteudo', 'temas.json'), 'utf8'));

try {
  const historico = lerHistorico();
  const data = hojeBrasilia();
  if (historico.some((p) => p.data === data)) {
    console.log(`Já existe post para ${data}.`);
    process.exit(0);
  }

  const plano = proximoPost(historico, temas);
  const post = await escreverPost(plano, (p) => arteEstoura(montarHtml(p, plano.etapa, plano.tema)));
  mkdirSync('saida', { recursive: true });
  const arquivo = `saida/${data}.jpg`;
  await renderizarJpeg(montarHtml(post, plano.etapa, plano.tema), arquivo);

  const id = `${data}-${plano.tema.id}-${plano.etapa}`;
  const imagem = await hospedar(readFileSync(arquivo), id);
  const legenda = montarLegenda(post);
  await enviarParaVeto(id, imagem, legenda, process.env.HORARIO_PUBLICACAO ?? '11h30');

  historico.push({ id, data, tema: plano.tema.id, etapa: plano.etapa, frase: `${post.titulo} ${post.destaque}`, imagem, legenda, status: 'pendente' });
  salvarHistorico(historico);
  console.log(`Post ${id} enviado para aprovação.`);
} catch (erro) {
  console.error(erro);
  await avisar(`⚠️ Instagram Umbrella: não consegui gerar o post de hoje.\n${erro.message}`).catch(console.error);
  process.exit(1);
}

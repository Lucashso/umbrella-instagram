import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { conferidor, prepararEEnviar } from './fluxo.js';
import { hojeBrasilia, proximoPost } from './plano.js';
import { escreverPost } from './redator.js';
import { avisar, enviarBotoes, lerHistorico, salvarHistorico } from './servicos.js';

const temas = JSON.parse(readFileSync(resolve(import.meta.dirname, '..', 'conteudo', 'temas.json'), 'utf8'));

try {
  const historico = lerHistorico();
  const data = hojeBrasilia();

  // Sem aprovação nada avança: lembra do post parado em vez de criar outro.
  const parado = historico.find((p) => p.status === 'pendente');
  if (parado) {
    await enviarBotoes(parado.id, parado.versao, `⏳ Este post ainda espera sua decisão, então não gerei um novo hoje:\n\n${parado.legenda}`);
    process.exit(0);
  }
  if (historico.some((p) => p.data === data)) {
    console.log(`Já existe post para ${data}.`);
    process.exit(0);
  }

  const { tema, etapa, anteriores } = proximoPost(historico, temas);
  const post = await escreverPost({ tema, etapa, anteriores }, conferidor(etapa, tema));
  const id = `${data}-${tema.id}-${etapa}`;
  const { imagens, legenda } = await prepararEEnviar({ id, versao: 1, post, etapa, tema });

  historico.push({ id, data, tema: tema.id, etapa, versao: 1, frase: `${post.titulo} ${post.destaque}`, post, imagens, legenda, status: 'pendente' });
  salvarHistorico(historico);
  console.log(`Post ${id} enviado para aprovação.`);
} catch (erro) {
  console.error(erro);
  await avisar(`⚠️ Instagram Umbrella: não consegui gerar o post de hoje.\n${erro.message}`).catch(console.error);
  process.exit(1);
}

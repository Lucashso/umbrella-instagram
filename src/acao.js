// Executa o que foi pedido pelo Telegram. Roda no GitHub Actions, disparado pelo webhook.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { conferidor, prepararEEnviar } from './fluxo.js';
import { reescreverPost } from './redator.js';
import { avisar, enviarBotoes, exigir, lerHistorico, publicarNoInstagram, salvarHistorico } from './servicos.js';

const temas = JSON.parse(readFileSync(resolve(import.meta.dirname, '..', 'conteudo', 'temas.json'), 'utf8'));
const acao = exigir('ACAO');
const id = exigir('POST_ID');
const versao = Number(exigir('POST_VERSAO'));

const historico = lerHistorico();
const entrada = historico.find((p) => p.id === id);

try {
  if (!entrada) {
    await avisar(`Não encontrei o post ${id}.`);
  } else if (entrada.status !== 'pendente') {
    await avisar(`Nada feito: este post já está como "${entrada.status}".`);
  } else if (entrada.versao !== versao) {
    await avisar(`Nada feito: você tocou em uma versão antiga. A atual é a versão ${entrada.versao}, e os botões dela continuam valendo.`);
  } else if (acao === 'descartar') {
    entrada.status = 'descartado';
    await avisar('Post descartado. Amanhã gero um novo para a mesma etapa da sequência.');
  } else if (acao === 'editar') {
    const tema = temas.find((t) => t.id === entrada.tema);
    const post = await reescreverPost({ tema, etapa: entrada.etapa, post: entrada.post, pedido: exigir('PEDIDO') }, conferidor(entrada.etapa, tema));
    const nova = entrada.versao + 1;
    const { imagem, legenda } = await prepararEEnviar({ id, versao: nova, post, etapa: entrada.etapa, tema });
    Object.assign(entrada, { versao: nova, post, imagem, legenda, frase: `${post.titulo} ${post.destaque}` });
  } else if (acao === 'aprovar') {
    if (process.env.PUBLICAR_DE_VERDADE !== 'sim') {
      // Trava: enquanto a variável não for "sim", nada vai para o Instagram.
      entrada.status = 'simulado';
      await avisar(`Teste: aprovado, mas a publicação está travada, então nada foi ao Instagram.\n${id}`);
    } else {
      entrada.media_id = await publicarNoInstagram(exigir('IG_USER_ID'), entrada.imagem, entrada.legenda, exigir('IG_ACCESS_TOKEN'));
      entrada.status = 'publicado';
      await avisar('✅ Publicado no Instagram.');
    }
  } else {
    throw new Error(`Ação desconhecida: ${acao}`);
  }
} catch (erro) {
  console.error(erro);
  process.exitCode = 1;
  // O post continua pendente; os botões novos permitem tentar de novo.
  const texto = acao === 'editar'
    ? `⚠️ Não consegui editar: ${erro.message}\nA versão anterior continua valendo.`
    : `⚠️ A publicação falhou: ${erro.message}\nConfira o Instagram antes de tentar de novo.`;
  await enviarBotoes(id, versao, texto).catch(console.error);
} finally {
  salvarHistorico(historico);
}

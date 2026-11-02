// Executa o que foi pedido pelo Telegram. Roda no GitHub Actions, disparado pelo webhook.
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { conferidor, fraseDe, prepararEEnviar } from './fluxo.js';
import { hojeBrasilia, temaLivre } from './plano.js';
import { escreverPost, reescreverPost } from './redator.js';
import { avisar, enviarBotoes, exigir, lerHistorico, publicarNoInstagram, publicarStory, salvarHistorico } from './servicos.js';

const temas = JSON.parse(readFileSync(resolve(import.meta.dirname, '..', 'conteudo', 'temas.json'), 'utf8'));
const acao = exigir('ACAO');
const id = exigir('POST_ID');
const versao = Number(exigir('POST_VERSAO'));

const historico = lerHistorico();
const entrada = historico.find((p) => p.id === id);

// Pedido da social media: não entra na sequência dor, CRM resolve e dica.
async function criarDaIdeia(tipo) {
  const assunto = exigir('PEDIDO');
  const etapa = tipo === 'story' ? 'story' : 'ideia';
  const tema = temaLivre(assunto, temas);
  const post = await escreverPost({ tema, etapa, anteriores: [] }, conferidor(etapa, tema));
  const data = hojeBrasilia();
  const novoId = `${data}-${tipo}-${randomBytes(3).toString('hex')}`;
  const { imagens, legenda } = await prepararEEnviar({ id: novoId, versao: 1, post, etapa, tema });
  historico.push({ id: novoId, data, tipo, assunto, etapa, versao: 1, frase: fraseDe(post, etapa), post, imagens, legenda, status: 'pendente' });
}

try {
  if (acao === 'ideia_story' || acao === 'ideia_post') {
    await criarDaIdeia(acao === 'ideia_story' ? 'story' : 'post');
  } else if (!entrada) {
    await avisar(`Não encontrei o post ${id}.`);
  } else if (entrada.status !== 'pendente') {
    await avisar(`Nada feito: este conteúdo já está como "${entrada.status}".`);
  } else if (entrada.versao !== versao) {
    await avisar(`Nada feito: você tocou em uma versão antiga. A atual é a versão ${entrada.versao}, e os botões dela continuam valendo.`);
  } else if (acao === 'descartar') {
    entrada.status = 'descartado';
    await avisar(entrada.tipo ? 'Descartado.' : 'Post descartado. Amanhã gero um novo para a mesma etapa da sequência.');
  } else if (acao === 'editar') {
    const tema = entrada.tipo ? temaLivre(entrada.assunto, temas) : temas.find((t) => t.id === entrada.tema);
    const post = await reescreverPost({ tema, etapa: entrada.etapa, post: entrada.post, pedido: exigir('PEDIDO') }, conferidor(entrada.etapa, tema));
    const nova = entrada.versao + 1;
    const { imagens, legenda } = await prepararEEnviar({ id, versao: nova, post, etapa: entrada.etapa, tema });
    Object.assign(entrada, { versao: nova, post, imagens, legenda, frase: fraseDe(post, entrada.etapa) });
    delete entrada.imagem;
  } else if (acao === 'aprovar') {
    if (process.env.PUBLICAR_DE_VERDADE !== 'sim') {
      // Trava: enquanto a variável não for "sim", nada vai para o Instagram.
      entrada.status = 'simulado';
      await avisar(`Teste: aprovado, mas a publicação está travada, então nada foi ao Instagram.\n${id}`);
    } else if (entrada.tipo === 'story') {
      entrada.media_id = await publicarStory(exigir('IG_USER_ID'), entrada.imagens[0], exigir('IG_ACCESS_TOKEN'));
      entrada.status = 'publicado';
      await avisar('✅ Story publicado no Instagram.');
    } else {
      entrada.media_id = await publicarNoInstagram(exigir('IG_USER_ID'), entrada.imagens ?? [entrada.imagem], entrada.legenda, exigir('IG_ACCESS_TOKEN'));
      entrada.status = 'publicado';
      await avisar('✅ Publicado no Instagram.');
    }
  } else {
    throw new Error(`Ação desconhecida: ${acao}`);
  }
} catch (erro) {
  console.error(erro);
  process.exitCode = 1;
  if (acao.startsWith('ideia_')) {
    await avisar(`⚠️ Não consegui criar a partir dessa ideia: ${erro.message}\nReformule e me mande de novo.`).catch(console.error);
  } else {
    // O conteúdo continua pendente; os botões novos permitem tentar de novo.
    const texto = acao === 'editar'
      ? `⚠️ Não consegui editar: ${erro.message}\nA versão anterior continua valendo.`
      : `⚠️ A publicação falhou: ${erro.message}\nConfira o Instagram antes de tentar de novo.`;
    await enviarBotoes(id, versao, texto).catch(console.error);
  }
} finally {
  salvarHistorico(historico);
}

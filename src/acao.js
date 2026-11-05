// Executa o que foi pedido pelo Telegram. Roda no GitHub Actions, disparado pelo webhook.
import { randomBytes } from 'node:crypto';
import { CONTAS, contaDe, contasAtivas, rotulo, temasDe } from './contas.js';
import { conferidor, fraseDe, prepararEEnviar } from './fluxo.js';
import { hojeBrasilia, temaLivre } from './plano.js';
import { escreverPost, reescreverPost } from './redator.js';
import { avisar, conferirConta, credenciais, enviarBotoes, exigir, lerHistorico, publicarNoInstagram, publicarStory, salvarHistorico, usarCanal } from './servicos.js';

const acao = exigir('ACAO');
const id = exigir('POST_ID');
const versao = Number(exigir('POST_VERSAO'));

const historico = lerHistorico();
const entrada = historico.find((p) => p.id === id);
// Responde no chat do bot da conta: a Leme Hub tem bot e grupo próprios.
usarCanal(entrada ? contaDe(entrada) : CONTAS[process.env.CONTA || 'umbrella']);

// Pedido da social media: não entra na sequência da conta.
async function criarDaIdeia(tipo) {
  const conta = CONTAS[process.env.CONTA || 'umbrella'];
  if (!conta || !contasAtivas().includes(conta)) throw new Error(`a conta "${process.env.CONTA}" ainda não está ligada`);
  const assunto = exigir('PEDIDO');
  const etapa = tipo === 'story' ? 'story' : 'ideia';
  const tema = temaLivre(assunto, temasDe(conta));
  const post = await escreverPost({ tema, etapa, anteriores: [], conta }, conferidor(etapa, tema, conta));
  const data = hojeBrasilia();
  const novoId = `${conta.prefixo}${data}-${tipo}-${randomBytes(3).toString('hex')}`;
  const { imagens, legenda } = await prepararEEnviar({ id: novoId, versao: 1, post, etapa, tema, conta });
  historico.push({ ...(conta.prefixo && { conta: conta.id }), id: novoId, data, tipo, assunto, etapa, versao: 1, frase: fraseDe(post, etapa), post, imagens, legenda, status: 'pendente' });
}

async function publicar(conta) {
  const { igId, token } = credenciais(conta);
  // Última barreira contra publicar no perfil errado: nada sai se o @ do token não for o esperado.
  await conferirConta(igId, token, conta.usuario);
  if (entrada.tipo === 'story') return publicarStory(igId, entrada.imagens[0], token);
  return publicarNoInstagram(igId, entrada.imagens ?? [entrada.imagem], entrada.legenda, token);
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
    const conta = contaDe(entrada);
    const temas = temasDe(conta);
    const tema = entrada.tipo ? temaLivre(entrada.assunto, temas) : temas.find((t) => t.id === entrada.tema);
    const post = await reescreverPost({ tema, etapa: entrada.etapa, post: entrada.post, pedido: exigir('PEDIDO'), conta }, conferidor(entrada.etapa, tema, conta));
    const nova = entrada.versao + 1;
    const { imagens, legenda } = await prepararEEnviar({ id, versao: nova, post, etapa: entrada.etapa, tema, conta });
    Object.assign(entrada, { versao: nova, post, imagens, legenda, frase: fraseDe(post, entrada.etapa) });
    delete entrada.imagem;
  } else if (acao === 'aprovar') {
    const conta = contaDe(entrada);
    if (process.env.PUBLICAR_DE_VERDADE !== 'sim') {
      // Trava: enquanto a variável não for "sim", nada vai para o Instagram.
      entrada.status = 'simulado';
      await avisar(`Teste: aprovado, mas a publicação está travada, então nada foi ao Instagram.\n${id}`);
    } else {
      entrada.media_id = await publicar(conta);
      entrada.status = 'publicado';
      await avisar(`✅ ${entrada.tipo === 'story' ? 'Story publicado' : 'Publicado'} em ${rotulo(conta)}.`);
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

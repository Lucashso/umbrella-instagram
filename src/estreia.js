// Publica os posts de estreia de uma conta, na ordem do arquivo. Pedido direto do Lucas, sem passar pelo Telegram.
// Roda uma vez: o que já está publicado no histórico é pulado, então rodar de novo não duplica.
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CONTAS, rotulo, temasDe } from './contas.js';
import { fraseDe } from './fluxo.js';
import { hojeBrasilia } from './plano.js';
import { arteEstoura, montarSlides, renderizarJpeg } from './render.js';
import { avisar, conferirConta, credenciais, exigir, hospedar, lerHistorico, publicarNoInstagram, salvarHistorico } from './servicos.js';
import { montarLegenda, validarPost } from './validar.js';

const conta = CONTAS[exigir('CONTA')];
if (!conta) throw new Error(`conta desconhecida: ${process.env.CONTA}`);
if (process.env.PUBLICAR_DE_VERDADE !== 'sim') throw new Error('a publicação está travada (PUBLICAR_DE_VERDADE)');

const posts = JSON.parse(readFileSync(resolve(import.meta.dirname, '..', 'conteudo', `estreia-${conta.id}.json`), 'utf8'));
const tema = temasDe(conta)[0];
const historico = lerHistorico();
const { igId, token } = credenciais(conta);
await conferirConta(igId, token, conta.usuario);

mkdirSync('saida', { recursive: true });
try {
  for (const { id, etapa, post } of posts) {
    if (historico.some((p) => p.id === id && p.status === 'publicado')) {
      console.log(`${id}: já publicado, pulei.`);
      continue;
    }
    const erros = validarPost(post, etapa, conta.persona);
    if (erros.length) throw new Error(`${id}: ${erros.join('; ')}`);
    // No carrossel de recursos, "Passo 1 de 3" vira "Recurso 1 de 3".
    const slides = montarSlides(post, etapa, tema, conta).map((h) => h.replace(/Passo (\d) de (\d)/, 'Recurso $1 de $2'));
    const imagens = [];
    for (const [i, html] of slides.entries()) {
      if (await arteEstoura(html)) throw new Error(`${id}: o slide ${i + 1} não coube`);
      const arquivo = `saida/${id}-${i + 1}.jpg`;
      await renderizarJpeg(html, arquivo);
      imagens.push(await hospedar(readFileSync(arquivo), `${id}-${i + 1}`));
    }
    const legenda = montarLegenda(post);
    const media_id = await publicarNoInstagram(igId, imagens, legenda, token);
    historico.push({ conta: conta.id, id, data: hojeBrasilia(), tipo: 'post', assunto: 'estreia do perfil', etapa, versao: 1, frase: fraseDe(post, etapa), post, imagens, legenda, status: 'publicado', media_id });
    salvarHistorico(historico);
    console.log(`${id}: publicado (${media_id}).`);
    await avisar(`✅ Estreia publicada em ${rotulo(conta)}: ${fraseDe(post, etapa)}`);
  }
} catch (erro) {
  await avisar(`⚠️ A estreia de ${rotulo(conta)} parou: ${erro.message}\nO que já saiu está no perfil; rodar de novo continua de onde parou.`).catch(console.error);
  throw erro;
}

import { hojeBrasilia } from './plano.js';
import { avisar, exigir, foiVetado, lerHistorico, obterToken, publicarNoInstagram, salvarHistorico } from './servicos.js';

const historico = lerHistorico();
const post = historico.find((p) => p.data === hojeBrasilia() && p.status === 'pendente');

try {
  if (!post) {
    console.log('Nenhum post pendente hoje.');
    process.exit(0);
  }
  if (await foiVetado(post.id)) {
    post.status = 'vetado';
    await avisar('Combinado: post vetado. Amanhã gero um novo para a mesma etapa da sequência.');
  } else if (process.env.PUBLICAR_DE_VERDADE !== 'sim') {
    // Trava: enquanto a variável não for "sim", nada vai para o Instagram.
    post.status = 'simulado';
    await avisar(`Teste: este post seria publicado agora, mas a publicação está travada.\n${post.id}`);
  } else {
    const token = await obterToken();
    post.media_id = await publicarNoInstagram(exigir('IG_USER_ID'), post.imagem, post.legenda, token);
    post.status = 'publicado';
    await avisar(`✅ Post publicado no Instagram: ${post.id}`);
  }
} catch (erro) {
  console.error(erro);
  if (post) post.status = 'falhou';
  await avisar(`⚠️ Instagram Umbrella: a publicação de hoje falhou.\n${erro.message}`).catch(console.error);
  process.exitCode = 1;
} finally {
  salvarHistorico(historico);
}

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { conferidor, fraseDe, prepararEEnviar } from './fluxo.js';
import { hojeBrasilia, proximoPost, temaLivre } from './plano.js';
import { escreverPost } from './redator.js';
import { avisar, enviarBotoes, lerHistorico, salvarHistorico } from './servicos.js';

const temas = JSON.parse(readFileSync(resolve(import.meta.dirname, '..', 'conteudo', 'temas.json'), 'utf8'));
const historico = lerHistorico();
const data = hojeBrasilia();

async function passoPost() {
  // Sem aprovação a sequência não avança: lembra do post parado em vez de criar outro.
  const parado = historico.find((p) => !p.tipo && p.status === 'pendente');
  if (parado) {
    await enviarBotoes(parado.id, parado.versao, `⏳ Este post ainda espera sua decisão, então não gerei um novo hoje:\n\n${parado.legenda}`);
    return;
  }
  if (historico.some((p) => !p.tipo && p.data === data)) {
    console.log(`Já existe post para ${data}.`);
    return;
  }
  const { tema, etapa, anteriores } = proximoPost(historico, temas);
  const post = await escreverPost({ tema, etapa, anteriores }, conferidor(etapa, tema));
  const id = `${data}-${tema.id}-${etapa}`;
  const { imagens, legenda } = await prepararEEnviar({ id, versao: 1, post, etapa, tema });
  historico.push({ id, data, tema: tema.id, etapa, versao: 1, frase: fraseDe(post, etapa), post, imagens, legenda, status: 'pendente' });
  console.log(`Post ${id} enviado para aprovação.`);
}

async function passoStory() {
  const id = `${data}-story-umbi`;
  if (historico.some((p) => p.id === id)) {
    console.log(`Já existe story para ${data}.`);
    return;
  }
  // Story do dia anterior sem resposta perdeu o momento e não trava nada.
  for (const p of historico) {
    if (p.tipo === 'story' && p.status === 'pendente' && p.diario && p.data < data) p.status = 'expirado';
  }
  // O story conversa com o assunto do post da vez, sem precisar vender.
  const { tema: doDia } = proximoPost(historico.filter((p) => p.status === 'publicado'), temas);
  const assunto = `Story diário de bom humor sobre a rotina do corretor. Inspiração de hoje: ${doDia.assunto}.`;
  const tema = temaLivre(assunto, temas);
  const anteriores = historico.filter((p) => p.tipo === 'story' && p.status === 'publicado').slice(-15).map((p) => ({ etapa: 'story', frase: p.frase }));
  const post = await escreverPost({ tema, etapa: 'story', anteriores }, conferidor('story', tema));
  const { imagens, legenda } = await prepararEEnviar({ id, versao: 1, post, etapa: 'story', tema });
  historico.push({ id, data, tipo: 'story', diario: true, assunto, etapa: 'story', versao: 1, frase: fraseDe(post, 'story'), post, imagens, legenda, status: 'pendente' });
  console.log(`Story ${id} enviado para aprovação.`);
}

// Um passo com falha não impede o outro; o erro aparece no Telegram e no GitHub.
let falhou = false;
for (const [nome, passo] of [['o post', passoPost], ['o story', passoStory]]) {
  try {
    await passo();
  } catch (erro) {
    falhou = true;
    console.error(erro);
    await avisar(`⚠️ Instagram Umbrella: não consegui gerar ${nome} de hoje.\n${erro.message}`).catch(console.error);
  }
  salvarHistorico(historico);
}
if (falhou) process.exitCode = 1;

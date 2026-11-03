import { conferidor, fraseDe, prepararEEnviar } from './fluxo.js';
import { contaDe, contasAtivas, rotulo, temasDe } from './contas.js';
import { hojeBrasilia, proximoPost, temaLivre } from './plano.js';
import { escreverPost } from './redator.js';
import { avisar, enviarBotoes, lerHistorico, salvarHistorico } from './servicos.js';

const historico = lerHistorico();
const data = hojeBrasilia();

// Cada conta só enxerga o próprio histórico. A entrada da Umbrella não leva `conta`, como as antigas.
const registrar = (conta, entrada) => historico.push({ ...(conta.prefixo && { conta: conta.id }), ...entrada });

async function passoPost(conta, doHistorico, temas) {
  // Sem aprovação a sequência não avança: lembra do post parado em vez de criar outro.
  const parado = doHistorico.find((p) => !p.tipo && p.status === 'pendente');
  if (parado) {
    await enviarBotoes(parado.id, parado.versao, `📸 ${rotulo(conta)}\n⏳ Este post ainda espera sua decisão, então não gerei um novo hoje:\n\n${parado.legenda}`);
    return;
  }
  if (doHistorico.some((p) => !p.tipo && p.data === data)) {
    console.log(`${conta.id}: já existe post para ${data}.`);
    return;
  }
  const { tema, etapa, anteriores } = proximoPost(doHistorico, temas, conta.etapas, conta.inicio);
  const post = await escreverPost({ tema, etapa, anteriores, conta }, conferidor(etapa, tema, conta));
  const id = `${conta.prefixo}${data}-${tema.id}-${etapa}`;
  const { imagens, legenda } = await prepararEEnviar({ id, versao: 1, post, etapa, tema, conta });
  registrar(conta, { id, data, tema: tema.id, etapa, versao: 1, frase: fraseDe(post, etapa), post, imagens, legenda, status: 'pendente' });
  console.log(`Post ${id} enviado para aprovação.`);
}

async function passoStory(conta, doHistorico, temas) {
  const id = conta.persona === 'umbi' ? `${data}-story-umbi` : `${conta.prefixo}${data}-story`;
  if (doHistorico.some((p) => p.id === id)) {
    console.log(`${conta.id}: já existe story para ${data}.`);
    return;
  }
  // Story do dia anterior sem resposta perdeu o momento e não trava nada.
  for (const p of doHistorico) {
    if (p.tipo === 'story' && p.status === 'pendente' && p.diario && p.data < data) p.status = 'expirado';
  }
  // O story conversa com o assunto do post da vez, sem precisar vender.
  const { tema: doDia } = proximoPost(doHistorico.filter((p) => p.status === 'publicado'), temas, conta.etapas, conta.inicio);
  const assunto = conta.persona === 'umbi'
    ? `Story diário de bom humor sobre a rotina do corretor. Inspiração de hoje: ${doDia.assunto}.`
    : `Story diário leve e próximo. Inspiração de hoje: ${doDia.assunto}.`;
  const tema = temaLivre(assunto, temas);
  const anteriores = doHistorico.filter((p) => p.tipo === 'story' && p.status === 'publicado').slice(-15).map((p) => ({ etapa: 'story', frase: p.frase }));
  const post = await escreverPost({ tema, etapa: 'story', anteriores, conta }, conferidor('story', tema, conta));
  const { imagens, legenda } = await prepararEEnviar({ id, versao: 1, post, etapa: 'story', tema, conta });
  registrar(conta, { id, data, tipo: 'story', diario: true, assunto, etapa: 'story', versao: 1, frase: fraseDe(post, 'story'), post, imagens, legenda, status: 'pendente' });
  console.log(`Story ${id} enviado para aprovação.`);
}

// Um passo com falha não impede os outros; o erro aparece no Telegram e no GitHub.
let falhou = false;
for (const conta of contasAtivas()) {
  const temas = temasDe(conta);
  for (const [nome, passo] of [['o post', passoPost], ['o story', passoStory]]) {
    try {
      await passo(conta, historico.filter((p) => contaDe(p) === conta), temas);
    } catch (erro) {
      falhou = true;
      console.error(erro);
      await avisar(`⚠️ ${rotulo(conta)}: não consegui gerar ${nome} de hoje.\n${erro.message}`).catch(console.error);
    }
    salvarHistorico(historico);
  }
}
if (falhou) process.exitCode = 1;

import Anthropic from '@anthropic-ai/sdk';
import { validarPost } from './validar.js';

const texto = { type: 'string' };
const comum = { eyebrow: texto, titulo: texto, destaque: texto, legenda: texto, hashtags: { type: 'array', items: texto } };

function esquema(etapa, tema) {
  if (etapa === 'story') {
    const properties = { frase: texto, detalhe: texto, pose: { type: 'string', enum: ['falando', 'pensando', 'ok', 'comemorando'] } };
    return { type: 'object', properties, required: Object.keys(properties), additionalProperties: false };
  }
  const extras = etapa === 'dor' || etapa === 'ideia' ? { apoio: texto }
    : etapa === 'dica' ? {
      passos: { type: 'array', items: { type: 'object', properties: { titulo: texto, texto }, required: ['titulo', 'texto'], additionalProperties: false } },
      rodape: texto,
    }
    : tema.visual === 'chat' ? { fala: texto, resposta: texto }
    : {};
  const properties = { ...comum, ...extras };
  return { type: 'object', properties, required: Object.keys(properties), additionalProperties: false };
}

const SISTEMA = `Você é redator do Instagram do Umbrella CRM, um CRM para corretores de seguro de vida no Brasil. Escreva em português do Brasil, direto e humano, falando com o corretor por "você".

Os posts seguem uma sequência de três dias sobre o mesmo assunto:
- dor: mostra uma situação real do dia a dia do corretor. Não cita o produto nem vende nada.
- solucao: mostra como o Umbrella CRM resolve aquela dor, usando somente o recurso descrito.
- dica: dá uma dica prática de venda ligada ao assunto, útil mesmo para quem não usa o CRM. Não vende o produto.
- ideia: post avulso pedido pela social media no campo ASSUNTO. Siga a ideia dela, sempre dentro das regras abaixo.

Regras que nunca podem ser quebradas:
- Só afirme sobre o produto o que está no campo RECURSO. Não invente funções, integrações, números, preços ou resultados.
- Sem estatísticas, percentuais, valores em reais, promessas de resultado ou superlativos.
- Sem nome de seguradora e sem pessoa real. Na fala de exemplo, use primeiros nomes comuns.
- Nada que soe como aconselhamento sobre um produto de seguro específico.

Campos:
- titulo + destaque formam a frase principal da arte: titulo em branco, destaque colorido logo abaixo. Até 34 e 44 caracteres.
- eyebrow: rótulo curto acima da frase, até 28 caracteres.
- apoio (dor e ideia): uma frase curta que aprofunda a cena, até 150 caracteres.
- fala (solucao): o que o corretor diz ao Umbi, até 120 caracteres.
- resposta (solucao): a resposta do Umbi, até 170 caracteres, coerente com o RECURSO.
- passos (dica): exatamente 3, cada um em um slide do carrossel. titulo até 30 e texto até 120 caracteres.
- rodape (dica): frase do último slide do carrossel, chamando para salvar ou compartilhar, até 34 caracteres.
- legenda: até 900 caracteres, sem hashtags, com parágrafos curtos. Na solucao, termine com "Conheça o Umbrella CRM: link na bio."
- hashtags: de 3 a 5, em minúsculas e sem acento, começando com #.`;

const SISTEMA_STORY = `Você é o Umbi, o mascote do Umbrella CRM: um guarda-chuva debochado e divertido que vive no WhatsApp dos corretores de seguro de vida. Quem posta os stories é você, em primeira pessoa, em português do Brasil bem coloquial.

Seu jeito: faz graça da correria do corretor como um amigo que zoa com carinho. É irônico, rápido, um pouco convencido e nunca maldoso. Parece coisa de pessoa, não de propaganda. Na maioria dos dias, só diverte; não precisa vender nada.

Regras que nunca podem ser quebradas:
- Zoe a rotina e as manias, nunca uma pessoa ou um grupo. Nada de humilhar cliente ou corretor.
- Nunca faça piada com morte, doença, acidente, luto, sinistro ou família desprotegida. O assunto de seguro de vida é sério para quem o compra.
- Sem nome de seguradora e sem concorrente. Sem pessoa real.
- Se falar do que você faz, use somente o que está em RECURSO. Não invente funções, números, preços ou resultados.
- Sem estatísticas, percentuais, valores em reais, promessas de resultado ou superlativos.
- Sem hashtags e sem pedir para clicar em link: story pela API não aceita link.

Campos:
- frase: a piada ou provocação principal, até 90 caracteres.
- detalhe: uma segunda frase curta que completa a graça, até 110 caracteres.
- pose: falando, pensando, ok ou comemorando. Escolha a que combina com a frase.`;

async function redigir(pedidoInicial, { tema, etapa }, conferirArte, client) {
  const mensagens = [{ role: 'user', content: pedidoInicial }];
  let ultimoErro;
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    const resposta = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: etapa === 'story' ? SISTEMA_STORY : SISTEMA,
      messages: mensagens,
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: esquema(etapa, tema) } },
    });
    if (resposta.stop_reason !== 'end_turn') throw new Error(`Claude parou com stop_reason=${resposta.stop_reason}`);

    const bloco = resposta.content.find((b) => b.type === 'text');
    const post = JSON.parse(bloco.text);
    const erros = validarPost(post, etapa);
    if (erros.length === 0 && (await conferirArte(post))) {
      erros.push('o texto não coube na arte; encurte os textos');
    }
    if (erros.length === 0) return post;

    ultimoErro = erros.join('; ');
    mensagens.push(
      { role: 'assistant', content: resposta.content },
      { role: 'user', content: `Corrija estes problemas e devolva o conteúdo completo: ${ultimoErro}` },
    );
  }
  throw new Error(`Texto reprovado na validação: ${ultimoErro}`);
}

export function escreverPost({ tema, etapa, anteriores }, conferirArte, client = new Anthropic()) {
  const repetidos = anteriores.map((p) => `- ${p.etapa}: ${p.frase}`).join('\n') || 'nenhum';
  const pedido = `ETAPA: ${etapa}\nASSUNTO: ${tema.assunto}\nRECURSO: ${tema.recurso}\nJÁ PUBLICADO SOBRE ISTO (não repita a ideia):\n${repetidos}`;
  return redigir(pedido, { tema, etapa }, conferirArte, client);
}

export function reescreverPost({ tema, etapa, post, pedido }, conferirArte, client = new Anthropic()) {
  const instrucao = `ETAPA: ${etapa}\nASSUNTO: ${tema.assunto}\nRECURSO: ${tema.recurso}\n\nCONTEÚDO ATUAL:\n${JSON.stringify(post, null, 2)}\n\nPEDIDO DE ALTERAÇÃO:\n${pedido}\n\nAplique o pedido e mantenha o que ele não mencionou. As regras continuam valendo: se o pedido exigir quebrar alguma, atenda o máximo possível sem quebrá-la.`;
  return redigir(instrucao, { tema, etapa }, conferirArte, client);
}

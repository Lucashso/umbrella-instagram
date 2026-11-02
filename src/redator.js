import Anthropic from '@anthropic-ai/sdk';
import { validarPost } from './validar.js';

const texto = { type: 'string' };
const comum = { eyebrow: texto, titulo: texto, destaque: texto, legenda: texto, hashtags: { type: 'array', items: texto } };

function esquema(etapa, tema) {
  const extras = etapa === 'dor' ? { apoio: texto }
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

Regras que nunca podem ser quebradas:
- Só afirme sobre o produto o que está no campo RECURSO. Não invente funções, integrações, números, preços ou resultados.
- Sem estatísticas, percentuais, valores em reais, promessas de resultado ou superlativos.
- Sem nome de seguradora e sem pessoa real. Na fala de exemplo, use primeiros nomes comuns.
- Nada que soe como aconselhamento sobre um produto de seguro específico.

Campos:
- titulo + destaque formam a frase principal da arte: titulo em branco, destaque colorido logo abaixo. Até 34 e 44 caracteres.
- eyebrow: rótulo curto acima da frase, até 28 caracteres.
- apoio (dor): uma frase curta que aprofunda a cena, até 150 caracteres.
- fala (solucao): o que o corretor diz ao Umbi, até 120 caracteres.
- resposta (solucao): a resposta do Umbi, até 170 caracteres, coerente com o RECURSO.
- passos (dica): exatamente 3. titulo até 30 e texto até 58 caracteres.
- rodape (dica): chamada curta para salvar ou compartilhar, até 34 caracteres.
- legenda: até 900 caracteres, sem hashtags, com parágrafos curtos. Na solucao, termine com "Conheça o Umbrella CRM: link na bio."
- hashtags: de 3 a 5, em minúsculas e sem acento, começando com #.`;

export async function escreverPost({ tema, etapa, anteriores }, conferirArte, client = new Anthropic()) {
  const repetidos = anteriores.map((p) => `- ${p.etapa}: ${p.frase}`).join('\n') || 'nenhum';
  const mensagens = [{
    role: 'user',
    content: `ETAPA: ${etapa}\nASSUNTO: ${tema.assunto}\nRECURSO: ${tema.recurso}\nPOSTS JÁ PUBLICADOS SOBRE ESTE ASSUNTO (não repita a ideia):\n${repetidos}`,
  }];

  let ultimoErro;
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    const resposta = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SISTEMA,
      messages: mensagens,
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: esquema(etapa, tema) } },
    });
    if (resposta.stop_reason !== 'end_turn') throw new Error(`Claude parou com stop_reason=${resposta.stop_reason}`);

    const bloco = resposta.content.find((b) => b.type === 'text');
    const post = JSON.parse(bloco.text);
    const erros = validarPost(post, etapa);
    if (erros.length === 0 && (await conferirArte(post))) {
      erros.push('o texto não coube na arte; encurte o título, o destaque e os textos');
    }
    if (erros.length === 0) return post;

    ultimoErro = erros.join('; ');
    mensagens.push(
      { role: 'assistant', content: resposta.content },
      { role: 'user', content: `Corrija estes problemas e devolva o post completo: ${ultimoErro}` },
    );
  }
  throw new Error(`Texto reprovado na validação: ${ultimoErro}`);
}

const LIMITES = { eyebrow: 28, titulo: 34, destaque: 44, apoio: 150, fala: 120, resposta: 170, rodape: 34, legenda: 1200, frase: 90, detalhe: 110 };

// Promessa, número, preço ou seguradora em post automático é risco comercial e regulatório.
const PROIBIDOS = [
  [/garant(e|ia|ido|ida|imos)/i, 'promessa de garantia'],
  [/r\$\s*\d/i, 'valor em reais'],
  [/\d+\s*%/, 'percentual'],
  [/\b(o|a)\s+melhor\b|\bn[úu]mero 1\b|\bl[íi]der\b/i, 'superlativo sem prova'],
  [/\b(prudential|azos|mag|bradesco|icatu|metlife|omint|sulam[ée]rica|porto seguro)\b/i, 'nome de seguradora'],
  [/\bumbri\b|\bbella\b/i, 'nome errado do assistente'],
];

// O deboche do Umbi não pode encostar no que o seguro de vida protege.
const SENSIVEIS_STORY = /\b(morte|mort[oa]s?|morr\w*|falec\w*|funeral|enterro|velório|luto|vi[úu]v[oa]s?|[óo]rf[ãa]os?|doen[çc]as?|c[âa]ncer|infarto|acidentes?|sinistros?)\b/i;

// Contas que falam com o cliente final: nada do CRM, e consórcio sem promessa de crédito ou contemplação.
const PROIBIDOS_CLIENTE = [
  [/\bumbi\b|\bumbrella\b|\bcrm\b/i, 'marca de outra conta'],
  [/contempla\w*\s+(garantid|imediat|r[áa]pid|na hora)/i, 'promessa de contemplação'],
  [/cr[ée]dito\s+(aprovado|liberado|f[áa]cil)|libere seu cr[ée]dito/i, 'promessa de crédito'],
  [/sem\s+(an[áa]lise|consulta)\s+(de\s+)?(cr[ée]dito|score|spc|serasa)/i, 'promessa de crédito sem análise'],
  [/sem\s+juros/i, '"sem juros", que esconde a taxa de administração'],
  [/\b(porto|tokio|allianz|zurich|mapfre|hdi|liberty|caixa|embracon|rodobens|servopa|cnp)\b/i, 'nome de seguradora ou administradora'],
];

export function validarPost(post, etapa, persona = 'umbi') {
  const erros = [];
  for (const [campo, max] of Object.entries(LIMITES)) {
    if (typeof post[campo] === 'string' && post[campo].length > max) {
      erros.push(`${campo} tem ${post[campo].length} caracteres (máximo ${max})`);
    }
  }
  if (etapa === 'dica') {
    if (post.passos?.length !== 3) erros.push('dica precisa de exatamente 3 passos');
    for (const p of post.passos ?? []) {
      if (p.titulo.length > 30) erros.push(`passo "${p.titulo}" passa de 30 caracteres`);
      if (p.texto.length > 120) erros.push(`texto do passo "${p.titulo}" passa de 120 caracteres`);
    }
  }
  if (etapa === 'story') {
    if (persona === 'umbi' && SENSIVEIS_STORY.test(`${post.frase} ${post.detalhe}`)) erros.push('story não pode falar de morte, doença, acidente ou sinistro');
  } else if (!Array.isArray(post.hashtags) || post.hashtags.length === 0 || post.hashtags.length > 5) {
    erros.push('use de 1 a 5 hashtags');
  } else if (post.hashtags.some((h) => !/^#[\p{L}\p{N}_]+$/u.test(h))) {
    erros.push('hashtag inválida');
  }
  const texto = JSON.stringify(post);
  for (const [regra, motivo] of persona === 'umbi' ? PROIBIDOS : [...PROIBIDOS, ...PROIBIDOS_CLIENTE]) {
    if (regra.test(texto)) erros.push(`contém ${motivo}`);
  }
  return erros;
}

export function montarLegenda(post) {
  return `${post.legenda.trim()}\n\n${post.hashtags.join(' ')}`;
}

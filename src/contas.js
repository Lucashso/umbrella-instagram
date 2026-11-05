import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Uma conta sem @ configurado nunca fica ativa: a trava de publicação compara com ele.
// Contas de CRM (persona umbi ou timo) falam com o corretor e têm mascote; as de cliente, não.
export const CONTAS = {
  umbrella: {
    id: 'umbrella', usuario: 'umbrella.crm', persona: 'umbi', sufixo: '', prefixo: '',
    arquivoTemas: 'temas.json', etapas: ['dor', 'solucao', 'dica'], inicio: 0,
    produto: 'Umbrella CRM', assistente: 'Umbi', tagStory: 'Umbi na área',
    logo: 'logo.png', logoClaro: 'logo_dark.png',
    mascote: { pensando: 'umbi-pensando-parado.webp', falando: 'umbi-falando-parado.webp', comemorando: 'umbi-comemorando-parado.webp', ok: 'umbi-ok-parado.webp' },
    jeito: 'o mascote do Umbrella CRM: um guarda-chuva debochado e divertido que vive no WhatsApp dos corretores de seguro de vida',
    humor: 'faz graça da correria do corretor como um amigo que zoa com carinho. É irônico, rápido, um pouco convencido e nunca maldoso',
  },
  leme: {
    id: 'leme', usuario: 'leme.crm', persona: 'timo', sufixo: '_LEME', prefixo: 'leme-',
    // Mesmo produto da Umbrella, com outra marca: os temas são os mesmos, com os nomes trocados.
    // Começa em outro assunto para quem segue as duas contas não ver o mesmo post no mesmo dia.
    arquivoTemas: 'temas.json', etapas: ['dor', 'solucao', 'dica'], inicio: 5,
    trocas: [[/Umbrella CRM/g, 'Leme CRM'], [/\bUmbi\b/g, 'Timo']],
    produto: 'Leme CRM', assistente: 'Timo', tagStory: 'Timo no leme', marca: 'leme', css: ['base.css', 'leme.css'],
    logo: 'logo-leme.png', logoClaro: 'logo-leme-claro.png',
    mascote: { pensando: 'timo-pensando.png', falando: 'timo-acenando.webp', comemorando: 'timo-comemorando.webp', ok: 'timo-acenando.webp' },
    jeito: 'o mascote do Leme CRM: um robozinho timoneiro, de quepe de marinheiro, que vive no WhatsApp dos corretores de seguro de vida',
    humor: 'brinca com a correria do corretor com humor leve e tranquilo, como um parceiro de bordo que já viu muita maré. Usa imagens de navegação (rumo, maré, porto, bússola) de vez em quando, sem forçar trocadilho em toda frase. É calmo, confiante e nunca maldoso',
  },
  priscilla: {
    id: 'priscilla', usuario: 'freitas.priscilla', persona: 'cliente', sufixo: '_PRISCILLA', prefixo: 'priscilla-',
    arquivoTemas: 'temas-cliente.json', etapas: ['situacao', 'caminho', 'dica'], inicio: 0,
    marca: 'priscilla', nome: 'Priscilla Freitas', cta: 'Me chama no direct.',
    quem: 'Priscilla Freitas, corretora de seguro de vida e consórcio',
    voz: 'Escreva em primeira pessoa do singular, como a própria Priscilla: próxima, clara e acolhedora, como quem conversa com um conhecido.',
  },
  arcana: {
    id: 'arcana', usuario: '', persona: 'cliente', sufixo: '_ARCANA', prefixo: 'arcana-',
    // Começa em outro assunto para o seguidor das duas contas não ver o mesmo tema no mesmo dia.
    arquivoTemas: 'temas-cliente.json', etapas: ['situacao', 'caminho', 'dica'], inicio: 6,
    marca: 'arcana', nome: 'Arcana Corretora de Seguros', cta: 'Chame a Arcana no direct.',
    quem: 'a Arcana Corretora de Seguros, cujo lema é "Proteção, preparo e antecipação"',
    voz: 'Escreva como empresa, usando "nós" ou "a Arcana": segura, clara e respeitosa, sem soar distante.',
  },
};

export const ehCrm = (conta) => conta.persona !== 'cliente';

export const contaDe = (entrada) => CONTAS[entrada.conta ?? 'umbrella'];

// Liga as contas aos poucos: só entra quem está na variável e tem o @ definido.
export function contasAtivas(valor = process.env.CONTAS_ATIVAS) {
  const ids = (valor || 'umbrella').split(',').map((s) => s.trim());
  return Object.values(CONTAS).filter((c) => ids.includes(c.id) && c.usuario);
}

function trocar(valor, trocas) {
  if (typeof valor === 'string') return trocas.reduce((s, [de, para]) => s.replace(de, para), valor);
  if (Array.isArray(valor)) return valor.map((v) => trocar(v, trocas));
  if (valor && typeof valor === 'object') return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, trocar(v, trocas)]));
  return valor;
}

export function temasDe(conta) {
  const temas = JSON.parse(readFileSync(resolve(import.meta.dirname, '..', 'conteudo', conta.arquivoTemas), 'utf8'));
  return conta.trocas ? trocar(temas, conta.trocas) : temas;
}

export const rotulo = (conta) => `@${conta.usuario}`;

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Uma conta sem @ configurado nunca fica ativa: a trava de publicação compara com ele.
export const CONTAS = {
  umbrella: {
    id: 'umbrella', usuario: 'umbrella.crm', persona: 'umbi', sufixo: '', prefixo: '',
    arquivoTemas: 'temas.json', etapas: ['dor', 'solucao', 'dica'], inicio: 0,
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

export const contaDe = (entrada) => CONTAS[entrada.conta ?? 'umbrella'];

// Liga as contas aos poucos: só entra quem está na variável e tem o @ definido.
export function contasAtivas(valor = process.env.CONTAS_ATIVAS) {
  const ids = (valor || 'umbrella').split(',').map((s) => s.trim());
  return Object.values(CONTAS).filter((c) => ids.includes(c.id) && c.usuario);
}

export function temasDe(conta) {
  return JSON.parse(readFileSync(resolve(import.meta.dirname, '..', 'conteudo', conta.arquivoTemas), 'utf8'));
}

export const rotulo = (conta) => `@${conta.usuario}`;

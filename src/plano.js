export const ETAPAS = ['dor', 'solucao', 'dica'];

// Só post da sequência publicado avança: dia vetado ou com falha repete a mesma etapa.
// Stories e posts avulsos têm `tipo` e ficam de fora da contagem.
export function proximoPost(historico, temas, etapas = ETAPAS, inicio = 0) {
  const daSequencia = historico.filter((p) => !p.tipo);
  const publicados = daSequencia.filter((p) => p.status === 'publicado').length;
  const tema = temas[(inicio + Math.floor(publicados / etapas.length)) % temas.length];
  const etapa = etapas[publicados % etapas.length];
  const anteriores = daSequencia.filter((p) => p.status === 'publicado' && p.tema === tema.id);
  return { tema, etapa, anteriores };
}

// Cada post abre de um jeito. São 7 para não casar com as 3 etapas: a mesma etapa só repete o gancho 7 temas depois.
export const GANCHOS = [
  'uma cena curta narrada, sem pergunta',
  'uma pergunta direta para quem lê',
  'uma fala entre aspas, como alguém diria no dia a dia',
  'um contraste entre o que parece e o que acontece de verdade',
  'uma afirmação que provoca, sem pergunta',
  'um detalhe pequeno e concreto da rotina que revela o problema',
  'uma comparação com algo de fora do trabalho',
];

export const ganchoDe = (historico) => GANCHOS[historico.filter((p) => !p.tipo && p.status === 'publicado').length % GANCHOS.length];

// Últimas frases da sequência, de qualquer tema, para o redator não repetir a abertura.
export const postsRecentes = (historico, quantos = 9) => historico.filter((p) => !p.tipo && p.frase).slice(-quantos).map((p) => ({ etapa: p.etapa, frase: p.frase }));

// Story reprovado ou expirado também conta: quem aprova já viu a piada.
export const storiesRecentes = (historico, quantos = 20) => historico.filter((p) => p.tipo === 'story' && p.frase).slice(-quantos).map((p) => ({ etapa: 'story', frase: p.frase }));

const FORMATOS_STORY = [
  'uma observação engraçada sobre uma mania',
  'uma pergunta para o seguidor responder de cabeça',
  'expectativa contra realidade',
  'uma confissão em primeira pessoa de quem está postando',
  'um conselho rápido de uma linha',
  'uma cena de um horário específico do dia',
  'um "quem nunca?"',
];

const PAUTAS_LIVRES = {
  crm: ['Segunda-feira e a meta do mês', 'Cliente que responde "vou ver com a esposa"', 'Áudio de cinco minutos do cliente', 'Reunião que podia ter sido uma mensagem', 'Fim de mês correndo atrás de proposta', 'Café, trânsito e a primeira visita do dia'],
  empresa: ['Segunda-feira na empresa pequena', 'Dono que faz de tudo um pouco', 'Grupo de WhatsApp da equipe', 'Fim de mês e fechamento', 'Aquela tarefa que todo mundo acha que é do outro', 'Cliente que pede "só um ajustezinho"'],
  cliente: ['Planos para o ano que vem', 'Conversa sobre dinheiro em família', 'Organizar a papelada da casa', 'O primeiro imóvel', 'Filhos crescendo', 'Começo de mês e as contas'],
};

// O story não acompanha o post: gira por outro assunto e outro formato a cada dia,
// para o perfil não passar a semana inteira falando da mesma coisa.
export function pautaStory(data, temas, temaDoPost, conta) {
  // O `inicio` desloca a conta: Umbrella e Leme não caem no mesmo assunto no mesmo dia.
  const dia = Math.floor(Date.parse(data) / 86400000) + (conta.inicio ?? 0);
  const livres = PAUTAS_LIVRES[conta.mascote ? 'crm' : conta.persona === 'empresa' ? 'empresa' : 'cliente'];
  const doProduto = temas.filter((t) => t.id !== temaDoPost.id).map((t) => t.assunto);
  // Intercala assunto do produto e assunto solto da rotina.
  const pautas = doProduto.flatMap((a, i) => (i < livres.length ? [a, livres[i]] : [a]));
  return { assunto: pautas[dia % pautas.length], formato: FORMATOS_STORY[dia % FORMATOS_STORY.length] };
}

// Tema usado por stories e pedidos da social media: conhece todos os recursos do produto.
export function temaLivre(assunto, temas) {
  return { id: 'livre', assunto, visual: 'nenhum', recurso: temas.map((t) => `- ${t.recurso}`).join('\n') };
}

// Data no fuso de Brasília; o runner do GitHub roda em UTC.
export function hojeBrasilia(agora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(agora);
}

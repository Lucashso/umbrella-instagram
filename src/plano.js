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

// Tema usado por stories e pedidos da social media: conhece todos os recursos do produto.
export function temaLivre(assunto, temas) {
  return { id: 'livre', assunto, visual: 'nenhum', recurso: temas.map((t) => `- ${t.recurso}`).join('\n') };
}

// Data no fuso de Brasília; o runner do GitHub roda em UTC.
export function hojeBrasilia(agora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(agora);
}

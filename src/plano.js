export const ETAPAS = ['dor', 'solucao', 'dica'];

// Só post publicado avança a sequência: dia vetado ou com falha repete a mesma etapa.
export function proximoPost(historico, temas) {
  const publicados = historico.filter((p) => p.status === 'publicado').length;
  const tema = temas[Math.floor(publicados / ETAPAS.length) % temas.length];
  const etapa = ETAPAS[publicados % ETAPAS.length];
  const anteriores = historico.filter((p) => p.status === 'publicado' && p.tema === tema.id);
  return { tema, etapa, anteriores };
}

// Data no fuso de Brasília; o runner do GitHub roda em UTC.
export function hojeBrasilia(agora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(agora);
}

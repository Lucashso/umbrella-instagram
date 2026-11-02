// Renderiza exemplos e o pior caso de tamanho de texto, sem chamar nenhuma API.
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { arteEstoura, montarHtml, renderizarJpeg } from './render.js';

const temas = JSON.parse(readFileSync(resolve(import.meta.dirname, '..', 'conteudo', 'temas.json'), 'utf8'));
const chat = temas.find((t) => t.id === 'registro-pos-reuniao');
const lista = temas.find((t) => t.id === 'atrasos');
const m = (n) => 'Mmmmmmmmm '.repeat(20).slice(0, n);

const casos = {
  dor: ['dor', chat, { eyebrow: 'Rotina do corretor', titulo: 'A reunião foi ótima.', destaque: 'E o que foi combinado?', apoio: 'Duas reuniões depois, a anotação ficou num papel, o próximo passo ficou na memória e o cliente ficou esperando.' }],
  solucao_chat: ['solucao', chat, { eyebrow: 'Umbi no seu WhatsApp', titulo: 'Saiu da reunião?', destaque: 'Mande um áudio.', fala: 'Cria um lead pra Marina, indicação do Paulo, e me lembra de ligar sexta.', resposta: 'Entendi! Vou criar o lead da Marina e a tarefa de ligar na sexta. Posso confirmar?' }],
  solucao_lista: ['solucao', lista, { eyebrow: 'Atrasos', titulo: 'Parcela atrasada é', destaque: 'cliente pedindo uma conversa.' }],
  dica: ['dica', chat, { eyebrow: 'Dica de venda', titulo: 'Antes de encerrar a reunião,', destaque: 'combine o próximo passo.', rodape: 'Salve para a próxima reunião', passos: [{ titulo: 'Repita o combinado', texto: 'Resuma em voz alta o que ficou decidido.' }, { titulo: 'Marque a data', texto: 'Saia da conversa com dia e hora do retorno.' }, { titulo: 'Registre na hora', texto: 'Anote antes de entrar no próximo compromisso.' }] }],
  limite_dor: ['dor', chat, { eyebrow: m(28), titulo: m(34), destaque: m(44), apoio: m(150) }],
  limite_chat: ['solucao', chat, { eyebrow: m(28), titulo: m(34), destaque: m(44), fala: m(120), resposta: m(170) }],
  limite_dica: ['dica', chat, { eyebrow: m(28), titulo: m(34), destaque: m(44), rodape: m(34), passos: [1, 2, 3].map(() => ({ titulo: m(30), texto: m(58) })) }],
};

mkdirSync('saida', { recursive: true });
for (const [nome, [etapa, tema, post]] of Object.entries(casos)) {
  const html = montarHtml(post, etapa, tema);
  const estoura = await arteEstoura(html);
  await renderizarJpeg(html, `saida/${nome}.jpg`);
  console.log(`${nome}: ${estoura ? 'ESTOURA' : 'cabe'}`);
  // Os casos "limite_" são extremos: podem reduzir o título ou ser recusados. Os reais precisam caber.
  if (estoura && !nome.startsWith('limite_')) process.exitCode = 1;
}

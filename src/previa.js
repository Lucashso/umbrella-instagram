// Renderiza exemplos e o pior caso de tamanho de texto, sem chamar nenhuma API.
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { arteEstoura, montarSlides, renderizarJpeg } from './render.js';

const temas = JSON.parse(readFileSync(resolve(import.meta.dirname, '..', 'conteudo', 'temas.json'), 'utf8'));
const chat = temas.find((t) => t.id === 'registro-pos-reuniao');
const lista = temas.find((t) => t.id === 'atrasos');
const m = (n) => 'Mmmmmmmmm '.repeat(20).slice(0, n);

const casos = {
  dor: ['dor', chat, { eyebrow: 'Rotina do corretor', titulo: 'A reunião foi ótima.', destaque: 'E o que foi combinado?', apoio: 'Duas reuniões depois, a anotação ficou num papel, o próximo passo ficou na memória e o cliente ficou esperando.' }],
  solucao_chat: ['solucao', chat, { eyebrow: 'Umbi no seu WhatsApp', titulo: 'Saiu da reunião?', destaque: 'Mande um áudio.', fala: 'Cria um lead pra Marina, indicação do Paulo, e me lembra de ligar sexta.', resposta: 'Entendi! Vou criar o lead da Marina e a tarefa de ligar na sexta. Posso confirmar?' }],
  solucao_lista: ['solucao', lista, { eyebrow: 'Atrasos', titulo: 'Parcela atrasada é', destaque: 'cliente pedindo uma conversa.' }],
  dica: ['dica', chat, { eyebrow: 'Dica de venda', titulo: 'Antes de ligar o carro,', destaque: 'anote 3 coisas da reunião', rodape: 'Salve para a próxima reunião', passos: [{ titulo: 'O que o cliente pediu', texto: 'Use as palavras dele. Anote a prioridade, a dúvida e a objeção que apareceram na conversa.' }, { titulo: 'O próximo passo e a data', texto: 'Quem faz o quê e até quando. Sem data combinada, o retorno vira esquecimento.' }, { titulo: 'Um resumo para o cliente', texto: 'Mande por mensagem o que foi combinado e peça um ok de volta. Isso evita mal-entendido.' }] }],
  story: ['story', chat, { frase: 'Você jurou que ia anotar depois da reunião. Eu vi. Eu sempre vejo.', detalhe: 'Amanhã você jura de novo. E eu continuo aqui, guardando seu guarda-chuva.', pose: 'pensando' }],
  ideia: ['ideia', chat, { eyebrow: 'Recado do Umbi', titulo: 'Segunda-feira chegou.', destaque: 'Seus leads também.', apoio: 'Café na mão, agenda aberta e aquela lista de retornos que não vai se ligar sozinha.' }],
  limite_story: ['story', chat, { frase: m(90), detalhe: m(110), pose: 'ok' }],
  limite_dor: ['dor', chat, { eyebrow: m(28), titulo: m(34), destaque: m(44), apoio: m(150) }],
  limite_chat: ['solucao', chat, { eyebrow: m(28), titulo: m(34), destaque: m(44), fala: m(120), resposta: m(170) }],
  limite_dica: ['dica', chat, { eyebrow: m(28), titulo: m(34), destaque: m(44), rodape: m(34), passos: [1, 2, 3].map(() => ({ titulo: m(30), texto: m(120) })) }],
};

mkdirSync('saida', { recursive: true });
for (const [nome, [etapa, tema, post]] of Object.entries(casos)) {
  for (const [i, html] of montarSlides(post, etapa, tema).entries()) {
    const estoura = await arteEstoura(html);
    const arquivo = `saida/${nome}-${i + 1}.jpg`;
    await renderizarJpeg(html, arquivo);
    console.log(`${arquivo}: ${estoura ? 'ESTOURA' : 'cabe'}`);
    // Os casos "limite_" são extremos: podem reduzir o título ou ser recusados. Os reais precisam caber.
    if (estoura && !nome.startsWith('limite_')) process.exitCode = 1;
  }
}

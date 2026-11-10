import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { CONTAS } from './contas.js';

const run = promisify(execFile);
const TEMPLATES = resolve(import.meta.dirname, '..', 'templates');

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const CHECK = '<svg viewBox="0 0 24 24"><path d="M5 13l5 5L20 7"/></svg>';
const X = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const SETA = '<svg viewBox="0 0 24 24"><path d="M4 12h15M13 6l6 6-6 6"/></svg>';
const ONDA = [14, 28, 40, 22, 34, 16, 42, 26, 36, 18, 30, 40, 20, 32, 14, 26, 38, 18].map((h) => `<i style="height:${h}px"></i>`).join('');

const titulo = (p) => `<div class="eyebrow">${esc(p.eyebrow)}</div><h1>${esc(p.titulo)}<em>${esc(p.destaque)}</em></h1>`;

function documento(classe, html, folhas = ['base.css']) {
  const base = pathToFileURL(TEMPLATES + '/').href;
  const estilos = folhas.map((f) => `<link rel="stylesheet" href="${f}">`).join('');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><base href="${base}">${estilos}</head><body class="${classe}">${html}<script>${AJUSTE}</script></body></html>`;
}

// Estilo neon (Lucas, 10/11/2026): fundo escuro com brilho, telas em vidro inclinadas, título enorme com degradê
// e "Arraste para o lado", como o carrossel "Funções do Umbi". Vale para a solução e o carrossel de dica.
const BRILHO = '<svg viewBox="0 0 24 24"><path d="M12 2l2.2 6.6L21 11l-6.8 2.4L12 20l-2.2-6.6L3 11l6.8-2.4z"/></svg>';
const RAIO = '<svg viewBox="0 0 24 24"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>';
const FX = `<svg class="fx" viewBox="0 0 1080 1350" preserveAspectRatio="none"><defs>
<linearGradient id="lz" x1="0" x2="1"><stop offset="0" style="stop-color:var(--a3);stop-opacity:0"/><stop offset=".55" style="stop-color:var(--a1)"/><stop offset="1" style="stop-color:var(--a2);stop-opacity:0"/></linearGradient>
<linearGradient id="chao" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0B0822"/><stop offset="1" stop-color="#010006"/></linearGradient>
<filter id="bl" x="-10%" y="-50%" width="120%" height="200%"><feGaussianBlur stdDeviation="9"/></filter></defs>
<g fill="none" stroke="url(#lz)"><path d="M-60 1090C260 950 560 1170 1140 900" stroke-width="12" filter="url(#bl)" opacity=".6"/><path d="M-60 1090C260 950 560 1170 1140 900" stroke-width="2.5"/><path d="M-60 1160C320 1070 620 1230 1140 1000" stroke-width="1.5" opacity=".5"/><path d="M520 -20L1100 380" stroke-width="1.5" opacity=".45"/></g>
<path d="M260 1350C500 1170 720 1110 1080 1050V1350Z" fill="url(#chao)"/><path d="M260 1350C500 1170 720 1110 1080 1050" fill="none" stroke="url(#lz)" stroke-width="2.5"/>
<g style="fill:var(--a1)"><circle cx="880" cy="250" r="5"/><circle cx="1010" cy="470" r="4"/><circle cx="610" cy="1205" r="7" filter="url(#bl)"/><circle cx="610" cy="1205" r="5"/><circle cx="140" cy="660" r="3" opacity=".6"/><circle cx="960" cy="900" r="4" opacity=".7"/></g></svg>`;
const TAGS_CRM = ['Automação', 'Atendimento', 'Vendas', 'Resultados'];
const num = (n) => String(n).padStart(2, '0');
const manchete = (branco, cor) => `<h1>${esc(branco)}<em>${esc(cor)}</em></h1>`;
// Uma frase só (passo, rodapé) vira metade branca e metade em degradê, como "Agendamento / de reunião".
const partir = (s) => {
  const p = String(s).trim().split(/\s+/);
  const corte = Math.ceil(p.length / 2);
  return p.length < 2 ? ['', s] : [p.slice(0, corte).join(' '), p.slice(corte).join(' ')];
};

// `figura(pose, classe)` desenha o mascote (contas de CRM) ou a vela da Leme Hub; `cor` só vem na Leme Hub.
function neon(conta, figura, cor) {
  const [forte, ...resto] = (conta.produto ?? conta.nome).split(' ');
  const tags = conta.marca === 'lemehub' ? PRODUTOS_HUB.map((p) => p.nome) : TAGS_CRM;
  const topo = `<div class="topo"><span class="marca"><i class="mk"></i><b>${esc(forte)}</b> ${esc(resto.join(' '))}</span><span class="tags">${tags.map((t) => `<i>${esc(t)}</i>`).join('')}</span></div>`;
  const cores = cor ? `<style>body.neon.n-lemehub{--a1:${cor.claro};--a2:${cor.cor};--a3:${cor.escuro}}</style>` : '';
  const pe = (html) => `<div class="rodape"><span class="arraste">${html}</span><i class="mk"></i></div>`;
  const pagina = (classe, html, rodape) => documento(`neon n-${conta.id} ${classe}`, `${cores}${FX}${topo}${html}${rodape}`, ['base.css', 'neon.css']);
  const pill = (html) => `<div class="pill">${BRILHO}${html}</div>`;
  const arraste = pe(`Arraste para o lado<b>${SETA}</b>`);

  return {
    pagina, pill, pe,
    // Capa, um slide por passo e o final.
    carrossel(post) {
      const total = num(post.passos.length);
      const cartoes = post.passos.map((p, i) => `<div class="mc vidro"><b>${num(i + 1)}</b>${esc(p.titulo)}</div>`).join('');
      const capa = pagina('capa', `${pill(esc(post.eyebrow))}${manchete(post.titulo, post.destaque)}${figura('falando', 'heroi')}<div class="stage"><div class="mini">${cartoes}</div></div>`, arraste);
      const passos = post.passos.map((p, i) => {
        const [a, b] = partir(p.titulo);
        const cartao = `<div class="lado"><div class="cartao vidro tilt"><b class="big">${num(i + 1)}</b><s></s><s></s><s></s></div>${figura(i % 2 ? 'ok' : 'falando', 'mini-masc')}</div>`;
        return pagina(`passo v${variante(p.titulo, 2)}`, `${pill(`Passo <b>${num(i + 1)}</b> de ${total}`)}${manchete(a, b)}<div class="stage duo"><p class="apoio">${esc(p.texto)}</p>${cartao}</div>`, arraste);
      });
      const [a, b] = partir(post.rodape);
      const fim = pagina('final', `${pill(esc(post.eyebrow))}${manchete(a, b)}<div class="stage"><div class="orbita">${figura('comemorando', '')}</div></div>`, pe(conta.usuario ? `@${esc(conta.usuario)}` : esc(conta.nome)));
      return [capa, ...passos, fim];
    },
  };
}

// Contas de CRM (Umbrella e Leme): mesmo layout, com logo, mascote e cores de cada marca.
function artesCrm(c) {
  const mascote = (pose) => `<img class="umbi" src="${c.mascote[pose]}" alt="${c.assistente}">`;
  const rodape = (logo, texto) => `<div class="foot"><img src="${logo}" alt="${c.produto}"><span>${esc(texto)}</span></div>`;
  const doc = (classe, html) => documento(`${c.marca ? `m-${c.marca}` : ''} ${classe}`.trim(), html, c.css);
  const n = neon(c, (pose, classe) => `<img class="${classe}" src="${c.mascote[pose]}" alt="${c.assistente}">`);

  const artes = {
    dor: (post) => doc('', `${titulo(post)}<div class="stage"><p class="apoio">${esc(post.apoio)}</p>${mascote('pensando')}</div>${rodape(c.logo, 'Você também passa por isso?')}`),

    // Solução e dica sorteiam o estilo: o clássico (escuro na solução, branco na dica) ou o neon.
    solucao: (post, tema) => (sorteio(post, 'solucao') ? artes.solucaoNeon(post, tema) : artes.solucaoClassica(post, tema)),
    dica: (post) => (sorteio(post, 'dica') ? n.carrossel(post) : artes.dicaClara(post)),

    solucaoClassica(post, tema) {
      if (tema.visual === 'lista') {
        const linhas = tema.itens.map(([nome, info]) => `<div class="row"><span class="ck">${CHECK}</span><b>${esc(nome)}</b><small>${esc(info)}</small></div>`).join('');
        return doc('', `${titulo(post)}<div class="stage"><div class="card">${linhas}<div class="bar"><span>${tema.itens.length} selecionados</span><span class="btn pri">${esc(tema.botao)} ${SETA}</span></div></div>${mascote('ok')}</div>${rodape(c.logo, 'Exemplo ilustrativo')}`);
      }
      const acoes = tema.confirmar ? `<div class="acts"><span class="btn pri">${CHECK} Confirmar</span><span class="btn sec">${X} Cancelar</span></div>` : '';
      return doc('', `${titulo(post)}<div class="stage"><div class="chat"><div class="b me"><div class="wave"><span class="play"></span>${ONDA}</div>“${esc(post.fala)}”</div><div class="b um"><div class="who"><img src="${c.mascote.falando}" alt="">${esc(c.assistente)}</div>${esc(post.resposta)}${acoes}</div></div></div>${rodape(c.logo, 'Exemplo ilustrativo')}`);
    },

    // Carrossel branco: capa, um slide por passo e encerramento.
    dicaClara(post) {
      const capa = doc('light', `${titulo(post)}<div class="stage">${mascote('falando')}</div>${rodape(c.logoClaro, 'Arraste para ver')}`);
      const passos = post.passos.map((p, i) => doc('light', `<div class="eyebrow">Passo ${i + 1} de ${post.passos.length}</div><h1><em>${esc(p.titulo)}</em></h1><div class="stage"><p class="apoio">${esc(p.texto)}</p>${mascote(i === 1 ? 'ok' : 'falando')}</div>${rodape(c.logoClaro, `${i + 2}/${post.passos.length + 2}`)}`));
      const fim = doc('light', `<div class="eyebrow">${esc(post.eyebrow)}</div><h1><em>${esc(post.rodape)}</em></h1><div class="stage">${mascote('comemorando')}</div>${rodape(c.logoClaro, c.produto)}`);
      return [capa, ...passos, fim];
    },

    // Neon: o mascote ao lado da tela do recurso (conversa no WhatsApp ou lista), em vidro inclinado.
    solucaoNeon(post, tema) {
      let tela;
      if (tema.visual === 'lista') {
        const linhas = tema.itens.map(([nome, info]) => `<div class="lin"><span class="ck">${CHECK}</span><span class="av">${esc(nome.at(-1))}</span><b>${esc(nome)}</b><small>${esc(info)}</small></div>`).join('');
        tela = `<div class="painel vidro tilt"><div class="p-topo"><b>${esc(post.eyebrow)}</b><span>${tema.itens.length} selecionados</span></div>${linhas}<div class="bt pri largo">${esc(tema.botao)} ${SETA}</div></div>`;
      } else {
        const acoes = tema.confirmar ? `<div class="acoes"><span class="bt pri">${CHECK} Confirmar</span><span class="bt">${X} Cancelar</span></div>` : '';
        tela = `<div class="fone vidro tilt"><div class="f-topo"><img src="${c.mascote.falando}" alt=""><span><b>${esc(c.assistente)}</b><small>online</small></span></div><div class="msg eu"><div class="wave"><span class="play"></span>${ONDA}</div>“${esc(post.fala)}”</div><div class="msg ele">${esc(post.resposta)}${acoes}</div></div>`;
      }
      return n.pagina(`solucao v${variante(post.titulo, 2)}`, `${n.pill(esc(post.eyebrow))}${manchete(post.titulo, post.destaque)}<div class="stage duo"><img class="masc" src="${c.mascote.ok}" alt="${c.assistente}">${tela}</div>`, n.pe('Exemplo ilustrativo'));
    },

    // O story é o mascote falando em primeira pessoa, em formato vertical.
    story: (post) => doc('story', `<div class="eyebrow">${esc(c.tagStory)}</div><h1>${esc(post.frase)}</h1><div class="stage"><p class="apoio">${esc(post.detalhe)}</p>${mascote(post.pose in c.mascote ? post.pose : 'falando')}</div><div class="assinatura">@${esc(c.usuario)}</div>`),

    ideia: (post) => doc('', `${titulo(post)}<div class="stage"><p class="apoio">${esc(post.apoio)}</p>${mascote('falando')}</div>${rodape(c.logo, c.produto)}`),
  };
  return artes;
}

// Contas sem mascote (cliente final e Leme Hub): arte só de texto, com a identidade de cada marca.
function slidesCliente(post, etapa, conta) {
  const pagina = (classe, html) => documento(`m-${conta.marca} ${classe}`.trim(), html, conta.css ?? ['base.css', 'cliente.css']);
  const assinatura = conta.logo ? `<img src="${conta.logo}" alt="${esc(conta.nome)}">` : `<b>${esc(conta.nome)}</b>`;
  const pe = (texto) => `<div class="foot">${assinatura}<span>${esc(texto)}</span></div>`;
  const apoio = (texto) => `<div class="stage"><p class="apoio">${esc(texto)}</p></div>`;

  if (etapa === 'story') {
    return [pagina('story', `<div class="eyebrow">${esc(conta.nome)}</div><h1>${esc(post.frase)}</h1>${apoio(post.detalhe)}<div class="assinatura">${conta.usuario ? `@${esc(conta.usuario)}` : ''}</div>`)];
  }
  if (etapa === 'dica') {
    const total = post.passos.length + 2;
    return [
      pagina('', `${titulo(post)}${apoio(`${post.passos.length} passos para pôr em prática`)}${pe('Arraste para ver')}`),
      ...post.passos.map((p, i) => pagina('', `<div class="eyebrow">Passo ${i + 1} de ${post.passos.length}</div><h1><em>${esc(p.titulo)}</em></h1>${apoio(p.texto)}${pe(`${i + 2}/${total}`)}`)),
      pagina('', `<div class="eyebrow">${esc(post.eyebrow)}</div><h1><em>${esc(post.rodape)}</em></h1>${apoio(conta.cta)}${pe(`${total}/${total}`)}`),
    ];
  }
  const fim = etapa === conta.etapas[0] ? (conta.perguntaFim ?? 'Já pensou nisso?') : conta.cta;
  return [pagina('', `${titulo(post)}${apoio(post.apoio)}${pe(fim)}`)];
}

// Leme Hub: um layout por etapa, como as seções do lemehub.com.br, na cor do produto do assunto.
const PRODUTOS_HUB = [
  { nome: 'Softwares', re: /softwares?|sob medida|sistema/i, cor: '#cbd5e1', claro: '#f1f5f9', escuro: '#334155' },
  { nome: 'IA', re: /\bIA\b|intelig[êe]ncia artificial/, cor: '#c084fc', claro: '#e9d5ff', escuro: '#7e22ce' },
  { nome: 'Wellness', re: /wellness|check-in|academia/i, cor: '#6ee07a', claro: '#bbf7c4', escuro: '#15803d' },
  { nome: 'Gestão', re: /gest[ãa]o|cobran[çc]a/i, cor: '#fb923c', claro: '#fed7aa', escuro: '#c2410c' },
  { nome: 'Chat', re: /\bchat\b/i, cor: '#2dd4bf', claro: '#99f6e4', escuro: '#0f766e' },
];
const AZUL_HUB = { nome: 'Leme Hub', cor: '#7dd3fc', claro: '#bae6fd', escuro: '#0369a1' };
// O produto vem do começo do RECURSO do tema ("Gestão da Leme Hub: ..."), ou do próprio texto.
const produtoHub = (texto = '') => {
  const inicio = texto.split(':')[0];
  const noInicio = PRODUTOS_HUB.find((p) => p.re.test(inicio));
  if (noInicio) return noInicio;
  // Texto que fala de mais de um produto é sobre a Leme Hub em geral: fica no azul da marca.
  const achados = PRODUTOS_HUB.filter((p) => p.re.test(texto));
  return achados.length === 1 ? achados[0] : AZUL_HUB;
};
// No fundo claro a cor do produto escurece para continuar legível.
const corHub = (p, claro) => (claro
  ? `<style>body.m-lemehub.m-lemehub{--ac:${p.escuro};--ac-lt:${p.escuro};--grad:linear-gradient(100deg,${p.escuro},${p.escuro} 40%,${p.cor} 140%)}</style>`
  : `<style>body.m-lemehub.m-lemehub{--ac:${p.cor};--ac-lt:${p.claro};--grad:linear-gradient(100deg,${p.claro},${p.cor})}</style>`);
// Variação estável por post: o mesmo texto sempre dá o mesmo desenho, mas posts diferentes variam.
function variante(s, n) {
  return [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % n;
}
// Sorteio do estilo (Lucas, 10/11: "pode randomizar"): sai do texto do post, então é aleatório entre posts,
// mas a arte medida, a enviada para aprovação e a publicada são sempre a mesma. Verdadeiro = neon.
// ESTILO_ARTE=neon|classico força um dos dois (prévia e testes).
export function sorteio(post, etapa) {
  const forcado = process.env.ESTILO_ARTE;
  if (forcado) return forcado === 'neon';
  return variante(`${etapa}|${JSON.stringify(post)}`, 2) === 1;
}

function slidesLemehub(post, etapa, tema, conta) {
  // O carrossel de dica no estilo clássico sai claro (o branco do feed).
  const claro = etapa === 'dica';
  const doc = (classe, cor, html) => documento(`m-lemehub ${claro ? 'claro ' : ''}${classe}`, corHub(cor, claro) + html, conta.css);
  const pe = (texto) => `<div class="foot"><img src="${conta.logo}" alt="${esc(conta.nome)}"><span>${esc(texto)}</span></div>`;
  const cor = produtoHub(tema?.recurso ?? JSON.stringify(post));
  const v = variante(post.titulo ?? post.frase, 2);
  // Sem mascote: a vela da marca faz o papel da figura, e o mini-mascote dos passos some.
  const n = neon(conta, (_pose, classe) => (classe === 'mini-masc' ? '' : `<i class="mk ${classe}"></i>`), cor);

  if (etapa === 'story') {
    return [doc('story l-story', cor, `<img class="vela" src="vela-lemehub.png" alt=""><div class="eyebrow">${esc(conta.nome)}</div><h1>${esc(post.frase)}</h1><div class="stage"><p class="apoio">${esc(post.detalhe)}</p></div><div class="assinatura">@${esc(conta.usuario)}</div>`)];
  }
  if (etapa === 'dica') {
    if (sorteio(post, etapa)) return n.carrossel(post);
    const total = post.passos.length + 2;
    const capa = doc(`l-capa v${v}`, cor, `${titulo(post)}<div class="stage"><div class="seta">Arraste <b>→</b></div></div>${pe(`1/${total}`)}`);
    const passos = post.passos.map((p, i) => doc('l-passo', produtoHub(`${p.titulo} ${p.texto}`) === AZUL_HUB ? cor : produtoHub(`${p.titulo} ${p.texto}`),
      `<div class="num">${String(i + 1).padStart(2, '0')}</div><div class="eyebrow">Passo ${i + 1} de ${post.passos.length}</div><h1><em>${esc(p.titulo)}</em></h1><div class="stage"><p class="apoio">${esc(p.texto)}</p></div>${pe(`${i + 2}/${total}`)}`));
    const fim = doc('l-fim', cor, `<div class="eyebrow">${esc(post.eyebrow)}</div><h1>${esc(post.rodape)}</h1><div class="stage"><img class="vela" src="vela-lemehub.png" alt=""></div>${pe('lemehub.com.br')}`);
    return [capa, ...passos, fim];
  }
  if (etapa === conta.etapas[0]) {
    // Problema: manchete grande, sem cartão, e a pergunta que puxa o comentário.
    return [doc(`l-hero v${v}`, cor, `${titulo(post)}<div class="stage"><p class="apoio"><span class="aspas">“</span>${esc(post.apoio)}</p></div><div class="pergunta">${esc(conta.perguntaFim)}</div>${pe('lemehub.com.br')}`)];
  }
  if (etapa === 'ideia' && cor === AZUL_HUB) {
    // Post avulso sobre a Leme Hub em geral: a vitrine com os cinco produtos, como no site.
    const chips = PRODUTOS_HUB.map((p) => `<span class="chip" style="--c:${p.cor}"><i></i>${p.nome}</span>`).join('');
    return [doc(`l-vitrine v${v}`, cor, `${titulo(post)}<div class="stage"><p class="apoio">${esc(post.apoio)}</p><div class="chips">${chips}</div></div>${pe(conta.cta)}`)];
  }
  // Solução e ideias de um produto, no sorteio: o texto numa janela de sistema (clássico)
  if (!sorteio(post, etapa)) {
    return [doc(`l-janela v${v}`, cor, `${titulo(post)}<div class="stage"><div class="janela"><div class="barra"><i></i><i></i><i></i><span>lemehub · ${esc(cor.nome)}</span></div><p class="apoio">${esc(post.apoio)}</p><div class="ok">✓ ${esc(conta.cta)}</div></div></div>${pe('lemehub.com.br')}`)];
  }
  // ou ao lado de um painel de sistema em vidro (neon), na cor do produto.
  const barras = [46, 70, 54, 88, 62, 100, 78].map((h) => `<i style="height:${h}%"></i>`).join('');
  const esqueleto = '<div class="esq"><i></i><span><s></s><s style="width:60%"></s></span></div>'.repeat(2);
  const painel = `<div class="painel vidro tilt"><div class="barra"><i></i><i></i><i></i><span>lemehub · ${esc(cor.nome)}</span></div><div class="graf">${barras}</div>${esqueleto}</div>`;
  return [n.pagina(`solucao-hub v${v}`, `${n.pill(esc(post.eyebrow))}${manchete(post.titulo, post.destaque)}<div class="stage duo"><div><p class="apoio">${esc(post.apoio)}</p><span class="cta"><i>${RAIO}</i>${esc(conta.cta)}</span></div>${painel}</div>`, n.pe('lemehub.com.br'))];
}

// Cada item é a página de uma imagem; mais de uma vira carrossel na publicação.
export function montarSlides(post, etapa, tema, conta = CONTAS.umbrella) {
  if (conta.marca === 'lemehub') return slidesLemehub(post, etapa, tema, conta);
  if (!conta.mascote) return slidesCliente(post, etapa, conta);
  const artes = artesCrm(conta);
  if (etapa === 'dica') return artes.dica(post);
  if (etapa === 'solucao') return [artes.solucao(post, tema)];
  return [artes[etapa](post)];
}

// Mede a arte no navegador: reduz o título até caber e marca o estouro se nem assim couber.
const AJUSTE = `document.fonts.ready.then(function(){
  var palco=document.querySelector('.stage'),h=document.querySelector('h1'),tam=parseFloat(getComputedStyle(h).fontSize);
  function cabe(){
    var p=palco.getBoundingClientRect(),t=h.getBoundingClientRect();
    var r=[].map.call(palco.children,function(c){return c.getBoundingClientRect()});
    var topo=Math.min.apply(null,r.map(function(x){return x.top})),base=Math.max.apply(null,r.map(function(x){return x.bottom}));
    var largo=[h].concat([].slice.call(palco.children)).every(function(e){return e.scrollWidth<=e.clientWidth+1});
    return topo>=t.bottom+24&&base<=p.bottom+1&&largo;
  }
  while(!cabe()&&tam>56){tam-=4;h.style.fontSize=tam+'px'}
  document.body.dataset.estouro=cabe()?'nao':'sim';
});`;

const janela = (html) => `--window-size=1080,${/<body class="[^"]*\bstory\b/.test(html) ? 1920 : 1350}`;

export async function arteEstoura(html) {
  const chrome = process.env.CHROME_PATH ?? 'google-chrome';
  const pasta = await mkdtemp(join(tmpdir(), 'ig-'));
  try {
    const pagina = join(pasta, 'post.html');
    await writeFile(pagina, html);
    const { stdout } = await run(chrome, [
      '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
      '--force-device-scale-factor=1', janela(html), '--virtual-time-budget=6000',
      `--user-data-dir=${join(pasta, 'perfil')}`, '--dump-dom', pathToFileURL(pagina).href,
    ], { timeout: 90000, maxBuffer: 10 * 1024 * 1024 });
    const marca = stdout.match(/data-estouro="(sim|nao)"/)?.[1];
    if (!marca) throw new Error('Não consegui medir a arte');
    return marca === 'sim';
  } finally {
    await rm(pasta, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});
  }
}

// A API do Instagram só aceita JPEG.
export async function renderizarJpeg(html, destino) {
  const chrome = process.env.CHROME_PATH ?? 'google-chrome';
  const pasta = await mkdtemp(join(tmpdir(), 'ig-'));
  try {
    const pagina = join(pasta, 'post.html');
    await writeFile(pagina, html);
    await run(chrome, [
      '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
      '--force-device-scale-factor=1', janela(html), '--virtual-time-budget=6000',
      `--user-data-dir=${join(pasta, 'perfil')}`, `--screenshot=${resolve(destino)}`,
      pathToFileURL(pagina).href,
    ], { timeout: 90000 });
    if ((await stat(destino)).size < 10000) throw new Error('Imagem gerada vazia');
  } finally {
    await rm(pasta, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});
  }
}

import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const TEMPLATES = resolve(import.meta.dirname, '..', 'templates');

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const CHECK = '<svg viewBox="0 0 24 24"><path d="M5 13l5 5L20 7"/></svg>';
const X = '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const SETA = '<svg viewBox="0 0 24 24"><path d="M4 12h15M13 6l6 6-6 6"/></svg>';
const ONDA = [14, 28, 40, 22, 34, 16, 42, 26, 36, 18, 30, 40, 20, 32, 14, 26, 38, 18].map((h) => `<i style="height:${h}px"></i>`).join('');

const UMBI = {
  pensando: 'umbi-pensando-parado.webp',
  falando: 'umbi-falando-parado.webp',
  comemorando: 'umbi-comemorando-parado.webp',
  ok: 'umbi-ok-parado.webp',
};
const umbi = (pose) => `<img class="umbi" src="${UMBI[pose]}" alt="Umbi">`;

const titulo = (p) => `<div class="eyebrow">${esc(p.eyebrow)}</div><h1>${esc(p.titulo)}<em>${esc(p.destaque)}</em></h1>`;
const rodape = (logo, texto) => `<div class="foot"><img src="${logo}" alt="Umbrella CRM"><span>${esc(texto)}</span></div>`;

function documento(classe, html) {
  const base = pathToFileURL(TEMPLATES + '/').href;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><base href="${base}"><link rel="stylesheet" href="base.css"></head><body class="${classe}">${html}<script>${AJUSTE}</script></body></html>`;
}

function slideDor(post) {
  return documento('', `${titulo(post)}<div class="stage"><p class="apoio">${esc(post.apoio)}</p>${umbi('pensando')}</div>${rodape('logo.png', 'Você também passa por isso?')}`);
}

function slideSolucao(post, tema) {
  if (tema.visual === 'lista') {
    const linhas = tema.itens.map(([nome, info]) => `<div class="row"><span class="ck">${CHECK}</span><b>${esc(nome)}</b><small>${esc(info)}</small></div>`).join('');
    return documento('', `${titulo(post)}<div class="stage"><div class="card">${linhas}<div class="bar"><span>${tema.itens.length} selecionados</span><span class="btn pri">${esc(tema.botao)} ${SETA}</span></div></div>${umbi('ok')}</div>${rodape('logo.png', 'Exemplo ilustrativo')}`);
  }
  const acoes = tema.confirmar ? `<div class="acts"><span class="btn pri">${CHECK} Confirmar</span><span class="btn sec">${X} Cancelar</span></div>` : '';
  return documento('', `${titulo(post)}<div class="stage"><div class="chat"><div class="b me"><div class="wave"><span class="play"></span>${ONDA}</div>“${esc(post.fala)}”</div><div class="b um"><div class="who"><img src="${UMBI.falando}" alt="">Umbi</div>${esc(post.resposta)}${acoes}</div></div></div>${rodape('logo.png', 'Exemplo ilustrativo')}`);
}

// A dica é sempre um carrossel: capa, um slide por passo e encerramento.
function slidesDica(post) {
  const logo = 'logo_dark.png';
  const capa = documento('light', `${titulo(post)}<div class="stage">${umbi('falando')}</div>${rodape(logo, 'Arraste para ver')}`);
  const passos = post.passos.map((p, i) => documento('light', `<div class="eyebrow">Passo ${i + 1} de ${post.passos.length}</div><h1><em>${esc(p.titulo)}</em></h1><div class="stage"><p class="apoio">${esc(p.texto)}</p>${umbi(i === 1 ? 'ok' : 'falando')}</div>${rodape(logo, `${i + 2}/${post.passos.length + 2}`)}`));
  const fim = documento('light', `<div class="eyebrow">${esc(post.eyebrow)}</div><h1><em>${esc(post.rodape)}</em></h1><div class="stage">${umbi('comemorando')}</div>${rodape(logo, 'Umbrella CRM')}`);
  return [capa, ...passos, fim];
}

// O story é o Umbi falando em primeira pessoa, em formato vertical.
function slideStory(post) {
  return documento('story', `<div class="eyebrow">Umbi na área</div><h1>${esc(post.frase)}</h1><div class="stage"><p class="apoio">${esc(post.detalhe)}</p>${umbi(post.pose in UMBI ? post.pose : 'falando')}</div><div class="assinatura">@umbrella.crm</div>`);
}

function slideIdeia(post) {
  return documento('', `${titulo(post)}<div class="stage"><p class="apoio">${esc(post.apoio)}</p>${umbi('falando')}</div>${rodape('logo.png', 'Umbrella CRM')}`);
}

// Cada item é a página de uma imagem; mais de uma vira carrossel na publicação.
export function montarSlides(post, etapa, tema) {
  if (etapa === 'story') return [slideStory(post)];
  if (etapa === 'ideia') return [slideIdeia(post)];
  if (etapa === 'dor') return [slideDor(post)];
  if (etapa === 'dica') return slidesDica(post);
  return [slideSolucao(post, tema)];
}

// Mede a arte no navegador: reduz o título até caber e marca o estouro se nem assim couber.
const AJUSTE = `document.fonts.ready.then(function(){
  var palco=document.querySelector('.stage'),h=document.querySelector('h1'),tam=78;
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

const janela = (html) => `--window-size=1080,${html.includes('<body class="story">') ? 1920 : 1350}`;

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

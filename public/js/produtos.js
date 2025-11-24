import { initHeader } from './header.js';
import { showToast } from '/public/js/utils/toast.js';
document.addEventListener("DOMContentLoaded",()=>{ initHeader(); loadAndRender(); });

const API_BASE='/api';
const qs=(s,r=document)=>r.querySelector(s);
const esc=(s='')=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#039;");
const fmtBRL=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v||0));
const normalize=str=>String(str).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'');
async function fetchJSON(url,opts={}){ const res=await fetch(url,{ headers:{ 'Content-Type':'application/json', ...(opts.headers||{}) }, credentials:'include', ...opts }); let data=null; try{ data=await res.json(); }catch{} if(!res.ok) throw new Error((data && (data.message||data.error))||`HTTP ${res.status}`); return data; }
const debounced=(fn,ms=250)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms) } };

function mapToSection(p){
  const norm=(s='')=>String(s).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'');
  const catRaw=(p.categoria||'').trim(), espRaw=(p.especie||'').trim(), nomeRaw=(p.nome||'').trim();
  const cat=norm(catRaw), esp=norm(espRaw), nome=norm(nomeRaw);
  const isRacao = cat.includes('racao') || nome.includes('racao');
  const isSache = cat.includes('sache') || nome.includes('sache');
  const isAcess = cat.includes('acess') || nome.includes('acess');
  let isGato = /gato|felin/.test(esp)||/gato|felin/.test(cat)||/gato|felin/.test(nome);
  let isCao  = /cachorr|cao|canin/.test(esp)||/cachorr|cao|canin/.test(cat)||/cachorr|cao|canin/.test(nome);
  if(!espRaw && (isGato===isCao)){ isCao = /cachorr|cao|canin/.test(nome); isGato = !isCao && /gato|felin/.test(nome); }
  if(isAcess) return 'Acessórios';
  if(isSache && isGato) return 'Sachê para Gatos';
  if(isSache && isCao) return 'Sachê para Cachorros';
  if(isRacao && isGato) return 'Ração para Gatos';
  if(isRacao && isCao) return 'Ração para Cachorros';
  if(isRacao) return 'Ração';
  if(isSache) return 'Sachê';
  if(catRaw){ const t=catRaw.toLowerCase(); if(t==='racao') return 'Ração'; if(t==='sache') return 'Sachê'; return catRaw.replace(/(^|\s)\S/g,m=>m.toUpperCase()); }
  return 'Outros';
}

const MANAGED = new Set(['Ração para Gatos','Ração para Cachorros','Sachê para Gatos','Sachê para Cachorros','Acessórios','Ração','Sachê','Outros']);
function getSectionByTitle(title){
  const normTitle = normalize(title);
  const managedH3 = [...document.querySelectorAll('section[data-managed="1"] .section-title')].find(h=>normalize(h.textContent)===normTitle);
  if(managedH3) return managedH3.closest('section');
  const h3 = [...document.querySelectorAll('main .section-title')].find(h=>normalize(h.textContent)===normTitle);
  return h3? h3.closest('section') : null;
}
function createSection(title){
  const main = qs('main.container') || qs('main') || document.body;
  const section = document.createElement('section');
  section.dataset.managed = '1';
  const heading = document.createElement('h3'); heading.className='section-title'; heading.textContent=title;
  const grid = document.createElement('div'); grid.className='grid cols-3';
  section.append(heading,grid); main.appendChild(section); return section;
}
function ensureSection(title){ return getSectionByTitle(title) || createSection(title); }
function hideManagedSectionsExcept(visibleTitles){
  [...document.querySelectorAll('section[data-managed="1"]')].forEach(sec=>{
    const h = sec.querySelector('.section-title');
    const t = h? normalize(h.textContent) : '';
    if(!visibleTitles.has(t) && !visibleTitles.has(h?.textContent)) sec.remove();
  });
}

/* ---------- ALTERAÇÃO PRINCIPAL: cardHTML agora respeita estoque ---------- */
function cardHTML(p){
  const img = p.imagem || '/public/img/placeholder-product.png';
  // tenta normalizar o nome do campo de estoque (pode ser 'estoque', 'stock', etc.)
  const estoqueRaw = (p.estoque ?? p.stock ?? p.qtde ?? 0);
  const estoque = Number(estoqueRaw ?? 0);
  const isOut = Number.isNaN(estoque) ? false : (estoque <= 0);
  // badge / botão desabilitado se indisponível
  const badge = isOut ? `<span class="badge unavailable" style="color: red">Produto indisponível</span>` : ``;
  const addBtn = isOut
    ? `<button class="btn primary" data-add disabled aria-disabled="true" title="Produto indisponível">Indisponível</button>`
    : `<button class="btn primary" data-add>Adicionar ao Carrinho</button>`;

  // inclui data-stock no card para checagem rápida no handler
  return `<article class="product-card" data-product-id="${esc(p.id ?? p.id_produto)}" data-stock="${esc(String(estoque))}">
    <div class="product-info">
      <h4 title="${esc(p.nome||'')}">${esc(p.nome||'Produto')}</h4>
      <div class="price">${fmtBRL(p.preco)}</div>
      ${badge}
      ${addBtn}
    </div>
    <img src="${esc(img)}" alt="${esc(p.nome||'Imagem do produto')}" class="product-img">
  </article>`;
}

function renderGroups(groups){
  const visible = new Set();
  Object.entries(groups).forEach(([title,list])=>{
    if(!list.length) return;
    const sec = ensureSection(title);
    const grid = sec.querySelector('.grid') || (()=>{ const g=document.createElement('div'); g.className='grid cols-3'; sec.appendChild(g); return g; })();
    if(!STATE?.sort || STATE.sort.startsWith('nome-')) list.sort((a,b)=>String(a.nome||'').localeCompare(String(b.nome||''),'pt-BR'));
    grid.innerHTML = list.map(cardHTML).join('');
    visible.add(title);
    visible.add(normalize(title));
  });
  hideManagedSectionsExcept(visible);
}

const STATE = { q:'', categoria:'', especie:'', precoMin:null, precoMax:null, sort:'', page:1, perPage:24, lastTotal:0 };

function ensureFiltersUI(){
  const main = qs('main.container') || qs('main') || document.body;
  if(qs('section.filters')) return;
  const filters = document.createElement('section'); filters.className='filters';
  filters.innerHTML = `<div class="filters-grid"><input id="f-q" type="search" placeholder="Buscar (nome, categoria, espécie)..." /><select id="f-categoria"><option value="">Todas as categorias</option></select><select id="f-especie"><option value="">Todas as espécies</option></select><input id="f-preco-min" type="number" placeholder="Preço mín" step="0.01" min="0" /><input id="f-preco-max" type="number" placeholder="Preço máx" step="0.01" min="0" /><select id="f-sort"><option value="">Ordenar...</option><option value="nome-asc">Nome (A→Z)</option><option value="nome-desc">Nome (Z→A)</option><option value="preco-asc">Menor preço</option><option value="preco-desc">Maior preço</option></select><button id="f-clear" class="btn">Limpar</button></div>`;
  const pager = document.createElement('nav'); pager.className='pagination';
  pager.innerHTML = `<button id="pg-prev" class="btn">← Anterior</button><span id="pg-info"></span><button id="pg-next" class="btn">Próxima →</button><label class="per-page" style="margin-left:8px;">Itens/página<select id="pg-size"><option>12</option><option selected>24</option><option>48</option></select></label>`;
  main.prepend(pager); main.prepend(filters);
}

function buildQueryParams(){
  const p = new URLSearchParams();
  p.set('only_active','true');
  p.set('page',String(STATE.page));
  p.set('per_page',String(STATE.perPage));
  if(STATE.q) p.set('q',STATE.q);
  if(STATE.categoria) p.set('categoria',STATE.categoria);
  if(STATE.especie) p.set('especie',STATE.especie);
  if(STATE.precoMin != null) p.set('preco_min',String(STATE.precoMin));
  if(STATE.precoMax != null) p.set('preco_max',String(STATE.precoMax));
  if(STATE.sort) p.set('sort',STATE.sort);
  return p.toString();
}

async function loadStaticOptions(){
  const selCat = qs('#f-categoria'); const selEsp = qs('#f-especie');
  if(!selCat || !selEsp) return;
  try{
    const [cats,esps] = await Promise.all([ fetchJSON(`${API_BASE}/produtos/categorias`).catch(()=>[]), fetchJSON(`${API_BASE}/produtos/especies`).catch(()=>[]) ]);
    if(Array.isArray(cats)) selCat.innerHTML = ['<option value="">Todas as categorias</option>'].concat(cats.map(c=>`<option value="${esc(c.key)}">${esc(c.value)}</option>`)).join('');
    if(Array.isArray(esps)) selEsp.innerHTML = ['<option value="">Todas as espécies</option>'].concat(esps.map(e=>`<option value="${esc(e.key)}">${esc(e.value)}</option>`)).join('');
  }catch(e){ console.warn('Falha ao carregar categorias/especies', e); }
}

async function queryAndRender(){
  const url = `${API_BASE}/produtos?${buildQueryParams()}`;
  try{
    const res = await fetchJSON(url);
    const items = Array.isArray(res) ? res : (res.items || []);
    const pagination = res.pagination || { page: STATE.page, per_page: STATE.perPage, total: items.length, has_prev:false, has_next:false };
    STATE.page = pagination.page || STATE.page;
    STATE.perPage = pagination.per_page || STATE.perPage;
    STATE.lastTotal = pagination.total || 0;
    const groups = {};
    for(const p of items){ const title = mapToSection(p); (groups[title] ||= []).push(p); }
    renderGroups(groups);
    const info = qs('#pg-info');
    const startI = STATE.lastTotal ? (STATE.page-1)*STATE.perPage + 1 : 0;
    const endI = Math.min(STATE.page*STATE.perPage, STATE.lastTotal);
    if(info) info.textContent = STATE.lastTotal ? `${startI}–${endI} de ${STATE.lastTotal}` : `0 resultados`;
    const prev = qs('#pg-prev'), next = qs('#pg-next');
    if(prev) prev.disabled = !pagination.has_prev;
    if(next) next.disabled = !pagination.has_next;
    replaceURLFromState();
  }catch(err){ console.error('Erro ao consultar produtos:', err); showToast('Erro ao carregar produtos.', 'error'); }
}

function initFiltersEvents(){
  const $q=qs('#f-q'), $cat=qs('#f-categoria'), $esp=qs('#f-especie'), $mn=qs('#f-preco-min'), $mx=qs('#f-preco-max'), $sort=qs('#f-sort'), $clr=qs('#f-clear'), $pp=qs('#pg-size');
  const onChange = debounced(()=>{ STATE.q=($q?.value||'').trim(); STATE.categoria=($cat?.value||''); STATE.especie=($esp?.value||''); STATE.precoMin=$mn?.value?Number($mn.value):null; STATE.precoMax=$mx?.value?Number($mx.value):null; STATE.sort=($sort?.value||''); STATE.page=1; queryAndRender(); },250);
  $q&&$q.addEventListener('input',onChange);
  [$cat,$esp,$mn,$mx,$sort].forEach(el=>el&&el.addEventListener('change',onChange));
  if($sort){ const updateSort=()=>{ STATE.sort=($sort?.value||''); STATE.page=1; queryAndRender(); }; $sort.addEventListener('input',updateSort); }
  $clr&&$clr.addEventListener('click',()=>{ if($q) $q.value=''; if($cat) $cat.value=''; if($esp) $esp.value=''; if($mn) $mn.value=''; if($mx) $mx.value=''; if($sort) $sort.value=''; Object.assign(STATE,{ q:'', categoria:'', especie:'', precoMin:null, precoMax:null, sort:'', page:1 }); queryAndRender(); });
  const prev=qs('#pg-prev'), next=qs('#pg-next');
  prev&&prev.addEventListener('click',()=>{ if(STATE.page>1){ STATE.page--; queryAndRender(); }});
  next&&next.addEventListener('click',()=>{ STATE.page++; queryAndRender(); });
  $pp&&$pp.addEventListener('change',()=>{ const v=Number($pp.value)||24; STATE.perPage=v; STATE.page=1; queryAndRender(); });
}

/* bindAddToCart: agora checa stock no card (data-stock) e evita POST se estoque <= 0 */
let ADD_CART_HANDLER_BOUND=false;
function bindAddToCart(){ 
  if(ADD_CART_HANDLER_BOUND) return; 
  ADD_CART_HANDLER_BOUND=true; 
  document.body.addEventListener('click',async (e)=>{
    const btn=e.target.closest('button[data-add]'); 
    if(!btn) return; 
    const card=btn.closest('.product-card'); 
    const pid=card?.getAttribute('data-product-id'); 
    if(!pid) return; 

    // checagem extra de estoque: usa data-stock do card (string)
    const stockRaw = card?.getAttribute('data-stock');
    const stockNum = stockRaw == null ? null : Number(stockRaw);
    if(stockNum !== null && !Number.isNaN(stockNum) && stockNum <= 0){
      showToast('Produto indisponível no momento.', 'error');
      return; // impede adicionar
    }

    if(btn.dataset.loading==='1') return; 
    btn.dataset.loading='1'; 
    const old=btn.textContent; 
    btn.disabled=true; 
    btn.textContent='Adicionando...'; 
    try{ 
      await fetchJSON(`${API_BASE}/carrinho/items`,{ method:'POST', body: JSON.stringify({ id_produto: Number(pid), quantidade:1, modo:'INCLUIR' }), }); 
      btn.textContent='Adicionado!'; 
      showToast('Adicionado ao carrinho','success'); 
      window.dispatchEvent(new CustomEvent('cart:updated')); 
    }catch(err){ 
      btn.textContent='Erro! Tente de novo'; 
      if((err.message||'').includes('401')) showToast('Faça login para adicionar ao carrinho','error'); 
      else showToast('Erro de banco de dados.','error'); 
    }finally{ 
      setTimeout(()=>{ btn.textContent=old; btn.disabled=false; btn.dataset.loading='0'; },900); 
    } 
  }); 
}

const PRODUCT_DETAIL_URL='/detail';
let NAV_HANDLER_BOUND=false;
function bindNavigateToDetail(){ 
  if(NAV_HANDLER_BOUND) return; 
  NAV_HANDLER_BOUND=true; 
  document.body.addEventListener('click',(e)=>{ 
    if(e.target.closest('button[data-add]')) return; 
    const card=e.target.closest('.product-card'); 
    if(!card) return; 
    const pid=card.getAttribute('data-product-id'); 
    if(!pid) return; 
    window.location.href = `${PRODUCT_DETAIL_URL}?id=${encodeURIComponent(pid)}`; 
  }); 
}

function parseURLToState(){ const params=new URLSearchParams(window.location.search); STATE.page = Number(params.get('page')) || 1; STATE.perPage = Number(params.get('per_page')) || STATE.perPage; STATE.q = params.get('q') || ''; STATE.categoria = params.get('categoria') || ''; STATE.especie = params.get('especie') || ''; STATE.precoMin = params.has('preco_min') ? Number(params.get('preco_min')) : null; STATE.precoMax = params.has('preco_max') ? Number(params.get('preco_max')) : null; STATE.sort = params.get('sort') || ''; }

function applyStateToUI(){ const $q=qs('#f-q'), $cat=qs('#f-categoria'), $esp=qs('#f-especie'), $mn=qs('#f-preco-min'), $mx=qs('#f-preco-max'), $sort=qs('#f-sort'), $pp=qs('#pg-size'); if($q) $q.value = STATE.q || ''; if($cat) $cat.value = STATE.categoria || ''; if($esp) $esp.value = STATE.especie || ''; if($mn) $mn.value = (STATE.precoMin != null && !Number.isNaN(STATE.precoMin)) ? String(STATE.precoMin) : ''; if($mx) $mx.value = (STATE.precoMax != null && !Number.isNaN(STATE.precoMax)) ? String(STATE.precoMax) : ''; if($sort) $sort.value = STATE.sort || ''; if($pp) $pp.value = String(STATE.perPage || 24); }

function replaceURLFromState(){ const base='/produtos'; const q = buildQueryParams(); const newUrl = q ? `${base}?${q}` : base; history.replaceState(null,'',newUrl); }

window.addEventListener('popstate',()=>{ parseURLToState(); applyStateToUI(); queryAndRender(); });

async function loadAndRender(){ 
  try{ 
    ensureFiltersUI(); 
    await loadStaticOptions(); 
    parseURLToState(); 
    applyStateToUI(); 
    await queryAndRender(); 
    initFiltersEvents(); 
    bindAddToCart(); 
    bindNavigateToDetail(); 
  }catch(err){ 
    console.error('Falha no bootstrap dos produtos:',err); 
    showToast('Erro ao carregar página.','error'); 
  } 
}

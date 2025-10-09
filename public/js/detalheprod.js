// /public/js/detalheprod.js
import { initHeader, updateCartCount } from './header.js';
import { showToast } from '/public/js/utils/toast.js';

document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  bootstrap();
});

const API_BASE = '/api';

/* utils */
const qs  = (s, r=document) => r.querySelector(s);
const esc = (s='') => String(s)
  .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
  .replaceAll('"','&quot;').replaceAll("'","&#039;");
const fmtBRL = (v) => new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' })
  .format(Number(v||0));

async function fetchJSON(url, opts={}) {
  const res = await fetch(url, { headers:{'Content-Type':'application/json'}, credentials:'include', ...opts });
  let data=null; try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error((data && (data.message||data.error)) || `HTTP ${res.status}`);
  return data;
}

function getProductIdFromURL() {
  const u = new URL(window.location.href);
  let id = u.searchParams.get('id');
  if (!id) {
    const m = window.location.pathname.match(/(\d+)(?:\/)?$/);
    if (m) id = m[1];
  }
  return id ? Number(id) : null;
}

/* API */
async function addToCart(id_produto, quantidade) {
  const body = JSON.stringify({ id_produto: Number(id_produto), quantidade: Number(quantidade), modo: 'INCLUIR' });
  return fetchJSON(`${API_BASE}/carrinho/items`, { method:'POST', body });
}

/* UI fillers */
function fillBreadcrumbs({ especie, categoria }) {
  const bc = qs('.breadcrumbs');
  if (!bc) return;
  const links = bc.querySelectorAll('a');
  if (links[0]) { links[0].textContent = 'Pet Shop'; links[0].href = '/'; }
  if (links[1]) { links[1].textContent = especie || 'Produtos'; links[1].href = '/produtos'; }
  if (links[2]) { links[2].textContent = categoria || 'Categoria'; links[2].href = '/produtos'; }
}

function fillImages(imagem) {
  const main = qs('#mainProductImage');
  const thumbs = qs('.thumbnails');
  const src = imagem || '/public/img/placeholder-product.png';
  if (main) main.src = src;
  if (thumbs) {
    thumbs.innerHTML = '';
    [src, src, src, src].forEach((s, i) => {
      const im = document.createElement('img');
      im.src = s; im.alt = `Thumbnail ${i+1}`;
      if (i === 0) im.classList.add('active');
      im.addEventListener('click', () => {
        if (main) main.src = s;
        thumbs.querySelectorAll('img').forEach(el => el.classList.remove('active'));
        im.classList.add('active');
      });
      thumbs.appendChild(im);
    });
  }
}

function fillMeta(prod) {
  // título
  qs('.product-title') && (qs('.product-title').textContent = prod.nome || 'Produto');

  // estoque e botão
  const stock = qs('.stock-status');
  if (stock) {
    const disponivel = (prod.estoque ?? 0) > 0 && (prod.is_active ?? true);
    stock.textContent = disponivel ? 'Em estoque' : 'Indisponível';
    stock.classList.toggle('out', !disponivel);
    const btn = qs('.add-to-cart-btn');
    if (btn) btn.disabled = !disponivel;
  }

  // ✅ ID ao lado do estoque
  const codeEl = qs('.product-code');
  if (codeEl) {
    const pid = prod.id ?? prod.id_produto ?? null;
    if (pid) {
      codeEl.textContent = `Cód. #${pid}`;
      qs('.meta-sep')?.classList.remove('hide');
    } else {
      codeEl.textContent = '';
      qs('.meta-sep')?.classList.add('hide');
    }
  }

  // ✅ descrição acima do preço (esconde se não tiver)
  const descEl = qs('.product-description');
  if (descEl) {
    const txt = (prod.descricao || '').toString().trim();
    if (txt) {
      descEl.textContent = txt;
      descEl.style.display = '';
    } else {
      descEl.style.display = 'none';
    }
  }

  // preço
  qs('.product-price') && (qs('.product-price').textContent = fmtBRL(prod.preco));
}


function bindQtyAndCart(prodId) {
  const dec = qs('#decrease-qty');
  const inc = qs('#increase-qty');
  const input = qs('#quantity-input');
  const addBtn = qs('.add-to-cart-btn');

  const norm = () => {
    let v = parseInt(input.value || '1', 10);
    if (!Number.isFinite(v) || v < 1) v = 1;
    input.value = String(v);
    return v;
  };

  dec && dec.addEventListener('click', () => { const v = norm(); if (v > 1) input.value = String(v-1); });
  inc && inc.addEventListener('click', () => { const v = norm(); input.value = String(v+1); });
  input && input.addEventListener('change', norm);

  if (addBtn) {
    addBtn.addEventListener('click', async () => {
      if (addBtn.dataset.loading === '1') return;
      addBtn.dataset.loading = '1';
      const old = addBtn.textContent;
      addBtn.disabled = true; addBtn.textContent = 'Adicionando...';
      try {
        const qtd = norm();
        await addToCart(prodId, qtd);
        addBtn.textContent = 'Adicionado!';
        showToast('Adicionado ao carrinho', 'success');
        await updateCartCount();                // ✅ atualiza badge do header
        window.dispatchEvent(new CustomEvent('cart:updated'));
      } catch (err) {
        if ((err.message || '').includes('401')) {
          showToast('Faça login para adicionar ao carrinho', 'error');
        } else {
          showToast('Erro de banco de dados.', 'error');
        }
      } finally {
        setTimeout(() => { addBtn.textContent = old; addBtn.disabled = false; addBtn.dataset.loading = '0'; }, 900);
      }
    });
  }
}

/* bootstrap */
async function bootstrap() {
  const id = getProductIdFromURL();
  if (!id) {
    showToast('Produto não especificado', 'error');
    return;
  }
  try {
    const prod = await fetchJSON(`${API_BASE}/produtos/${id}`);
    fillBreadcrumbs(prod);
    fillImages(prod.imagem);
    fillMeta(prod);
    bindQtyAndCart(id);
  } catch (err) {
    showToast('Não foi possível carregar o produto.', 'error');
    const title = qs('.product-title');
    if (title) title.textContent = 'Produto não encontrado';
  }
}

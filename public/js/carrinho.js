// /public/js/cart.js
import { initHeader, updateCartCount } from './header.js';
import { showToast } from '/public/js/utils/toast.js';

document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  bootstrapCart();
});

const API_BASE = '/api';

/* Helpers */
const qs  = (s, r=document) => r.querySelector(s);
const esc = (s='') => String(s)
  .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
  .replaceAll('"','&quot;').replaceAll("'","&#039;");
const fmtBRL = (v) => new Intl.NumberFormat('pt-BR',{ style:'currency', currency:'BRL' })
  .format(Number(v||0));

async function fetchJSON(url, opts={}) {
  const res = await fetch(url, { headers:{'Content-Type':'application/json'}, credentials:'include', ...opts });
  let data=null; try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error((data && (data.message||data.error)) || `HTTP ${res.status}`);
  return data;
}

/* API */
async function getCart() {
  return fetchJSON(`${API_BASE}/carrinho`);
}
async function getProduto(id) {
  return fetchJSON(`${API_BASE}/produtos/${id}`);
}

// SETAR quantidade explicitamente (valor digitado)
async function setQtdSetar(id_produto, quantidade) {
  const body = JSON.stringify({ id_produto: Number(id_produto), quantidade: Number(quantidade), modo: 'SETAR' });
  return fetchJSON(`${API_BASE}/carrinho/items`, { method:'POST', body });
}

// INCLUIR +1
async function incluirUm(id_produto) {
  const body = JSON.stringify({ id_produto: Number(id_produto), quantidade: 1, modo: 'INCLUIR' });
  return fetchJSON(`${API_BASE}/carrinho/items`, { method:'POST', body });
}

// REMOVER -1 (se chegar a 0, o back remove o item)
async function removerUm(id_produto) {
  const body = JSON.stringify({ id_produto: Number(id_produto), quantidade: 1, modo: 'REMOVER' });
  console.log(body)
  return fetchJSON(`${API_BASE}/carrinho/items`, { method:'POST', body });
}

async function removeItem(id_cart_item) {
  return fetchJSON(`${API_BASE}/carrinho/items/${id_cart_item}`, { method: 'DELETE' });
}

/* Render */
function ensureListContainer() {
  const sec = qs('section.cart-items');
  if (!sec) return null;
  let list = qs('#cart-list', sec);
  if (!list) {
    list = document.createElement('div');
    list.id = 'cart-list';
    // limpa mocks estáticos
    [...sec.querySelectorAll('.cart-item-card')].forEach(n => n.remove());
    sec.appendChild(list);
  }
  return list;
}

function renderSummary({ subtotal }) {
  const aside = qs('.cart-summary');
  if (!aside) return;
  const freteLabel = 'A calcular no checkout';
  const freteValue = 0;
  const total = Number(subtotal) + Number(freteValue);

  aside.innerHTML = `
    <h3>Resumo da Compra</h3>
    <div class="summary-line">
      <span>Subtotal</span>
      <span>${fmtBRL(subtotal)}</span>
    </div>
    <div class="summary-line">
      <span>Frete</span>
      <span>${freteLabel}</span>
    </div>
    <div class="summary-total">
      <strong>Total</strong>
      <strong>${fmtBRL(total)}</strong>
    </div>
    <div class="payment-options"></div>
    <a href="/checkout" class="btn primary" style="width:100%; text-align:center;">Continuar</a>
  `;
}

function itemCardHTML(item) {
  const p = item.product || {};
  const img = p.imagem || '/public/img/placeholder-product.png';
  const nome = p.nome || `Produto #${item.id_produto}`;
  const unit = item.preco_unitario ?? p.preco ?? 0;
  const qtd  = item.quantidade ?? 1;
  const subtotal = unit * qtd;

  // guardamos os DOIS ids: id_cart_item (remover) e id_produto (alterar qtd)
  return `
  <article class="cart-item-card"
           data-cart-item-id="${esc(item.id_cart_item)}"
           data-prod-id="${esc(item.id_produto)}">
    <img src="${esc(img)}" alt="${esc(nome)}" class="item-image">
    <div class="item-details">
      <h4 title="${esc(nome)}">${esc(nome)}</h4>
      <p class="subtitle">${fmtBRL(unit)} / un.</p>
      <div class="item-actions">
        <div class="quantity-control">
          <button class="btn-qty" data-dec aria-label="Diminuir">-</button>
          <input type="number" value="${esc(qtd)}" min="1" class="qty-input" aria-label="Quantidade" style="margin-bottom:0;">
          <button class="btn-qty" data-inc aria-label="Aumentar">+</button>
        </div>
        <button class="btn-remove">Remover</button>
      </div>
    </div>
    <div class="item-price" data-subtotal>${fmtBRL(subtotal)}</div>
  </article>`;
}

async function renderCart() {
  const container = ensureListContainer();
  if (!container) return;

  try {
    const data = await getCart();
    const items = data.items || [];

    if (!items.length) {
      container.innerHTML = `
        <div class="card" style="padding:16px;">
          <p class="subtitle">Seu carrinho está vazio.</p>
          <a href="/produtos" class="btn primary" style="margin-top:8px;">Começar a comprar</a>
        </div>`;
      renderSummary({ subtotal: 0 });
      updateCartCount(0);
      return;
    }

    // Enriquecer com dados do produto
    const prods = await Promise.all(items.map(it => getProduto(it.id_produto).catch(()=>({}))));
    const rich = items.map((it, i) => ({ ...it, product: prods[i] || {} }));

    container.innerHTML = rich.map(itemCardHTML).join('');
    renderSummary({ subtotal: data.subtotal || 0 });

    const count = rich.reduce((acc, it) => acc + (it.quantidade||0), 0);
    updateCartCount(count);

  } catch (err) {
    const container = ensureListContainer();
    if (container) {
      const msg = (err.message||'').includes('401') ? 'Faça login para ver seu carrinho.' : 'Não foi possível carregar seu carrinho.';
      container.innerHTML = `<div class="card" style="padding:16px;"><p class="subtitle">${esc(msg)}</p></div>`;
    }
    showToast('Erro de banco de dados.', 'error');
  }
}

/* Interações */
const busyKeys = new Set(); // evita chamadas duplicadas por item
let CART_EVENTS_BOUND = false;

function bindCartEvents() {
  if (CART_EVENTS_BOUND) return;
  CART_EVENTS_BOUND = true;

  const sec = qs('section.cart-items');
  if (!sec) return;

  sec.addEventListener('click', async (e) => {
    const card = e.target.closest('.cart-item-card');
    if (!card) return;

    const cartItemId = card.getAttribute('data-cart-item-id');
    const prodId     = card.getAttribute('data-prod-id');

    // Incrementar (+1 via INCLUIR)
    if (e.target.matches('[data-inc]')) {
      const key = `inc:${prodId}`;
      if (busyKeys.has(key)) return;
      busyKeys.add(key);
      try {
        await incluirUm(prodId);
        await renderCart();
        window.dispatchEvent(new CustomEvent('cart:updated'));
      } catch (err) {
        showToast('Erro de banco de dados.', 'error');
      } finally {
        busyKeys.delete(key);
      }
      return;
    }

    // Diminuir (-1 via REMOVER) — o back subtrai e, se zerar, apaga o item
    if (e.target.matches('[data-dec]')) {
      const key = `dec:${prodId}`;
      if (busyKeys.has(key)) return;
      busyKeys.add(key);
      try {
        await removerUm(prodId);
        await renderCart();
        window.dispatchEvent(new CustomEvent('cart:updated'));
      } catch (err) {
        showToast('Erro de banco de dados.', 'error');
      } finally {
        busyKeys.delete(key);
      }
      return;
    }

    // Remover item (excluir de vez)
    if (e.target.matches('.btn-remove')) {
      const key = `rm:${cartItemId}`;
      if (busyKeys.has(key)) return;
      busyKeys.add(key);

      const btn = e.target;
      const old = btn.textContent;
      btn.disabled = true; btn.textContent = 'Removendo...';
      try {
        await removeItem(cartItemId);
        showToast('Item removido', 'success');
        await renderCart();
        window.dispatchEvent(new CustomEvent('cart:updated'));
      } catch (err) {
        showToast('Erro de banco de dados.', 'error');
      } finally {
        busyKeys.delete(key);
        btn.disabled = false; btn.textContent = old;
      }
    }
  });

  // Digitar quantidade manualmente -> SETAR
  sec.addEventListener('change', async (e) => {
    const input = e.target.closest('.qty-input');
    if (!input) return;
    const card = e.target.closest('.cart-item-card');
    const prodId = card?.getAttribute('data-prod-id');

    let next = parseInt(input.value || '1', 10);
    if (!Number.isFinite(next) || next < 1) next = 1;

    const key = `set:${prodId}`;
    if (busyKeys.has(key)) return;
    busyKeys.add(key);

    try {
      await setQtdSetar(prodId, next);
      showToast('Quantidade atualizada', 'success');
      await renderCart();
      window.dispatchEvent(new CustomEvent('cart:updated'));
    } catch (err) {
      showToast('Erro de banco de dados.', 'error');
      await renderCart();
    } finally {
      busyKeys.delete(key);
    }
  });
}

/* Bootstrap */
async function bootstrapCart() {
  await renderCart();
  bindCartEvents();
}

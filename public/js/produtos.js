// /public/js/produtos.js
import { showToast } from './utils/toast.js';
import { initSidebar } from './sidebar.js';

const API_BASE = '/api';
const MAX_IMG_BYTES = 10 * 1024 * 1024;

document.addEventListener("DOMContentLoaded", () => {
  initSidebar();
  wireProductEditModal();
  loadProductsList();
});

function defaultAvatar(nome){
  if(!nome) return 'https://placehold.co/200x200?text=?';
  nome = String(nome).toLowerCase();
  return 'https://placehold.co/200x200?text=?';
}

/* ============== HELPERS ============== */
const qs  = (s, r=document) => r.querySelector(s);
const qsa = (s, r=document) => [...r.querySelectorAll(s)];
const esc = (s) => (s ?? '').toString()
  .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
  .replaceAll('"','&quot;').replaceAll("'","&#039;");
const fmtBRL = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v||0));

async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const err = new Error((data && (data.message || data.error)) || `HTTP ${res.status}`);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

function inlinePlaceholder(text='Produto') {
  const svg = encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='400'>
      <rect width='100%' height='100%' fill='#f3f4f6'/>
      <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle'
        font-family='Inter,Arial' font-size='28' fill='#9ca3af'>${text}</text>
    </svg>`
  );
  return `data:image/svg+xml;charset=utf-8,${svg}`;
}

function toDataURL(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result); // data:image/...;base64,xxxx
    fr.onerror = () => reject(new Error('Falha ao ler arquivo.'));
    fr.readAsDataURL(file);
  });
}

/* ============== STATE ============== */
let PRODUCTS = [];       // cache da listagem
let CURRENT = null;      // produto em edição (obj)
let CHANGED_FILE = null; // File selecionado no modal

/* ============== LISTAGEM ============== */
async function loadProductsList() {
  const grid = qs('.product-grid');
  if (!grid) return;
  grid.innerHTML = `<article class="product-card"><div class="product-card-content">Carregando…</div></article>`;
  try {
    const data = await fetchJSON(`${API_BASE}/produtos?page=1&per_page=200`);
    const items = Array.isArray(data) ? data : (data.items || []);
    PRODUCTS = items;
    renderGrid(items);
  } catch (err) {
    console.error(err);
    grid.innerHTML = `<article class="product-card"><div class="product-card-content">Erro ao carregar produtos.</div></article>`;
    showToast('Erro ao carregar produtos.', 'error');
  }
}

function productCardHTML(p) {
  const id = p.id ?? p.id_produto;
  // usa imagem_url se existir (vem do backend), fallback p.imagem ou avatar
  const img = p.imagem_url || p.imagem || defaultAvatar(p.nome);
  const cat = p.categoria || '—';
  const preco = fmtBRL(p.preco);
  const estoque = Number(p.estoque ?? 0);
  const inactive = p.is_active === false;
  const style = inactive ? `style="opacity:.6;filter:grayscale(.2)"` : '';

  return `
  <article class="product-card" data-product-id="${id}" ${style}>
    <img src="${img}" alt="Imagem do Produto">
    <div class="product-card-content">
      <span class="product-category">${esc(cat)}</span>
      <h4 title="${esc(p.nome || '')}">${esc(p.nome || 'Sem nome')}</h4>
      <div class="product-info">
        <span>Preço: <strong>${preco}</strong></span>
        <span>Estoque: <strong>${estoque} un.</strong></span>
      </div>
    </div>
    <div class="product-card-footer">
      <button class="btn edit-product-btn">Editar</button>
      <button class="btn danger remove-product-btn">${inactive ? 'Reativar' : 'Remover'}</button>
    </div>
  </article>`;
}

function renderGrid(list) {
  const grid = qs('.product-grid');
  if (!grid) return;
  if (!list.length) {
    grid.innerHTML = `<article class="product-card"><div class="product-card-content">Nenhum produto cadastrado.</div></article>`;
    return;
  }
  grid.innerHTML = list.map(productCardHTML).join('');
  // delegação de eventos (editar/remover)
  grid.addEventListener('click', onGridClick, { once: true });
}

function onGridClick(e) {
  const btn = e.target.closest('button');
  if (!btn) {
    e.currentTarget.addEventListener('click', onGridClick, { once: true });
    return;
  }
  const card = btn.closest('.product-card');
  const id = Number(card?.dataset.productId);
  const prod = PRODUCTS.find(x => (x.id ?? x.id_produto) === id);
  if (!prod) return;

  if (btn.classList.contains('edit-product-btn')) {
    openEditModal(prod);
  } else if (btn.classList.contains('remove-product-btn')) {
    toggledelete(prod);
  }
  // re-anexa para próximos cliques
  e.currentTarget.addEventListener('click', onGridClick, { once: true });
}

/* ============== MODAL: NOVO/EDIÇÃO ============== */
function wireProductEditModal() {
  const modal = document.getElementById('editProductModal');
  const closeModalBtn  = document.getElementById('close-modal-btn');
  const cancelEditBtn  = document.getElementById('cancel-edit-btn');
  const addProductBtn  = document.getElementById('add-product-btn');
  const modalTitle     = document.getElementById('modal-title');
  const form           = document.getElementById('edit-product-form');

  // Campos
  const imageInput     = document.getElementById('product-image');
  const imagePreview   = document.getElementById('current-product-image');
  const nameInput      = document.getElementById('product-name');
  const priceInput     = document.getElementById('product-price');
  const stockInput     = document.getElementById('product-stock');
  const categoryInput  = document.getElementById('product-category');

  function openModal(isNew = false, data = {}) {
    // FIX: usa o padrão do CSS -> adicionar .active (e pode manter/remover .hidden)
    modal.classList.remove('hidden');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    form.reset();
    CHANGED_FILE = null;

    if (isNew) {
      CURRENT = null;
      modalTitle.textContent = 'Adicionar Novo Produto';
      imagePreview.src = inlinePlaceholder('Sem imagem');
      imagePreview.style.display = 'block';
    } else {
      CURRENT = data;
      const id = data.id ?? data.id_produto;
      modalTitle.textContent = `Editar Produto #${id}`;
      nameInput.value     = data.nome ?? '';
      priceInput.value    = Number(data.preco ?? 0);
      stockInput.value    = Number(data.estoque ?? 0);
      categoryInput.value = data.categoria ?? '';
      imagePreview.src    = (data.imagem_url || data.imagem || '') || inlinePlaceholder(data.nome || 'Produto');
      imagePreview.style.display = 'block';
    }
  }

  function closeModal() {
    // FIX: remove .active e volta .hidden conforme CSS
    modal.classList.remove('active');
    modal.classList.add('hidden');
    document.body.style.overflow = '';
    form.reset();
    imagePreview.style.display = 'none';
    imagePreview.src = '';
    CURRENT = null;
    CHANGED_FILE = null;
  }

  // abrir novo
  addProductBtn?.addEventListener('click', () => openModal(true));

  // fechar
  closeModalBtn?.addEventListener('click', closeModal);
  cancelEditBtn?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e) => {
    // FIX: olha .active (não .hidden)
    if (e.key === 'Escape' && modal.classList.contains('active')) closeModal();
  });

  // preview imagem
  imageInput?.addEventListener('change', () => {
    const file = imageInput.files?.[0];
    if (!file) { CHANGED_FILE = null; imagePreview.style.display='none'; imagePreview.src=''; return; }
    if (!file.type.startsWith('image/')) { showToast('Selecione uma imagem válida.', 'error'); imageInput.value=''; return; }
    if (file.size > MAX_IMG_BYTES) { showToast('Imagem excede 10 MB.', 'error'); imageInput.value=''; return; }
    CHANGED_FILE = file;
    const url = URL.createObjectURL(file);
    imagePreview.src = url;
    imagePreview.style.display = 'block';
  });

  // submit
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const payload = {
      nome: (nameInput.value || '').trim(),
      preco: Number(priceInput.value),
      estoque: Number(stockInput.value),
      categoria: categoryInput.value || null,
    };

    try {
      if (CHANGED_FILE) {
        payload.imagem = await toDataURL(CHANGED_FILE); // casa com _set_image_from_payload
      }
    } catch (err) {
      showToast(err.message || 'Erro ao processar a imagem.', 'error');
      return;
    }

    const btn = form.querySelector('button[type="submit"]');
    const old = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = 'Salvando…'; }

    try {
      let result;
      if (CURRENT) {
        // PATCH /produtos/:id
        const id = CURRENT.id ?? CURRENT.id_produto;
        result = await fetchJSON(`${API_BASE}/produtos/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        // Atualiza cache
        const idx = PRODUCTS.findIndex(x => (x.id ?? x.id_produto) === id);
        if (idx >= 0) PRODUCTS[idx] = result;
        // Atualiza card
        const card = qs(`.product-card[data-product-id="${id}"]`);
        if (card) card.outerHTML = productCardHTML(result);
        showToast('Produto atualizado com sucesso!', 'success');
      } else {
        // POST /produtos
        result = await fetchJSON(`${API_BASE}/produtos`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        // Adiciona no topo e re-renderiza
        PRODUCTS.unshift(result);
        renderGrid(PRODUCTS);
        showToast('Produto criado com sucesso!', 'success');
      }
      closeModal();
    } catch (err) {
      const p = err.payload || {};
      if (p.error === 'validation_error') showToast(p.message || 'Erro de validação.', 'error');
      else if (p.error === 'database_error') showToast('Erro de banco de dados.', 'error');
      else showToast(p.message || err.message || 'Erro ao salvar produto.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = old; }
    }
  });

  // expõe função para abrir a partir da grid
  window.__openProductModal = openModal;
}

function openEditModal(prod) {
  window.__openProductModal?.(false, prod);
}

function confirmDialog({ 
  title = 'Confirmar ação', 
  message = 'Tem certeza?', 
  confirmText = 'Confirmar', 
  cancelText = 'Cancelar' 
} = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    overlay.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>${title}</h2>
          <button class="close-btn" aria-label="Fechar">&times;</button>
        </div>
        <div class="modal-body" style="color: var(--muted); line-height:1.5;">
          <p>${message}</p>
        </div>
        <div class="modal-footer">
          <button class="btn" data-cancel>${cancelText}</button>
          <button class="btn danger" data-confirm>${confirmText}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    const closeBtn = overlay.querySelector('.close-btn');
    const btnCancel = overlay.querySelector('[data-cancel]');
    const btnConfirm = overlay.querySelector('[data-confirm]');

    const cleanup = (val) => {
      overlay.classList.remove('active');
      setTimeout(() => {
        overlay.remove();
        document.body.style.overflow = '';
        resolve(val);
      }, 150);
    };

    closeBtn.addEventListener('click', () => cleanup(false));
    btnCancel.addEventListener('click', () => cleanup(false));
    btnConfirm.addEventListener('click', () => cleanup(true));

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cleanup(false);
    });

    const onKey = (e) => {
      if (e.key === 'Escape') cleanup(false);
    };
    document.addEventListener('keydown', onKey, { once: true });

    // foco inicial
    setTimeout(() => btnConfirm.focus(), 0);
  });
}

/* ============== REMOVER/REATIVAR (SOFT DELETE) ============== */
async function toggledelete(prod) {
  const id = prod.id ?? prod.id_produto;

  // tela de confirmação
  const ok = await confirmDialog({
    title: 'Remover produto?',
    message: `Tem certeza que deseja remover <strong>${esc(prod.nome || 'este produto')}</strong>? Essa ação não poderá ser desfeita.`,
    confirmText: 'Remover',
    cancelText: 'Cancelar'
  });
  if (!ok) return;

  try {
    const res = await fetchJSON(`${API_BASE}/produtos/${id}`, { method: 'DELETE' });

    // toast de sucesso
    showToast(res?.message || 'Produto removido com sucesso!', 'success');

    // remove da UI e do cache
    PRODUCTS = PRODUCTS.filter(x => (x.id ?? x.id_produto) !== id);
    const card = document.querySelector(`.product-card[data-product-id="${id}"]`);
    if (card) card.remove();

    // se preferir, re-renderize tudo:
    // renderGrid(PRODUCTS);

  } catch (err) {
    const p = err.payload || {};
    showToast(p.message || err.message || 'Erro ao remover produto.', 'error');
  }
}


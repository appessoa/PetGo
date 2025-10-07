// /public/js/admin.js
import { initSidebar } from './sidebar.js';

const API_BASE = '';                 // seus controllers estão com url_prefix "/api"
const MAX_IMG_BYTES = 10 * 1024 * 1024;  // 10 MB (igual ao service)

/* ========================== BOOT ========================== */
document.addEventListener('DOMContentLoaded', () => {
  // UI existente
  wireVetModal();
  wireVetAccordion();
  // Sidebar
  initSidebar();
  // Seções dinâmicas (safe se não existirem)
  loadVeterinariosRecentes();
  loadVendasRecentes();
  // Produto (form + arquivo + upload)
  wireProductForm();
});

/* ========================== HELPERS ========================== */
const qs = (sel, root = document) => root.querySelector(sel);

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

function toast(message, type = 'success') {
  const div = document.createElement('div');
  div.textContent = message;
  div.style.position = 'fixed';
  div.style.right = '16px';
  div.style.bottom = '16px';
  div.style.padding = '12px 16px';
  div.style.borderRadius = '12px';
  div.style.boxShadow = 'var(--shadow)';
  div.style.zIndex = '9999';
  div.style.fontWeight = '600';
  div.style.background = type === 'success' ? '#dcfce7' : '#fee2e2';
  div.style.color = type === 'success' ? '#166534' : '#991b1b';
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3500);
}

function clearErrors(root = document) {
  root.querySelectorAll('.field-error').forEach(e => e.remove());
  root.querySelectorAll('.has-error').forEach(el => el.classList.remove('has-error'));
}

function fieldError(inputEl, message) {
  if (!inputEl) return toast(message, 'error');
  inputEl.classList.add('has-error');
  const small = document.createElement('small');
  small.className = 'field-error';
  small.style.color = '#b91c1c';
  small.style.fontSize = '12px';
  small.style.marginTop = '6px';
  small.textContent = message;
  const group = inputEl.closest('.form-group') || inputEl.parentElement || document.body;
  group.appendChild(small);
}

function escapeHTML(str) {
  return (str ?? '').toString()
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderStatusBadge(status) {
  const ativo = String(status).toLowerCase();
  const isActive = ativo === 'true' || ativo === 'ativo' || ativo === 'active' || ativo === '1';
  const cls = isActive ? 'active' : 'inactive';
  const label = isActive ? 'Ativo' : 'Inativo';
  return `<span class="status ${cls}">${label}</span>`;
}

/* ========================== VETERINÁRIOS ========================== */
function getVeterinariosSection() {
  return [...document.querySelectorAll('.content-card')].find(sec => {
    const h2 = sec.querySelector('.card-header h2');
    return h2 && /Veterin[aá]rios Recentes/i.test(h2.textContent);
  });
}

async function loadVeterinariosRecentes() {
  const sec = getVeterinariosSection();
  if (!sec) return;

  const table = sec.querySelector('table.custom-table');
  if (!table) return;

  const tbody = table.querySelector('tbody') || table.appendChild(document.createElement('tbody'));
  tbody.innerHTML = `<tr><td colspan="3">Carregando...</td></tr>`;

  try {
    // ajuste a rota /veterinarios se ela for diferente
    const vets = await fetchJSON(`${API_BASE}/veterinarios`);
    const list = Array.isArray(vets) ? vets : (vets.veterinarios || []);
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="3">Nenhum veterinário encontrado.</td></tr>`;
      return;
    }
    tbody.innerHTML = list.slice(0, 5).map(v => {
      const nome = v.nome || v.name || '—';
      const especialidade = v.especialidade || v.specialty || '—';
      const status = v.status ?? v.ativo ?? true;
      return `
        <tr>
          <td>${escapeHTML(nome)}</td>
          <td>${escapeHTML(especialidade)}</td>
          <td>${renderStatusBadge(status)}</td>
        </tr>`;
    }).join('');
  } catch (e) {
    console.error('Erro veterinários:', e);
    tbody.innerHTML = `<tr><td colspan="3">Erro ao carregar veterinários.</td></tr>`;
  }
}

/* ========================== VENDAS (placeholder) ========================== */
function loadVendasRecentes() {
  const sec = [...document.querySelectorAll('.content-card')].find(sec => {
    const h2 = sec.querySelector('.card-header h2');
    return h2 && /Vendas Recentes/i.test(h2.textContent);
  });
  if (!sec) return;

  const table = sec.querySelector('table.custom-table');
  if (!table) return;

  table.innerHTML = `
    <thead>
      <tr>
        <th>Pedido</th>
        <th>Cliente</th>
        <th>Total</th>
        <th>Status</th>
        <th>Data</th>
      </tr>
    </thead>
    <tbody><tr><td colspan="5">Integre aqui sua rota de vendas.</td></tr></tbody>`;
}

/* ========================== MODAL VETS ========================== */
function wireVetModal() {
  const openModalBtn = document.getElementById('open-vet-modal-btn');
  const modal = document.getElementById('vet-modal');
  if (!openModalBtn || !modal) return;

  const closeButtons = modal.querySelectorAll('.close-btn');
  const openModal = () => modal.classList.remove('hidden');
  const closeModal = () => modal.classList.add('hidden');

  openModalBtn.addEventListener('click', openModal);
  closeButtons.forEach(btn => btn.addEventListener('click', closeModal));
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
  });
}

/* ========================== ACORDEÃO VETS ========================== */
function wireVetAccordion() {
  const items = document.querySelectorAll('.vet-accordion-item');
  items.forEach(item => {
    const header = item.querySelector('.vet-accordion-header');
    if (!header) return;
    header.addEventListener('click', () => {
      const open = item.classList.contains('is-open');
      items.forEach(it => it.classList.remove('is-open'));
      if (!open) item.classList.add('is-open');
    });
  });
}

/* ========================== PRODUTOS ========================== */
// Endpoints dos controllers que criamos:
// POST   /api/produtos                   -> cria produto (aceita imagem data URL)
// PATCH  /api/produtos/:id/estoque       -> { estoque }
// PATCH  /api/produtos/:id/ativo         -> { is_active }

function wireProductForm() {
  const form = document.querySelector('form.product-form');
  if (!form) return;

  const nameInput   = qs('#product-name', form);
  const priceInput  = qs('#product-price', form);
  const stockInput  = qs('#product-stock', form);
  const categorySel = qs('#product-category', form);

  const fileInput   = qs('#photo-product', form);
  const fileDrop    = qs('.file-drop', form);
  const fileMeta    = qs('#photo-product-meta', form);
  const filePreview = qs('#photo-product-preview', form);

  // --- file helpers ---
  let currentPreviewURL = null;

  function updateFileMeta(file) {
    if (!file) {
      fileMeta.textContent = 'Nenhum arquivo selecionado';
      return;
    }
    const mb = (file.size / 1024 / 1024).toFixed(2);
    fileMeta.textContent = `${file.name} • ${mb} MB`;
  }

  function showPreview(file) {
    if (currentPreviewURL) {
      URL.revokeObjectURL(currentPreviewURL);
      currentPreviewURL = null;
    }
    if (file && file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      currentPreviewURL = url;
      filePreview.innerHTML = `
        <img alt="Pré-visualização" src="${url}">
        <div>
          <div style="font-weight:600;color:var(--text)">${escapeHTML(file.name)}</div>
          <div style="font-size:12px;color:var(--muted)">${escapeHTML(file.type)} • ${(file.size/1024).toFixed(0)} KB</div>
        </div>`;
      filePreview.style.display = 'grid'; // mesmo padrão do CSS
    } else {
      filePreview.innerHTML = '';
      filePreview.style.display = 'none';
    }
  }

  function toDataURL(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result); // "data:image/...;base64,...."
      fr.onerror = () => reject(new Error('Falha ao ler o arquivo.'));
      fr.readAsDataURL(file);
    });
  }

  function installDragAndDrop() {
    if (!fileDrop) return;
    ['dragenter','dragover'].forEach(evt =>
      fileDrop.addEventListener(evt, e => {
        e.preventDefault(); e.stopPropagation();
        fileDrop.classList.add('is-dragover');
      })
    );
    ['dragleave','dragend','drop'].forEach(evt =>
      fileDrop.addEventListener(evt, e => {
        e.preventDefault(); e.stopPropagation();
        if (evt !== 'drop') fileDrop.classList.remove('is-dragover');
      })
    );
    fileDrop.addEventListener('drop', e => {
      const files = e.dataTransfer?.files;
      fileDrop.classList.remove('is-dragover');
      if (!files || !files.length) return;
      fileInput.files = files;              // mantém acessibilidade
      const file = files[0];
      handleFileChange(file);
    });
  }

  function handleFileChange(file) {
    clearErrors(form);
    if (!file) {
      updateFileMeta(null);
      showPreview(null);
      return;
    }
    if (!file.type.startsWith('image/')) {
      updateFileMeta(null);
      showPreview(null);
      fieldError(fileInput, 'Selecione uma imagem válida (PNG/JPG).');
      return;
    }
    if (file.size > MAX_IMG_BYTES) {
      updateFileMeta(file);
      showPreview(file);
      fieldError(fileInput, 'Imagem excede 10 MB.');
      return;
    }
    updateFileMeta(file);
    showPreview(file);
  }

  fileInput?.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    handleFileChange(file);
  });

  installDragAndDrop();
  updateFileMeta(null);
  showPreview(null);

  // --- submit ---
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors(form);

    const nome = (nameInput?.value || '').trim();
    const preco = priceInput?.value;
    const estoque = stockInput?.value;
    const categoria = categorySel?.value || null;

    let hasErr = false;
    if (!nome) { fieldError(nameInput, 'Nome é obrigatório.'); hasErr = true; }
    if (preco === '' || isNaN(Number(preco))) { fieldError(priceInput, 'Preço inválido.'); hasErr = true; }
    if (estoque !== '' && isNaN(Number(estoque))) { fieldError(stockInput, 'Estoque inválido.'); hasErr = true; }
    if (hasErr) return;

    const payload = {
      nome,
      descricao: null,
      preco: Number(preco),
      estoque: estoque === '' ? 0 : Number(estoque),
      categoria,
      
    };

    const file = fileInput?.files?.[0];
    try {
      if (file) {
        if (!file.type.startsWith('image/')) throw new Error('Imagem inválida.');
        if (file.size > MAX_IMG_BYTES) throw new Error('Imagem excede 10 MB.');
        payload.photo = await toDataURL(file); // casa com _set_image_from_payload
      }
    } catch (err) {
      fieldError(fileInput, err.message || 'Erro ao processar a imagem.');
      return;
    }

    const btn = form.querySelector('button[type="submit"]');
    const old = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = 'Salvando…'; }

    try {
      const created = await fetchJSON(`${API_BASE}/api/produtos`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      form.reset();
      updateFileMeta(null);
      showPreview(null);
      toast(`Produto “${created?.nome ?? nome}” criado com sucesso!`, 'success');
      // aqui você pode atualizar uma lista/cards de produtos, se houver
    } catch (err) {
      const p = err.payload || {};
      if (p.error === 'validation_error') {
        if (p.field === 'nome') fieldError(nameInput, p.message);
        else if (p.field === 'preco') fieldError(priceInput, p.message);
        else if (p.field === 'estoque') fieldError(stockInput, p.message);
        else if (p.field === 'imagem') fieldError(fileInput, p.message);
        else toast(p.message || 'Erro de validação.', 'error');
      } else if (p.error === 'database_error') {
        toast('Erro de banco de dados.', 'error');
      } else if (p.error === 'http_error') {
        toast(p.message || 'Erro HTTP.', 'error');
      } else {
        toast(p.message || err.message || 'Erro interno.', 'error');
      }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = old; }
    }
  });
}

/* ============ OPCIONAIS: ações rápidas nos produtos (se criar UI) ============ */
async function setProdutoAtivo(id, ativo) {
  return fetchJSON(`${API_BASE}/api/produtos/${id}/ativo`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active: !!ativo }),
  });
}

async function setProdutoEstoque(id, estoque) {
  return fetchJSON(`${API_BASE}/api/produtos/${id}/estoque`, {
    method: 'PATCH',
    body: JSON.stringify({ estoque: Number(estoque) }),
  });
}
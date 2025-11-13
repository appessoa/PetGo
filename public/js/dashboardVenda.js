// /public/js/dashboardVenda.js
import { initSidebar } from './sidebar.js';

const API_ADMIN_ORDERS = ['/api/admin/orders', '/api/orders?admin=1']; // ordem de tentativa

/* ========= helpers ========= */
const qs  = (s, r=document) => r.querySelector(s);
const qsa = (s, r=document) => Array.from(r.querySelectorAll(s));
const fmtBRL = (v) => new Intl.NumberFormat('pt-BR',{ style:'currency', currency:'BRL' }).format(Number(v||0));
const fmtDateBR = (iso) => {
  try { const d = new Date(iso); return d.toLocaleDateString('pt-BR'); } catch { return iso || ''; }
};
async function fetchJSON(url, opts={}) {
  const res = await fetch(url, { headers:{'Content-Type':'application/json'}, credentials:'include', ...opts });
  let data=null; try{ data=await res.json(); }catch{}
  if(!res.ok) throw new Error((data && (data.error||data.message)) || `HTTP ${res.status}`);
  return data;
}

/* ========= mapeamento de status (back -> badge CSS + label) ========= */
const STATUS_MAP = {
  finalizado : { cls: 'completed', label: 'Concluída' },
  concluido  : { cls: 'completed', label: 'Concluída' },
  enviado    : { cls: 'shipped'  , label: 'Enviada'   },
  processado : { cls: 'processed', label: 'Processada' },
  andamento  : { cls: 'processed', label: 'Em andamento' },
  cancelado  : { cls: 'cancelled', label: 'Cancelado' },
};

/* ========= estado dos filtros ========= */
const STATE = {
  from: '',  // YYYY-MM-DD
  to:   '',  // YYYY-MM-DD
  status: 'finalizado',   // por padrão: pedidos finalizados
  q: ''     // busca por cliente/ID
};

/* ========= binding dos filtros (IDs são atribuídos dinamicamente) ========= */
function wireFilters() {
  const bar = qs('.filter-bar');
  if (!bar) return;

  // pega inputs pela ordem e dá IDs:
  const inputs = qsa('.filter-input', bar);
  // ordem na página: [dateFrom, dateTo, selectStatus, searchInput]
  const [dateFrom, dateTo, selectStatus, searchInput] = [inputs[0], inputs[1], inputs[2], inputs[3]];
  if (dateFrom)  dateFrom.id  = 'f-from';
  if (dateTo)    dateTo.id    = 'f-to';
  if (selectStatus) selectStatus.id = 'f-status';
  if (searchInput)  searchInput.id  = 'f-q';

  // Popula select com opção "Concluída (finalizado)" por padrão
  if (selectStatus && !selectStatus.dataset.enhanced) {
    selectStatus.dataset.enhanced = '1';
    const hasFinal = qsa('option', selectStatus).some(o => (o.value||'').toLowerCase().includes('final'));
    if (!hasFinal) {
      selectStatus.insertAdjacentHTML('beforeend', `<option value="finalizado" selected>Concluída</option>`);
    } else {
      // tenta selecionar finalizado por padrão se existir
      qsa('option', selectStatus).forEach(o => {
        if ((o.value||'').toLowerCase().includes('final')) o.selected = true;
      });
    }
  }

  const onChange = () => {
    STATE.from   = (dateFrom && dateFrom.value) || '';
    STATE.to     = (dateTo && dateTo.value) || '';
    STATE.status = (selectStatus && selectStatus.value) || '';
    STATE.q      = (searchInput && searchInput.value.trim()) || '';
    loadAndRender();
  };

  dateFrom  && dateFrom.addEventListener('change', onChange);
  dateTo    && dateTo.addEventListener('change', onChange);
  selectStatus && selectStatus.addEventListener('change', onChange);
  searchInput  && searchInput.addEventListener('input', () => {
    clearTimeout(searchInput._t);
    searchInput._t = setTimeout(onChange, 250);
  });

  // Botão CSV
  const btnCSV = bar.querySelector('.btn');
  btnCSV && btnCSV.addEventListener('click', exportCSV);
}

/* ========= query builder ========= */
function buildQuery() {
  const p = new URLSearchParams();
  if (STATE.status) p.set('status', STATE.status);
  if (STATE.from)   p.set('date_from', STATE.from);
  if (STATE.to)     p.set('date_to', STATE.to);
  if (STATE.q)      p.set('q', STATE.q);
  return p.toString();
}

/* ========= busca robusta (com fallback de endpoint) ========= */
async function fetchOrders() {
  let lastErr = null;
  for (const base of API_ADMIN_ORDERS) {
    const url = base.includes('?') ? `${base}&${buildQuery()}` : `${base}?${buildQuery()}`;
    try {
      const data = await fetchJSON(url);
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.items)) return data.items;
      return data;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Falha ao buscar pedidos.');
}

/* ========= render KPIs ========= */
function renderKPIs(orders) {
  const kpiCards = qsa('.kpi-card');
  if (!kpiCards.length) return;

  const now = Date.now();
  const d30 = 30 * 24 * 3600 * 1000;

  const faturamento = orders.reduce((acc, o) => acc + Number(o.total || 0), 0);
  const ult30 = orders.filter(o => {
    const t = new Date(o.created_at || o.createdAt || o.data || Date.now()).getTime();
    return (now - t) <= d30;
  }).length;
  const ticket = orders.length ? (faturamento / orders.length) : 0;

  if (kpiCards[0]) kpiCards[0].querySelector('.kpi-value').textContent = fmtBRL(faturamento);
  if (kpiCards[1]) kpiCards[1].querySelector('.kpi-value').textContent = String(ult30);
  if (kpiCards[2]) kpiCards[2].querySelector('.kpi-value').textContent = fmtBRL(ticket);
}

/* ========= tabela ========= */
function statusBadge(statusRaw) {
  const key = String(statusRaw||'').toLowerCase();
  const m = STATUS_MAP[key] || { cls:'processed', label: statusRaw || '—' };
  return `<span class="status ${m.cls}">${m.label}</span>`;
}

function rowHTML(order) {
  const id    = order.id || order.id_pedido || order.idPedido || order.order_id || '?';
  const user  = order.user_name || order.cliente || order.customer || (order.user && (order.user.name || order.user.email)) || `Usuário #${order.user_id || order.userId || '-'}`;
  const date  = fmtDateBR(order.created_at || order.createdAt || order.data);
  const total = fmtBRL(order.total || 0);
  const st    = statusBadge(order.status);

  return `
    <tr data-oid="${id}">
      <td><strong>#${id}</strong></td>
      <td>${user}</td>
      <td>${date}</td>
      <td>${total}</td>
      <td>${st}</td>
      <td class="actions-cell">
        <button class="action-view" title="Ver Detalhes">📄</button>
        <button class="action-print" title="Imprimir Recibo">🖨️</button>
      </td>
    </tr>`;
}

function renderTable(orders) {
  const tbody = qs('table.custom-table tbody');
  if (!tbody) return;

  if (!orders.length) {
    tbody.innerHTML = `
      <tr><td colspan="6">
        <div class="card" style="padding:12px;">Nenhum pedido encontrado para os filtros atuais.</div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = orders.map(rowHTML).join('');
  bindTableActions(tbody);
}

/* ========= exportação CSV ========= */
function exportCSV() {
  const tbody = qs('table.custom-table tbody');
  if (!tbody) return;
  const rows = qsa('tr', tbody);
  if (!rows.length) return;

  const header = ['ID da Venda', 'Cliente', 'Data', 'Valor Total', 'Status'];
  const lines = [header.join(';')];

  rows.forEach(tr => {
    const tds = qsa('td', tr);
    if (tds.length < 5) return;
    const id    = (tds[0].innerText || '').trim();
    const cli   = (tds[1].innerText || '').trim();
    const data  = (tds[2].innerText || '').trim();
    const total = (tds[3].innerText || '').trim();
    const status= (tds[4].innerText || '').trim();
    lines.push([id, cli, data, total, status].map(v => `"${v.replaceAll('"','""')}"`).join(';'));
  });

  const blob = new Blob([lines.join('\n')], {type: 'text/csv;charset=utf-8;'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `vendas_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ========= MODAL DETALHE ========= */
function ensureDetailModal() {
  let root = document.querySelector('#orderModal');
  if (root) {
    wireModalClose(root);
    return root;
  }
  // fallback simples se não existir no HTML
  const html = `
    <div id="orderModal" class="modal" aria-hidden="true" style="display:none;">
      <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="orderModalTitle">
        <header class="modal-header">
          <h3 id="orderModalTitle">Pedido</h3>
          <button class="modal-close" aria-label="Fechar">×</button>
        </header>
        <section class="modal-body">
          <div class="order-head">
            <div>
              <div class="order-id-status">
                <span class="order-id">#—</span>
                <span class="pill pill-muted" data-ord-status>status</span>
              </div>
              <div class="order-meta">
                <span class="meta-item" data-ord-date>—</span>
                <span class="meta-item" data-ord-user>—</span>
                <span class="meta-item" data-ord-email>—</span>
              </div>
            </div>
            <div class="order-total">
              <small>Total</small>
              <strong data-ord-total>R$ 0,00</strong>
            </div>
          </div>
          <div class="order-items-wrap">
            <table class="custom-table modal-table">
              <thead>
                <tr><th>Produto</th><th>Qtd</th><th>Unitário</th><th>Subtotal</th></tr>
              </thead>
              <tbody id="orderItemsBody"><tr><td colspan="4" style="padding:12px;">Carregando...</td></tr></tbody>
            </table>
          </div>
        </section>
        <footer class="modal-footer">
          <button class="btn" id="printOrder">Imprimir</button>
          <button class="btn primary" id="closeOrderModal">Fechar</button>
        </footer>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
  root = document.querySelector('#orderModal');
  wireModalClose(root);
  return root;
}

function wireModalClose(root) {
  const closeBtns = root.querySelectorAll('.modal-close, #closeOrderModal');
  closeBtns.forEach(b => b.addEventListener('click', closeDetailModal));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDetailModal(); });
}

function openDetailModal() {
  const root = ensureDetailModal();
  root.style.display = 'block';
  root.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}
function closeDetailModal() {
  const root = document.querySelector('#orderModal');
  if (!root) return;
  root.style.display = 'none';
  root.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function M() {
  const root = ensureDetailModal();
  return {
    root,
    id: root.querySelector('.order-id'),
    statusPill: root.querySelector('[data-ord-status], .order-id-status .pill'),
    date: root.querySelector('[data-ord-date]'),
    user: root.querySelector('[data-ord-user]'),
    email: root.querySelector('[data-ord-email]'),
    total: root.querySelector('[data-ord-total]'),
    items: root.querySelector('#orderItemsBody'),
    print: root.querySelector('#printOrder'),
  };
}

// Detalhe do pedido (com fallback)
async function fetchOrderDetail(id) {
  try { return await fetchJSON(`/api/admin/orders/${id}`); }
  catch (e1) {
    try { return await fetchJSON(`/api/orders/${id}?admin=1`); }
    catch (e2) { throw e1; }
  }
}

// Renderiza o conteúdo do modal
function renderOrderDetail(data) {
  const el = M();
  const set = (n, v) => { if (n) n.textContent = v; };

  const id = data.id || data.id_pedido || '—';
  set(el.id, `#${id}`);

  const stKey = String(data.status||'').toLowerCase();
  const st = STATUS_MAP[stKey]?.label || (data.status || '—');
  if (el.statusPill) {
    el.statusPill.textContent = st;
    el.statusPill.className = `pill ${STATUS_MAP[stKey]?.cls ? `pill-${STATUS_MAP[stKey].cls}` : 'pill-muted'}`;
  }

  set(el.date, fmtDateBR(data.created_at || Date.now()));
  set(el.user, data.user_name || `Usuário #${data.user_id || '—'}`);
  set(el.email, data.user_email || '');
  set(el.total, fmtBRL(data.total || 0));

  const items = Array.isArray(data.items) ? data.items : [];
  if (el.items) {
    if (!items.length) {
      el.items.innerHTML = `<tr><td colspan="4" style="padding:12px;">Pedido sem itens.</td></tr>`;
    } else {
      el.items.innerHTML = items.map(it => {
        const nome = it.produto_nome || it.produto?.nome || `#${it.produto_id||''}`;
        const qtd  = Number(it.qtd||0);
        const unit = Number(it.preco_unit||0);
        const sub  = qtd * unit;
        return `<tr>
          <td>${nome}</td>
          <td>${qtd}</td>
          <td>${fmtBRL(unit)}</td>
          <td>${fmtBRL(sub)}</td>
        </tr>`;
      }).join('');
    }
  }
  if (el.print) el.print.onclick = () => window.open(`/api/admin/orders/${id}/recibo`, '_blank');
}

// Abre modal e busca detalhe
async function openOrderDetail(orderId) {
  const el = M();
  if (el.items) el.items.innerHTML = `<tr><td colspan="4" style="padding:12px;">Carregando...</td></tr>`;
  openDetailModal();
  try {
    const data = await fetchOrderDetail(orderId);
    renderOrderDetail(data);
  } catch (err) {
    if (el.items) el.items.innerHTML = `<tr><td colspan="4" style="padding:12px;color:#b91c1c;">Não foi possível carregar o pedido #${orderId}: ${(err && err.message) || 'erro'}</td></tr>`;
  }
}

/* ========= ações da tabela ========= */
function bindTableActions(tbody) {
  if (!tbody) return;
  tbody.addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-oid]');
    if (!tr) return;
    const oid = tr.getAttribute('data-oid');

    if (e.target.closest('.action-view')) {
      openOrderDetail(oid);
    }
    if (e.target.closest('.action-print')) {
      window.open(`/api/admin/orders/${oid}/recibo`, '_blank');
    }
  });
}

/* ========= carregar e renderizar ========= */
async function loadAndRender() {
  try {
    if (!STATE.status) STATE.status = 'finalizado'; // força status finalizado por padrão

    const orders = await fetchOrders();

    // filtro extra no front (se necessário)
    const list = orders.filter(o => {
      const st = String(o.status || '').toLowerCase();
      const statusOk = STATE.status ? (st.includes(STATE.status)) : true;

      const created = new Date(o.created_at || o.createdAt || Date.now());
      const fromOk = STATE.from ? (created >= new Date(STATE.from)) : true;
      const toOk   = STATE.to   ? (created <= new Date(STATE.to + 'T23:59:59')) : true;

      const hay = `${o.id||o.id_pedido||''} ${(o.user_name||'')} ${(o.cliente||'')} ${(o.total||'')}`.toLowerCase();
      const qOk = STATE.q ? hay.includes(STATE.q.toLowerCase()) : true;

      return statusOk && fromOk && toOk && qOk;
    });

    renderKPIs(list);
    renderTable(list);

  } catch (err) {
    console.error('Falha ao carregar vendas:', err);
    const tbody = qs('table.custom-table tbody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="card" style="padding:12px;">Erro ao carregar vendas.</div></td></tr>`;
    }
    renderKPIs([]);
  }
}

/* ========= bootstrap ========= */
document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  wireFilters();
  loadAndRender();
});

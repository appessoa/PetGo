// /public/js/pagamento.js
import { initHeader, updateCartCount } from './header.js';
import { showToast } from '/public/js/utils/toast.js';

document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  bootstrapPaymentPage();
});

const API_BASE = '/api';

/* ================= Helpers ================= */
const qs  = (s, r=document) => r.querySelector(s);
const qsa = (s, r=document) => [...r.querySelectorAll(s)];
const esc = (s='') => String(s)
  .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
  .replaceAll('"','&quot;').replaceAll("'","&#039;");
const fmtBRL = (v) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'})
  .format(Number(v||0));

async function fetchJSON(url, opts={}) {
  const res = await fetch(url, { headers: { 'Content-Type':'application/json' }, credentials:'include', ...opts });
  let data=null; try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error((data && (data.message||data.error)) || `HTTP ${res.status}`);
  return data;
}

/* ================== API ================== */
const getCart = () => fetchJSON(`${API_BASE}/carrinho`);
const getProduto = (id) => fetchJSON(`${API_BASE}/produtos/${id}`);

/**
 * POST /api/checkout
 * body: { payment_method: 'credit_card'|'pix', payment_data: {...} }
 * response esperado: { id_pedido, total, status } (ou {order_id: ...})
 */
const postCheckout = (payload) =>
  fetchJSON(`${API_BASE}/checkout`, { method:'POST', body: JSON.stringify(payload) });

/* ============ Máscaras/validações simples ============ */
function maskCardNumber(v='') {
  return v.replace(/\D/g,'').slice(0,16).replace(/(\d{4})(?=\d)/g, '$1 ');
}
function maskExpiry(v='') {
  const d = v.replace(/\D/g,'').slice(0,4);
  if (d.length <= 2) return d;
  return d.slice(0,2) + '/' + d.slice(2);
}
function maskCVV(v='') {
  return v.replace(/\D/g,'').slice(0,4);
}

function validateCreditCard({ number, name, expiry, cvv }) {
  const digits = number.replace(/\s/g,'');
  if (digits.length < 15 || digits.length > 16) return 'Número do cartão inválido.';
  if (!name || name.trim().length < 3) return 'Nome no cartão inválido.';
  if (!/^\d{2}\/\d{2}$/.test(expiry)) return 'Validade inválida (MM/AA).';
  const mm = parseInt(expiry.slice(0,2), 10);
  if (mm < 1 || mm > 12) return 'Mês de validade inválido.';
  if (!/^\d{3,4}$/.test(cvv)) return 'CVV inválido.';
  return null;
}
function validatePix({ cpfCnpj }) {
  if (!cpfCnpj || cpfCnpj.replace(/\D/g,'').length < 11) return 'CPF/CNPJ inválido.';
  return null;
}

/* ============ Render Resumo do Pedido ============ */
async function renderOrderSummary() {
  const aside = qs('.order-summary');
  if (!aside) return { total: 0, items: [] };

  try {
    const cart = await getCart();
    const items = cart.items || [];
    const prods = await Promise.all(items.map(it => getProduto(it.id_produto).catch(()=>({}))));
    const rich = items.map((it, i) => ({ ...it, product: prods[i] || {} }));
    const subtotal = Number(cart.subtotal || 0);

    if (!rich.length) {
      aside.innerHTML = `
        <h3>Seu Pedido</h3>
        <div class="card" style="padding:16px;">
          <p class="subtitle">Seu carrinho está vazio.</p>
          <a href="/produtos" class="btn primary" style="margin-top:8px;">Continuar comprando</a>
        </div>`;
      // desabilitar finalização se não há itens
      const finalizeBtn = getFinalizeBtn();
      if (finalizeBtn) { finalizeBtn.disabled = true; }
      updateCartCount(0);
      return { total: 0, items: [] };
    }

    const linesHTML = rich.map(it => {
      const p = it.product || {};
      const img = p.imagem || '/public/img/placeholder-product.png';
      const nome = p.nome || `Produto #${it.id_produto}`;
      const qtd = it.quantidade || 1;
      const unit = it.preco_unitario ?? p.preco ?? 0;
      const lineTotal = unit * qtd;
      return `
        <div class="order-item">
          <img src="${esc(img)}" alt="${esc(nome)}">
          <span>${esc(nome)} (${qtd}x)</span>
          <span>${fmtBRL(lineTotal)}</span>
        </div>`;
    }).join('');

    aside.innerHTML = `
      <h3>Seu Pedido</h3>
      ${linesHTML}
      <div class="order-total-summary">
        <span>Total</span>
        <span>${fmtBRL(subtotal)}</span>
      </div>
    `;
    return { total: subtotal, items: rich };
  } catch (err) {
    aside.innerHTML = `
      <h3>Seu Pedido</h3>
      <div class="card" style="padding:16px;">
        <p class="subtitle">Não foi possível carregar o pedido.</p>
      </div>`;
    showToast('Erro de banco de dados.', 'error');
    return { total: 0, items: [] };
  }
}

/* ============ Parcelas dinâmicas ============ */
function fillInstallments(total) {
  const sel = qs('#installments');
  if (!sel) return;
  const T = Number(total) || 0;
  // Ex.: 1x, 2x, 3x sem juros; 6x com juros leve (exemplo protótipo)
  const noInt = [
    { n:1, label: `1x de ${fmtBRL(T)} sem juros` },
    { n:2, label: `2x de ${fmtBRL(T/2)} sem juros` },
    { n:3, label: `3x de ${fmtBRL(T/3)} sem juros` },
  ];
  const juro6 = T * 1.03; // 3% protótipo
  const withInt = { n:6, label: `6x de ${fmtBRL(juro6/6)} com juros` };

  sel.innerHTML = [...noInt.map(x => `<option value="${x.n}">${esc(x.label)}</option>`),
                   `<option value="${withInt.n}">${esc(withInt.label)}</option>`].join('');
}

/* ============ Toggle método de pagamento ============ */
function bindPaymentMethodToggle() {
  const radios = qsa('input[name="payment_method"]');
  const ccForm = qs('#creditCardForm');
  const pixForm = qs('#pixForm');

  const update = () => {
    const val = radios.find(r => r.checked)?.value || 'credit_card';
    if (val === 'credit_card') {
      ccForm.style.display = '';
      pixForm.style.display = 'none';
    } else {
      ccForm.style.display = 'none';
      pixForm.style.display = '';
    }
  };

  radios.forEach(r => r.addEventListener('change', update));
  update();
}

/* ============ Máscaras (input) ============ */
function bindMasks() {
  const $card = qs('#cardNumber');
  const $exp  = qs('#expiryDate');
  const $cvv  = qs('#cvv');

  if ($card) $card.addEventListener('input', () => $card.value = maskCardNumber($card.value));
  if ($exp)  $exp.addEventListener('input',  () => $exp.value  = maskExpiry($exp.value));
  if ($cvv)  $cvv.addEventListener('input',  () => $cvv.value  = maskCVV($cvv.value));
}

/* ============ Finalizar Pedido ============ */
function getFinalizeBtn() {
  return qs('#paymentForm .btn.primary');
}

function bindSubmit(totalRef) {
  const form = qs('#paymentForm');
  if (!form) return;

  const finalizeBtn = getFinalizeBtn();
  if (finalizeBtn && finalizeBtn.tagName === 'A') {
    // Impede navegação do <a> e trata como submit
    finalizeBtn.addEventListener('click', (e) => { e.preventDefault(); form.requestSubmit(); });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const radios = qsa('input[name="payment_method"]');
    const method = radios.find(r => r.checked)?.value || 'credit_card';

    // coleta dados
    let payload = { payment_method: method, payment_data: {} };

    if (method === 'credit_card') {
      const number  = (qs('#cardNumber')?.value || '').trim();
      const name    = (qs('#cardName')?.value || '').trim();
      const expiry  = (qs('#expiryDate')?.value || '').trim();
      const cvv     = (qs('#cvv')?.value || '').trim();
      const inst    = parseInt(qs('#installments')?.value || '1', 10);

      const err = validateCreditCard({ number, name, expiry, cvv });
      if (err) { showToast(err, 'error'); return; }

      payload.payment_data = {
        card_last4: number.replace(/\s/g,'').slice(-4),
        holder: name,
        expiry,
        installments: inst
      };
    } else {
      const cpfCnpj = (qs('#cpfPix')?.value || '').trim();
      const err = validatePix({ cpfCnpj });
      if (err) { showToast(err, 'error'); return; }

      payload.payment_data = { cpf_cnpj: cpfCnpj };
    }

    // trava botão
    const btn = getFinalizeBtn();
    const old = btn?.textContent;
    if (btn) { btn.textContent = 'Processando...'; btn.disabled = true; }

    try {
      const res = await postCheckout(payload);
      // aceita tanto { id_pedido } quanto { order_id }
      const orderId = res.id_pedido || res.order_id || res.id || null;

      showToast('Pedido realizado com sucesso!', 'success');
      updateCartCount(0);

      // redireciona
      if (orderId) {
        location.href = `/orderConfirmed?order_id=${encodeURIComponent(orderId)}`;
      } else {
        location.href = `/orderConfirmed`;
      }
    } catch (err) {
      showToast('Erro de banco de dados.', 'error');
    } finally {
      if (btn) { btn.textContent = old || 'Finalizar Pedido'; btn.disabled = false; }
    }
  });
}

/* ============ Bootstrap ============ */
async function bootstrapPaymentPage() {
  // Resumo + parcelas dinâmicas
  const { total } = await renderOrderSummary();
  fillInstallments(total);

  // Inputs/Radio
  bindPaymentMethodToggle();
  bindMasks();
  bindSubmit(total);
}

// /public/js/pagamento.js
import { initHeader, updateCartCount } from './header.js';
import { showToast } from '/public/js/utils/toast.js';

document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  bootstrapPaymentPage();
});

const API_BASE = '/api';

// === CONFIGURAÇÃO ÚTIL PARA DEBUG/TESTE ===
// Se true, o frontend NÃO tentará postar para /api/checkout e fará download do payload diretamente.
// Use para testar sem backend. Depois colocar false.
const FORCE_DOWNLOAD_ON_SUBMIT = false;

/* ================= Helpers ================= */
const qs  = (s, r=document) => r.querySelector(s);
const qsa = (s, r=document) => [...r.querySelectorAll(s)];
const esc = (s='') => String(s)
  .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
  .replaceAll('"','&quot;').replaceAll("'","&#039;");
const fmtBRL = (v) => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'})
  .format(Number(v||0));

async function fetchJSON(url, opts={}) {
  console.debug('[fetchJSON] request', url, opts);
  const res = await fetch(url, { headers: { 'Content-Type':'application/json' }, credentials:'include', ...opts });
  let data=null;
  try { data = await res.json(); } catch (err) { console.debug('[fetchJSON] no-json-response', err); }
  if (!res.ok) throw new Error((data && (data.message||data.error)) || `HTTP ${res.status}`);
  return data;
}

/* ================== API ================== */
const getCart = () => fetchJSON(`${API_BASE}/carrinho`);
const getProduto = (id) => fetchJSON(`${API_BASE}/produtos/${id}`);

/**
 * POST /api/checkout
 * body: { payment_method: 'credit_card'|'pix', payment_data: {...}, order: {...} }
 */
const postCheckout = async (payload) => {
  console.debug('[postCheckout] payload to send:', payload);
  return await fetchJSON(`${API_BASE}/checkout`, { method:'POST', body: JSON.stringify(payload) });
};

/* ============ Utilitários adicionais ============ */
function downloadJSON(obj, filename) {
  try {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    console.info('[downloadJSON] arquivo gerado:', filename);
  } catch (err) {
    console.error('[downloadJSON] erro ao gerar arquivo', err);
    showToast('Não foi possível gerar arquivo para download.', 'error');
  }
}

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
    console.debug('[renderOrderSummary] cart', cart);
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
    console.error('[renderOrderSummary] erro', err);
    aside.innerHTML = `
      <h3>Seu Pedido</h3>
      <div class="card" style="padding:16px;">
        <p class="subtitle">Não foi possível carregar o pedido.</p>
      </div>`;
    showToast('Erro ao carregar o carrinho. Veja o console.', 'error');
    return { total: 0, items: [] };
  }
}

/* ============ Parcelas dinâmicas ============ */
function fillInstallments(total) {
  const sel = qs('#installments');
  if (!sel) return;
  const T = Number(total) || 0;
  const noInt = [
    { n:1, label: `1x de ${fmtBRL(T)} sem juros` },
    { n:2, label: `2x de ${fmtBRL(T/2)} sem juros` },
    { n:3, label: `3x de ${fmtBRL(T/3)} sem juros` },
  ];
  const juro6 = T * 1.03;
  const withInt = { n:6, label: `6x de ${fmtBRL(juro6/6)} com juros` };

  sel.innerHTML = [...noInt.map(x => `<option value="${x.n}">${esc(x.label)}</option>`),
                   `<option value="${withInt.n}">${esc(withInt.label)}</option>`].join('');
}

/* ============ Toggle método de pagamento (corrigido para evitar validação de campos ocultos) ============ */
function bindPaymentMethodToggle() {
  const radios = qsa('input[name="payment_method"]');
  const ccForm = qs('#creditCardForm');
  const pixForm = qs('#pixForm');

  // campos dentro de cada formulário (inputs, selects, textareas)
  const ccFields = Array.from(ccForm ? ccForm.querySelectorAll('input, select, textarea') : []);
  const pixFields = Array.from(pixForm ? pixForm.querySelectorAll('input, select, textarea') : []);

  const update = () => {
    const val = radios.find(r => r.checked)?.value || 'credit_card';

    if (val === 'credit_card') {
      if (ccForm) ccForm.style.display = '';
      if (pixForm) pixForm.style.display = 'none';
    } else {
      if (ccForm) ccForm.style.display = 'none';
      if (pixForm) pixForm.style.display = '';
    }

    // Para evitar validação de campos ocultos, desabilitamos os que não estão visíveis
    ccFields.forEach(f => {
      // se o método for cartão, habilita e torna required quando aplicável
      f.disabled = (val !== 'credit_card');
      // manter required apenas quando o campo for relevante e estiver visível
      if (f.tagName === 'INPUT' || f.tagName === 'SELECT' || f.tagName === 'TEXTAREA') {
        if (f.hasAttribute('data-always-required')) return;
        f.required = (val === 'credit_card');
      }
    });

    pixFields.forEach(f => {
      f.disabled = (val !== 'pix');
      if (f.tagName === 'INPUT' || f.tagName === 'SELECT' || f.tagName === 'TEXTAREA') {
        if (f.hasAttribute('data-always-required')) return;
        f.required = (val === 'pix');
      }
    });
  };

  radios.forEach(r => r.addEventListener('change', update));
  update(); // estado inicial correto
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

/* ============ Finalizar Pedido / Fluxo PIX ============ */
function getFinalizeBtn() {
  return qs('#paymentForm .btn.primary') || qs('#paymentForm button[type="submit"]');
}

function createPixModal({ orderId, pix_key, pix_qr_text, amount }) {
  const overlay = document.createElement('div');
  overlay.className = 'pix-overlay';
  overlay.style = `
    position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;
  `;
  const card = document.createElement('div');
  card.className = 'pix-card';
  card.style = 'background:#fff;padding:20px;border-radius:8px;max-width:420px;width:90%;box-shadow:0 8px 30px rgba(0,0,0,0.2)';

  card.innerHTML = `
    <h3>Pagamento via Pix</h3>
    <p>Pedido: <strong>${esc(orderId)}</strong></p>
    <p><strong>Valor:</strong> ${fmtBRL(amount)}</p>
    <div style="display:flex;gap:12px;align-items:center;margin:12px 0;">
      <div style="width:140px;height:140px;border:1px solid #ddd;display:flex;align-items:center;justify-content:center">
        <img id="pixQR" alt="QR Code Pix" src="" style="max-width:100%;max-height:100%;object-fit:contain">
      </div>
      <div style="flex:1;">
        <p style="word-break:break-all"><strong>Chave Pix:</strong><br><span id="pixKeyText">${esc(pix_key || '')}</span></p>
        <p class="help-text">Copie a chave e pague pelo seu app bancário.</p>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button id="copyPixKey" class="btn">Copiar chave</button>
          <button id="simulatePaid" class="btn">Já paguei</button>
          <button id="closePix" class="btn">Cancelar</button>
        </div>
      </div>
    </div>
    <p style="font-size:13px;color:#666;margin-top:8px;">Obs: esta tela é parte do fluxo de pagamento. Se você estiver em modo de teste, clique em "Já paguei" para confirmar manualmente.</p>
  `;

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  const img = overlay.querySelector('#pixQR');
  if (pix_qr_text) {
    if (pix_qr_text.startsWith('data:image')) {
      img.src = pix_qr_text;
    } else if (pix_qr_text.startsWith('http')) {
      img.src = pix_qr_text;
    } else {
      const canvas = document.createElement('canvas');
      canvas.width = 300; canvas.height = 300;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.fillStyle = '#000';
      ctx.font = '14px monospace';
      wrapText(ctx, pix_qr_text, 10, 20, 280, 16);
      img.src = canvas.toDataURL('image/png');
    }
  } else {
    const canvas = document.createElement('canvas');
    canvas.width = 300; canvas.height = 300;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = '#000';
    ctx.font = 'bold 16px Arial';
    ctx.fillText('PIX', 130, 140);
    ctx.font = '12px monospace';
    wrapText(ctx, pix_key || 'PIX', 10, 170, 280, 14);
    img.src = canvas.toDataURL('image/png');
  }

  return {
    overlay,
    close: () => overlay.remove(),
    setOnCopy(handler) { overlay.querySelector('#copyPixKey').addEventListener('click', handler); },
    setOnPaid(handler) { overlay.querySelector('#simulatePaid').addEventListener('click', handler); },
    setOnClose(handler) { overlay.querySelector('#closePix').addEventListener('click', handler); }
  };
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, y);
      line = words[n] + ' ';
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, y);
}

/**
 * Tenta confirmar pagamento via backend (rota opcional). Se falhar, redireciona localmente.
 */
async function tryConfirmPayment(orderId) {
  try {
    const res = await fetchJSON(`${API_BASE}/checkout/confirm`, { method: 'POST', body: JSON.stringify({ order_id: orderId }) });
    const oid = res.id_pedido || res.order_id || res.id || orderId;
    location.href = `/orderConfirmed?order_id=${encodeURIComponent(oid)}`;
  } catch (err) {
    console.warn('Confirmação backend falhou/ausente, redirecionando localmente.', err);
    location.href = `/orderConfirmed?order_id=${encodeURIComponent(orderId)}`;
  }
}

/* ============ Submit (com inclusão do payload do carrinho) ============ */
function bindSubmit(totalRef) {
  const form = qs('#paymentForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const radios = qsa('input[name="payment_method"]');
    const method = radios.find(r => r.checked)?.value || 'credit_card';

    // coleta dados de pagamento
    let payload = { payment_method: method, payment_data: {}, order: {} };

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
    } else { // PIX
      const cpfCnpj = (qs('#cpfPix')?.value || '').trim();
      const err = validatePix({ cpfCnpj });
      if (err) { showToast(err, 'error'); return; }

      payload.payment_data = { cpf_cnpj: cpfCnpj };
    }

    // === buscar o carrinho atual e anexar ao payload ===
    try {
      const cart = await getCart();
      console.debug('[bindSubmit] cart obtido', cart);
      const items = (cart.items || []).map(it => ({
        id_produto: it.id_produto,
        quantidade: it.quantidade,
        preco_unitario: it.preco_unitario ?? it.preco ?? null,
        nome: it.nome || (it.product && it.product.nome) || undefined
      }));
      const subtotal = Number(cart.subtotal ?? 0);
      const total = Number(cart.total ?? cart.subtotal ?? subtotal);

      payload.order = { items, subtotal, total };
    } catch (err) {
      console.warn('[bindSubmit] falha ao obter carrinho, usando fallback', err);
      payload.order = { items: [], subtotal: totalRef || 0, total: totalRef || 0 };
    }

    // Exibir payload no console (útil para debug)
    console.groupCollapsed('[bindSubmit] payload final');
    console.log(payload);
    console.groupEnd();

    const btn = getFinalizeBtn();
    const old = btn?.textContent;
    if (btn) { btn.textContent = 'Processando...'; btn.disabled = true; }

    try {
      if (FORCE_DOWNLOAD_ON_SUBMIT) {
        // modo teste: força download do payload e não chama o backend
        const name = `checkout-payload-${Date.now()}.json`;
        downloadJSON(payload, name);
        showToast('Payload gerado para download (modo de teste).', 'success');
        updateCartCount(0);
        if (btn) { btn.textContent = old || 'Finalizar Pedido'; btn.disabled = false; }
        return;
      }

      // tenta enviar para backend
      let res;
      try {
        res = await postCheckout(payload);
        console.debug('[bindSubmit] resposta do backend', res);
      } catch (err) {
        // erro de rede/resposta - gerar arquivo para download para permitir 'baixa' no sistema
        console.error('[bindSubmit] erro no postCheckout', err);
        showToast('Falha ao enviar para /api/checkout. Gerando arquivo JSON para baixar.', 'error');

        const name = `checkout-failed-${Date.now()}.json`;
        downloadJSON(payload, name);

        // opcional: parar aqui ou continuar com fallback modal PIX
        if (payload.payment_method === 'credit_card') {
          if (btn) { btn.textContent = old || 'Finalizar Pedido'; btn.disabled = false; }
          return;
        } else {
          // criar pedido localmente (fake orderId) para abrir modal Pix com a chave copiada do CPF/CNPJ
          const fakeOrderId = `local-${Date.now()}`;
          const pixKey = payload.payment_data.cpf_cnpj || `pix-fail-${Date.now()}`;
          const amount = payload.order.total || totalRef || 0;
          const modal = createPixModal({ orderId: fakeOrderId, pix_key: pixKey, pix_qr_text: null, amount });

          modal.setOnCopy(async () => {
            try {
              await navigator.clipboard.writeText(pixKey);
              showToast('Chave Pix copiada para a área de transferência.', 'success');
            } catch (e) {
              showToast('Não foi possível copiar a chave.', 'error');
            }
          });

          modal.setOnPaid(() => {
            showToast('Pagamento confirmado localmente (teste). Redirecionando...', 'info');
            location.href = `/orderConfirmed?order_id=${encodeURIComponent(fakeOrderId)}`;
          });

          modal.setOnClose(() => {
            modal.close();
            if (btn) { btn.textContent = old || 'Finalizar Pedido'; btn.disabled = false; }
          });

          updateCartCount(0);
          if (btn) { btn.textContent = old || 'Finalizar Pedido'; btn.disabled = false; }
          return;
        }
      }

      // se aqui, postCheckout teve sucesso e temos res
      const orderId = res.id_pedido || res.order_id || res.id || `order-${Date.now()}`;

      if (payload.payment_method === 'credit_card') {
        showToast('Pedido confirmado (cartão).', 'success');
        updateCartCount(0);
        location.href = `/orderConfirmed?order_id=${encodeURIComponent(orderId)}`;
        return;
      }

      // PIX: backend pode retornar pix_key / pix_qr / total
      const pixKey = (res.pix_key || res.chave_pix || payload.payment_data.cpf_cnpj || `pix-chave-${orderId}`);
      const pixQRText = res.pix_qr || res.qr_text || res.pix_qr_text || null;
      const amount = res.total || payload.order.total || totalRef || 0;

      const modal = createPixModal({ orderId, pix_key: pixKey, pix_qr_text: pixQRText, amount });

      modal.setOnCopy(async () => {
        try {
          await navigator.clipboard.writeText(pixKey);
          showToast('Chave Pix copiada para a área de transferência.', 'success');
        } catch (err) {
          showToast('Não foi possível copiar a chave.', 'error');
        }
      });

      modal.setOnPaid(() => {
        showToast('Confirmando pagamento...', 'info');
        tryConfirmPayment(orderId);
      });

      modal.setOnClose(() => {
        modal.close();
        if (btn) { btn.textContent = old || 'Finalizar Pedido'; btn.disabled = false; }
      });

      showToast('Pedido criado. Aproxime o QR ou copie a chave para pagar.', 'success');
      updateCartCount(0);
    } catch (err) {
      console.error('[bindSubmit] erro não esperado', err);
      showToast('Erro ao processar o pedido. Veja o console.', 'error');
    } finally {
      if (btn) { btn.textContent = old || 'Finalizar Pedido'; btn.disabled = false; }
    }
  });
}

/* ============ Bootstrap ============ */
async function bootstrapPaymentPage() {
  const { total } = await renderOrderSummary();
  fillInstallments(total);

  bindPaymentMethodToggle();
  bindMasks();
  bindSubmit(total);
}

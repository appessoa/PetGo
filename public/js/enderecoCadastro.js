// /public/js/enderecoCadastro.js
// deve ser importado como <script type="module" src="/public/js/enderecoCadastro.js"></script>

const API_BASE = '/api/users/addresses'; // GET list, POST create, GET/:id, PATCH/:id
const CSRF_TOKEN = window.CSRF_TOKEN || document.querySelector('meta[name="csrf-token"]')?.content || null;
const API_TOKEN = window.API_TOKEN || null;

function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return Array.from(document.querySelectorAll(sel)); }

function showToast(msg, type = 'info') {
  // implementação simples; adapte ao seu sistema de toast
  alert(msg);
}

function buildHeaders() {
  const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json' };
  if (CSRF_TOKEN) headers['X-CSRFToken'] = CSRF_TOKEN;
  if (API_TOKEN) headers['Authorization'] = 'Bearer ' + API_TOKEN;
  return headers;
}

// tenta extrair id da URL:
// formatos aceitos: /adress/cadastro/123   ou   /adress/cadastro?id=123
function getAddressIdFromUrl() {
  const url = new URL(window.location.href);
  // 1) procura param id
  if (url.searchParams.has('id')) {
    const v = url.searchParams.get('id');
    if (v && /^\d+$/.test(v)) return v;
  }
  // 2) procura último segmento numérico
  const parts = url.pathname.replace(/\/+$/, '').split('/');
  const last = parts[parts.length - 1];
  if (/^\d+$/.test(last)) return last;
  return null;
}

// mapeamento entre campos do formulário e payload esperado pelo backend
function formToPayload(form) {
  return {
    nome: form.destinatario?.value?.trim() || '',     // destinatário
    cep: form.cep?.value?.trim() || '',
    estado: form.estado?.value || '',
    logradouro: form.endereco?.value?.trim() || '',
    numero: form.numero?.value?.trim() || '',
    complemento: form.complemento?.value?.trim() || '',
    bairro: form.bairro?.value?.trim() || '',
    cidade: form.cidade?.value?.trim() || '',
    pontoRef: form.referencia?.value?.trim() || '',
    // opcional: tag (Casa/Trabalho) se quiser permitir no form
  };
}

function payloadToForm(data, form) {
  if (!data || !form) return;
  form.destinatario.value = data.nome ?? form.destinatario.value;
  form.cep.value = data.cep ?? form.cep.value;
  if (data.estado) {
    // tenta selecionar a option se existir
    const opt = form.estado.querySelector(`option[value="${data.estado}"]`);
    if (opt) opt.selected = true;
  }
  form.endereco.value = data.logradouro ?? form.endereco.value;
  form.numero.value = data.numero ?? form.numero.value;
  form.complemento.value = data.complemento ?? form.complemento.value;
  form.bairro.value = data.bairro ?? form.bairro.value;
  form.cidade.value = data.cidade ?? form.cidade.value;
  form.referencia.value = data.referencia ?? form.referencia.value;
}

async function fetchAddress(id) {
  try {
    const res = await fetch(`${API_BASE}/${id}`, {
      method: 'GET',
      headers: buildHeaders(),
      credentials: 'same-origin'
    });
    if (!res.ok) {
      const txt = await res.text().catch(()=>null);
      throw new Error(`Status ${res.status} ${txt || ''}`);
    }
    return await res.json();
  } catch (err) {
    console.error('fetchAddress error', err);
    throw err;
  }
}

async function createAddress(payload) {
  try {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: buildHeaders(),
      credentials: 'same-origin',
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const txt = await res.text().catch(()=>null);
      throw new Error(`Status ${res.status} ${txt || ''}`);
    }
    return await res.json();
  } catch (err) {
    console.error('createAddress error', err);
    throw err;
  }
}

async function updateAddress(id, payload) {
  try {
    const res = await fetch(`${API_BASE}/${id}`, {
      method: 'PATCH',
      headers: buildHeaders(),
      credentials: 'same-origin',
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const txt = await res.text().catch(()=>null);
      throw new Error(`Status ${res.status} ${txt || ''}`);
    }
    return await res.json();
  } catch (err) {
    console.error('updateAddress error', err);
    throw err;
  }
}

function validatePayload(payload) {
  const required = ['cidade', 'estado', 'numero', 'logradouro', 'bairro'];
  const missing = required.filter(k => !payload[k] || String(payload[k]).trim() === '');
  return missing;
}

function decideRedirectAfterSave() {
  // tenta voltar para a página anterior (selection) se existir, senão tenta rota padrão
  const ref = document.referrer || '';
  if (ref.includes('/selecionar') || ref.includes('/meusendereco') || ref.includes('/selection')) {
    return () => window.history.back();
  }
  // rota padrão para onde o usuário escolhe endereço (ajuste se necessário)
  const fallback = '/selecionar-endereco';
  return () => window.location.href = fallback;
}

async function main() {
  const form = qs('.checkout-form-section');
  if (!form) return;

  const addressId = getAddressIdFromUrl();
  const redirect = decideRedirectAfterSave();

  // se for edição: busca dados e popula
  if (addressId) {
    try {
      const data = await fetchAddress(addressId);
      payloadToForm(data, form);
      // opcional: alterar texto do botão
      const btn = form.querySelector('button[type="submit"]');
      if (btn) btn.textContent = 'Salvar alterações';
      // colocar um campo escondido para sinalizar edição (não estraga nada)
      let hid = form.querySelector('input[name="editing_id"]');
      if (!hid) {
        hid = document.createElement('input');
        hid.type = 'hidden';
        hid.name = 'editing_id';
        form.appendChild(hid);
      }
      hid.value = addressId;
    } catch (err) {
      showToast('Não foi possível carregar o endereço para edição. Você pode tentar novamente.');
    }
  }

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const payload = formToPayload(form);
    const missing = validatePayload(payload);
    if (missing.length) {
      showToast('Campos obrigatórios faltando: ' + missing.join(', '));
      return;
    }

    try {
      let saved;
      if (addressId) {
        saved = await updateAddress(addressId, payload);
        showToast('Endereço atualizado com sucesso!', 'success');
      } else {
        saved = await createAddress(payload);
        showToast('Endereço criado com sucesso!', 'success');
      }

      // redireciona: tenta voltar ao seletor de endereço ou para checkout
      // se o formulário original veio com action="/checkout", talvez você queira ir para /checkout
      // nesse caso, redirecionamos para o referrer quando pertinente; ajuste se quiser comportamento diferente.
      setTimeout(() => {
        // se a página de seleção existe no referrer, voltamos; senão vamos para fallback
        redirect();
      }, 300);

    } catch (err) {
      console.error(err);
      showToast('Erro ao salvar endereço. Verifique os dados e tente novamente.');
    }
  });
}

document.addEventListener('DOMContentLoaded', main);

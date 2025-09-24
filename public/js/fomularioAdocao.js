// /public/js/formulario.js
import { showToast } from '/public/js/utils/toast.js'; // se não tiver toast aqui, pode remover esse import
import { initHeader } from './header.js';

document.addEventListener('DOMContentLoaded', () => {
  wireSteps();
  wireResidenceToggle();
  wireSliders();
  bootPrefill();
  wireFormSubmit(); // adicionamos o submit final
  initHeader();
});

/* =============== BOOT: PRE-FILL =============== */
async function bootPrefill(){
  // 1) carrega /api/me
  let me;
  try{
    me = await fetchJSON('/api/me');
  }catch(e){
    console.warn('Não foi possível carregar /api/me:', e);
    return;
  }

  // 2) Preenche campos básicos
  setVal('nome',       me?.nome);
  setVal('cpf',        me?.cpf);
  setVal('email',      me?.email);
  setVal('telefone',   me?.numero);

  // 3) Endereço principal do usuário
  const userId = me?.id || me?.id_user;
  if (!userId) return;

  try {
    const list = await fetchJSON(`/api/users/${userId}/addresses`);
    let addr = null;
    if (Array.isArray(list) && list.length){
      addr = list.find(a => a.is_primary) || list[0];
      try { localStorage.setItem('primary_addr_id', String(addr.id || addr.id_address)); } catch {}
    }
    if (!addr) {
      let addrId = null; try { addrId = localStorage.getItem('primary_addr_id'); } catch {}
      if (addrId) {
        try { addr = await fetchJSON(`/api/users/${userId}/addresses/${addrId}`); } catch {}
      }
    }
    if (addr) {
      const cepMask = (addr.cep || '').replace(/\D/g,'').replace(/^(\d{5})(\d{0,3})$/, (_,a,b)=> b? `${a}-${b}` : a);
      setVal('cep', cepMask);
      setVal('endereco',   addr.logradouro || addr.endereco || '');
      setVal('bairro',     addr.bairro || '');
      setVal('cidade',     addr.cidade || '');
      const uf = addr.estado || '';
      const $estado = document.getElementById('estado');
      if ($estado) $estado.value = uf;
      setVal('numero',      addr.numero || '');
      setVal('complemento', addr.complemento || '');
    }
  } catch (e) {
    console.warn('Endereço do usuário indisponível:', e);
  }
}

/* =============== HELPERS =============== */
async function fetchJSON(url, opts={}){
  const r = await fetch(url, { credentials: 'include', ...opts });
  let data = null;
  try { data = await r.json(); } catch {}
  if (!r.ok) {
    const err = new Error((data && (data.error || data.message)) || `HTTP ${r.status}`);
    err.status = r.status;
    err.payload = data;
    throw err;
  }
  return data;
}

function setVal(id, v){
  const el = document.getElementById(id);
  if (!el || v == null) return;
  el.value = String(v);
}

/* =============== UI: STEPS =============== */
function wireSteps(){
  const nextBtns = document.querySelectorAll('.next-step');
  const prevBtns = document.querySelectorAll('.prev-step');

  nextBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const step = parseInt(btn.dataset.step, 10);
      goToStep(step + 1);
    });
  });

  prevBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const step = parseInt(btn.dataset.step, 10);
      goToStep(step - 1);
    });
  });
}

function goToStep(target){
  const steps = [1,2,3];
  if (!steps.includes(target)) return;
  document.querySelectorAll('.progress-step').forEach((el,i)=>{
    el.classList.toggle('active', (i+1) === target);
  });
  ['step1Content','step2Content','step3Content'].forEach((id, idx) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', (idx+1) === target);
  });
}

/* =============== UI: RESIDENCE / TELAS =============== */
function wireResidenceToggle(){
  const sel = document.getElementById('residencia_tipo');
  const group = document.getElementById('telas-protecao-group');
  const telas = document.getElementById('telas_protecao');
  if (!sel || !group) return;

  const update = () => {
    const isApto = (sel.value || '').toLowerCase() === 'apartamento';
    group.style.display = isApto ? '' : 'none';
    if (telas) {
      if (isApto) telas.setAttribute('required','true');
      else        telas.removeAttribute('required');
    }
  };

  sel.addEventListener('change', update);
  update();
}

/* =============== UI: SLIDERS =============== */
function wireSliders(){
  const pairs = [
    { input: 'sociabilidade', label: 'sociabilidade-value' },
    { input: 'brincadeira',   label: 'brincadeira-value'   },
    { input: 'carinho',       label: 'carinho-value'       },
  ];
  pairs.forEach(({input,label})=>{
    const $in = document.getElementById(input);
    const $lb = document.getElementById(label);
    if (!$in || !$lb) return;
    const update = () => { $lb.textContent = $in.value; };
    $in.addEventListener('input', update);
    update();
  });
}

/* =============== SUBMIT FINAL =============== */
function wireFormSubmit(){
  const form = document.querySelector('form');
  if(!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFieldErrors();

    const btn = form.querySelector('[type="submit"]');
    const oldText = btn?.textContent;
    if(btn){ btn.disabled = true; btn.textContent = 'Enviando...'; }

    try{
      const payload = collectPayload();
      const app = await fetchJSON('/api/adocoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include'
      });

      showToast?.('Formulário enviado com sucesso!', 'success');
      setTimeout(() => (window.location.href = "/UserPage"), 1500);

      // window.location.href = `/minhas-adocoes/${app.id || app.id_adoption_applications || ''}`;
    }catch(err){
      const msg = err?.payload?.message || err?.message || 'Falha ao enviar.';
      const details = err?.payload?.details || err?.payload?.errors || null;
      if(details && typeof details === 'object'){
        markFieldErrors(details);
      }
      showToast?.(msg, 'error');
      console.warn('SUBMIT ERROR:', err);
    }finally{
      if(btn){ btn.disabled = false; btn.textContent = oldText; }
    }
  });
}

function collectPayload(){
  const getByIdOrName = (key) =>
    document.getElementById(key) || document.querySelector(`[name="${key}"]`);

  const v = (key) => (getByIdOrName(key)?.value ?? '').toString().trim();
  const num = (key) => {
    const raw = v(key);
    if(raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };

  const tpEl = getByIdOrName('telas_protecao');
  let telas_protecao = null;
  if(tpEl){
    if(tpEl.type === 'checkbox'){
      telas_protecao = !!tpEl.checked;
    }else{
      const raw = (tpEl.value || '').toString().toLowerCase();
      if(['sim','true','1','yes'].includes(raw)) telas_protecao = true;
      else if(['nao','não','false','0','no'].includes(raw)) telas_protecao = false;
    }
  }

  return {
    pet_id:        num('pet_id'),
    tipo_pet:      v('tipo_pet') || null,
    residencia_tipo: v('residencia_tipo'),
    telas_protecao,
    sociabilidade: num('sociabilidade'),
    brincadeira:   num('brincadeira'),
    carinho:       num('carinho'),
    motivo:        v('motivo')
  };
}

function clearFieldErrors(){
  document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
  document.querySelectorAll('.field-hint').forEach(el => el.remove());
}

function markFieldErrors(details){
  Object.keys(details).forEach(k => {
    const el = document.getElementById(k) || document.querySelector(`[name="${k}"]`);
    if(!el) return;
    el.classList.add('input-error');
    let hint = el.nextElementSibling;
    const msg = details[k];
    if(!hint || !hint.classList?.contains('field-hint')){
      hint = document.createElement('div');
      hint.className = 'field-hint';
      el.insertAdjacentElement('afterend', hint);
    }
    hint.textContent = msg;
  });
}


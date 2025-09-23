// /public/js/formulario.js
import { showToast } from '/public/js/utils/toast.js'; // se não tiver toast aqui, pode remover esse import

document.addEventListener('DOMContentLoaded', () => {
  wireSteps();
  wireResidenceToggle();
  wireSliders();
  bootPrefill();
});

/* =============== BOOT: PRE-FILL =============== */
async function bootPrefill(){
  // 1) carrega /api/me
  let me;
  try{
    me = await fetchJSON('/api/me');
  }catch(e){
    // não redireciona aqui; apenas deixa o formulário vazio
    console.warn('Não foi possível carregar /api/me:', e);
    return;
  }

  // 2) Preenche campos básicos (se existirem)
  setVal('nome',       me?.nome);
  setVal('cpf',        me?.cpf);
  setVal('email',      me?.email);
  setVal('telefone',   me?.numero);

  // 3) Endereço principal do usuário
  const userId = me?.id || me?.id_user;
  if (!userId) return;

  try {
    // tenta lista de endereços
    const list = await fetchJSON(`/api/users/${userId}/addresses`);
    let addr = null;
    if (Array.isArray(list) && list.length){
      addr = list.find(a => a.is_primary) || list[0];
      try { localStorage.setItem('primary_addr_id', String(addr.id || addr.id_address)); } catch {}
    }

    // fallback: busca item específico se tiver id salvo
    if (!addr) {
      let addrId = null; try { addrId = localStorage.getItem('primary_addr_id'); } catch {}
      if (addrId) {
        try { addr = await fetchJSON(`/api/users/${userId}/addresses/${addrId}`); } catch {}
      }
    }

    // Se encontrou endereço, preenche os campos
    if (addr) {
      // CEP — mostra no formato 00000-000
      const cepMask = (addr.cep || '').replace(/\D/g,'').replace(/^(\d{5})(\d{0,3})$/, (_,a,b)=> b? `${a}-${b}` : a);
      setVal('cep', cepMask);

      // Estes campos são desabilitados no HTML (serão populados automaticamente)
      setVal('endereco',   addr.logradouro || addr.endereco || '');
      setVal('bairro',     addr.bairro || '');
      setVal('cidade',     addr.cidade || '');

      // estado é <select>, então setamos o value se existir
      const uf = addr.estado || '';
      const $estado = document.getElementById('estado');
      if ($estado) $estado.value = uf;

      // Campos que o usuário completa manualmente
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
  // steps: 1,2,3
  const steps = [1,2,3];
  if (!steps.includes(target)) return;

  // progress bar
  document.querySelectorAll('.progress-step').forEach((el,i)=>{
    el.classList.toggle('active', (i+1) === target);
  });

  // contents
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
  update(); // estado inicial
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

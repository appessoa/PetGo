// /public/js/userpage.js
import { initHeader } from './header.js';
import { showToast } from './utils/toast.js';

document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  boot();
});

async function boot(){
  try{
    const me = await fetchJSON('/api/me');
    renderProfile(me);
    await loadAndRenderAddress(me);

    const pets  = await fetchJSON('/api/me/pets');
    renderPets(pets);

    const sched = await fetchJSON('/api/agendamentos');
    renderScheduling(sched);

    const orders = await fetchJSON('/api/me/orders');
    renderOrders(orders);

    wireActions(me);
  }catch(e){
    console.error(e);
    showToast('Faça login para ver sua conta.', 'error');
    location.href = '/login';
  }
}

/* =========================
 * ENDEREÇO
 * ========================= */
async function loadAndRenderAddress(me){
  const userId = me?.id || me?.id_user;
  if(!userId){ setAddressValueInGrid('-'); return; }

  try{
    const list = await fetchJSON(`/api/users/${userId}/addresses`, { credentials:'include' });
    if (Array.isArray(list) && list.length){
      const primary = list.find(a => a.is_primary) || list[0];
      try { localStorage.setItem('primary_addr_id', String(primary.id || primary.id_address)); } catch {}
      const full = primary.full_address || composeFullAddress(primary) || '-';
      setAddressValueInGrid(full);
      return;
    }
  }catch(err){
    console.debug('Lista de endereços indisponível, tentando item único…', err?.message || err);
  }

  let addrId = null;
  try{ addrId = localStorage.getItem('primary_addr_id'); }catch{}
  if(addrId){
    try{
      const addr = await fetchJSON(`/api/users/${userId}/addresses/${addrId}`, { credentials:'include' });
      const full = addr?.full_address || composeFullAddress(addr) || '-';
      setAddressValueInGrid(full);
      return;
    }catch(err){
      console.debug('Falha ao buscar endereço específico:', err?.message || err);
    }
  }

  setAddressValueInGrid('-');
}

function setAddressValueInGrid(text){
  const row = document.querySelector('.info-row[data-field="endereco"]');
  if(!row) return;
  const span = row.querySelector('[data-role="value"]');
  if(span) span.textContent = text || '-';
}

/* =========================
 * AGENDAMENTOS
 * ========================= */
function renderScheduling(items){
  const list = document.getElementById('schedList');
  if(!list) return;

  list.innerHTML = '';

  if(!items || !items.length){
    list.innerHTML = '<div class="info-item">Você ainda não possui agendamentos.</div>';
    return;
  }

  console.log('Agendamentos:', items);

  for(const ag of items){
    const dt = ag.date ? formatBRDate(ag.date) : '-';
    const hr = ag.time || '';
    const serv = labelService(ag.service);
    const petNome = ag.pet?.nome || ag.pet?.name || `#${ag.pet_id}`;
    const notes = ag.notes || ag.observacoes || '';

    const statusClass = classByStatus(ag.status);
    const statusLabel = labelStatus(ag.status);

    const el = document.createElement('div');
    el.className = 'scheduling-item';
    el.innerHTML = `
      <div class="scheduling-info">
        <strong>${serv} — ${escapeHtml(petNome)}</strong>
        <small>Dr. ${escapeHtml(ag.vet?.name || ag.vet?.nome || 'Veterinário(a)')} - ${ag.vet?.especialidade}</small>
        <small>Data: ${dt} • Horário: ${hr}</small>
        ${notes ? `<small>Obs.: ${escapeHtml(notes)}</small>` : ''}
      </div>
      <div class="scheduling-status ${statusClass}">${statusLabel}</div>
    `;
    list.appendChild(el);
  }
}
function labelService(s){
  const map = { banho:'Banho & Tosa', veterinario:'Veterinário Online', passeio:'Passeio PetGo', hotel:'Hotelzinho' };
  return map[(s||'').toLowerCase()] || (s || 'Serviço');
}
function classByStatus(st){
  const s = (st||'').toLowerCase();
  if(s === 'confirmado') return 'status-confirmado';
  if(s === 'concluido')  return 'status-concluido';
  if(s === 'cancelado')  return 'status-cancelado';
  return 'status-marcado';
}
function labelStatus(st){
  const s = (st||'').toLowerCase();
  if(s === 'confirmado') return 'Confirmado';
  if(s === 'concluido')  return 'Concluído';
  if(s === 'cancelado')  return 'Cancelado';
  return 'Marcado';
}
function formatBRDate(iso){
  try{
    const d = new Date(iso);
    if(!isNaN(d)) return d.toLocaleDateString('pt-BR');
    const [y,m,dd] = String(iso).split('-');
    return `${dd}/${m}/${y}`;
  }catch{ return iso; }
}

/* =========================
 * FETCH
 * ========================= */
async function fetchJSON(url, opts={}){
  const r = await fetch(url, { credentials: 'include', ...opts });
  if(!r.ok) {
    let msg = 'Erro';
    try { const j = await r.json(); msg = j.error || j.message || JSON.stringify(j); } catch {}
    throw new Error(`${r.status}: ${msg}`);
  }
  return r.json();
}

/* =========================
 * PERFIL + GRID
 * ========================= */
function ageFromDOB(dob){
  if(!dob) return 'idade desconhecida';
  const b = new Date(dob);
  const now = new Date();
  let years = now.getFullYear() - b.getFullYear();
  let months = now.getMonth() - b.getMonth();
  if (now.getDate() < b.getDate()) months -= 1;
  if (months < 0) { years -= 1; months += 12; }
  if (years > 0) return `${years} ano(s) e ${months} mes(es)`;
  return `${months} mes(es)`;
}

function renderProfile(me){
  const card = document.querySelector('.profile-card .profile-info');
  if(card){
    card.querySelector('h2').textContent = me.nome || 'Usuário';
    const pTags = card.querySelectorAll('p');
    if(pTags[0]) pTags[0].textContent = `Email: ${me.email || '-'}`;
    if(pTags[1]){
      const dt = me.created_at ? new Date(me.created_at) : null;
      const mes = dt ? dt.toLocaleDateString('pt-BR', { month:'long', year:'numeric' }) : '-';
      pTags[1].textContent = `Membro desde: ${mes}`;
    }
  }

  const grid = document.getElementById('infoGrid');
  if(!grid) return;

  const fields = [
    { key:'nome',     label:'Nome',     value: me.nome },
    { key:'email',    label:'Email',    value: me.email },
    { key:'cpf',      label:'CPF',      value: me.cpf },
    { key:'numero',   label:'Telefone', value: me.numero },
    { key:'endereco', label:'Endereço', value: '-', readonly: true },
  ];

  grid.innerHTML = fields.map(f => infoRowTpl(f.key, f.label, f.value, f.readonly)).join('');
  grid.addEventListener('click', onGridClick, { once: true });
}

function infoRowTpl(key, label, value, readonly=false){
  const isAddress = key === 'endereco';
  return `
    <div class="info-row" data-field="${key}">
      <div class="info-meta">
        <span class="info-label">${label}:</span>
        <span class="info-value" data-role="value">${escapeHtml(value || '-')}</span>
      </div>
      ${
        isAddress
          ? `<button class="btn" data-role="addr-edit">Editar</button>`
          : `<button class="icon-btn" data-role="edit" aria-label="Editar ${label}" title="Editar">
               ${pencilSVG()}
             </button>`
      }
    </div>
  `;
}

function onGridClick(e){
  const grid = e.currentTarget;
  grid.addEventListener('click', async ev => {
    const btn = ev.target.closest('[data-role="edit"],[data-role="save"],[data-role="cancel"],[data-role="addr-edit"]');
    if(!btn) return;

    const row = ev.target.closest('.info-row');
    if(!row) return;

    const field = row.dataset.field;
    const label = row.querySelector('.info-label')?.textContent.replace(':','') || field;

    // Endereço: sempre abre o modal
    if (btn.dataset.role === 'addr-edit' || (btn.dataset.role === 'edit' && field === 'endereco')) {
      if (typeof window.openAddressModal === 'function') {
        window.openAddressModal();
      } else {
        showToast('Modal de endereço indisponível.', 'error');
      }
      return;
    }

    if(btn.dataset.role === 'edit'){
      const current = row.querySelector('[data-role="value"]')?.textContent?.trim() || '';
      row.innerHTML = `
        <div class="inline-edit">
          <span class="badge">${label}</span>
          <input type="text" value="${escapeAttr(current === '-' ? '' : current)}" data-role="input">
        </div>
        <div class="inline-actions">
          <button class="btn primary" data-role="save">Salvar</button>
          <button class="btn" data-role="cancel">Cancelar</button>
        </div>
      `;
      row.querySelector('[data-role="input"]').focus();
      return;
    }

    if(btn.dataset.role === 'cancel'){
      const me = await fetchJSON('/api/me');
      const val = me[field] || '';
      row.outerHTML = infoRowTpl(field, capitalize(fieldLabel(field)), val, field==='endereco');
      showToast('Edição cancelada.');
      return;
    }

    if(btn.dataset.role === 'save'){
      const input = row.querySelector('[data-role="input"]');
      const newValue = (input?.value || '').trim();

      const body = {};
      body[field] = newValue;

      btn.disabled = true;
      try{
        const updated = await fetchJSON('/api/me', {
          method:'PUT',
          headers:{'Content-Type':'application/json'},
          credentials:'include',
          body: JSON.stringify(body)
        });

        row.outerHTML = infoRowTpl(field, capitalize(fieldLabel(field)), updated[field] || '');
        showToast('Informação atualizada!', 'success');
      }catch(err){
        showToast(err.message || 'Erro ao salvar.', 'error');
        btn.disabled = false;
      }
    }
  });
}

/* =========================
 * PETS
 * ========================= */
function renderPets(pets){
  const grid = document.querySelector('.pets-grid');
  if(!grid) return;
  grid.innerHTML = '';
  if(!pets || !pets.length){
    grid.innerHTML = '<div class="info-item">Você ainda não adotou pets.</div>';
    return;
  }
  for(const p of pets){
    const img = p.photo || defaultAvatar(p.breed);
    const el = document.createElement('div');
    el.className = 'pet-card';
    el.innerHTML = `
      <img src="${img}" alt="${escapeHtml(p.name || p.nome)}">
      <div class="pet-body">
        <h4>${escapeHtml(p.name || p.nome)}</h4>
        <p>
        ${escapeHtml(p.species || '')}
        ${p.species && (p.breed || p.raca) ? ' - ' : ''}
        ${escapeHtml(p.breed || p.raca || '')}
        </p>
        <p>
        ${ageFromDOB(p.dob)}
        ${p.weight ? ` - ${p.weight} kg` : ''}
        </p>
      </div>
    `;
    grid.appendChild(el);
  }
}

/* =========================
 * PEDIDOS
 * ========================= */
function renderOrders(orders){
  const list = document.querySelector('.orders-list');
  if(!list) return;
  list.innerHTML = '';
  if(!orders || !orders.length){
    list.innerHTML = '<div class="info-item">Você ainda não possui pedidos.</div>';
    return;
  }
  for(const o of orders){
    const dt = o.created_at ? new Date(o.created_at).toLocaleDateString('pt-BR') : '';
    const itens = (o.items || []).map(i => `${i.produto} (${i.qtd})`).join(', ');
    const statusClass = o.status === 'concluido' ? 'status-concluido'
                      : o.status === 'andamento' ? 'status-andamento'
                      : '';
    const el = document.createElement('div');
    el.className = 'order-item';
    el.innerHTML = `
      <div class="order-info">
        <strong>Pedido #${o.id}</strong>
        <span>Data: ${dt} — Total: R$ ${Number(o.total || 0).toFixed(2)}</span>
        <span>Itens: ${escapeHtml(itens)}</span>
      </div>
      <div class="order-status ${statusClass}">${o.status || ''}</div>
    `;
    list.appendChild(el);
  }
}

/* =========================
 * AÇÕES: ALTERAR SENHA
 * ========================= */
function wireActions(me){
  const toggle = document.getElementById('togglePwForm');
  const form = document.getElementById('pwForm');
  const cancel = document.getElementById('pwCancel');

  if(toggle && form){
    toggle.addEventListener('click', ()=>{
      const isHidden = form.hasAttribute('hidden');
      if(isHidden){ form.removeAttribute('hidden'); toggle.setAttribute('aria-expanded','true'); }
      else{ form.setAttribute('hidden',''); toggle.setAttribute('aria-expanded','false'); }
    });
  }
  if(cancel && form){
    cancel.addEventListener('click', ()=>{
      form.reset();
      form.setAttribute('hidden','');
      toggle?.setAttribute('aria-expanded','false');
    });
  }
  if(form){
    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      const oldpw = document.getElementById('pwOld').value.trim();
      const newpw = document.getElementById('pwNew').value.trim();
      if(!oldpw || !newpw) return;

      const btn = form.querySelector('.primary');
      btn.disabled = true;
      try{
        await fetchJSON('/api/me/password', {
          method:'PUT',
          headers:{'Content-Type':'application/json'},
          credentials:'include',
          body: JSON.stringify({ old_password: oldpw, new_password: newpw })
        });
        showToast('Senha alterada com sucesso!', 'success');
        form.reset();
        form.setAttribute('hidden','');
        toggle?.setAttribute('aria-expanded','false');
      }catch(err){
        showToast(err.message || 'Erro ao alterar senha.', 'error');
      }finally{
        btn.disabled = false;
      }
    });
  }
}

/* =========================
 * MODAL ALTERAR SENHA
 * ========================= */
(function setupPasswordModal(){
  const openBtn = document.getElementById('openPwModal');
  const modal = document.getElementById('pwModal');
  const form = document.getElementById('pwForm');

  if(!openBtn || !modal || !form) return;

  const closeEls = modal.querySelectorAll('[data-close]');
  const close = () => {
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden','true');
    form.reset();
  };
  const open = () => {
    modal.classList.add('show');
    modal.setAttribute('aria-hidden','false');
    setTimeout(()=> document.getElementById('pwOld')?.focus(), 0);
  };

  openBtn.addEventListener('click', open);
  closeEls.forEach(el => el.addEventListener('click', close));
  modal.addEventListener('click', (e)=> { if(e.target === modal) close(); });
  document.addEventListener('keydown', (e)=> { if(modal.classList.contains('show') && e.key === 'Escape') close(); });

  form.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const oldpw = document.getElementById('pwOld').value.trim();
    const newpw = document.getElementById('pwNew').value.trim();

    if(newpw.length < 6){
      showToast('A nova senha precisa ter ao menos 6 caracteres.', 'error');
      return;
    }

    const submitBtn = form.querySelector('.primary');
    submitBtn.disabled = true;

    try{
      await fetchJSON('/api/me/password', {
        method:'PUT',
        headers:{'Content-Type':'application/json'},
        credentials:'include',
        body: JSON.stringify({ old_password: oldpw, new_password: newpw })
      });
      showToast('Senha alterada com sucesso!', 'success');
      close();
    }catch(err){
      showToast(err.message || 'Erro ao alterar senha.', 'error');
    }finally{
      submitBtn.disabled = false;
    }
  });
})();

/* ===== Modal de Endereço ===== */
(function setupAddressModal(){
  const modal = document.getElementById('addrModal');
  const form  = document.getElementById('addrForm');
  if(!modal || !form) return;

  // seleciona os elementos *quando* o modal abre (evita null)
  function queryAddrEls(){
    return {
      $cep:        document.getElementById('addrCep'),
      $logradouro: document.getElementById('addrLogradouro'),
      $bairro:     document.getElementById('addrBairro'),
      $cidade:     document.getElementById('addrCidade'),
      $estado:     document.getElementById('addrEstado'),
      $numero:     document.getElementById('addrNumero'),
      $compl:      document.getElementById('addrComplemento'),
      $help:       document.getElementById('addrCepHelp'),
    };
  }

  // máscara & ViaCEP (delegado ao abrir para ter refs recentes)
  function wireCepMaskAndLookup($cep, $logradouro, $bairro, $cidade, $estado, $help){
    const cleanup = [];
    const onInput = (e) => {
      const d = e.target.value.replace(/\D/g, '').slice(0,8);
      e.target.value = d.length > 5 ? d.slice(0,5) + '-' + d.slice(5) : d;
    };
    const onBlur = () => fetchCepIfReady();
    const onKey = () => { if ($cep.value.replace(/\D/g, '').length === 8) fetchCepIfReady(); };

    $cep.addEventListener('input', onInput);
    $cep.addEventListener('blur', onBlur);
    $cep.addEventListener('keyup', onKey);
    cleanup.push(()=> $cep.removeEventListener('input', onInput));
    cleanup.push(()=> $cep.removeEventListener('blur', onBlur));
    cleanup.push(()=> $cep.removeEventListener('keyup', onKey));

    async function fetchCepIfReady(){
      const digits = $cep.value.replace(/\D/g, '');
      if (digits.length !== 8){
        setHelp('Digite um CEP com 8 dígitos.');
        clearAuto();
        return;
      }
      setHelp('Buscando endereço…');
      try {
        const resp = await fetch(`https://viacep.com.br/ws/${digits}/json/`, { cache: 'no-store' });
        if (!resp.ok) throw new Error();
        const data = await resp.json();
        if (data.erro){
          setHelp('CEP não encontrado.');
          clearAuto();
          return;
        }
        $logradouro.value = data.logradouro || '';
        $bairro.value     = data.bairro || '';
        $cidade.value     = data.localidade || '';
        $estado.value     = data.uf || '';
        setHelp('Endereço preenchido. Informe número e complemento.');
      } catch {
        setHelp('Falha na consulta do CEP.');
        clearAuto();
      }
    }
    function clearAuto(){ $logradouro.value=''; $bairro.value=''; $cidade.value=''; $estado.value=''; }
    function setHelp(msg){ if($help) $help.textContent = msg || ''; }

    return () => cleanup.forEach(fn => fn());
  }

  let removeCepListeners = null;

  // API pública para abrir modal
  window.openAddressModal = async function openAddressModal(){
    const els = queryAddrEls();
    const { $cep, $logradouro, $bairro, $cidade, $estado, $numero, $compl, $help } = els;

    // se algum essencial não existir, aborta com aviso
    if (!$cep || !$logradouro || !$bairro || !$cidade || !$estado || !$numero || !$compl) {
      console.warn('Campos do modal de endereço não encontrados no DOM.');
      showToast('Modal de endereço indisponível no momento.', 'error');
      return;
    }

    // (re)liga máscara & ViaCEP sempre que abrir
    if (removeCepListeners) removeCepListeners();
    removeCepListeners = wireCepMaskAndLookup($cep, $logradouro, $bairro, $cidade, $estado, $help);

    // carrega dados atuais
    try{
      const me = await fetchJSON('/api/me');
      const userId = me?.id || me?.id_user;

      let addr = null;
      try{
        const list = await fetchJSON(`/api/users/${userId}/addresses`);
        if (Array.isArray(list) && list.length){
          addr = list.find(a => a.is_primary) || list[0];
          try { localStorage.setItem('primary_addr_id', String(addr.id || addr.id_address)); } catch {}
        }
      }catch{}

      if(!addr){
        let addrId = null; try{ addrId = localStorage.getItem('primary_addr_id'); }catch{}
        if(addrId){
          try{ addr = await fetchJSON(`/api/users/${userId}/addresses/${addrId}`); }catch{}
        }
      }

      // preenche form (com segurança)
      $cep.value        = (addr?.cep || '').replace(/\D/g,'').replace(/^(\d{5})(\d{0,3})$/, (_,a,b)=> b? `${a}-${b}` : a);
      $logradouro.value = addr?.logradouro || addr?.endereco || '';
      $bairro.value     = addr?.bairro || '';
      $cidade.value     = addr?.cidade || '';
      $estado.value     = addr?.estado || '';
      $numero.value     = addr?.numero || '';
      $compl.value      = addr?.complemento || '';

      modal.classList.add('show');
      modal.setAttribute('aria-hidden', 'false');
      setTimeout(()=> $cep.focus(), 0);
    }catch(e){
      console.error(e);
      showToast('Não foi possível carregar seu endereço.', 'error');
    }
  };

  function closeModal(){
    const { $help } = queryAddrEls();
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    const form = document.getElementById('addrForm');
    form?.reset();
    if ($help) $help.textContent = '';
    if (removeCepListeners) { removeCepListeners(); removeCepListeners = null; }
  }

  modal.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', closeModal));
  modal.addEventListener('click', (e)=> { if(e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e)=> { if(modal.classList.contains('show') && e.key === 'Escape') closeModal(); });

  // submit
  document.getElementById('addrForm')?.addEventListener('submit', async (e)=>{
    e.preventDefault();

    const { $cep, $logradouro, $bairro, $cidade, $estado, $numero, $compl } = queryAddrEls();
    if (!$cep || !$logradouro || !$bairro || !$cidade || !$estado || !$numero) {
      showToast('Preencha o formulário de endereço corretamente.', 'error');
      return;
    }

    const cepDigits = $cep.value.replace(/\D/g,'');
    if (cepDigits.length !== 8){ showToast('Informe um CEP válido (8 dígitos).', 'error'); $cep.focus(); return; }
    if (!$logradouro.value || !$bairro.value || !$cidade.value || !$estado.value){ showToast('Use o CEP para preencher o endereço.', 'error'); $cep.focus(); return; }
    if (!$numero.value){ showToast('Informe o número.', 'error'); $numero.focus(); return; }

    const payload = {
      cep: $cep.value,
      logradouro: $logradouro.value,
      numero: $numero.value,
      complemento: $compl?.value || '',
      bairro: $bairro.value,
      cidade: $cidade.value,
      estado: $estado.value,
      pais: 'BR',
      is_primary: true,
    };

    const submitBtn = document.querySelector('#addrForm .primary');
    if (submitBtn) submitBtn.disabled = true;

    try{
      const me = await fetchJSON('/api/me');
      const userId = me?.id || me?.id_user;

      let addrId = null;
      try{
        const list = await fetchJSON(`/api/users/${userId}/addresses`);
        if (Array.isArray(list) && list.length){
          const primary = list.find(a => a.is_primary) || list[0];
          addrId = primary.id || primary.id_address;
        }
      }catch{}

      let saved;
      if (addrId){
        saved = await fetchJSON(`/api/users/${userId}/addresses/${addrId}`, {
          method: 'PATCH',
          headers: { 'Content-Type':'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
      } else {
        saved = await fetchJSON(`/api/users/${userId}/addresses`, {
          method: 'POST',
          headers: { 'Content-Type':'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        });
        try { localStorage.setItem('primary_addr_id', String(saved.id || saved.id_address)); } catch {}
      }

      const full = saved?.full_address || composeFullAddress(saved) || composeFullAddress(payload) || '-';
      setAddressValueInGrid(full);

      showToast('Endereço atualizado com sucesso!', 'success');
      closeModal();
    }catch(err){
      console.error(err);
      showToast(err.message || 'Erro ao salvar endereço.', 'error');
    }finally{
      if (submitBtn) submitBtn.disabled = false;
    }
  });
})();

/* =========================
 * UTILS
 * ========================= */
function composeFullAddress(addr){
  if(!addr) return '';
  const street = addr.logradouro || addr.endereco || addr.street || '';
  const numero = addr.numero || addr.number || '';
  const complemento = addr.complemento || addr.complement || '';
  const bairro = addr.bairro || addr.district || '';
  const cidade = addr.cidade || addr.city || '';
  const estado = addr.estado || addr.state || '';
  const cep = addr.cep || addr.zip || '';
  const pais = addr.pais || addr.country || 'BR';

  const parts = [];
  if(street) parts.push(numero ? `${street}, ${numero}` : street);
  if(complemento) parts.push(complemento);
  if(bairro) parts.push(bairro);
  if(cidade) parts.push(cidade);
  if(estado) parts.push(estado);
  if(cep) parts.push(`CEP ${cep}`);
  if(pais) parts.push(pais);

  return parts.filter(Boolean).join(' - ');
}

function defaultAvatar(breed){
  const b = (breed || '').toLowerCase();
  if(b.includes('gato')) return 'https://placekitten.com/400/250';
  if(b.includes('cach') || b.includes('dog')) return 'https://placedog.net/400/250';
  return 'https://placehold.co/400x250?text=PET';
}
function fieldLabel(key){
  const map = { nome:'Nome', email:'Email', cpf:'CPF', numero:'Telefone', endereco:'Endereço' };
  return map[key] || key;
}
function capitalize(s){ return (s||'').charAt(0).toUpperCase() + (s||'').slice(1); }
function escapeAttr(s){ return String(s).replaceAll('"','&quot;'); }
function escapeHtml(s){
  if(!s) return '';
  return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>');
}
function pencilSVG(){
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 20h9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L8 18l-4 1 1-4L16.5 3.5z" stroke="currentColor" stroke-width="2" fill="none"/>
  </svg>`;
}

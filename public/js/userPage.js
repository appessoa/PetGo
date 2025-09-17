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

    const pets = await fetchJSON('/api/me/pets');
    renderPets(pets);

    // 👉 NOVO: carrega agendamentos do usuário
    const sched = await fetchJSON('/api/agendamentos');
    renderScheduling(sched);

    const orders = await fetchJSON('/api/me/orders');
    renderOrders(orders);

    wireActions(me);
  }catch(e){
    console.error(e);
    showToast('Faça login para ver sua conta.', 'error');  // em vez de alert
    location.href = '/login';
  }
}


function renderScheduling(items){
  const list = document.getElementById('schedList');
  if(!list) return;

  list.innerHTML = '';

  if(!items || !items.length){
    list.innerHTML = '<div class="info-item">Você ainda não possui agendamentos.</div>';
    return;
  }

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
        <small>Data: ${dt} • Horário: ${hr}</small>
        ${notes ? `<small>Obs.: ${escapeHtml(notes)}</small>` : ''}
      </div>
      <div class="scheduling-status ${statusClass}">${statusLabel}</div>
    `;
    list.appendChild(el);
  }
}

function labelService(s){
  const map = {
    banho: 'Banho & Tosa',
    veterinario: 'Veterinário Online',
    passeio: 'Passeio PetGo',
    hotel: 'Hotelzinho',
  };
  return map[(s||'').toLowerCase()] || (s || 'Serviço');
}

function classByStatus(st){
  const s = (st||'').toLowerCase();
  if(s === 'confirmado') return 'status-confirmado';
  if(s === 'concluido') return 'status-concluido';
  if(s === 'cancelado') return 'status-cancelado';
  return 'status-marcado'; // default
}

function labelStatus(st){
  const s = (st||'').toLowerCase();
  if(s === 'confirmado') return 'Confirmado';
  if(s === 'concluido') return 'Concluído';
  if(s === 'cancelado') return 'Cancelado';
  return 'Marcado';
}

function formatBRDate(iso){
  // aceita "YYYY-MM-DD" ou Date ISO completo
  try{
    const d = new Date(iso);
    if(!isNaN(d)) return d.toLocaleDateString('pt-BR');
    // fallback para string YYYY-MM-DD
    const [y,m,dd] = String(iso).split('-');
    return `${dd}/${m}/${y}`;
  }catch{ return iso; }
}


async function fetchJSON(url, opts={}){
  const r = await fetch(url, { credentials: 'include', ...opts });
  if(!r.ok) {
    let msg = 'Erro';
    try { const j = await r.json(); msg = j.error || JSON.stringify(j); } catch {}
    throw new Error(`${r.status}: ${msg}`);
  }
  return r.json();
}
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
  // header do perfil
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

  // grade de informações com "caneta" por campo
  const grid = document.getElementById('infoGrid');
  if(!grid) return;

  const fields = [
    { key:'nome',     label:'Nome',     value: me.nome },
    { key:'email',    label:'Email',    value: me.email },
    { key:'cpf',      label:'CPF',      value: me.cpf },
    { key:'numero',   label:'Telefone', value: me.numero },
    { key:'endereco', label:'Endereço', value: me.endereco },
  ];

  grid.innerHTML = fields.map(f => infoRowTpl(f.key, f.label, f.value)).join('');

  // delega edição inline
  grid.addEventListener('click', onGridClick, { once: true });
}

function infoRowTpl(key, label, value){
  return `
    <div class="info-row" data-field="${key}">
      <div class="info-meta">
        <span class="info-label">${label}:</span>
        <span class="info-value" data-role="value">${escapeHtml(value || '-')}</span>
      </div>
      <button class="icon-btn" data-role="edit" aria-label="Editar ${label}" title="Editar">
        ${pencilSVG()}
      </button>
    </div>
  `;
}

function onGridClick(e){
  const grid = e.currentTarget;
  grid.addEventListener('click', async ev => {
    const btn = ev.target.closest('[data-role="edit"],[data-role="save"],[data-role="cancel"]');
    if(!btn) return;

    const row = ev.target.closest('.info-row');
    if(!row) return;

    const field = row.dataset.field;
    const label = row.querySelector('.info-label')?.textContent.replace(':','') || field;

    // entrar em modo edição
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

    // cancelar
    if(btn.dataset.role === 'cancel'){
      // re-render somente esta linha a partir do DOM atual do card
      const me = await fetchJSON('/api/me');
      row.outerHTML = infoRowTpl(field, capitalize(fieldLabel(field)), me[field] || '');
      showToast('Edição cancelada.');
      return;
    }

    // salvar
    if(btn.dataset.role === 'save'){
      const input = row.querySelector('[data-role="input"]');
      const newValue = (input?.value || '').trim();

      // payload apenas com o campo alterado
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

        // re-render linha com valor novo confirmado pelo backend
        row.outerHTML = infoRowTpl(field, capitalize(fieldLabel(field)), updated[field] || '');
        showToast('Informação atualizada!', 'success');
      }catch(err){
        showToast(err.message || 'Erro ao salvar.', 'error');
        btn.disabled = false;
      }
    }
  });
}

function fieldLabel(key){
  const map = { nome:'Nome', email:'Email', cpf:'CPF', numero:'Telefone', endereco:'Endereço' };
  return map[key] || key;
}
function capitalize(s){ return (s||'').charAt(0).toUpperCase() + (s||'').slice(1); }
function escapeAttr(s){ return String(s).replaceAll('"','&quot;'); }

function pencilSVG(){
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M12 20h9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L8 18l-4 1 1-4L16.5 3.5z" stroke="currentColor" stroke-width="2" fill="none"/>
  </svg>`;
}

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

// Ações: editar perfil & alterar senha
function wireActions(me){
  // apenas senha (edição de perfil agora é inline por campo)
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
// ---- Modal Alterar Senha ----
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
    // foco no primeiro campo
    setTimeout(()=> document.getElementById('pwOld')?.focus(), 0);
  };

  openBtn.addEventListener('click', open);
  closeEls.forEach(el => el.addEventListener('click', close));
  modal.addEventListener('click', (e)=> {
    if(e.target === modal) close(); // (backup)
  });
  document.addEventListener('keydown', (e)=> {
    if(modal.classList.contains('show') && e.key === 'Escape') close();
  });

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


function defaultAvatar(breed){
  const b = (breed || '').toLowerCase();
  if(b.includes('gato')) return 'https://placekitten.com/400/250';
  if(b.includes('cach') || b.includes('dog')) return 'https://placedog.net/400/250';
  return 'https://placehold.co/400x250?text=PET';
}

function escapeHtml(s){
  if(!s) return '';
  return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
}



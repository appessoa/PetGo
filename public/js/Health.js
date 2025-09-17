import { initHeader } from './header.js';

document.addEventListener("DOMContentLoaded", () => {
  initHeader();
  boot();
});

// ====== App state ======
let state = { pets: [], selectedPetId: null };

// ====== Utils ======
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// Retorna elemento e emite warning se não existir (evita TypeError de null.innerHTML)
function must$(sel) {
  const el = $(sel);
  if (!el) {
    console.warn(`[UI] Elemento não encontrado: ${sel}. Verifique o HTML.`);
  }
  return el;
}

function uid(){ return 'p_' + Math.random().toString(36).slice(2,9); } // ids locais (uploads etc.)

// ====== API helpers ======
const API = {
  async listPets(){
    const r = await fetch('/api/pets', { credentials: 'include' });
    if(!r.ok) throw new Error('Falha ao listar pets');
    return r.json();
  },
  async createPet(payload){
    const r = await fetch('/api/pets', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    if(!r.ok) throw new Error('Falha ao criar pet');
    return r.json();
  },
  async updatePet(id, payload){
    const r = await fetch(`/api/pets/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type':'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    if(!r.ok) throw new Error('Falha ao atualizar pet');
    return r.json();
  },
  async deletePet(id){
    const r = await fetch(`/api/pets/${id}`, { method: 'DELETE', credentials: 'include' });
    if(!r.ok) throw new Error('Falha ao excluir pet');
    return true;
  },
  async addVaccine(petId, vac){
    const r = await fetch(`/api/pets/${petId}/vaccines`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      credentials: 'include',
      body: JSON.stringify(vac)
    });
    if(!r.ok) throw new Error('Falha ao adicionar vacina');
    return r.json();
  },
  async removeVaccine(petId, vId){
    const r = await fetch(`/api/pets/${petId}/vaccines/${vId}`, { method: 'DELETE', credentials: 'include' });
    if(!r.ok) throw new Error('Falha ao remover vacina');
    return true;
  },
  async addConsult(petId, cons){
    const r = await fetch(`/api/pets/${petId}/consultations`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      credentials: 'include',
      body: JSON.stringify(cons)
    });
    if(!r.ok) throw new Error('Falha ao adicionar consulta');
    return r.json();
  },
  async removeConsult(petId, cId){
    const r = await fetch(`/api/pets/${petId}/consultations/${cId}`, { method: 'DELETE', credentials: 'include' });
    if(!r.ok) throw new Error('Falha ao remover consulta');
    return true;
  }
};

// ====== Boot ======
async function boot(){
  try{
    state.pets = await API.listPets();
  }catch(e){
    console.error(e);
    state.pets = [];
  }
  if(state.pets.length) state.selectedPetId = normalizeId(state.pets[0].id);
  renderPetsList();
  renderReminders();
  renderSelected();
  wireEvents();
}

// ====== Rendering ======
function renderPetsList(){
  const list = must$('#petsList'); if(!list) return;
  list.innerHTML = '';
  state.pets.forEach(p => {
    const petPhoto = p.photo || defaultAvatar(p.species);
    const el = document.createElement('div');
    const pid = normalizeId(p.id);
    el.className = 'pet-item' + (pid === state.selectedPetId ? ' active' : '');
    el.dataset.id = pid;
    el.innerHTML = `
      <img src="${petPhoto}" class="pet-avatar" alt="${escapeHtml(p.name)}">
      <div>
        <div style="font-weight:700">${escapeHtml(p.name)}</div>
        <div class="muted">${escapeHtml(p.species || '')} • ${escapeHtml(p.breed || '')}</div>
      </div>
    `;
    el.addEventListener('click', () => { selectPet(pid) });
    list.appendChild(el);
  });
  if(state.pets.length === 0){
    list.innerHTML = '<div class="muted">Nenhum pet cadastrado.</div>';
  }
}

function defaultAvatar(species){
  if(!species) return 'https://placehold.co/200x200?text=?';
  species = String(species).toLowerCase();
  if(species.includes('gato')) return 'https://placekitten.com/200/200';
  if(species.includes('cach') || species.includes('dog')) return 'https://placedog.net/200/200';
  return 'https://placehold.co/200x200?text=pet';
}

function renderSelected(){
  const detail = must$('#petDetail');
  const empty = must$('#emptyPlaceholder');
  const notice = must$('#noticeBox');
  if(!detail || !empty || !notice) return;

  const pet = state.pets.find(p => normalizeId(p.id) === state.selectedPetId);
  if(!pet){
    detail.style.display = 'none';
    empty.style.display = 'block';
    notice.innerHTML = '';
    return;
  }

  const petPhoto = pet.photo || defaultAvatar(pet.species);

  empty.style.display = 'none';
  detail.style.display = 'block';
  const photoEl = must$('#detailPhoto');
  const nameEl  = must$('#detailName');
  const infoEl  = must$('#detailInfo');
  if(photoEl) photoEl.src = petPhoto;
  if(nameEl)  nameEl.textContent = pet.name || '';
  if(infoEl)  infoEl.textContent =
    `${pet.species || '-'} • ${pet.sexo || '-'} • ${pet.breed || '-'} • ` +
    `${pet.dob ? ageFromDOB(pet.dob) : 'idade desconhecida'}` +
    `${pet.weight ? ` • ${pet.weight} kg` : ''}`;

  const vList = must$('#vaccineList'); if(vList){ 
    vList.innerHTML = '';
    (pet.vaccines || []).slice().reverse().forEach(v=>{
      const div = document.createElement('div');
      div.className = 'timeline-item';
      div.innerHTML = `<strong>${escapeHtml(v.name)}</strong>
        <div class="meta">${formatDate(v.date)} ${v.next ? '• Próx: ' + formatDate(v.next) : ''}</div>
        <div style="margin-top:6px">${escapeHtml(v.notes || '')}</div>
        <div style="margin-top:8px"><button data-id="${v.id}" class="btn" onclick="removeVaccine('${v.id}')">Remover</button></div>`;
      vList.appendChild(div);
    });
  }

  const cList = must$('#consultList'); if(cList){
    cList.innerHTML = '';
    (pet.consultations || []).slice().reverse().forEach(c=>{
      const div = document.createElement('div');
      div.className = 'timeline-item';
      div.innerHTML = `<strong>${escapeHtml(c.reason || 'Consulta')}</strong>
        <div class="meta">${formatDate(c.date)}</div>
        <div style="margin-top:6px">${escapeHtml(c.notes || '')}</div>
        <div style="margin-top:8px"><button data-id="${c.id}" class="btn" onclick="removeConsult('${c.id}')">Remover</button></div>`;
      cList.appendChild(div);
    });
  }

  const upList = must$('#uploadsList'); if(upList){
    upList.innerHTML = '';
    (pet.uploads || []).forEach(u=>{
      const img = document.createElement('img');
      img.className = 'upload-thumb';
      img.src = u.data;
      img.title = u.name;
      upList.appendChild(img);
    });
  }

  renderNotice(pet);
  renderReminders();
}

function renderNotice(pet){
  const box = must$('#noticeBox'); if(!box) return;
  const upcoming = (pet.vaccines || [])
    .filter(v => v.next)
    .map(v => ({...v, days: daysUntil(v.next)}))
    .sort((a,b)=>a.days-b.days);
  const soon = upcoming.filter(u => u.days <= 7 && u.days >= 0);
  if(soon.length){
    box.innerHTML = `<div class="notice"><strong>Atenção:</strong> Vacina "${escapeHtml(soon[0].name)}" com próxima dose em ${soon[0].days} dia(s) (${formatDate(soon[0].next)})</div>`;
  } else {
    box.innerHTML = '';
  }
}

function renderReminders(){
  const container = must$('#reminders'); if(!container) return;
  container.innerHTML = '';
  const items = [];
  state.pets.forEach(p => {
    (p.vaccines || []).forEach(v=>{
      if(v.next) items.push({petName: p.name, vaccine: v.name, next: v.next});
    });
  });
  items.sort((a,b)=> new Date(a.next) - new Date(b.next));
  if(items.length === 0){
    container.innerHTML = '<div class="muted">Nenhum lembrete programado.</div>';
    return;
  }
  items.slice(0,5).forEach(it=>{
    const days = daysUntil(it.next);
    const el = document.createElement('div');
    el.innerHTML = `<strong>${escapeHtml(it.petName)}</strong>: ${escapeHtml(it.vaccine)} • ${formatDate(it.next)} <span class="muted">(${days} dias)</span>`;
    container.appendChild(el);
  });
}

// ====== Helpers ======
function normalizeId(id){ return id != null ? String(id) : null; }

function formatDate(d){ if(!d) return ''; const dt = new Date(d); return dt.toLocaleDateString(); }
function daysUntil(d){ const t = new Date(d); const now = new Date(); return Math.ceil((t - now) / (1000*60*60*24)); }

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

function escapeHtml(s){ if(!s) return ''; return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }
async function readFileAsDataURL(file){
  return new Promise((res, rej)=>{
    const fr = new FileReader();
    fr.onload = ()=>res(fr.result);
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
}

// ====== Actions ======
function selectPet(id){
  state.selectedPetId = normalizeId(id);
  renderPetsList(); renderSelected();
}

// Expor no escopo global os removers usados em onclick
window.removeVaccine = async function(vId){
  const pet = state.pets.find(p=>normalizeId(p.id)===state.selectedPetId);
  if(!pet) return;
  try{
    await API.removeVaccine(pet.id, vId);
    pet.vaccines = (pet.vaccines || []).filter(v=>v.id !== vId);
    renderSelected(); renderPetsList();
  }catch(e){ alert('Falha ao remover vacina'); }
};
window.removeConsult = async function(cId){
  const pet = state.pets.find(p=>normalizeId(p.id)===state.selectedPetId);
  if(!pet) return;
  try{
    await API.removeConsult(pet.id, cId);
    pet.consultations = (pet.consultations || []).filter(c=>c.id !== cId);
    renderSelected(); renderPetsList();
  }catch(e){ alert('Falha ao remover consulta'); }
};

// ====== Forms & events ======
function wireEvents(){
  const btnNewPet = must$('#btnNewPet');
  const cancelPet = must$('#cancelPet');
  const savePet = must$('#savePet');

  const vaccineForm = must$('#vaccineForm');
  const consultForm = must$('#consultForm');
  const fileInput = must$('#fileInput');

  const editPetBtn = must$('#editPet');
  const deletePetBtn = must$('#deletePet');

  // Se algum elemento essencial não existe, não quebra
  if(btnNewPet) btnNewPet.addEventListener('click', ()=>{
    const card = must$('#newPetCard'); if(card) { card.style.display = 'block'; const nm = must$('#petName'); if(nm) nm.focus(); }
  });
  if(cancelPet) cancelPet.addEventListener('click', ()=>{
    const card = must$('#newPetCard'); if(card) card.style.display = 'none';
    clearNewPetForm();
  });

  if(savePet) savePet.addEventListener('click', async ()=>{
    const card = must$('#newPetCard'); // opcional
    const editId = savePet.dataset.editId || null;
    const name = (must$('#petName')?.value || '').trim();
    if(!name){ alert('Nome é obrigatório'); return; }
    const species = (must$('#petSpecies')?.value || '').trim();
    const sexo    = (must$('#petSexo')?.value || '').trim();
    const breed   = (must$('#petBreed')?.value || '').trim();
    const dob     = must$('#petDOB')?.value || null;
    const weight  = (must$('#petWeight')?.value || '').trim();
    const file    = must$('#petPhoto')?.files?.[0];

    let photo = null;
    if(file) photo = await readFileAsDataURL(file);

    const payload = { name, species, sexo, breed, dob, weight, photo };
    try{
      if(!editId){
        const created = await API.createPet(payload);
        created.vaccines ??= [];
        created.consultations ??= [];
        created.uploads ??= [];
        state.pets.push(created);
        state.selectedPetId = normalizeId(created.id);
      }else{
        const updated = await API.updatePet(editId, payload);
        const idx = state.pets.findIndex(p=>normalizeId(p.id)===normalizeId(editId));
        if(idx>=0){
          updated.vaccines = updated.vaccines ?? state.pets[idx].vaccines ?? [];
          updated.consultations = updated.consultations ?? state.pets[idx].consultations ?? [];
          updated.uploads = updated.uploads ?? state.pets[idx].uploads ?? [];
          state.pets[idx] = updated;
          state.selectedPetId = normalizeId(updated.id);
        }
        delete savePet.dataset.editId;
      }
      renderPetsList();
      renderSelected();
      if(card) card.style.display = 'none';
      clearNewPetForm();
    }catch(e){
      console.error(e);
      alert('Falha ao salvar pet');
    }
  });

  if(vaccineForm) vaccineForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const pet = state.pets.find(p=>normalizeId(p.id)===state.selectedPetId);
    if(!pet){ alert('Selecione um pet'); return; }
    const name = (must$('#vacName')?.value || '').trim();
    const date = must$('#vacDate')?.value;
    const next = must$('#vacNext')?.value || null;
    const notes = (must$('#vacNotes')?.value || '').trim() || null;
    if(!name || !date){ alert('Nome e data são obrigatórios'); return; }
    try{
      const created = await API.addVaccine(pet.id, { name, date, next, notes });
      pet.vaccines ??= [];
      pet.vaccines.push(created);
      renderSelected(); renderPetsList();
      vaccineForm.reset();
    }catch(e){ alert('Falha ao salvar vacina'); }
  });

  if(consultForm) consultForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const pet = state.pets.find(p=>normalizeId(p.id)===state.selectedPetId);
    if(!pet){ alert('Selecione um pet'); return; }
    const date = must$('#consDate')?.value;
    const reason = (must$('#consReason')?.value || '').trim();
    const notes  = (must$('#consNotes')?.value || '').trim();
    if(!date){ alert('Data é obrigatória'); return; }
    try{
      const created = await API.addConsult(pet.id, { date, reason, notes });
      pet.consultations ??= [];
      pet.consultations.push(created);
      renderSelected(); renderPetsList();
      consultForm.reset();
    }catch(e){ alert('Falha ao salvar consulta'); }
  });

  if(fileInput) fileInput.addEventListener('change', async (e)=>{
    const file = e.target.files?.[0];
    if(!file) return;
    const pet = state.pets.find(p=>normalizeId(p.id)===state.selectedPetId);
    if(!pet){ alert('Selecione um pet'); return; }
    const data = await readFileAsDataURL(file);
    pet.uploads ??= [];
    pet.uploads.push({ id: uid(), name: file.name, data });
    renderSelected(); fileInput.value = '';
  });

  if(editPetBtn) editPetBtn.addEventListener('click', ()=>{
    const pet = state.pets.find(p=>normalizeId(p.id)===state.selectedPetId); if(!pet) return;
    const card = must$('#newPetCard'); if(card) card.style.display = 'block';
    const set = (sel, val) => { const el = must$(sel); if(el) el.value = val ?? ''; };
    set('#petName', pet.name);
    set('#petSpecies', pet.species);
    set('#petSexo', pet.sexo);
    set('#petBreed', pet.breed);
    set('#petDOB', pet.dob);
    set('#petWeight', pet.weight);
    if(savePetBtnExists()) document.querySelector('#savePet').dataset.editId = normalizeId(pet.id);
  });

  if(deletePetBtn) deletePetBtn.addEventListener('click', async ()=>{
    const id = state.selectedPetId;
    if(!id) return;
    if(!confirm('Remover este pet?')) return;
    try{
      await API.deletePet(id);
      state.pets = state.pets.filter(p=>normalizeId(p.id) !== id);
      state.selectedPetId = state.pets.length ? normalizeId(state.pets[0].id) : null;
      renderPetsList(); renderSelected();
    }catch(e){ alert('Falha ao excluir pet'); }
  });

  function savePetBtnExists(){ return !!$('#savePet'); }
}

function clearNewPetForm(){
  const card = must$('#newPetCard');
  if(!card) return;
  card.querySelectorAll('input,textarea,select').forEach(i=>{ i.value=''; });
}

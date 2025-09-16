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
function uid(){ return 'p_' + Math.random().toString(36).slice(2,9); } // ainda uso p/ itens locais (vac/cons/uploads) até receber id do server

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
    return r.json(); // deve vir o pet com id
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
    const r = await fetch(`/api/pets/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
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
    return r.json(); // vacina com id
  },
  async removeVaccine(petId, vId){
    const r = await fetch(`/api/pets/${petId}/vaccines/${vId}`, {
      method: 'DELETE',
      credentials: 'include'
    });
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
    const r = await fetch(`/api/pets/${petId}/consultations/${cId}`, {
      method: 'DELETE',
      credentials: 'include'
    });
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
  if(state.pets.length) state.selectedPetId = state.pets[0].id;
  renderPetsList();
  renderReminders();
  renderSelected();
  wireEvents();
}

// ====== Rendering ======
function renderPetsList(){
  const list = $('#petsList');
  list.innerHTML = '';
  state.pets.forEach(p => {
    const petPhoto = p.photo || defaultAvatar(p.species);
    const el = document.createElement('div');
    el.className = 'pet-item' + (p.id === state.selectedPetId ? ' active' : '');
    el.dataset.id = p.id;
    el.innerHTML = `
      <img src="${petPhoto}" class="pet-avatar" alt="${p.name}">
      <div>
        <div style="font-weight:700">${escapeHtml(p.name)}</div>
        <div class="muted">${escapeHtml(p.species || '')} • ${escapeHtml(p.breed || '')}</div>
      </div>
    `;
    el.addEventListener('click', () => { selectPet(p.id) });
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
  const pet = state.pets.find(p => p.id === state.selectedPetId);
  if(!pet){
    $('#petDetail').style.display = 'none';
    $('#emptyPlaceholder').style.display = 'block';
    $('#noticeBox').innerHTML = '';
    return;
  }

  const petPhoto = pet.photo || defaultAvatar(pet.species); // ✅

  $('#emptyPlaceholder').style.display = 'none';
  $('#petDetail').style.display = 'block';
  $('#detailPhoto').src = petPhoto;
  $('#detailName').textContent = pet.name;
  $('#detailInfo').textContent =
    `${pet.species || '-'} • ${pet.breed || '-'} • ${pet.dob ? ageFromDOB(p.dob) : 'idade desconhecida'} • ${pet.weight ? pet.weight + ' kg' : ''}`;

  const vList = $('#vaccineList'); vList.innerHTML = '';
  (pet.vaccines || []).slice().reverse().forEach(v=>{
    const div = document.createElement('div');
    div.className = 'timeline-item';
    div.innerHTML = `<strong>${escapeHtml(v.name)}</strong>
      <div class="meta">${formatDate(v.date)} ${v.next ? '• Próx: ' + formatDate(v.next) : ''}</div>
      <div style="margin-top:6px">${escapeHtml(v.notes || '')}</div>
      <div style="margin-top:8px"><button data-id="${v.id}" class="btn" onclick="removeVaccine('${v.id}')">Remover</button></div>`;
    vList.appendChild(div);
  });

  const cList = $('#consultList'); cList.innerHTML = '';
  (pet.consultations || []).slice().reverse().forEach(c=>{
    const div = document.createElement('div');
    div.className = 'timeline-item';
    div.innerHTML = `<strong>${escapeHtml(c.reason || 'Consulta')}</strong>
    <div class="meta">${formatDate(c.date)}</div>
    <div style="margin-top:6px">${escapeHtml(c.notes || '')}</div>
    <div style="margin-top:8px"><button data-id="${c.id}" class="btn" onclick="removeConsult('${c.id}')">Remover</button></div>`;
    cList.appendChild(div);
  });

  const upList = $('#uploadsList'); upList.innerHTML = '';
  (pet.uploads || []).forEach(u=>{
    const img = document.createElement('img');
    img.className = 'upload-thumb';
    img.src = u.data;
    img.title = u.name;
    upList.appendChild(img);
  });

  renderNotice(pet);
  renderReminders();
}

function renderNotice(pet){
  const box = $('#noticeBox');
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
  const container = $('#reminders');
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
function formatDate(d){ if(!d) return ''; const dt = new Date(d); return dt.toLocaleDateString(); }
function daysUntil(d){
  const t = new Date(d); const now = new Date();
  return Math.ceil((t - now) / (1000*60*60*24));
}
function ageFromDOB(dob){
  if(!dob) return '';
  const b = new Date(dob); const now = new Date();
  const years = now.getFullYear() - b.getFullYear();
  return years + ' ano(s)';
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
  state.selectedPetId = id;
  renderPetsList(); renderSelected();
}

// Remoções (agora chamam API)
window.removeVaccine = async function(vId){
  const pet = state.pets.find(p=>p.id===state.selectedPetId);
  if(!pet) return;
  try{
    await API.removeVaccine(pet.id, vId);
    pet.vaccines = (pet.vaccines || []).filter(v=>v.id !== vId);
    renderSelected(); renderPetsList();
  }catch(e){ alert('Falha ao remover vacina'); }
}
window.removeConsult = async function(cId){
  const pet = state.pets.find(p=>p.id===state.selectedPetId);
  if(!pet) return;
  try{
    await API.removeConsult(pet.id, cId);
    pet.consultations = (pet.consultations || []).filter(c=>c.id !== cId);
    renderSelected(); renderPetsList();
  }catch(e){ alert('Falha ao remover consulta'); }
}

// ====== Forms & events ======
function wireEvents(){
  // Novo Pet: mostrar/ocultar
  $('#btnNewPet').addEventListener('click', ()=>{
    $('#newPetCard').style.display = 'block'; $('#petName').focus();
  });
  $('#cancelPet').addEventListener('click', ()=>{
    $('#newPetCard').style.display = 'none';
    clearNewPetForm();
  });

  // Salvar (criar ou atualizar)
  $('#savePet').addEventListener('click', async ()=>{
    const editId = $('#savePet').dataset.editId || null;
    const name = $('#petName').value.trim();
    if(!name){ alert('Nome é obrigatório'); return; }
    const species = $('#petSpecies').value.trim();
    const breed = $('#petBreed').value.trim();
    const dob = $('#petDOB').value || null;
    const weight = $('#petWeight').value.trim();
    const file = $('#petPhoto').files[0];

    let photo = null;
    if(file) photo = await readFileAsDataURL(file);

    const payload = { name, species, breed, dob, weight, photo };

    try{
      if(!editId){
        // CREATE
        const created = await API.createPet(payload);
        // servidor deve retornar { id, name, species, breed, dob, weight, photo, vaccines:[], consultations:[], uploads:[] }
        if(!created.vaccines) created.vaccines = [];
        if(!created.consultations) created.consultations = [];
        if(!created.uploads) created.uploads = [];
        state.pets.push(created);
        state.selectedPetId = created.id;
      }else{
        // UPDATE
        const updated = await API.updatePet(editId, payload);
        const idx = state.pets.findIndex(p=>p.id===editId);
        if(idx>=0){
          // preserva timelines/ uploads locais se o backend ainda não devolver
          updated.vaccines = updated.vaccines ?? state.pets[idx].vaccines ?? [];
          updated.consultations = updated.consultations ?? state.pets[idx].consultations ?? [];
          updated.uploads = updated.uploads ?? state.pets[idx].uploads ?? [];
          state.pets[idx] = updated;
          state.selectedPetId = updated.id;
        }
        delete $('#savePet').dataset.editId;
      }
      renderPetsList();
      renderSelected();
      $('#newPetCard').style.display = 'none';
      clearNewPetForm();
    }catch(e){
      console.error(e);
      alert('Falha ao salvar pet');
    }
  });

  // Vacina
  $('#vaccineForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const pet = state.pets.find(p=>p.id===state.selectedPetId);
    if(!pet){ alert('Selecione um pet'); return; }
    const name = $('#vacName').value.trim();
    const date = $('#vacDate').value;
    const next = $('#vacNext').value || null;
    const notes = $('#vacNotes').value.trim() || null;
    if(!name || !date){ alert('Nome e data são obrigatórios'); return; }
    try{
      const created = await API.addVaccine(pet.id, { name, date, next, notes });
      // `created` deve trazer id da vacina
      pet.vaccines = pet.vaccines || [];
      pet.vaccines.push(created);
      renderSelected(); renderPetsList();
      $('#vaccineForm').reset();
    }catch(e){ alert('Falha ao salvar vacina'); }
  });

  // Consulta
  $('#consultForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const pet = state.pets.find(p=>p.id===state.selectedPetId);
    if(!pet){ alert('Selecione um pet'); return; }
    const date = $('#consDate').value;
    const reason = $('#consReason').value.trim();
    const notes = $('#consNotes').value.trim();
    if(!date){ alert('Data é obrigatória'); return; }
    try{
      const created = await API.addConsult(pet.id, { date, reason, notes });
      pet.consultations = pet.consultations || [];
      pet.consultations.push(created);
      renderSelected(); renderPetsList();
      $('#consultForm').reset();
    }catch(e){ alert('Falha ao salvar consulta'); }
  });

  // Upload (client-side preview; se quiser salvar no backend, crie endpoint)
  $('#fileInput').addEventListener('change', async (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    const pet = state.pets.find(p=>p.id===state.selectedPetId);
    if(!pet){ alert('Selecione um pet'); return; }
    const data = await readFileAsDataURL(file);
    pet.uploads = pet.uploads || [];
    pet.uploads.push({ id: uid(), name: file.name, data });
    // se quiser persistir uploads no server, crie endpoint /api/pets/:id/uploads
    renderSelected(); $('#fileInput').value = '';
  });

  // Editar
  $('#editPet').addEventListener('click', ()=>{
    const pet = state.pets.find(p=>p.id===state.selectedPetId); if(!pet) return;
    $('#newPetCard').style.display = 'block';
    $('#petName').value = pet.name; $('#petSpecies').value = pet.species || ''; $('#petBreed').value = pet.breed || '';
    $('#petDOB').value = pet.dob || ''; $('#petWeight').value = pet.weight || '';
    $('#savePet').dataset.editId = pet.id;
  });

  // Excluir
  $('#deletePet').addEventListener('click', async ()=>{
    const id = state.selectedPetId;
    if(!id) return;
    if(!confirm('Remover este pet?')) return;
    try{
      await API.deletePet(id);
      state.pets = state.pets.filter(p=>p.id !== id);
      state.selectedPetId = state.pets.length ? state.pets[0].id : null;
      renderPetsList(); renderSelected();
    }catch(e){ alert('Falha ao excluir pet'); }
  });

  // Seleção inicial já foi feita em boot()
}

function clearNewPetForm(){
  $('#newPetCard').querySelectorAll('input,textarea,select').forEach(i=>i.value='');
}

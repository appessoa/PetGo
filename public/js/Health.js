import { initHeader } from './header.js';

document.addEventListener("DOMContentLoaded", () => {
    initHeader();
});

// ====== Storage keys ======
const STORAGE_KEY = 'petgo_health_v1';

    // ====== App state ======
let state = { pets: [], selectedPetId: null };

    // ====== Utils ======
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);
    function uid(){ return 'p_' + Math.random().toString(36).slice(2,9) }

    function loadState(){
      const raw = localStorage.getItem(STORAGE_KEY);
      if(raw) state = JSON.parse(raw);
    }
    function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

    // ====== Rendering ======
    function renderPetsList(){
      const list = $('#petsList');
      list.innerHTML = '';
      state.pets.forEach(p => {
        let petPhoto = p.photo 
        if(!petPhoto) petPhoto = defaultAvatar(p.photo);
        const el = document.createElement('div');
        el.className = 'pet-item' + (p.id === state.selectedPetId ? ' active' : '');
        el.dataset.id = p.id;
        el.innerHTML = `
          <img src="${(petPhoto)}" class="pet-avatar" alt="${p.name}">
          <div>
            <div style="font-weight:700">${p.name}</div>
            <div class="muted">${p.species} • ${p.breed || ''}</div>
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
      // simple placeholders by species
      if(!species) return 'https://placehold.co/200x200?text=?';
      species = species.toLowerCase();
      if(species.includes('gato') || species.includes('gato') ) return 'https://placekitten.com/200/200';
      if(species.includes('cach') || species.includes('dog')) return 'https://placedog.net/200/200';
      return 'https://placehold.co/200x200?text=pet';
    }

    function renderSelected(){
      const pet = state.pets.find(p => p.id === state.selectedPetId);
      let petPhoto = pet.photo 
      if(!petPhoto) petPhoto = defaultAvatar(pet.photo);
      if(!pet){
        $('#petDetail').style.display = 'none';
        $('#emptyPlaceholder').style.display = 'block';
        $('#noticeBox').innerHTML = '';
        return;
      }
      $('#emptyPlaceholder').style.display = 'none';
      $('#petDetail').style.display = 'block';
      $('#detailPhoto').src = petPhoto;
      $('#detailName').textContent = pet.name;
      $('#detailInfo').textContent = `${pet.species} • ${pet.breed || '-'} • ${pet.dob ? ageFromDOB(pet.dob) : 'idade desconhecida'} • ${pet.weight ? pet.weight + ' kg' : ''}`;

      // vaccines
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

      // consultations
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

      // uploads
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
      const upcoming = (pet.vaccines || []).filter(v => v.next).map(v => ({...v, days: daysUntil(v.next)})).sort((a,b)=>a.days-b.days);
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
          if(v.next){
            items.push({petName: p.name, vaccine: v.name, next: v.next});
          }
        })
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
      const diff = Math.ceil((t - now) / (1000*60*60*24));
      return diff;
    }
    function ageFromDOB(dob){
      if(!dob) return '';
      const b = new Date(dob); const now = new Date();
      const years = now.getFullYear() - b.getFullYear();
      return years + ' ano(s)';
    }
    function escapeHtml(s){ if(!s) return ''; return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

    // ====== Actions ======
    function selectPet(id){
      state.selectedPetId = id;
      saveState(); renderPetsList(); renderSelected();
    }

    // Remove vaccine/consult handlers (global so buttons inline can call)
    window.removeVaccine = function(vId){
      const pet = state.pets.find(p=>p.id===state.selectedPetId);
      if(!pet) return;
      pet.vaccines = (pet.vaccines || []).filter(v=>v.id !== vId);
      saveState(); renderSelected(); renderPetsList();
    }
    window.removeConsult = function(cId){
      const pet = state.pets.find(p=>p.id===state.selectedPetId);
      if(!pet) return;
      pet.consultations = (pet.consultations || []).filter(c=>c.id !== cId);
      saveState(); renderSelected(); renderPetsList();
    }

    // ====== Forms and events ======
    document.addEventListener('DOMContentLoaded', ()=>{
      loadState();
      renderPetsList();
      renderReminders();

      // New pet toggle
      $('#btnNewPet').addEventListener('click', ()=>{ $('#newPetCard').style.display = 'block'; $('#petName').focus(); });

      $('#cancelPet').addEventListener('click', ()=>{
        $('#newPetCard').style.display = 'none';
        clearNewPetForm();
      });

      // Save pet
      $('#savePet').addEventListener('click', async ()=>{
        const name = $('#petName').value.trim();
        if(!name){ alert('Nome é obrigatório'); return; }
        const species = $('#petSpecies').value.trim();
        const breed = $('#petBreed').value.trim();
        const dob = $('#petDOB').value || null;
        const weight = $('#petWeight').value.trim();
        const file = $('#petPhoto').files[0];

        let photoData = null;
        if(file){
          photoData = await readFileAsDataURL(file);
        }

        const pet = { id: uid(), name, species, breed, dob, weight, photo: photoData, vaccines: [], consultations: [], uploads: [] };
        state.pets.push(pet);
        state.selectedPetId = pet.id;
        saveState();
        renderPetsList();
        renderSelected();
        $('#newPetCard').style.display = 'none';
        clearNewPetForm();
      });

      // Vaccine form
      $('#vaccineForm').addEventListener('submit', (e)=>{
        e.preventDefault();
        const pet = state.pets.find(p=>p.id===state.selectedPetId);
        if(!pet){ alert('Selecione um pet'); return; }
        const name = $('#vacName').value.trim();
        const date = $('#vacDate').value;
        const next = $('#vacNext').value || null;
        const notes = $('#vacNotes').value.trim() || null;
        if(!name || !date){ alert('Nome e data são obrigatórios'); return; }
        const vac = { id: uid(), name, date, next, notes };
        pet.vaccines = pet.vaccines || []; pet.vaccines.push(vac);
        saveState(); renderSelected(); renderPetsList();
        $('#vaccineForm').reset();
      });

      // Consult form
      $('#consultForm').addEventListener('submit', (e)=>{
        e.preventDefault();
        const pet = state.pets.find(p=>p.id===state.selectedPetId);
        if(!pet){ alert('Selecione um pet'); return; }
        const date = $('#consDate').value;
        const reason = $('#consReason').value.trim();
        const notes = $('#consNotes').value.trim();
        if(!date){ alert('Data é obrigatória'); return; }
        const obj = { id: uid(), date, reason, notes };
        pet.consultations = pet.consultations || []; pet.consultations.push(obj);
        saveState(); renderSelected(); renderPetsList();
        $('#consultForm').reset();
      });

      // File upload
      $('#fileInput').addEventListener('change', async (e)=>{
        const file = e.target.files[0];
        if(!file) return;
        const pet = state.pets.find(p=>p.id===state.selectedPetId);
        if(!pet){ alert('Selecione um pet'); return; }
        const data = await readFileAsDataURL(file);
        pet.uploads = pet.uploads || [];
        pet.uploads.push({ id: uid(), name: file.name, data });
        saveState(); renderSelected(); $('#fileInput').value = '';
      });

      // Edit & delete pet
      $('#editPet').addEventListener('click', ()=>{
        const pet = state.pets.find(p=>p.id===state.selectedPetId); if(!pet) return;
        $('#newPetCard').style.display = 'block';
        $('#petName').value = pet.name; $('#petSpecies').value = pet.species; $('#petBreed').value = pet.breed;
        $('#petDOB').value = pet.dob || ''; $('#petWeight').value = pet.weight || '';
        // when saving, we'll detect duplicate by name? simpler approach: remove old then re-add on save
        // set a flag
        $('#savePet').dataset.editId = pet.id;
      });

      // Save with edit support
      $('#savePet').addEventListener('click', async ()=>{
        const editId = $('#savePet').dataset.editId;
        if(!editId) return; // handled above for new
        // update flow: remove old, then let main save handler create new with new id => but better update fields:
        const pet = state.pets.find(p=>p.id===editId);
        if(!pet) return;
        pet.name = $('#petName').value.trim();
        pet.species = $('#petSpecies').value.trim();
        pet.breed = $('#petBreed').value.trim();
        pet.dob = $('#petDOB').value || null;
        pet.weight = $('#petWeight').value.trim();
        const file = $('#petPhoto').files[0];
        if(file){
          pet.photo = await readFileAsDataURL(file);
        }
        delete $('#savePet').dataset.editId;
        saveState(); renderPetsList(); renderSelected();
        $('#newPetCard').style.display = 'none'; $('#newPetCard').querySelectorAll('input').forEach(i=>i.value='');
      });

      // delete pet
      $('#deletePet').addEventListener('click', ()=>{
        if(!confirm('Remover este pet?')) return;
        state.pets = state.pets.filter(p=>p.id !== state.selectedPetId);
        state.selectedPetId = state.pets.length ? state.pets[0].id : null;
        saveState(); renderPetsList(); renderSelected();
      });

      // initialize selection
      if(state.pets.length) { state.selectedPetId = state.selectedPetId || state.pets[0].id; }
      renderPetsList(); renderSelected();
    });

    // read file helper
    function readFileAsDataURL(file){
      return new Promise((res, rej)=>{
        const fr = new FileReader();
        fr.onload = ()=>res(fr.result);
        fr.onerror = rej;
        fr.readAsDataURL(file);
      })
    }

    // basic escape hook for inline on* handlers
    window.formatDate = formatDate;
    window.daysUntil = daysUntil;

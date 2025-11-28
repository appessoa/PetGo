import { initHeader } from './header.js';
import { showToast } from './utils/toast.js';

let ALL_VETS = []; // cache para filtrar conforme o serviço

// Único ponto de inicialização
document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  boot();
});

async function boot(){
  try{
    // tenta obter usuário e pets; se não logado, /api/me deve 401
    const [me, pets] = await Promise.all([
      fetchJSON('/api/me').catch(() => ({})),
      fetchJSON('/api/me/pets').catch(() => [])
    ]);

    hydrateTutor(me);
    hydratePets(pets);
  }catch(err){
    console.warn('Usuário não logado ou erro ao carregar dados:', err?.message);
    // location.href = '/login?next=/agendamento';
  } finally {
    // tenta carregar os veterinários, sem quebrar a página se der erro
    try{
      const vets = await fetchJSON('/veterinariosDisponiveis'); // ajuste se necessário
      ALL_VETS = extractVets(vets);
      console.log('Veterinários disponíveis:', ALL_VETS);
      hydrateVets(ALL_VETS); // preenche inicialmente (pode ficar oculto)
    }catch(e){
      console.warn('Não foi possível carregar veterinários:', e?.message);
      hydrateVets([]); // deixa "Sem preferência"
    }

    setupForm();          // submissão do formulário
    setMinDateToday();    // data mínima = hoje

    // inicializa listeners que atualizam o select de horários
    setupHorarioListeners();
  }
}

function extractVets(resp){
  if (Array.isArray(resp)) return resp;
  if (resp && Array.isArray(resp.veterinarios)) return resp.veterinarios;
  if (resp && resp.veterinarios && typeof resp.veterinarios === 'object') {
    return Object.values(resp.veterinarios);
  }
  if (resp && Array.isArray(resp.data)) return resp.data;
  if (resp && Array.isArray(resp.items)) return resp.items;
  return [];
}

function hydrateTutor(me){
  const nome = document.getElementById('nome');
  if(!nome) return;
  // Preenche e trava o campo quando logado
  nome.value = me?.nome || me?.username || me?.email || '';
  if (me?.nome || me?.username || me?.email){
    nome.readOnly = true;
    nome.classList.add('readonly');
    nome.title = 'Esse campo é preenchido automaticamente para usuários logados.';
  }
}

function hydratePets(pets){
  const sel = document.getElementById('pet');
  if(!sel) return;

  // limpa opções (mantém o placeholder)
  sel.querySelectorAll('option:not([value=""])').forEach(o => o.remove());

  if(Array.isArray(pets) && pets.length){
    for(const p of pets){
      const opt = document.createElement('option');
      opt.value = String(p.id || p.pet_id || p._id || p.uuid || p.nome || p.name); // ajuste conforme seu backend
      const nome = p.nome || p.name || 'Sem nome';
      const especie = p.species || p.especie || '';
      const raca = p.breed || p.raca || '';
      opt.textContent = [nome, especie, raca].filter(Boolean).join(' — ');
      sel.appendChild(opt);
    }
    sel.disabled = false;
  }else{
    // sem pets: deixa o select vazio e orienta
    sel.querySelectorAll('option:not([value=""])').forEach(o => o.remove());
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Você ainda não tem pets cadastrados';
    sel.appendChild(opt);
    sel.disabled = true;
  }
}

/**
 * Preenche o select de veterinários.
 * Se filterOnlineOnly = true, tenta manter apenas os que atendem online
 * (usa várias chaves possíveis do backend).
 */
function hydrateVets(vets, { filterOnlineOnly = false } = {}){
  const sel = document.getElementById('veterinario');
  if(!sel) return;

  // mantém apenas o placeholder inicial
  sel.querySelectorAll('option:not([value=""])').forEach(o => o.remove());

  let list = Array.isArray(vets) ? vets.slice() : [];

  if(filterOnlineOnly){
    list = list.filter(v => isVetOnline(v));
  }

  if(list.length){
    for(const v of list){
      const opt = document.createElement('option');
      opt.value = String(v.id || v.id_veterinarian || v.vet_id || v.uuid || v.veterinario_id);
      // rótulo amigável
      const nome = v.nome || v.name || v.full_name || 'Veterinário(a)';
      const esp  = v.especialidade || v.specialty || v.area || '';
      opt.textContent = [nome, esp ].filter(Boolean).join(' — ');
      sel.appendChild(opt);
    }
    sel.disabled = false;
  }else{
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Sem preferência';
    sel.appendChild(opt);
    sel.disabled = false; // pode escolher "sem preferência"
  }
}

function setupForm(){
  const form = document.getElementById('agendamentoForm') || document.querySelector('form');
  if(!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const servico = document.getElementById('servico')?.value || '';

    const payload = {
      tutor_nome: (document.getElementById('nome')?.value || '').trim(),
      pet_id: document.getElementById('pet')?.value || '',
      vet_id: document.getElementById('veterinario')?.value || '',
      servico,
      data: document.getElementById('data')?.value || '',
      hora: document.getElementById('hora')?.value || '',
      observacoes: document.getElementById('obs')?.value || ''
    };

    // se for veterinário online e o usuário escolheu um vet, mandamos o id
    if (servico === 'veterinario') {
      const vetId = document.getElementById('veterinario')?.value || '';
      if (vetId) payload.veterinario_id = vetId;
      // se quiser tornar obrigatório, descomente a linha em setupVetVisibility
    }

    if(!payload.pet_id){
      showToast('Selecione um pet.', 'error');
      return;
    }
    if(!payload.servico){
      showToast('Selecione um serviço.', 'error');
      return;
    }

    try{
      // AJUSTE a rota conforme seu backend de agendamento
      const res = await fetchJSON('/api/agendamentos', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      showToast('Serviço agendado com sucesso!', 'success');
      setTimeout(() => {
      window.location.replace("/");
    }, 1200);
    }catch(err){
      showToast(err.message || 'Erro ao agendar o serviço.', 'error');
    }
  });
}

function setMinDateToday(){
  const date = document.getElementById('data');
  if(!date) return;
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth()+1).padStart(2,'0');
  const dd = String(today.getDate()).padStart(2,'0');
  date.min = `${yyyy}-${mm}-${dd}`;
}

async function fetchJSON(url, opts={}){
  const r = await fetch(url, { credentials:'include', ...opts });
  if(!r.ok){
    let msg = `${r.status}: ${r.statusText}`;
    try { const j = await r.json(); msg = j.error || j.message || msg; } catch {}
    throw new Error(msg);
  }
  return r.json();
}

/* ---------------------------
   Novas funções: horários
   --------------------------- */

// Gera array de slots 'HH:MM' entre startHour..endHour (start inclusive, end exclusive do slot final)
function generateSlots(slotMinutes = 30, startHour = 8, endHour = 18) {
  const slots = [];
  const startTotalMin = startHour * 60;
  const endTotalMin = endHour * 60;
  for (let m = startTotalMin; m + slotMinutes <= endTotalMin; m += slotMinutes) {
    const hh = String(Math.floor(m / 60)).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');
    slots.push(`${hh}:${mm}`);
  }
  return slots;
}

// Normaliza strings de tempo para 'HH:MM' (aceita 'HH:MM', 'HH:MM:SS', ISO datetimes)
function normalizeTimeToHHMM(t) {
  if (t === null || t === undefined) return null;
  if (typeof t === 'string') {
    t = t.trim();
    // se tiver 'T' (ISO) tenta extrair parte de hora
    if (t.includes('T')) {
      try {
        const hhmmss = t.split('T')[1].split('+')[0].split('Z')[0];
        const parts = hhmmss.split(':');
        if (parts.length >= 2) return `${parts[0].padStart(2,'0')}:${parts[1].padStart(2,'0')}`;
      } catch (e) { /* fallback abaixo */ }
    }
    // se for HH:MM:SS ou HH:MM
    const p = t.split(':');
    if (p.length >= 2) {
      return `${p[0].padStart(2,'0')}:${p[1].padStart(2,'0')}`;
    }
  }
  // se vier objeto Date
  if (t instanceof Date) {
    const hh = String(t.getHours()).padStart(2,'0');
    const mm = String(t.getMinutes()).padStart(2,'0');
    return `${hh}:${mm}`;
  }
  return null;
}

// Busca agendamentos do vet (sem enviar date) e calcula horários livres para a date passada (YYYY-MM-DD)
async function fetchHorariosDisponiveis(vetId, date, slotMinutes = 30, startHour = 8, endHour = 18) {
  if (!vetId || !date) return [];

  try {
    const res = await fetch(`/veterinarios/${vetId}/agendamentos`, { credentials: 'include' });
    if (!res.ok) {
      console.warn('Erro ao buscar agendamentos:', res.status, res.statusText);
      return [];
    }
    const j = await res.json();
    const ags = j.agendamentos || [];

    // filtra só os do dia requisitado (string 'YYYY-MM-DD')
    const agsDoDia = ags.filter(a => {
      if (a.date) return String(a.date) === String(date);
      if (a.created_at) return String(a.created_at).startsWith(date);
      if (a.datetime) return String(a.datetime).startsWith(date);
      return false;
    });

    // monta set de ocupados em 'HH:MM'
    const ocupados = new Set();
    for (const a of agsDoDia) {
      const t = normalizeTimeToHHMM(a.time || a.hora || a.datetime || a.created_at);
      if (t) ocupados.add(t);
    }

    // gera todos os slots e filtra os ocupados
    const allSlots = generateSlots(slotMinutes, startHour, endHour);
    const livres = allSlots.filter(s => !ocupados.has(s));

    return livres;
  } catch (err) {
    console.warn('Erro fetchHorariosDisponiveis:', err);
    return [];
  }
}

/* ---------------------------
   Placeholder / população do select (corrigido: apenas 1 placeholder)
   --------------------------- */

// retorna (ou cria) o primeiro option[value=""]
function _getOrCreatePlaceholderOption(sel) {
  let placeholder = sel.querySelector('option[value=""]');
  if (!placeholder) {
    placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Selecione...';
    placeholder.disabled = true;
    sel.insertBefore(placeholder, sel.firstChild);
  }
  return placeholder;
}

// Mostra "Carregando..." reutilizando o placeholder
function selPlaceholderLoading() {
  const sel = document.getElementById('hora');
  if (!sel) return;
  const placeholder = _getOrCreatePlaceholderOption(sel);
  // remove todas as options exceto o placeholder
  sel.querySelectorAll('option').forEach(o => {
    if (o !== placeholder) o.remove();
  });
  placeholder.textContent = 'Carregando...';
  placeholder.selected = true;
  sel.disabled = true;
}

// Popula com horários, reutilizando o placeholder
function populateHoraSelect(horarios) {
  const sel = document.getElementById('hora');
  if (!sel) return;

  const placeholder = _getOrCreatePlaceholderOption(sel);

  // limpa todas as options exceto o placeholder
  sel.querySelectorAll('option').forEach(o => {
    if (o !== placeholder) o.remove();
  });

  if (!horarios || horarios.length === 0) {
    placeholder.textContent = 'Sem horários disponíveis';
    placeholder.selected = true;
    sel.disabled = true;
    return;
  }

  for (const h of horarios) {
    const opt = document.createElement('option');
    opt.value = h;
    opt.textContent = h;
    sel.appendChild(opt);
  }

  placeholder.textContent = 'Selecione...';
  placeholder.selected = true;
  sel.disabled = false;
}

/* ---------------------------
   Listeners para vet/data
   --------------------------- */

function setupHorarioListeners() {
  // evita duplicar listeners se a função for chamada mais de uma vez
  if (window._petgo_horario_listeners_installed) return;
  window._petgo_horario_listeners_installed = true;

  const vetSelect = document.getElementById('veterinario');
  const dateInput = document.getElementById('data');
  if (!vetSelect || !dateInput) return;

  let lastRequest = 0;

  async function update() {
    const vetId = vetSelect.value;
    const date = dateInput.value;
    if (!vetId) {
      populateHoraSelect([]);
      return;
    }
    const reqId = ++lastRequest;
    selPlaceholderLoading();

    const horarios = await fetchHorariosDisponiveis(vetId, date, 30, 8, 18);
    if (reqId !== lastRequest) return; // chamada obsoleta
    populateHoraSelect(horarios);
  }

  vetSelect.addEventListener('change', update);
  dateInput.addEventListener('change', update);

  // atualiza imediatamente se já houver valores
  update();
}

/* ---------------------------
   Visibilidade do campo veterinário (mantive seu bloco original)
   --------------------------- */

(function setupVetVisibility() {
  const servicoSelect = document.getElementById('servico');
  const vetSelect     = document.getElementById('veterinario');
  if (!servicoSelect || !vetSelect) return;

  const vetGroup = vetSelect.closest('.form-group');

  function updateVetVisibility() {
    const isVetOnline = servicoSelect.value === 'veterinario';

    if (vetGroup) {
      vetGroup.style.display = isVetOnline ? '' : 'none';
      vetGroup.setAttribute('aria-hidden', String(!isVetOnline));
    }

    vetSelect.disabled = !isVetOnline;

    if (!isVetOnline) vetSelect.value = '';
  }

  updateVetVisibility();
  servicoSelect.addEventListener('change', updateVetVisibility);
})();


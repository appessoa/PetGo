import { initHeader } from './header.js';
import { showToast } from './utils/toast.js';

let ALL_VETS = []; // cache para filtrar conforme o serviço

document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  boot();
});

async function boot(){
  try{
    // tenta obter usuário e pets; se não logado, /api/me deve 401
    const [me, pets] = await Promise.all([
      fetchJSON('/api/me'),
      fetchJSON('/api/me/pets')
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
  }else{
    // sem pets: deixa o select vazio e orienta
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
      // form.reset(); // se quiser limpar
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

document.addEventListener('DOMContentLoaded', () => {
  const servicoSelect = document.getElementById('servico');
  const vetSelect     = document.getElementById('veterinario');

  if (!servicoSelect || !vetSelect) return;

  // pega o "grupo" que contém label + select do veterinário
  const vetGroup = vetSelect.closest('.form-group');

  function updateVetVisibility() {
    const isVetOnline = servicoSelect.value === 'veterinario';

    // mostra/esconde o bloco inteiro
    if (vetGroup) {
      vetGroup.style.display = isVetOnline ? '' : 'none';
      vetGroup.setAttribute('aria-hidden', String(!isVetOnline));
    }

    // desabilita para não enviar no form quando escondido
    vetSelect.disabled = !isVetOnline;

    // (opcional) limpe o valor quando esconder
    if (!isVetOnline) vetSelect.value = '';
    
    // (opcional) tornar obrigatório quando visível:
    // vetSelect.required = isVetOnline;
  }

  // estado inicial + mudança
  updateVetVisibility();
  servicoSelect.addEventListener('change', updateVetVisibility);
});
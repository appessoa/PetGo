import { initHeader } from './header.js';
import { showToast } from './utils/toast.js';

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
    // Se quiser, pode redirecionar para login:
    // location.href = '/login?next=/agendamento';
  }finally{
    setupForm();
    setMinDateToday();
  }
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
      opt.value = String(p.id || p.pet_id || p._id || p.nome || p.name); // ajuste conforme seu backend
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

function setupForm(){
  const form = document.getElementById('agendamentoForm') || document.querySelector('form');
  if(!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const payload = {
      tutor_nome: (document.getElementById('nome')?.value || '').trim(),
      pet_id: document.getElementById('pet')?.value || '',
      servico: document.getElementById('servico')?.value || '',
      data: document.getElementById('data')?.value || '',
      hora: document.getElementById('hora')?.value || '',
      observacoes: document.getElementById('obs')?.value || ''
    };

    if(!payload.pet_id){
      showToast('Selecione um pet.', 'error');
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
      // se quiser limpar:
      // form.reset();
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



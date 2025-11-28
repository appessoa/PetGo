// /public/js/portal-vet.js
// Portal do Veterinário — integração agenda / prontuário + pacientes/pagination
document.addEventListener('DOMContentLoaded', () => {

  // ------------------ Config / Auth header (ajuste se usar token) ------------------
  const getAuthHeader = () => {
    // Se você usar token Bearer: return { 'Authorization': 'Bearer ' + localStorage.getItem('token') };
    return {};
  };

  // ------------------ Fetch helpers ------------------
  const checkResp = async (resp) => {
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      let parsed;
      try { parsed = JSON.parse(text); } catch (e) { parsed = null; }
      const err = new Error(`HTTP ${resp.status}`);
      err.status = resp.status;
      err.body = parsed || text;
      throw err;
    }
  };

  const getJSON = async (url) => {
    const resp = await fetch(url, { credentials: 'same-origin', headers: Object.assign({ 'Accept': 'application/json' }, getAuthHeader()) });
    await checkResp(resp);
    if (resp.status === 204) return null;
    return resp.json();
  };

  const postJSON = async (url, body) => {
    const resp = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeader()),
      body: JSON.stringify(body)
    });
    await checkResp(resp);
    if (resp.status === 204) return null;
    return resp.json();
  };

  const putJSON = async (url, body) => {
    const resp = await fetch(url, {
      method: 'PUT',
      credentials: 'same-origin',
      headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeader()),
      body: JSON.stringify(body)
    });
    await checkResp(resp);
    if (resp.status === 204) return null;
    return resp.json();
  };

  const deleteJSON = async (url) => {
    const resp = await fetch(url, {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: Object.assign({}, getAuthHeader())
    });
    await checkResp(resp);
    if (resp.status === 204) return true;
    try { return await resp.json(); } catch { return true; }
  };

  // ------------------ API wrappers ------------------

  // Agendamentos
  async function fetchAgendamento(agId) {
    if (!agId) throw new Error('agId required');
    return getJSON(`/api/agendamentos/${encodeURIComponent(agId)}`);
  }

  async function updateAgendamento(agId, payload) {
    if (!agId) throw new Error('agId required');
    return putJSON(`/api/agendamentos/${encodeURIComponent(agId)}`, payload);
  }

  async function cancelAgendamento(agId) {
    if (!agId) throw new Error('agId required');
    return updateAgendamento(agId, { status: 'cancelado' });
  }

  // Pets / Prontuários
  async function fetchPet(petId) {
    if (!petId) throw new Error('petId required');
    try {
      return await getJSON(`/api/pets/${encodeURIComponent(petId)}`);
    } catch (e) {
      return getJSON(`/pets/${encodeURIComponent(petId)}`);
    }
  }

  async function fetchHistoricoProntuariosPorPet(petId) {
    if (!petId) throw new Error('petId required');
    try {
      return await getJSON(`/pets/${encodeURIComponent(petId)}/prontuarios`);
    } catch (e) {
      return getJSON(`/api/pets/${encodeURIComponent(petId)}/prontuarios`);
    }
  }

  async function createProntuario(body) {
    try {
      return await postJSON('/prontuarios', body);
    } catch (e) {
      console.warn('[createProntuario] POST /prontuarios falhou, tentando /api/prontuarios', e);
      return postJSON('/api/prontuarios', body);
    }
  }

  async function getProntuario(prontId) {
    if (!prontId) throw new Error('prontId required');
    return getJSON(`/prontuarios/${encodeURIComponent(prontId)}`);
  }

  async function updateProntuario(prontId, body) {
    if (!prontId) throw new Error('prontId required');
    try {
      return await putJSON(`/prontuarios/${encodeURIComponent(prontId)}`, body);
    } catch (e) {
      return putJSON(`/api/prontuarios/${encodeURIComponent(prontId)}`, body);
    }
  }

  // Pacientes (do veterinário logado) — paginação
  async function fetchPatients(page = 1, per_page = 10, q = '') {
    const qs = new URLSearchParams({ page: String(page), per_page: String(per_page) });
    if (q) qs.set('q', q);
    return getJSON(`/api/vets/me/pacientes?${qs.toString()}`);
  }

  // ------------------ UI Helpers ------------------
  const showToast = (msg, type = 'info') => {
    console.log(`[toast:${type}] ${msg}`);
    const el = document.querySelector('#global-toast');
    if (el) {
      el.textContent = msg;
      el.className = `toast ${type}`;
      el.style.display = 'block';
      setTimeout(() => { el.style.display = 'none'; }, 3000);
    }
  };

  const setupModalCloseButtons = () => {
    document.querySelectorAll('.close-btn').forEach(btn => {
      btn.removeEventListener('click', closeModalHandler);
      btn.addEventListener('click', closeModalHandler);
    });
  };

  function closeModalHandler(ev) {
    const modal = ev.currentTarget.closest('.modal-overlay');
    if (modal) modal.classList.add('hidden');
  }

  const setupTableModals = () => {
    setupModalCloseButtons();
  };

  // ------------------ Agenda loading ------------------
  const loadVetAgenda = async () => {
    try {
      let me = null;
      try { me = await getJSON('/me'); } catch (e) { try { me = await getJSON('/api/me'); } catch (e2) { me = null; } }

      // PREFERE username para a sidebar, com fallbacks
      const sidebarNameEl = document.querySelector('.sidebar-profile span') || document.getElementById('vet-name');
      if (sidebarNameEl) {
        // Prefer the username field first, then nome, then name, then nested user
        const username = me?.username || me?.user?.username || me?.nome || me?.name || (me?.user && (me.user.nome || me.user.name)) || sidebarNameEl.textContent;
        sidebarNameEl.textContent = username;
      }

      if (!me || !me.logged_in || !me.is_vet) {
        console.warn('Usuário não é veterinário (ou não está logado). Interface permanece funcional para testes locais.');
        attachListenersToTableRows(); // liga botões estáticos
        attachPatientsSearchHandler();
        return;
      }

      // requisita a agenda do veterinário logado
      const data = await getJSON('/api/vets/me/agendamentos');
      const items = Array.isArray(data) ? data : (data && data.agendamentos) ? data.agendamentos : [];
      renderAgendaTable(items);

      // carrega pacientes para o vet logado
      loadPatients(1, currentPerPage);

    } catch (err) {
      console.error('Erro ao carregar agenda:', err);
      showToast('Erro ao carregar agenda (ver console)', 'error');
      attachListenersToTableRows();
      attachPatientsSearchHandler();
    }
  };

  const renderAgendaTable = (items) => {
    const tbody = document.querySelector('.appointments-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    // SE NÃO HOUVER AGENDAMENTOS: mostrar mensagem amigável
    if (!items || items.length === 0) {
      tbody.innerHTML = `
        <tr class="no-appointments-row">
          <td colspan="5" style="text-align:center; padding:20px;">
            <div>
              <strong>Nenhum agendamento para hoje.</strong>
              <div style="margin-top:8px;">
                <button class="btn small" id="refresh-appointments-btn">Atualizar</button>
              </div>
            </div>
          </td>
        </tr>
      `;
      // ligar botão de atualizar
      const refreshBtn = document.getElementById('refresh-appointments-btn');
      if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
          refreshBtn.disabled = true;
          refreshBtn.textContent = 'Atualizando...';
          try {
            await loadVetAgenda();
          } catch (e) {
            console.error('Erro ao atualizar agenda:', e);
          } finally {
            refreshBtn.disabled = false;
            refreshBtn.textContent = 'Atualizar';
          }
        });
      }
      return;
    }

    items.forEach(ag => {
      const tr = document.createElement('tr');

      const time = ag.hour || ag.time || (ag.date ? ag.date.slice(11,16) : '') || '';
      const petName = ag.pet_name || (ag.pet && (ag.pet.nome || ag.pet.name)) || '—';
      const tutor = ag.user?.nome || ag.owner_name || (ag.user && ag.user.name) || '—';
      const motivo = ag.notes || ag.service || '—';

      tr.innerHTML = `
        <td><strong>${escapeHtml(time)}</strong></td>
        <td class="patient-name">${escapeHtml(petName)}</td>
        <td class="tutor-name">${escapeHtml(tutor)}</td>
        <td>${escapeHtml(motivo)}</td>
        <td class="action-cell">${buildActionButtons(ag)}</td>
      `;

      tr.dataset.agendamentoId = ag.id_agendamento || ag.id || '';
      tr.dataset.petId = ag.pet_id || (ag.pet && (ag.pet.id_pet || ag.pet.id)) || '';
      tr.dataset.consultaId = ag.consultation_id || ag.pront_id || ag.id_consulta || '';
      tr.dataset.prontuarioId = ag.prontuario_id || ag.pront_id || '';

      tbody.appendChild(tr);
    });

    attachListenersToTableRows();
  };

  // ------------------ Attach listeners ------------------
  const attachListenersToTableRows = () => {
    const tbody = document.querySelector('.appointments-table tbody');
    if (!tbody) return;

    tbody.querySelectorAll('.open-prontuario-modal').forEach(btn => {
      btn.removeEventListener('click', rowClickHandler);
      btn.addEventListener('click', rowClickHandler);
    });

    tbody.querySelectorAll('.open-view-prontuario-modal').forEach(btn => {
      btn.removeEventListener('click', viewProntuarioHandler);
      btn.addEventListener('click', viewProntuarioHandler);
    });

    tbody.querySelectorAll('.open-view-historico-modal').forEach(btn => {
      btn.removeEventListener('click', viewHistoricoHandler);
      btn.addEventListener('click', viewHistoricoHandler);
    });

    tbody.querySelectorAll('.cancel-appointment').forEach(btn => {
      btn.removeEventListener('click', cancelHandler);
      btn.addEventListener('click', cancelHandler);
    });
  };

  function rowClickHandler(ev) {
    ev.stopPropagation();
    const row = ev.currentTarget.closest('tr');
    const petId = row.dataset.petId || null;
    const agId = row.dataset.agendamentoId || null;
    const consultaId = row.dataset.consultaId || null;
    openProntuarioForm({ petId, agId, consultaId });
  }

  function viewProntuarioHandler(ev) {
    ev.stopPropagation();
    const row = ev.currentTarget.closest('tr');
    const prontuarioId = row.dataset.prontuarioId || row.dataset.consultaId || null;
    if (!prontuarioId) {
      const petId = row.dataset.petId || null;
      loadHistoricoPet(petId);
      return;
    }
    openViewProntuario(prontuarioId);
  }

  async function viewHistoricoHandler(ev) {
    ev.stopPropagation();
    const row = ev.currentTarget.closest('tr');
    const petId = row.dataset.petId || null;
    if (!petId) return console.warn('Pet ID ausente no row');
    loadHistoricoPet(petId);
  }

  async function cancelHandler(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    const row = ev.currentTarget.closest('tr');
    const agId = row.dataset.agendamentoId;
    if (!agId) return alert('Agendamento não disponível para cancelamento.');
    if (!confirm('Tem certeza que deseja cancelar este agendamento?')) return;
    try {
      await cancelAgendamento(agId);
      showToast('Agendamento cancelado', 'success');
      await loadVetAgenda();
    } catch (err) {
      console.error('Erro ao cancelar agendamento', err);
      showToast('Erro ao cancelar agendamento (veja console)', 'error');
    }
  }

  // ------------------ UI builders ------------------
  const buildActionButtons = (ag) => {
    const status = (ag.status || 'marcado').toString().toUpperCase();
    const prontExists = !!(ag.prontuario_id || ag.pront_id || ag.has_prontuario);
    const finishedOrCancelled = /^(CONCLUIDO|CONCLUIDA|CANCELADO|CANCELADA|FINALIZADO|F)/i.test(status);
    if (prontExists || finishedOrCancelled) {
      return `<span class="status finished">Finalizada</span>
              <button class="btn small open-view-prontuario-modal">Ver Prontuário</button>`;
    }
    return `<button class="btn primary small open-prontuario-modal">Iniciar Atendimento</button>
            <button class="btn small cancel-appointment">Cancelar</button>`;
  };

  // ------------------ Prontuário: criar (modal) ------------------
  const openProntuarioForm = async ({ petId = null, agId = null, consultaId = null } = {}) => {
    const modal = document.getElementById('prontuario-modal');
    if (!modal) return;

    const form = modal.querySelector('#prontuario-form');
    const anamnese = modal.querySelector('#anamnese');
    const diagnostico = modal.querySelector('#diagnostico');
    const tratamento = modal.querySelector('#tratamento');
    const modalTitle = modal.querySelector('#modal-title');

    // hidden inputs
    let petInput = form.querySelector('input[name="pet_id"]');
    let agInput = form.querySelector('input[name="agendamento_id"]');
    let consultInput = form.querySelector('input[name="consulta_id"]');
    if (!petInput) { petInput = document.createElement('input'); petInput.type = 'hidden'; petInput.name = 'pet_id'; form.appendChild(petInput); }
    if (!agInput)  { agInput  = document.createElement('input'); agInput.type  = 'hidden'; agInput.name  = 'agendamento_id'; form.appendChild(agInput); }
    if (!consultInput) { consultInput = document.createElement('input'); consultInput.type = 'hidden'; consultInput.name = 'consulta_id'; form.appendChild(consultInput); }

    petInput.value = petId !== null && petId !== undefined ? String(petId) : '';
    agInput.value  = agId  !== null && agId  !== undefined ? String(agId)  : '';
    consultInput.value = consultaId !== null && consultaId !== undefined ? String(consultaId) : '';

    anamnese.value = '';
    diagnostico.value = '';
    tratamento.value = '';

    if (petId) {
      try {
        const petData = await fetchPet(petId).catch(() => null);
        modalTitle.textContent = `Novo Prontuário para ${petData?.nome || petData?.name || '[Pet]'}`;
      } catch (e) { modalTitle.textContent = 'Novo Prontuário'; }
    } else {
      modalTitle.textContent = 'Novo Prontuário';
    }

    modal.classList.remove('hidden');

    const submitHandler = async (evt) => {
      evt.preventDefault();
      try {
        const body = {
          pet_id: petInput.value ? Number(petInput.value) : undefined,
          anamnese: anamnese.value.trim(),
          diagnostico: diagnostico.value.trim(),
          tratamento: tratamento.value.trim()
        };
        if (agInput.value && agInput.value.trim() !== '') {
          const agNum = Number(agInput.value);
          if (!Number.isNaN(agNum)) body.agendamento_id = agNum;
        }
        if (consultInput.value && consultInput.value.trim() !== '') {
          const cNum = Number(consultInput.value);
          if (!Number.isNaN(cNum)) body.consulta_id = cNum;
        }

        if (!body.pet_id || !body.anamnese || !body.diagnostico || !body.tratamento) {
          alert('Preencha anamnese, diagnóstico e tratamento.');
          return;
        }

        console.log('[openProntuarioForm] enviando body:', body);
        await createProntuario(body);
        showToast('Prontuário salvo com sucesso', 'success');

        if (body.agendamento_id) {
          try { await updateAgendamento(body.agendamento_id, { status: 'concluido' }); } catch (e) { console.warn('Não foi possível finalizar agendamento:', e); }
        }

        modal.classList.add('hidden');
        await loadVetAgenda();
      } catch (err) {
        console.error('Erro ao salvar prontuário', err);
        showToast('Erro ao salvar prontuário (veja console)', 'error');
      }
    };

    if (form._prontSubmitHandler) {
      try { form.removeEventListener('submit', form._prontSubmitHandler); } catch (e) {}
      form._prontSubmitHandler = null;
    }
    form._prontSubmitHandler = submitHandler;
    form.addEventListener('submit', submitHandler);
  };

  // ------------------ Open & view existing prontuário ------------------
  const openViewProntuario = async (prontId) => {
    const modal = document.getElementById('view-prontuario-modal');
    if (!modal) return;
    const viewAnamnese = modal.querySelector('#view-anamnese');
    const viewDiagnostico = modal.querySelector('#view-diagnostico');
    const viewTratamento = modal.querySelector('#view-tratamento');

    try {
      const pront = await getProntuario(prontId);
      const p = (pront && pront.prontuario) ? pront.prontuario : pront;
      viewAnamnese.textContent = p.anamnese || '—';
      viewDiagnostico.textContent = p.diagnostico || '—';
      viewTratamento.textContent = p.tratamento || '—';
    } catch (err) {
      console.warn('Erro ao buscar prontuário:', err);
      viewAnamnese.textContent = 'Não foi possível carregar o prontuário.';
      viewDiagnostico.textContent = '';
      viewTratamento.textContent = '';
    }

    modal.classList.remove('hidden');
  };

  // ------------------ Histórico do pet ------------------
  const loadHistoricoPet = async (petId) => {
    try {
      const data = await fetchHistoricoProntuariosPorPet(petId);
      const modal = document.getElementById('view-historico-modal');
      if (!modal) return;
      const accordion = modal.querySelector('.history-accordion');
      accordion.innerHTML = '';

      const pronts = (data && data.prontuarios) ? data.prontuarios : (Array.isArray(data) ? data : []);
      if (pronts.length === 0) {
        accordion.innerHTML = '<p>Nenhum prontuário encontrado.</p>';
      } else {
        pronts.forEach(p => {
          const created = p.created_at ? (new Date(p.created_at)).toLocaleString() : '—';
          const itemHTML = `
            <article class="history-item">
              <button class="history-item-header">
                <span><strong>${escapeHtml(p.diagnostico || 'Prontuário')}</strong> - ${escapeHtml(created)}</span>
                <span class="accordion-arrow">▾</span>
              </button>
              <div class="history-item-content">
                <p><strong>Anamnese:</strong> ${escapeHtml(p.anamnese || '—')}</p>
                <p><strong>Diagnóstico:</strong> ${escapeHtml(p.diagnostico || '—')}</p>
                <p><strong>Tratamento:</strong> ${escapeHtml(p.tratamento || '—')}</p>
              </div>
            </article>
          `;
          accordion.insertAdjacentHTML('beforeend', itemHTML);
        });
      }

      accordion.querySelectorAll('.history-item-header').forEach(h => {
        h.addEventListener('click', () => h.closest('.history-item').classList.toggle('is-open'));
      });

      modal.classList.remove('hidden');
    } catch (err) {
      console.error('Erro ao carregar histórico do pet:', err);
      showToast('Erro ao carregar histórico do pet (veja console)', 'error');
    }
  };

  // ------------------ Meus Pacientes (paginação) ------------------
  let currentPatientsPage = 1;
  let currentPerPage = 10;
  let currentQuery = '';

  async function loadPatients(page = 1, per_page = 10, q = '') {
    try {
      currentPatientsPage = page;
      currentPerPage = per_page;
      currentQuery = q;
      const data = await fetchPatients(page, per_page, q);
      renderPatientsTable(data, page, per_page);
    } catch (err) {
      console.error('Erro ao carregar pacientes:', err);
      showToast('Erro ao carregar pacientes (veja console)', 'error');
    }
  }

  function renderPatientsTable(data, currentPage, perPage) {
    // tenta identificar o tbody da tabela "Meus Pacientes"
    let tbody = document.querySelector('.content-card:nth-of-type(2) table.custom-table tbody');
    if (!tbody) {
      // fallback por id (caso você tenha ajustado o HTML)
      tbody = document.querySelector('#meus-pacientes-table tbody');
    }
    if (!tbody) return;
    tbody.innerHTML = '';

    const patients = data && data.patients ? data.patients : [];
    if (patients.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5">Nenhum paciente encontrado.</td></tr>`;
      renderPatientsPagination(0, currentPage, perPage);
      return;
    }

    patients.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="patient-name"><strong>${escapeHtml(p.nome || p.name || '—')}</strong></td>
        <td>${escapeHtml((p.especie || p.species || '') + (p.raca ? ' ('+p.raca+')' : ''))}</td>
        <td>${escapeHtml(p.tutor || '—')}</td>
        <td>${escapeHtml(p.ultima_consulta || '—')}</td>
        <td><button class="btn small open-view-historico-modal" data-pet-id="${escapeHtml(p.id_pet || p.id)}">Ver Histórico</button></td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.open-view-historico-modal').forEach(btn => {
      btn.removeEventListener('click', patientHistoricoHandler);
      btn.addEventListener('click', patientHistoricoHandler);
    });

    renderPatientsPagination(data.total || 0, currentPage, perPage);
  }

  function renderPatientsPagination(total, page, per_page) {
    let container = document.querySelector('#patients-pagination');
    if (!container) {
      const card = document.querySelector('.content-card:nth-of-type(2)') || document.getElementById('meus-pacientes-card');
      if (!card) return;
      container = document.createElement('div');
      container.id = 'patients-pagination';
      container.style.marginTop = '12px';
      card.appendChild(container);
    }
    container.innerHTML = '';

    const pages = Math.max(1, Math.ceil((total || 0) / per_page));

    const createBtn = (label, targetPage, disabled = false) => {
      const b = document.createElement('button');
      b.className = 'btn small';
      b.textContent = label;
      if (disabled) b.disabled = true;
      b.addEventListener('click', () => loadPatients(targetPage));
      return b;
    };

    container.appendChild(createBtn('« Anterior', Math.max(1, page-1), page <= 1));
    const info = document.createElement('span');
    info.style.margin = '0 8px';
    info.textContent = `Página ${page} de ${pages} (${total} pacientes)`;
    container.appendChild(info);
    container.appendChild(createBtn('Próxima »', Math.min(pages, page+1), page >= pages));
  }

  function patientHistoricoHandler(ev) {
    ev.stopPropagation();
    const petId = ev.currentTarget.getAttribute('data-pet-id');
    if (!petId) return;
    loadHistoricoPet(petId);
  }

  function attachPatientsSearchHandler() {
    let searchInput = document.querySelector('.content-card:nth-of-type(2) .filter-input');
    if (!searchInput) searchInput = document.querySelector('#meus-pacientes-card .filter-input');
    if (!searchInput) return;
    let timer = null;
    searchInput.removeEventListener('input', patientsSearchInputHandler);
    searchInput.addEventListener('input', patientsSearchInputHandler);
    function patientsSearchInputHandler(ev) {
      const q = ev.currentTarget.value.trim();
      clearTimeout(timer);
      timer = setTimeout(() => {
        loadPatients(1, currentPerPage, q);
      }, 350);
    }
  }

  // ------------------ Utilities ------------------
  function escapeHtml(str) {
    if (!str && str !== 0) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ------------------ Init ------------------
  setupModalCloseButtons();
  attachListenersToTableRows(); // conecta botões estáticos do HTML
  attachPatientsSearchHandler();
  loadVetAgenda(); // tentará buscar agenda real e pacientes

});

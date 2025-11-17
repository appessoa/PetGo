// /public/js/admin.js
import { initSidebar } from './sidebar.js';
import { showToast } from './utils/toast.js'; // se não existir, o fallback abaixo cuida
function maskPhone(value) {
  value = value.replace(/\D/g, "");
  value = value.substring(0, 11);
  if (value.length > 6) {
    value = value.replace(/(\d{2})(\d{5})(\d{1,4})/, "($1) $2-$3");
  } else if (value.length > 2) {
    value = value.replace(/(\d{2})(\d{1,5})/, "($1) $2");
  } else if (value.length > 0) {
    value = value.replace(/(\d{1,2})/, "($1");
  }
  return value;
}
document.addEventListener('DOMContentLoaded', () => {

  // --- LÓGICA PARA O MODAL DE CADASTRO ---
  const openModalBtn = document.getElementById('open-vet-modal-btn');
  const modal = document.getElementById('vet-modal');
  
  if (openModalBtn && modal) {
    const closeButtons = modal.querySelectorAll('.close-btn');

    const openModal = () => {
      modal.classList.remove('hidden');
    };

    const closeModal = () => {
      modal.classList.add('hidden');
    };

    openModalBtn.addEventListener('click', openModal);

    closeButtons.forEach(button => {
      button.addEventListener('click', closeModal);
    });

    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        closeModal();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !modal.classList.contains('hidden')) {
        closeModal();
      }
    });
  }

  // --- LÓGICA PARA O ACORDEÃO DE VETERINÁRIOS ---
  const accordionItems = document.querySelectorAll('.vet-accordion-item');

  accordionItems.forEach(item => {
    const header = item.querySelector('.vet-accordion-header');
    if (header) {
      header.addEventListener('click', () => {
        const isOpen = item.classList.contains('is-open');
        accordionItems.forEach(otherItem => {
          otherItem.classList.remove('is-open');
        });
        if (!isOpen) {
          item.classList.add('is-open');
        }
      });
    }
  });

});


// ===================== CONFIG =====================
const API_BASE = ""; // mesma origem

// --- Toast seguro (usa showToast se existir) ---
function toast(msg, type = "info") {
  if (typeof window.showToast === "function") {
    window.showToast(msg, type);
  } else if (typeof showToast === "function") {
    showToast(msg, type);
  } else {
    if (type === "error") alert(msg);
    else console.log(`[${type}] ${msg}`);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  wireModal();
  loadVeterinarios();
  initSidebar();
});

/* ===================== HELPERS ===================== */
async function fetchJSON(url, opts = {}) {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const err = new Error((data && (data.error || data.message)) || `HTTP ${res.status}`);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

function escapeHTML(str) {
  return (str ?? "").toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Normaliza status vindo do backend → boolean
function statusToBool(s) {
  if (typeof s === "boolean") return s;
  if (s == null) return false;
  const v = String(s).toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "ativo" || v === "active";
}

function boolToSelectValue(b) {
  return b ? "1" : "0";   // "1" = Ativo, "0" = Inativo
}

function selectValueToBool(val) {
  return String(val) === "1";
}

// Badge
function renderStatusBadgeBool(ativoBool) {
  const cls = ativoBool ? "active" : "inactive";
  const label = ativoBool ? "Ativo" : "Inativo";
  return `<span class="status ${cls}">${label}</span>`;
}

/* ===================== VETERINÁRIOS ===================== */
async function loadVeterinarios() {
  const container = document.querySelector(".vet-accordion");
  if (!container) return;

  container.innerHTML = `<div class="loading-row">Carregando veterinários…</div>`;

  try {
    const vets = await fetchJSON(`${API_BASE}/veterinarios`);
    const list = Array.isArray(vets) ? vets : (vets.items || vets.veterinarios || []);
    if (!list?.length) {
      container.innerHTML = `<p class="no-data-message">Nenhum veterinário cadastrado.</p>`;
      // sucesso com lista vazia também é um retorno válido
      toast("Lista de veterinários carregada (vazia).", "info");
      return;
    }
    console.log(list)
    container.innerHTML = list.map(renderVetItem).join("");
    wireAccordion(container);
    wireActions(container);
  } catch (e) {
    console.error("Erro ao carregar veterinários:", e);
    container.innerHTML = `<p class="no-data-message">Erro ao carregar veterinários.</p>`;
    toast(`Erro ao carregar veterinários: ${e?.payload?.message || e?.message || "desconhecido"}`, "error");
  }
}

function formatBRDate(iso){
  try{
    const d = new Date(iso);
    if(!isNaN(d)) return d.toLocaleDateString('pt-BR');
    const [y,m,dd] = String(iso).split('-');
    return `${dd}/${m}/${y}`;
  }catch{ return iso; }
}

function renderVetItem(v) {
  const id = v.id ?? v.vet_id ?? v.id_veterinarian;
  const nome = v.nome || v.name || "—";
  const username = v.username || v.user || "";
  const email = v.email || v.mail || "";
  const numero = v.numero || v.telefone || v.phone || "";
  const especialidade = v.especialidade || v.specialty || "—";
  const crmv = v.CRMV || v.registro || "—";
  const ativoBool = statusToBool(v.status ?? v.ativo);

  const appointments = v.schedulings || [];

  const apptsHTML = appointments.length
    ? `<ul class="appointments-list">` +
      appointments.slice(0, 5).map(a =>
        `<li><strong>${escapeHTML(formatBRDate(a.date) || "")} - ${escapeHTML(a.time || "")}</strong> - ${escapeHTML(a.pet?.nome || a.pet_name || "")} (Tutor: ${escapeHTML(a.user?.nome || a.tutor || "")})</li>`
      ).join("") + `</ul>`
    : `<p class="no-data-message">Sem agendamentos próximos.</p>`;

  const patientsHTML = appointments.length
    ? `<ul class="patients-list">` +
      appointments.slice(0, 5).map(p =>
        `<li>${escapeHTML(p.pet?.nome || p.nome || "Paciente")} ${p.breed || p.pet?.raca ? `(${escapeHTML(p.breed || p.pet?.raca)})` : ""}</li>`
      ).join("") + `</ul>`
    : `<p class="no-data-message">Sem pacientes recentes.</p>`;

  return `
  <article class="vet-accordion-item"
           data-id="${escapeHTML(id)}"
           data-crmv="${escapeHTML(crmv)}"
           data-username="${escapeHTML(username)}"
           data-email="${escapeHTML(email)}"
           data-numero="${escapeHTML(numero)}">
    <button class="vet-accordion-header">
      <div class="vet-info">
        <span class="vet-name">${escapeHTML(nome)}</span>
        <span class="vet-specialty">${escapeHTML(especialidade)}</span>
      </div>
      <div class="vet-status-wrapper">
        ${renderStatusBadgeBool(ativoBool)}
        <span class="accordion-arrow">▾</span>
      </div>
    </button>
    <div class="vet-accordion-content">
      <div class="vet-details-actions">
        <button class="btn xs outline edit-vet-btn" id="btneditvet">Editar</button>
        <button class="btn xs danger delete-vet-btn">Excluir</button>
      </div>
      <div class="vet-details-grid">
        <div class="detail-card">
          <h3>Próximos Agendamentos</h3>
          ${apptsHTML}
        </div>
        <div class="detail-card">
          <h3>Pacientes Recentes</h3>
          ${patientsHTML}
        </div>
        <div class="detail-card muted">
          <p><strong>CRMV:</strong> ${escapeHTML(crmv)}</p>
          <p><strong>Email:</strong> ${escapeHTML(email || "—")}</p>
          <p><strong>Número:</strong> ${escapeHTML(numero || "—")}</p>
          <p><strong>Status:</strong> ${ativoBool ? "Ativo" : "Inativo"}</p>
        </div>
      </div>
    </div>
  </article>`;
}

function wireAccordion(root) {
  const items = root.querySelectorAll(".vet-accordion-item");
  items.forEach((item) => {
    const header = item.querySelector(".vet-accordion-header");
    if (!header) return;
    header.addEventListener("click", () => {
      const open = item.classList.contains("is-open");
      items.forEach((it) => it.classList.remove("is-open"));
      if (!open) item.classList.add("is-open");
    });
  });
}

function wireActions(root) {
  // Editar
  root.querySelectorAll(".edit-vet-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const item = btn.closest(".vet-accordion-item");
      if (!item) return;
      openEditFor(item);
    });
  });

  // Excluir
  root.querySelectorAll(".delete-vet-btn").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const item = btn.closest(".vet-accordion-item");
      if (!item) return;
      const id = item.dataset.id;
      if (!id) return;
      if (!confirm("Tem certeza que deseja excluir este veterinário?")) return;

      try {
        const resp = await fetchJSON(`${API_BASE}/veterinarios/${encodeURIComponent(id)}`, { method: "DELETE" });
        item.remove();
        toast(resp?.message || "Veterinário excluído com sucesso.", "success");
      } catch (err) {
        console.error("DELETE /veterinarios/:id", err);
        toast("Erro ao excluir: " + (err?.payload?.message || err?.message || "desconhecido"), "error");
      }
    });
  });
}

/* ===================== MODAL (CRIAR/EDITAR) ===================== */
function wireModal() {
  const openBtn   = document.getElementById("open-vet-modal-btn");
  const modal     = document.getElementById("vet-modal");
  const form      = document.getElementById("vet-form");
  const closeBtns = modal?.querySelectorAll(".close-btn");
  const editbnt = document.getElementById("btneditvet");

  if (!modal || !form) return;

  const getHeaderEl = () => modal.querySelector(".modal-header h2");
  const getStatusEl = () => form.querySelector("#vet-status");
  const pwdInput    = () => form.querySelector("#vet-Senha");
  const pwdLabel    = () => modal.querySelector('label[for="vet-Senha"]');

  // Funções para esconder/mostrar o campo senha + label.
  function hidePasswordField() {
    const inp = pwdInput();
    const lbl = pwdLabel();
    // esconder visualmente
    if (lbl) lbl.style.display = "none";
    if (inp) inp.style.display = "none";
    // garantir que não será enviado: remover name (guardamos em _origName)
    if (inp) {
      inp._origName = inp.getAttribute("name");
      if (inp.hasAttribute("name")) inp.removeAttribute("name");
      inp.value = "";
    }
  }
  function showPasswordField() {
    const inp = pwdInput();
    const lbl = pwdLabel();
    if (lbl) lbl.style.display = "";
    if (inp) inp.style.display = "";
    if (inp && inp._origName) inp.setAttribute("name", inp._origName);
  }

  const open = () => {
    modal.classList.remove("hidden");
  };

  const close = () => {
    modal.classList.add("hidden");
    form.reset();
    form.dataset.mode = "create";
    delete form.dataset.id;

    const headerEl = getHeaderEl();
    if (headerEl) headerEl.textContent = "Cadastrar Novo Veterinário";

    const statusEl = getStatusEl();
    if (statusEl) statusEl.value = "1"; // default: Ativo

    // Ao fechar, garante que o campo senha volte a aparecer (pronto para criar novo)
    showPasswordField();
  };

  openBtn?.addEventListener("click", () => {
    form.dataset.mode = "create";
    delete form.dataset.id;
    const headerEl = getHeaderEl();
    if (headerEl) headerEl.textContent = "Cadastrar Novo Veterinário";
    // mostrar senha no modo criação
    showPasswordField();
    open();
  });

  closeBtns?.forEach((b) => b.addEventListener("click", close));
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) close();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const btn = form.querySelector('[type="submit"]');
    const old = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = "Salvando…"; }

    try {
      const payload = collectVetPayload(form);
      const mode = form.dataset.mode;
      const id = form.dataset.id;
      console.log(mode)
      let resp;
      if (mode === "edit" && id) {
        resp = await fetchJSON(`${API_BASE}/veterinarios/${encodeURIComponent(id)}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        resp = await fetchJSON(`${API_BASE}/veterinarios`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      toast(resp?.message || "Veterinário salvo com sucesso.", "success");
      close();
      await loadVeterinarios();
    } catch (err) {
      console.error("Salvar veterinário", err);
      toast("Erro ao salvar: " + (err?.payload?.message || err?.message || "desconhecido"), "error");
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = old; }
    }
  });
}

// Lê dados do form e monta payload p/ API (status boolean)
// observe: o campo senha só será incluído se existir no DOM com atributo name e estiver preenchido
function collectVetPayload(form) {
  const name          = form.querySelector("#vet-name")?.value.trim() || "";
  const username      = form.querySelector("#vet-username")?.value.trim() || "";
  const email         = form.querySelector("#vet-email")?.value.trim() || "";
  const phone         = form.querySelector("#vet-numero")?.value.trim() || "";
  const passwordEl    = form.querySelector("#vet-Senha");
  const password      = (passwordEl && passwordEl.getAttribute("name")) ? (passwordEl.value || "") : "";
  const especialidade = form.querySelector("#vet-specialty")?.value.trim() || "";
  const CRMV          = form.querySelector("#vet-crmv")?.value.trim() || "";
  const statusVal     = form.querySelector("#vet-status")?.value ?? "1";
  const statusBool    = selectValueToBool(statusVal);

  const payload = {
    name,
    username,
    email,
    phone,
    especialidade,
    CRMV,
    status: statusBool, // envia como booleano
  };
  if (password) payload.password = password; // só envia se preenchida E se o input tiver name (modo criação)
  return payload;
}

// Preenche o form com dados vindos do backend (edição)
function fillForm(form, v = {}) {
  form.querySelector("#vet-name").value       = v.nome || v.name || "";
  form.querySelector("#vet-username").value   = v.username || v.user || "";
  form.querySelector("#vet-email").value      = v.email || v.mail || "";
  form.querySelector("#vet-numero").value     = v.numero || v.telefone || v.phone || "";
  form.querySelector("#vet-specialty").value  = v.especialidade || v.specialty || "";
  form.querySelector("#vet-crmv").value       = v.CRMV || v.registro || "";

  // Nunca preenche senha por segurança — apenas limpa
  const senhaEl = form.querySelector("#vet-Senha");
  if (senhaEl) senhaEl.value = "";

  // Status
  const statusEl = form.querySelector("#vet-status");
  if (statusEl) {
    const ativoBool = statusToBool(v.status ?? v.ativo);
    statusEl.value = boolToSelectValue(ativoBool);
  }
}

// Abre modal em modo edição; preenche com dados do DOM imediatamente e
// em segundo plano tenta buscar dados completos do backend e atualiza o form.
async function openEditFor(item) {
  const id = item.dataset.id;
  if (!id) return;

  const modal = document.getElementById("vet-modal");
  const form  = document.getElementById("vet-form");
  if (!modal || !form) return;

  form.dataset.mode = "edit";
  form.dataset.id = id
  const header = modal.querySelector(".modal-header h2");
  if (header) header.textContent = "Editar Veterinário";

  // Esconder label + input de senha assim que entrar em modo edição
  // (usa as mesmas funções definidas em wireModal — mas aqui garantimos que ocorrará
  // mesmo que wireModal não tenha rodado antes por algum motivo)
  (function hidePwdLocal() {
    const lbl = modal.querySelector('label[for="vet-Senha"]');
    const inp = form.querySelector('#vet-Senha');
    if (lbl) lbl.style.display = "none";
    if (inp) {
      inp.style.display = "none";
      inp._origName = inp.getAttribute("name");
      if (inp.hasAttribute("name")) inp.removeAttribute("name");
      inp.value = "";
      inp.removeAttribute("required"); // <<< isso resolve o erro
    }
  })();

  // 1) Preenche imediatamente com os dados disponíveis no DOM
  const domData = {
    nome: item.querySelector(".vet-name")?.textContent?.trim() || "",
    username: item.dataset.username || item.querySelector(".vet-username")?.textContent || "",
    email: item.dataset.email || "",
    numero: item.dataset.numero || "",
    especialidade: item.querySelector(".vet-specialty")?.textContent?.trim() || item.dataset.especialidade || "",
    CRMV: item.dataset.crmv || "",
    status: item.querySelector(".vet-status-wrapper .status")?.classList.contains("active"),
  };
  fillForm(form, domData);

  // Abre o modal para o usuário ver os dados imediatamente
  modal.classList.remove("hidden");

  // 2) Em background, tenta buscar dados completos do backend e atualiza o form
  try {
    const v = await fetchJSON(`${API_BASE}/veterinarios/${encodeURIComponent(id)}`);
    // Caso o backend retorne algo como { data: {...} } ou { veterinarian: {...} }
    const full = v?.data || v?.veterinario || v?.veterinarios || v;
    fillForm(form, full || {});
  } catch (err) {
    console.warn("Falha ao buscar /veterinarios/:id — mantendo dados locais.", err);
    toast("Não foi possível buscar dados do servidor. Usando informações locais.", "warning");
    // (já preenchemos com o DOM antes; nada mais a fazer)
  }
}

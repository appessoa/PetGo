document.addEventListener('DOMContentLoaded', () => {

  // --- LÓGICA PARA O MODAL DE CADASTRO ---
  const openModalBtn = document.getElementById('open-vet-modal-btn');
  const modal = document.getElementById('vet-modal');
  
  // Verifica se os elementos do modal existem na página antes de adicionar os eventos
  if (openModalBtn && modal) {
    const closeButtons = modal.querySelectorAll('.close-btn');

    const openModal = () => {
      modal.classList.remove('hidden');
    };

    const closeModal = () => {
      modal.classList.add('hidden');
    };

    // Abre o modal
    openModalBtn.addEventListener('click', openModal);

    // Fecha o modal clicando nos botões de fechar/cancelar
    closeButtons.forEach(button => {
      button.addEventListener('click', closeModal);
    });

    // Fecha o modal clicando fora dele (no overlay)
    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        closeModal();
      }
    });

    // Fecha o modal pressionando a tecla "Escape"
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
    
    // Verifica se o cabeçalho do acordeão existe
    if (header) {
      header.addEventListener('click', () => {
        const isOpen = item.classList.contains('is-open');

        // Fecha todos os outros itens para ter apenas um aberto por vez
        accordionItems.forEach(otherItem => {
          otherItem.classList.remove('is-open');
        });
        
        // Se o item clicado não estava aberto, ele abre.
        // Se já estava aberto, o loop acima já o fechou.
        if (!isOpen) {
            item.classList.add('is-open');
        }
      });
    }
  });

});


// /public/js/admin.js
const API_BASE = ""; // mesma origem (ajuste se backend estiver em outra porta/origem)

// --- Toast seguro (usa showToast se existir) ---
function toast(msg, type = "info") {
  if (typeof window.showToast === "function") {
    window.showToast(msg, type);
  } else {
    if (type === "error") alert(msg);
    else console.log(`[${type}] ${msg}`);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  wireModal();
  loadVeterinarios(); // carrega e desenha o acordeão
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
  const v = (s ?? "").toString().toLowerCase();
  return v === "ativo" || v === "active" || v === "true" || v === "1" || v === "yes";
}

// boolean → value do <select> ("active" | "inactive")
function boolToSelectValue(b) {
  return b ? "active" : "inactive";
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
    console.log("Veterinários carregados:", vets);
    const list = Array.isArray(vets) ? vets : (vets.items || vets.veterinarios || []);

    if (!list?.length) {
      container.innerHTML = `<p class="no-data-message">Nenhum veterinário cadastrado.</p>`;
      return;
    }

    container.innerHTML = list.map(renderVetItem).join("");
    wireAccordion(container);
    wireActions(container);
  } catch (e) {
    console.error("Erro ao carregar veterinários:", e);
    container.innerHTML = `<p class="no-data-message">Erro ao carregar veterinários.</p>`;
    toast(`Erro ao carregar: ${e?.payload?.message || e?.message || "desconhecido"}`, "error");
  }
}

function renderVetItem(v) {
  const id = v.id ?? v.vet_id ?? v.id_veterinario;
  const nome = v.nome || v.name || "—";
  const username = v.username || v.user || "";
  const email = v.email || v.mail || "";
  const numero = v.numero || v.telefone || v.phone || "";
  const especialidade = v.especialidade || v.specialty || "—";
  const crmv = v.CRMV || v.registro || "—";
  const ativoBool = statusToBool(v.status ?? v.ativo);

  const appointments = v.appointments || [];
  const patients = v.patients || [];

  const apptsHTML = appointments.length
    ? `<ul class="appointments-list">` +
      appointments.slice(0, 5).map(a =>
        `<li><strong>${escapeHTML(a.when || a.horario || "")}</strong> - ${escapeHTML(a.pet || a.pet_name || "")} (Tutor: ${escapeHTML(a.owner || a.tutor || "")})</li>`
      ).join("") + `</ul>`
    : `<p class="no-data-message">Sem agendamentos próximos.</p>`;

  const patientsHTML = patients.length
    ? `<ul class="patients-list">` +
      patients.slice(0, 5).map(p =>
        `<li>${escapeHTML(p.name || p.nome || "Paciente")} ${p.breed || p.raca ? `(${escapeHTML(p.breed || p.raca)})` : ""}</li>`
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
        <button class="btn xs outline edit-vet-btn">Editar</button>
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
        await fetchJSON(`${API_BASE}/veterinarios/${encodeURIComponent(id)}`, { method: "DELETE" });
        item.remove();
        toast("Veterinário excluído com sucesso.", "success");
      } catch (err) {
        console.error("DELETE /veterinarios/:id", err);
        toast("Erro ao excluir: " + (err?.payload?.message || err?.message || "desconhecido"), "error");
      }
    });
  });
}

/* ===================== MODAL (CRIAR/EDITAR) ===================== */
function wireModal() {
  const openBtn = document.getElementById("open-vet-modal-btn");
  const modal = document.getElementById("vet-modal");
  const closeBtns = modal?.querySelectorAll(".close-btn");
  const form = document.getElementById("vet-form");

  if (!modal || !form) return;

  const open = () => modal.classList.remove("hidden");
  const close = () => {
    modal.classList.add("hidden");
    form.reset();
    form.dataset.mode = "create";
    delete form.dataset.id;
    form.querySelector(".modal-header h2").textContent = "Cadastrar Novo Veterinário";
    form.querySelector("#vet-status").value = "active";
  };

  openBtn?.addEventListener("click", () => {
    form.dataset.mode = "create";
    delete form.dataset.id;
    form.querySelector(".modal-header h2").textContent = "Cadastrar Novo Veterinário";
    open();
  });

  closeBtns?.forEach(b => b.addEventListener("click", close));
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.classList.contains("hidden")) close(); });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const btn = form.querySelector('[type="submit"]');
    const old = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = "Salvando…"; }

    try {
      const payload = collectVetPayload(form);
      const mode = form.dataset.mode || "create";
      const id = form.dataset.id;

      let resp;
      if (mode === "edit" && id) {
        resp = await fetchJSON(`${API_BASE}/veterinarios/${encodeURIComponent(id)}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
      } else {
        resp = await fetchJSON(`${API_BASE}/veterinarios`, {
          method: "POST",
          body: JSON.stringify(payload)
        });
      }

      toast("Veterinário salvo com sucesso.", "success");
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
function collectVetPayload(form) {
  const name = form.querySelector("#vet-name")?.value.trim() || "";
  const username = form.querySelector("#vet-username")?.value.trim() || "";
  const email = form.querySelector("#vet-email")?.value.trim() || "";
  const phone = form.querySelector("#vet-numero")?.value.trim() || "";
  const password = form.querySelector("#vet-Senha")?.value || "";
  const especialidade = form.querySelector("#vet-specialty")?.value.trim() || "";
  const CRMV = form.querySelector("#vet-crmv")?.value.trim() || "";
  const statusVal = form.querySelector("#vet-status")?.value ; // "0" | "1"

  const payload = {
    name,
    username,
    email,
    phone,
    especialidade,
    CRMV,
    status: statusVal, // <-- boolean true/false
  };
  if (password) payload.password = password; // só envia se preenchida

  return payload;
}

// Preenche o form com dados vindos do backend (edição)
function fillForm(form, v) {
  form.querySelector("#vet-name").value = v.nome || v.name || "";
  form.querySelector("#vet-username").value = v.username || v.user || "";
  form.querySelector("#vet-email").value = v.email || v.mail || "";
  form.querySelector("#vet-numero").value = v.numero || v.telefone || v.phone || "";
  form.querySelector("#vet-specialty").value = v.especialidade || v.specialty || "";
  form.querySelector("#vet-crmv").value = v.CRMV || v.registro || "";
  form.querySelector("#vet-status").value = boolToSelectValue(!!ativoBool);
  // Nunca preenche senha por segurança
  const senhaEl = form.querySelector("#vet-Senha");
  if (senhaEl) senhaEl.value = "";
}

// Abre modal em modo edição; busca dados completos do backend
async function openEditFor(item) {
  const id = item.dataset.id;
  if (!id) return;

  const modal = document.getElementById("vet-modal");
  const form = document.getElementById("vet-form");
  if (!modal || !form) return;

  form.dataset.mode = "edit";
  form.dataset.id = id;
  form.querySelector(".modal-header h2").textContent = "Editar Veterinário";

  try {
    // tenta buscar do backend para garantir dados atualizados
    const v = await fetchJSON(`${API_BASE}/veterinarios/${encodeURIComponent(id)}`);
    fillForm(form, v || {});
  } catch (err) {
    // se der erro no GET, tenta preencher com o que temos no DOM (fallback)
    console.warn("Falha ao buscar /veterinarios/:id, usando dados do DOM", err);
    fillForm(form, {
      nome: item.querySelector(".vet-name")?.textContent || "",
      username: item.dataset.username || "",
      email: item.dataset.email || "",
      numero: item.dataset.numero || "",
      especialidade: item.querySelector(".vet-specialty")?.textContent || "",
      crmv: item.dataset.crmv || "",
      status: item.querySelector(".vet-status-wrapper .status")?.classList.contains("active"),
    });
  }

  modal.classList.remove("hidden");
}

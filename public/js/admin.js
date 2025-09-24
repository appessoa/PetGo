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
const API_BASE = ""; // "" = mesma origem. Ex.: "http://127.0.0.1:8000"

document.addEventListener("DOMContentLoaded", () => {
  wireVetModal();
  wireVetAccordion();
  loadVeterinariosRecentes();
  loadVendasRecentes();
  wireProductForm();
});

/* ================= HELPERS ================= */
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

function renderStatusBadge(status) {
  const ativo = Boolean(status); // força para boolean
  const cls = ativo ? "active" : "inactive";
  const label = ativo ? "Ativo" : "Inativo";
  return `<span class="status ${cls}">${label}</span>`;
}

function escapeHTML(str) {
  return (str ?? "").toString()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ================= VETERINÁRIOS ================= */
function getVeterinariosSection() {
  return [...document.querySelectorAll(".content-card")].find(sec => {
    const h2 = sec.querySelector(".card-header h2");
    return h2 && /Veterin[aá]rios Recentes/i.test(h2.textContent);
  });
}

async function loadVeterinariosRecentes() {
  const sec = getVeterinariosSection();
  if (!sec) return;

  const table = sec.querySelector("table.custom-table");
  if (!table) return;

  const tbody = table.querySelector("tbody") || table.appendChild(document.createElement("tbody"));
  tbody.innerHTML = `<tr><td colspan="3">Carregando...</td></tr>`;

  try {
    const vets = await fetchJSON(`${API_BASE}/veterinarios`);
    const list = Array.isArray(vets) ? vets : (vets.items || []);

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="3">Nenhum veterinário encontrado.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.slice(0, 5).map(v => {
      const nome = v.nome || v.name || "—";
      const especialidade = v.especialidade || v.specialty || "—";
      const status = v.status || (v.ativo ? "Ativo" : "Inativo");
      return `
        <tr>
          <td>${escapeHTML(nome)}</td>
          <td>${escapeHTML(especialidade)}</td>
          <td>${renderStatusBadge(status)}</td>
        </tr>`;
    }).join("");
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="3">Erro ao carregar veterinários.</td></tr>`;
    console.error("Erro veterinários:", e);
  }
}

/* ================= PRODUTOS ================= */
function wireProductForm() {
  const form = document.querySelector("form.product-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type="submit"]');
    const old = btn?.textContent;
    if (btn) { btn.disabled = true; btn.textContent = "Enviando..."; }

    try {
      const payload = {
        nome: form.querySelector("#product-name")?.value.trim(),
        preco: Number(form.querySelector("#product-price")?.value) || 0,
        estoque: Number(form.querySelector("#product-stock")?.value) || 0,
        categoria: form.querySelector("#product-category")?.value.trim()
      };

      // Ajuste conforme a rota real dos produtos no backend
      const created = await fetchJSON(`${API_BASE}/produtos`, {
        method: "POST",
        body: JSON.stringify(payload)
      });

      alert("Produto adicionado com sucesso!");
      form.reset();
      console.log("Produto criado:", created);
    } catch (err) {
      alert("Erro ao adicionar produto: " + (err?.message || "Erro desconhecido"));
      console.error("ERRO produto:", err);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = old; }
    }
  });
}

/* ================= VENDAS ================= */
function loadVendasRecentes() {
  const sec = [...document.querySelectorAll(".content-card")].find(sec => {
    const h2 = sec.querySelector(".card-header h2");
    return h2 && /Vendas Recentes/i.test(h2.textContent);
  });
  if (!sec) return;

  const table = sec.querySelector("table.custom-table");
  if (!table) return;

  table.innerHTML = `
    <thead>
      <tr>
        <th>Pedido</th>
        <th>Cliente</th>
        <th>Total</th>
        <th>Status</th>
        <th>Data</th>
      </tr>
    </thead>
    <tbody><tr><td colspan="5">Integre aqui sua rota de vendas.</td></tr></tbody>`;
}

/* ================= UI EXISTENTE ================= */
function wireVetModal() {
  const openModalBtn = document.getElementById("open-vet-modal-btn");
  const modal = document.getElementById("vet-modal");
  if (!openModalBtn || !modal) return;

  const closeButtons = modal.querySelectorAll(".close-btn");
  const openModal = () => modal.classList.remove("hidden");
  const closeModal = () => modal.classList.add("hidden");

  openModalBtn.addEventListener("click", openModal);
  closeButtons.forEach((b) => b.addEventListener("click", closeModal));
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.classList.contains("hidden")) closeModal(); });
}

function wireVetAccordion() {
  const items = document.querySelectorAll(".vet-accordion-item");
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

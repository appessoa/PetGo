import { initSidebar } from './sidebar.js';

const API_BASE = ""; // "" = mesma origem. Ex.: "http://127.0.0.1:8000"

document.addEventListener("DOMContentLoaded", () => {
  // Inicializa a sidebar
  initSidebar();

  // Inicializa os modais e acordeões
  wireVetModal();
  wireVetAccordion();
  wireProductEditModal(); // <-- Nova função para o modal de produtos
  wireProductForm(); // <-- Mantém a lógica do formulário de adicionar (se for diferente do modal)

  // Carrega dados
  loadVeterinariosRecentes();
  loadVendasRecentes();
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
    console.log('Veterinários carregados:', vets);
    const list = Array.isArray(vets) ? vets : (vets.veterinarios || []);

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
// Esta função parece ser para um formulário de ADICIONAR produto à parte,
// se for o mesmo que o modal, ela pode ser integrada ou removida.
// Se for um formulário de adicionar que NÃO é o modal, mantenha-o.
function wireProductForm() {
  const form = document.querySelector("form.product-form"); // Assumindo uma classe 'product-form'
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
      // Opcional: Recarregar produtos para atualizar a lista
      // loadProductsList();

    } catch (err) {
      alert("Erro ao adicionar produto: " + (err?.message || "Erro desconhecido"));
      console.error("ERRO produto:", err);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = old; }
    }
  });
}

// ============== LÓGICA DO MODAL DE EDIÇÃO DE PRODUTO CONSOLIDADA ==============
function wireProductEditModal() {
  const editProductModal = document.getElementById('editProductModal');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const cancelEditBtn = document.getElementById('cancel-edit-btn');
  const editProductButtons = document.querySelectorAll('.edit-product-btn');
  const addProductBtn = document.getElementById('add-product-btn');
  const modalTitle = document.getElementById('modal-title');
  const editProductForm = document.getElementById('edit-product-form');

  // Campos do formulário no modal
  const productImageInput = document.getElementById('product-image');
  const currentProductImage = document.getElementById('current-product-image');
  const productNameInput = document.getElementById('product-name');
  const productPriceInput = document.getElementById('product-price');
  const productStockInput = document.getElementById('product-stock');
  const productCategoryInput = document.getElementById('product-category');

  // Variável para armazenar o ID do produto que está sendo editado
  let currentProductId = null;

  // Função para abrir o modal
  function openModal(isNewProduct = false, productData = {}) {
    editProductModal.classList.add('active');
    document.body.style.overflow = 'hidden'; // Impede scroll do body

    editProductForm.reset(); // Limpa o formulário antes de preencher

    if (isNewProduct) {
      modalTitle.textContent = 'Adicionar Novo Produto';
      currentProductId = null; // Zera o ID para um novo produto
      currentProductImage.src = 'https://placehold.co/600x400/CCCCCC/FFFFFF?text=Sem+Imagem'; // Imagem padrão para adicionar
      currentProductImage.style.display = 'block';
    } else {
      modalTitle.textContent = `Editar Produto: ${productData.name || '—'}`; // Título com nome do produto
      currentProductId = productData.id;

      // Preenche os campos do formulário com os dados do produto
      productNameInput.value = productData.name || '';
      // Garante que o valor seja numérico e com ponto decimal para inputs type="number"
      productPriceInput.value = (parseFloat(productData.price) || 0).toFixed(2);
      productStockInput.value = parseInt(productData.stock) || 0;
      productCategoryInput.value = productData.category || '';
      
      currentProductImage.src = productData.image || 'https://placehold.co/600x400/CCCCCC/FFFFFF?text=Sem+Imagem';
      currentProductImage.style.display = 'block';
    }
  }

  // Função para fechar o modal
  function closeModal() {
    editProductModal.classList.remove('active');
    document.body.style.overflow = ''; // Restaura scroll do body
    editProductForm.reset(); // Limpa o formulário ao fechar
    currentProductId = null; // Garante que o ID seja resetado
    currentProductImage.style.display = 'none'; // Esconde a imagem de preview
    currentProductImage.src = ''; // Limpa a src da imagem
  }

  // Evento para abrir o modal ao clicar em "Editar"
  editProductButtons.forEach(button => {
    button.addEventListener('click', (event) => {
      const productCard = event.target.closest('.product-card');
      if (!productCard) {
        console.error("Não foi possível encontrar o product-card pai do botão Editar.");
        return;
      }

      const productId = productCard.dataset.productId;
      
      const productName = productCard.querySelector('h4').textContent;
      const priceElement = productCard.querySelector('.product-info strong:nth-child(1)');
      const stockElement = productCard.querySelector('.product-info strong:nth-child(2)');
      const productCategory = productCard.querySelector('.product-category').textContent;
      const productImage = productCard.querySelector('img').src;

      // Extrai o texto e remove "R$", "un.", espaços e substitui vírgula por ponto.
      const productPrice = priceElement ? priceElement.textContent.replace('R$', '').replace('.', '').replace(',', '.').trim() : '0';
      const productStock = stockElement ? stockElement.textContent.replace(' un.', '').trim() : '0';

      const productData = {
        id: productId,
        name: productName,
        price: parseFloat(productPrice),
        stock: parseInt(productStock),
        category: productCategory,
        image: productImage
      };
      
      openModal(false, productData);
    });
  });

  // Evento para abrir o modal ao clicar em "Adicionar Novo Produto"
  addProductBtn.addEventListener('click', () => {
    openModal(true);
  });

  // Eventos para fechar o modal
  closeModalBtn.addEventListener('click', closeModal);
  cancelEditBtn.addEventListener('click', closeModal);
  editProductModal.addEventListener('click', (event) => {
    if (event.target === editProductModal) {
      closeModal();
    }
  });

  // Pré-visualização da imagem ao selecionar um arquivo
  productImageInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        currentProductImage.src = e.target.result;
        currentProductImage.style.display = 'block';
      };
      reader.readAsDataURL(file);
    } else {
      currentProductImage.src = '';
      currentProductImage.style.display = 'none';
    }
  });

  // Lidar com o envio do formulário do modal
  editProductForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    
    const formData = new FormData(editProductForm);
    const productData = {};
    for (let [key, value] of formData.entries()) {
      productData[key] = value;
    }

    if (currentProductId) {
      productData.id = currentProductId;
    }

    console.log('Dados do produto a serem salvos:', productData);

    // TODO: Exemplo de envio para API
    try {
      const url = `${API_BASE}/produtos` + (productData.id ? `/${productData.id}` : '');
      const method = productData.id ? 'PUT' : 'POST';

      // Se você está enviando arquivos, use FormData diretamente
      // Se apenas dados JSON, use JSON.stringify(productData)
      const headers = productData.productImage instanceof File
        ? {} // FormData com arquivo não precisa de Content-Type manual
        : { 'Content-Type': 'application/json' };

      const body = productData.productImage instanceof File
        ? formData // Envia o FormData completo com o arquivo
        : JSON.stringify(productData); // Envia como JSON

      const response = await fetch(url, {
        method: method,
        body: body,
        headers: headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Erro desconhecido' }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Sucesso:', result);
      alert('Produto salvo com sucesso!');
      closeModal();
      // Opcional: Recarregar a lista de produtos na UI
      // loadProductsList();
    } catch (error) {
      console.error('Erro ao salvar produto:', error);
      alert('Erro ao salvar produto: ' + error.message);
    }
  });
}
// =========================================================================


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
// Esta função `wireVetModal` já existe no seu código, a duplicação no início do arquivo
// `DOMContentLoaded` foi removida.
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

// Esta função `wireVetAccordion` já existe no seu código, a duplicação no início do arquivo
// `DOMContentLoaded` foi removida.
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
// /public/js/header.js
export async function initHeader() {
  const header = document.getElementById('Header');
  if (!header) return;

  let user = null;
  try {
    const resp = await fetch("/me", { credentials: "include" });
    user = await resp.json();
  } catch (err) {
    console.error("Erro ao buscar usuário logado", err);
  }

  const navHtml = `
    <a href="/"><div class="logo"><span class="paw">🐾</span> PetGo</div></a>
    <nav>
      <a href="/#inicio">Início</a>
      <a href="/produtos">Produtos</a>
      <a href="/#servicos">Serviços</a>
      <a href="/PetGoAdocao">Adoção</a>
      <a href="/#contato">Contato</a>
    </nav>
  `;

  let baseActions = `
    <a href="/PetGoAgendamento"><button class="btn primary">Agende um serviço</button></a>
  `;

  if (user && user.logged_in) {
    // adiciona ícone do carrinho já com badge (0) — atualizamos depois
    baseActions += `
    <a href="/carrinho" class="cart-icon" id="cart-link" aria-label="Ver carrinho de compras" style="position:relative;">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
           viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="9" cy="21" r="1"></circle>
        <circle cx="20" cy="21" r="1"></circle>
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
      </svg>
      <span id="cart-count"
            style="position:absolute; top:-6px; right:-6px; min-width:20px; height:20px;
                   background:var(--primary); color:#fff; font:800 12px/20px Inter, sans-serif;
                   border-radius:999px; display:inline-block; text-align:center; padding:0 6px; box-shadow:var(--shadow);">
        0
      </span>
    </a>
    `;
  }

  let actionsHtml = "";
  if (user && user.logged_in) {
    const username = user.username || "Usuário";
    actionsHtml = `
      <div class="user-menu" data-open="false">
        <button class="user-btn" aria-haspopup="true" aria-expanded="false">
          <span class="avatar_menu">${username.slice(0,1).toUpperCase()}</span>
          <span class="user-name">${username}</span>
          <span class="caret">▾</span>
        </button>
        <div class="dropdown" role="menu">
          ${user.is_admin
            ? `<a role="menuitem" href="/adminPage">Administração</a>`
            : `
              <a role="menuitem" href="/UserPage">Dados do usuário</a>
              <a role="menuitem" href="/PetGoHealth">Plano Health</a>
            `}
          <a role="menuitem" href="/logout">Sair</a>
        </div>
      </div>
      ${baseActions}
    `;
  } else {
    actionsHtml = `
      <a href="/login"><button class="btn">Entrar</button></a>
      ${baseActions}
    `;
  }

  header.innerHTML = `
    <div class="container header-inner">
      ${navHtml}
      <div class="actions">${actionsHtml}</div>
    </div>
  `;

  // Comportamento do dropdown
  const menu = header.querySelector(".user-menu");
  if (menu) {
    const btn = menu.querySelector(".user-btn");
    const dd  = menu.querySelector(".dropdown");

    const close = () => {
      menu.dataset.open = "false";
      btn.setAttribute("aria-expanded", "false");
      dd.classList.remove("show");
    };
    const open = () => {
      menu.dataset.open = "true";
      btn.setAttribute("aria-expanded", "true");
      dd.classList.add("show");
    };

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      (menu.dataset.open === "true" ? close : open)();
    });

    // Fecha ao clicar fora
    document.addEventListener("click", close);

    // Acessibilidade: Esc fecha, setas navegam
    btn.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { open(); dd.querySelector("a")?.focus(); }
    });
    dd.addEventListener("keydown", (e) => {
      const items = Array.from(dd.querySelectorAll("a"));
      const i = items.indexOf(document.activeElement);
      if (e.key === "Escape") { close(); btn.focus(); }
      if (e.key === "ArrowDown") { e.preventDefault(); items[(i+1)%items.length]?.focus(); }
      if (e.key === "ArrowUp") { e.preventDefault(); items[(i-1+items.length)%items.length]?.focus(); }
    });
  }

  // Se o usuário está logado, carrega e exibe a contagem do carrinho
  if (user && user.logged_in) {
    updateCartCount().catch(()=>{});
    // Se o app disparar esse evento após alterações no carrinho, o header atualiza
    window.addEventListener('cart:updated', (e) => {
      const maybeCount = e?.detail?.count;
      updateCartCount(maybeCount).catch(()=>{});
    });
  }
}

/**
 * Atualiza o badge do carrinho no header.
 * - Se `forcedCount` for fornecido, usa diretamente;
 * - Caso contrário, consulta /api/carrinho e soma as quantidades.
 */
export async function updateCartCount(forcedCount) {
  const header = document.getElementById('Header');
  if (!header) return;

  const badge = header.querySelector('#cart-count');
  if (!badge) return;

  let count = Number(forcedCount);
  if (!Number.isFinite(count)) {
    try {
      const res = await fetch('/api/carrinho', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      count = (data.items || []).reduce((acc, it) => acc + (it.quantidade || 0), 0);
    } catch (err) {
      console.warn('Não foi possível obter o carrinho:', err);
      count = 0;
    }
  }

  badge.textContent = String(count);
}

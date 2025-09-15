export async function initHeader() {
  const header = document.getElementById('Header');
  if (!header) return;

  let user = null;
  try {
    const resp = await fetch("/me");  // rota do Flask
    user = await resp.json();
  } catch (err) {
    console.error("Erro ao buscar usuário logado", err);
  }

  let actionsHtml = "";
  if (user && user.logged_in) {
    actionsHtml = `
      <span class="welcome">👋 Olá, ${user.username}</span>
      <a href="/logout"><button class="btn">Sair</button></a>
      <a href="PetGoAgendamento.html"><button class="btn primary">Agende um serviço</button></a>
    `;
  } else {
    actionsHtml = `
      <a href="/login"><button class="btn">Entrar</button></a>
      <a href="PetGoAgendamento.html"><button class="btn primary">Agende um serviço</button></a>
    `;
  }

  let html = `
    <a href="/"><div class="logo"><span class="paw">🐾</span> PetGo</div></a>
    <nav>
      <a href="/#inicio">Início</a>
      <a href="/produtos">Produtos</a>
      <a href="/#servicos">Serviços</a>
      <a href="/PetGoAdocao">Adoção</a>
      <a href="/#contato">Contato</a>
    </nav>
    <div class="actions">
      ${actionsHtml}
    </div>
  `;

  header.innerHTML = html;
}

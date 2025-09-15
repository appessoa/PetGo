export function initHeader() {
    const header = document.getElementById('Header');
    if (!header) return;

    let html = `
          <a href= "index.html"><div class="logo"><span class="paw">🐾</span> PetGo</div></a>
      <nav>
        <a href="index.html#inicio">Início</a>
        <a href="produtos.html">Produtos</a>
        <a href="index.html#servicos">Serviços</a>
        <a href="index.html#adocao">Adoção</a>
        <a href="index.html#contato">Contato</a>
      </nav>
      <div class="actions">
        <button class="btn">Entrar</button>
        <a href = "PetGoAgendamento.html"><button class="btn primary">Agende um serviço</button></a>
      </div>`;
    header.innerHTML = html;}
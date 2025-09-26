 export async function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
 
   let html = '';

    html +=
 `<div class="sidebar-header">
      <div class="logo"><span class="paw">🐾</span> PetGo ADM</div>
    </div>
    <nav class="sidebar-nav">
      <ul>
        <li>
          <a href="/adminPage" class="active">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
            <span>Dashboard</span>
          </a>
        </li>
        <li>
          <a href="/vet_page">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            <span>Veterinários</span>
          </a>
        </li>
        <li>
          <a href="/produtosadmin">
             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
            <span>Produtos</span>
          </a>
        </li>
        <li>
          <a href="/histvendas">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8c-3.866 0-7 1.84-7 4s3.134 4 7 4 7-1.84 7-4-3.134-4-7-4z"></path><path d="M12 8v1.45A3.499 3.499 0 0 1 15.5 12M12 8V5"></path><path d="M5.022 10.218A3.5 3.5 0 0 1 8.5 8.514M18.978 10.218A3.5 3.5 0 0 0 15.5 8.514"></path><path d="M12 16a7 7 0 0 0-7 4h14a7 7 0 0 0-7-4z"></path><path d="M12 16v1.45a3.499 3.499 0 0 0 3.5 3.036M12 16v1.45A3.499 3.499 0 0 1 8.5 14.514"></path><path d="M12 20a3.5 3.5 0 0 1-3.5-3.036"></path><path d="M12 20a3.5 3.5 0 0 0 3.5-3.036"></path></svg>
            <span>Histórico de Vendas</span>
          </a>
        </li>
      </ul>
    </nav>`;

    sidebar.innerHTML = html;

 }
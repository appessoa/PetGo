document.addEventListener('DOMContentLoaded', () => {

  // --- LÓGICA PARA MODAIS ACIONADOS PELA TABELA (Ver Histórico, Prontuário, etc.) ---
  const setupTableModals = (openModalButtonsSelector, modalId) => {
    const modal = document.getElementById(modalId);
    const openModalButtons = document.querySelectorAll(openModalButtonsSelector);

    if (modal && openModalButtons.length > 0) {
      const modalTitle = modal.querySelector('h2');
      const closeButtons = modal.querySelectorAll('.close-btn');

      const openModal = (event) => {
        const button = event.currentTarget;
        const tableRow = button.closest('tr');
        
        if (tableRow && tableRow.querySelector('.patient-name')) {
            const petName = tableRow.querySelector('.patient-name').textContent.trim();
            if (modalTitle && modalTitle.id) { // Verifica se o título tem ID antes de tentar mudar
                if (modalTitle.id === 'view-prontuario-title') {
                    modalTitle.textContent = `Prontuário da Consulta de ${petName}`;
                } else if (modalTitle.id === 'view-historico-title') {
                    modalTitle.textContent = `Histórico Completo de ${petName}`;
                } else if (modalTitle.id === 'modal-title') {
                     modalTitle.textContent = `Novo Prontuário para ${petName}`;
                }
            }
        }
        modal.classList.remove('hidden');
      };

      const closeModal = () => {
        modal.classList.add('hidden');
      };

      openModalButtons.forEach(button => button.addEventListener('click', openModal));
      closeButtons.forEach(button => button.addEventListener('click', closeModal));
      modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
    }
  };

  // --- LÓGICA PARA O MODAL 'ADICIONAR PACIENTE' (BOTÃO FIXO) ---
  const setupAddPatientModal = () => {
      const openBtn = document.getElementById('open-add-paciente-modal');
      const modal = document.getElementById('add-paciente-modal');

      if (openBtn && modal) {
          const closeButtons = modal.querySelectorAll('.close-btn');
          const open = () => modal.classList.remove('hidden');
          const close = () => modal.classList.add('hidden');

          openBtn.addEventListener('click', open);
          closeButtons.forEach(btn => btn.addEventListener('click', close));
          modal.addEventListener('click', (event) => { if (event.target === modal) close(); });
      }
  };

  // --- CONFIGURAÇÃO DE TODOS OS MODAIS ---
  setupTableModals('.open-prontuario-modal', 'prontuario-modal');
  setupTableModals('.open-view-prontuario-modal', 'view-prontuario-modal');
  setupTableModals('.open-view-historico-modal', 'view-historico-modal');
  setupAddPatientModal(); // Chama a nova função específica

  // --- LÓGICA PARA FECHAR MODAIS COM A TECLA "ESCAPE" ---
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(modal => modal.classList.add('hidden'));
    }
  });

  // --- LÓGICA PARA O ACORDEÃO NO MODAL DE HISTÓRICO ---
  const historyAccordion = document.querySelector('.history-accordion');
  if(historyAccordion) {
    const historyItems = historyAccordion.querySelectorAll('.history-item');
    historyItems.forEach(item => {
        const header = item.querySelector('.history-item-header');
        header.addEventListener('click', () => { item.classList.toggle('is-open'); });
    });
  }

  // --- LÓGICA DA PAGINAÇÃO ---
  const paginationContainer = document.querySelector('.pagination');
  if (paginationContainer) {
    const prevButton = document.getElementById('prev-page');
    const nextButton = document.getElementById('next-page');
    const pageNumberLinks = paginationContainer.querySelectorAll('a:not(#prev-page):not(#next-page)');
    let currentPageIndex = Array.from(pageNumberLinks).findIndex(link => link.classList.contains('current'));

    const updatePagination = () => {
      pageNumberLinks.forEach((link, index) => {
        link.classList.toggle('current', index === currentPageIndex);
      });
      prevButton.classList.toggle('disabled', currentPageIndex === 0);
      nextButton.classList.toggle('disabled', currentPageIndex === pageNumberLinks.length - 1);
    };

    nextButton.addEventListener('click', (e) => {
      e.preventDefault();
      if (currentPageIndex < pageNumberLinks.length - 1) {
        currentPageIndex++;
        updatePagination();
      }
    });

    prevButton.addEventListener('click', (e) => {
      e.preventDefault();
      if (currentPageIndex > 0) {
        currentPageIndex--;
        updatePagination();
      }
    });
    
    pageNumberLinks.forEach((link, index) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        currentPageIndex = index;
        updatePagination();
      });
    });

    updatePagination();
  }
});
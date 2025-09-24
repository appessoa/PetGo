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
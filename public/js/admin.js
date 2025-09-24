// Adicione este código ao seu arquivo admin.js

document.addEventListener('DOMContentLoaded', () => {
  const openModalBtn = document.getElementById('open-vet-modal-btn');
  const modal = document.getElementById('vet-modal');
  
  // Verifica se os elementos existem antes de adicionar os eventos
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
});
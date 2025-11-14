import { initHeader } from './header.js';
import { showToast } from './utils/toast.js';

let IS_LOGGED_IN = false;

document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  checkLoginStatus();
  setupBotoesAdocao();
});

async function checkLoginStatus() {
  try {
    const res = await fetch('/me', {
      credentials: 'include'
    });

    const data = await res.json().catch(() => ({}));

    // sua API retorna { logged_in: true/false, ... }
    IS_LOGGED_IN = data.logged_in === true;
    console.log('Login status:', IS_LOGGED_IN, data);
  } catch (err) {
    console.warn('Erro ao verificar login:', err);
    IS_LOGGED_IN = false;
  }
}

function setupBotoesAdocao() {
  const botoesAdotar = document.querySelectorAll('.card .btn.primary');

  botoesAdotar.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (!IS_LOGGED_IN) {
        // usuário NÃO logado → avisa e redireciona
        showToast(
          'Você precisa estar logado para entrar na fila de adoção. Redirecionando para o login...',
          'error'
        );

        const loginUrl = `/login?next=${encodeURIComponent(window.location.pathname)}`;

        setTimeout(() => {
          window.location.href = loginUrl;
        }, 3000); // tempo pro usuário ler a mensagem
        return;
      }

      // usuário logado → só mostra a mensagem de fila de adoção
      showToast(
        'Você está na fila de adoção para esse pet, espere o nosso contato.',
        'success'
      );
    });
  });
}

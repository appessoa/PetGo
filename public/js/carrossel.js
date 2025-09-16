// Aguarda o conteúdo da página ser totalmente carregado
document.addEventListener('DOMContentLoaded', function () {

  // Inicializa o Swiper para o carrossel de serviços
  const servicesSwiper = new Swiper('.myServicesSwiper', {
    
    // Configurações principais
    loop: true, // Opcional: faz o carrossel girar em loop
    spaceBetween: 20, // Espaço em pixels entre cada card

    // // Paginação (as bolinhas embaixo)
    // pagination: {
    //   el: '.swiper-pagination',
    //   clickable: true, // Permite clicar nas bolinhas para navegar
    // },

    // Setas de Navegação
    navigation: {
      nextEl: '.swiper-button-next',
      prevEl: '.swiper-button-prev',
    },

    // Design Responsivo: muda a quantidade de slides dependendo do tamanho da tela
    breakpoints: {
      // Quando a tela for 640px ou maior, mostra 2 slides
      640: {
        slidesPerView: 2,
        spaceBetween: 20,
      },
      // Quando a tela for 1024px ou maior, mostra 3 slides
      1024: {
        slidesPerView: 3,
        spaceBetween: 30,
      },
    }
  });

});
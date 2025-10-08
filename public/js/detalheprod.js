document.addEventListener('DOMContentLoaded', function() {
            // --- LÓGICA DA GALERIA DE IMAGENS ---
            const mainImage = document.getElementById('mainProductImage');
            const thumbnails = document.querySelectorAll('.thumbnails img');

            thumbnails.forEach(thumb => {
                thumb.addEventListener('click', function() {
                    // Remove a classe 'active' de todas as thumbnails
                    thumbnails.forEach(t => t.classList.remove('active'));
                    
                    // Adiciona a classe 'active' na thumbnail clicada
                    this.classList.add('active');
                    
                    // Troca a imagem principal
                    mainImage.src = this.src;
                });
            });

            // --- LÓGICA DO SELETOR DE QUANTIDADE ---
            const decreaseBtn = document.getElementById('decrease-qty');
            const increaseBtn = document.getElementById('increase-qty');
            const quantityInput = document.getElementById('quantity-input');

            decreaseBtn.addEventListener('click', function() {
                let currentValue = parseInt(quantityInput.value);
                if (currentValue > 1) {
                    quantityInput.value = currentValue - 1;
                }
            });

            increaseBtn.addEventListener('click', function() {
                let currentValue = parseInt(quantityInput.value);
                quantityInput.value = currentValue + 1;
            });
        });
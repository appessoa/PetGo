document.addEventListener('DOMContentLoaded', () => {
        const nextButtons = document.querySelectorAll('.next-step');
        const prevButtons = document.querySelectorAll('.prev-step');
        const formSteps = document.querySelectorAll('.form-step-content');
        const progressSteps = document.querySelectorAll('.progress-step');

        nextButtons.forEach(button => {
            button.addEventListener('click', () => {
                const currentStepIndex = parseInt(button.dataset.step) - 1;
                const currentStepContent = formSteps[currentStepIndex];
                const inputs = currentStepContent.querySelectorAll('[required]');
                let allInputsValid = true;

                // Valida os campos antes de avançar
                inputs.forEach(input => {
                    if (!input.checkValidity()) {
                        allInputsValid = false;
                        input.reportValidity(); // Mostra a mensagem de erro do navegador
                    }
                });

                if (allInputsValid) {
                    // Esconde o passo atual
                    formSteps[currentStepIndex].classList.remove('active');
                    progressSteps[currentStepIndex].classList.remove('active');
                    progressSteps[currentStepIndex].classList.add('completed');

                    // Mostra o próximo passo
                    const nextStepIndex = currentStepIndex + 1;
                    if (formSteps[nextStepIndex]) {
                        formSteps[nextStepIndex].classList.add('active');
                        progressSteps[nextStepIndex].classList.add('active');
                    }
                }
            });
        });

        prevButtons.forEach(button => {
            button.addEventListener('click', () => {
                const currentStepIndex = parseInt(button.dataset.step) - 1;

                // Esconde o passo atual
                formSteps[currentStepIndex].classList.remove('active');
                progressSteps[currentStepIndex].classList.remove('active');

                // Mostra o passo anterior
                const prevStepIndex = currentStepIndex - 1;
                if (formSteps[prevStepIndex]) {
                    formSteps[prevStepIndex].classList.add('active');
                    progressSteps[prevStepIndex].classList.remove('completed');
                    progressSteps[prevStepIndex].classList.add('active');
                }
            });
        });

        // Lógica para o campo de telas de proteção, baseada no tipo de residência
        const residenciaSelect = document.getElementById('residencia_tipo');
        const telasProtecaoGroup = document.getElementById('telas-protecao-group');
        const telasProtecaoSelect = document.getElementById('telas_protecao');

        if (residenciaSelect && telasProtecaoGroup) {
            residenciaSelect.addEventListener('change', () => {
                if (residenciaSelect.value === 'Apartamento') {
                    telasProtecaoGroup.style.display = 'flex';
                    telasProtecaoSelect.setAttribute('required', 'true');
                } else {
                    telasProtecaoGroup.style.display = 'none';
                    telasProtecaoSelect.removeAttribute('required');
                }
            });
        }


        const sociabilidadeSlider = document.getElementById('sociabilidade');
    const sociabilidadeValue = document.getElementById('sociabilidade-value');

    const brincadeiraSlider = document.getElementById('brincadeira');
    const brincadeiraValue = document.getElementById('brincadeira-value');

    const carinhoSlider = document.getElementById('carinho');
    const carinhoValue = document.getElementById('carinho-value');

    // Funções para atualizar os valores
    function updateSliderValue(slider, valueElement) {
        valueElement.textContent = slider.value;
    }

    // Adiciona o "ouvinte" de eventos para cada barra
    if (sociabilidadeSlider) {
        sociabilidadeSlider.addEventListener('input', () => {
            updateSliderValue(sociabilidadeSlider, sociabilidadeValue);
        });
    }

    if (brincadeiraSlider) {
        brincadeiraSlider.addEventListener('input', () => {
            updateSliderValue(brincadeiraSlider, brincadeiraValue);
        });
    }

    if (carinhoSlider) {
        carinhoSlider.addEventListener('input', () => {
            updateSliderValue(carinhoSlider, carinhoValue);
        });
    }
    });
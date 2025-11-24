// Importações necessárias
import { initHeader } from './header.js';
import { showToast } from './utils/toast.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Inicializa o Header (se necessário)
    initHeader();
    
    const form = document.querySelector('form');
    const submitBtn = form.querySelector('button[type="submit"]');
    const pageTitle = document.querySelector('.section-title');

    // Ativa busca automática de CEP
    setupCepAutoFill(); 

    // 1. Verificar se é edição (ID na URL)
    const urlParams = new URLSearchParams(window.location.search);
    const addressId = urlParams.get('id');

    let currentUserId = null;

    // Obter ID do usuário logado
    try {
        const userRes = await fetch('/api/me');
        if(userRes.ok) {
            const userData = await userRes.json();
            currentUserId = userData.id;
        } else {
            // Se não estiver logado, avisa e talvez redirecione
            showToast("Sessão expirada. Faça login novamente.", "error");
        }
    } catch (e) {
        console.error("Erro de autenticação", e);
    }

    // 2. Se for Edição, buscar dados e preencher
    if (addressId && currentUserId) {
        pageTitle.textContent = "Editar Endereço";
        submitBtn.textContent = "Salvar Alterações";
        
        try {
            const res = await fetch(`/api/users/${currentUserId}/addresses/${addressId}`);
            if (res.ok) {
                const data = await res.json();
                fillForm(data);
            } else {
                showToast("Endereço não encontrado.", "error");
            }
        } catch (error) {
            console.error("Erro ao buscar endereço", error);
            showToast("Erro ao carregar dados do endereço.", "error");
        }
    }

    // 3. Envio do formulário (Cadastrar ou Atualizar)
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // COLETA DOS DADOS
        const payload = {
            nomeEntrega: document.getElementById('destinatario').value,
            cep: document.getElementById('cep').value.replace(/\D/g, ''),
            estado: document.getElementById('estado').value,
            logradouro: document.getElementById('endereco').value,
            numero: document.getElementById('numero').value,
            complemento: document.getElementById('complemento').value,
            bairro: document.getElementById('bairro').value,
            cidade: document.getElementById('cidade').value,
            pontoRef: document.getElementById('referencia').value
        };

        // Trava o botão e muda o texto
        submitBtn.disabled = true;
        submitBtn.textContent = "Processando...";
        
        let responseOk = false; // Flag para controlar o finally

        try {
            let url, method;
            let successMessage;

            if (addressId) {
                // ATUALIZAR
                url = `/api/users/${currentUserId}/addresses/${addressId}`;
                method = 'PATCH';
                successMessage = "Endereço atualizado com sucesso!";
            } else {
                // CRIAR
                url = `/api/users/${currentUserId}/addresses`;
                method = 'POST';
                successMessage = "Endereço cadastrado com sucesso!";
            }

            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            responseOk = response.ok;

            if (response.ok) {
                // SUCESSO: Mostra Toast e espera para redirecionar
                showToast(successMessage, "success"); // Assumindo que seu toast aceita o tipo "success"
                
                submitBtn.textContent = "Redirecionando...";

                setTimeout(() => {
                    // Volta para a tela anterior (lista de endereços)
                    window.history.back();
                }, 1500); // Espera 1.5 segundos

            } else {
                // ERRO DA API
                const err = await response.json();
                showToast(err.message || 'Erro ao processar solicitação.', "error");
            }

        } catch (error) {
            console.error(error);
            showToast('Erro de conexão com o servidor.', "error");
        } finally {
            // Só reabilita o botão se DEU ERRO. 
            // Se deu sucesso, mantemos desabilitado até a página mudar.
            if (!responseOk) {
                submitBtn.disabled = false;
                submitBtn.textContent = addressId ? "Salvar Alterações" : "Salvar";
            }
        }
    });
});

// FUNÇÃO PARA PREENCHER FORMULÁRIO NA EDIÇÃO
function fillForm(data) {
    if(data.cep) document.getElementById('cep').value = data.cep;
    if(data.estado) document.getElementById('estado').value = data.estado;
    if(data.logradouro) document.getElementById('endereco').value = data.logradouro;
    if(data.numero) document.getElementById('numero').value = data.numero;
    if(data.complemento) document.getElementById('complemento').value = data.complemento;
    if(data.bairro) document.getElementById('bairro').value = data.bairro;
    if(data.cidade) document.getElementById('cidade').value = data.cidade;

    if(data.nomeEntrega) document.getElementById('destinatario').value = data.nomeEntrega;
    if(data.pontoRef) document.getElementById('referencia').value = data.pontoRef;
}

// FUNÇÃO VIACEP
function setupCepAutoFill() {
    const cepInput = document.getElementById('cep');
    if(!cepInput) return;

    cepInput.addEventListener('input', async (e) => {
        const rawValue = e.target.value.replace(/\D/g, '');
        
        if (rawValue.length === 8) {
            const endInput = document.getElementById('endereco');
            const placeholderOriginal = endInput.placeholder;
            endInput.placeholder = "Buscando...";
            
            try {
                const response = await fetch(`https://viacep.com.br/ws/${rawValue}/json/`);
                const data = await response.json();

                if (!data.erro) {
                    document.getElementById('endereco').value = data.logradouro;
                    document.getElementById('bairro').value = data.bairro;
                    document.getElementById('cidade').value = data.localidade;
                    document.getElementById('estado').value = data.uf;
                    document.getElementById('numero').focus();
                    
                    showToast("CEP encontrado!", "success"); // Feedback visual opcional
                } else {
                    showToast("CEP não encontrado.", "error");
                }
            } catch (error) {
                console.error("Erro ao buscar CEP", error);
            } finally {
                 endInput.placeholder = placeholderOriginal;
            }
        }
    });
}
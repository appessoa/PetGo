// Importações necessárias
import { initHeader } from './header.js';
import { showToast } from './utils/toast.js';

document.addEventListener('DOMContentLoaded', async () => {
    initHeader(); // Inicializa o cabeçalho dinâmico
    await loadAddresses();
});

// Variável global para armazenar o ID do usuário
let currentUserId = null;

async function loadAddresses() {
    const addressGrid = document.querySelector('.address-grid');
    
    // Botão de adicionar (HTML fixo)
    const addNewBtnHTML = `
        <a href="/adress/cadastro" class="add-new-card">
            <div class="icon-plus">+</div>
            <span style="font-weight: 600;">Adicionar novo endereço</span>
        </a>
    `;

    try {
        // 1. Pega o usuário logado
        const userResponse = await fetch('/api/me');
        if (!userResponse.ok) {
            // Se a sessão expirou, redireciona
            window.location.href = '/login';
            return;
        }
        const userData = await userResponse.json();
        currentUserId = userData.id; 

        // 2. Busca endereços
        const addressResponse = await fetch(`/api/users/${currentUserId}/addresses`);
        if (!addressResponse.ok) throw new Error('Erro ao buscar endereços');

        const addresses = await addressResponse.json();

        addressGrid.innerHTML = '';

        if (!addresses || addresses.length === 0) {
            addressGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Nenhum endereço cadastrado.</p>';
        } else {
            addresses.forEach((addr, index) => {
                addressGrid.appendChild(createAddressCard(addr, index));
            });
        }

        addressGrid.insertAdjacentHTML('beforeend', addNewBtnHTML);
        setupCardSelectionEvents();

    } catch (error) {
        console.error('Erro:', error);
        addressGrid.innerHTML = '<p>Erro ao carregar endereços.</p>' + addNewBtnHTML;
        showToast("Erro ao carregar seus endereços.", "error");
    }
}

function createAddressCard(addr, index) {
    const label = document.createElement('label');
    label.className = 'address-card';
    
    const isChecked = addr.is_primary ? 'checked' : (index === 0 ? 'checked' : '');
    const cepFormatado = addr.cep.replace(/^(\d{5})(\d{3})/, "$1-$2");

    // Botões de Ação
    const actionButtons = `
        <div class="card-actions" style="display: flex; gap: 10px; margin-top: 10px; border-top: 1px solid #eee; padding-top: 8px;">
            <button type="button" onclick="editAddress('${addr.id}', event)" style="background: none; border: none; color: #2563eb; cursor: pointer; font-size: 0.85rem; font-weight: 600;">Editar</button>
            <button type="button" onclick="deleteAddress('${addr.id}', event)" style="background: none; border: none; color: #dc2626; cursor: pointer; font-size: 0.85rem; font-weight: 600;">Excluir</button>
        </div>
    `;

    // HTML DO CARD
    label.innerHTML = `
        <input type="radio" name="address_id" value="${addr.id}" ${isChecked}>
        <div class="card-details">
            <div class="card-header">
                <span class="address-title">${addr.logradouro}, ${addr.numero}</span>
                ${addr.is_primary ? '<span class="badge-primary" style="background:var(--primary); color:white; padding:2px 6px; border-radius:4px; font-size:0.75rem; margin-left:8px;">Principal</span>' : ''}
            </div>
            
            ${addr.nomeEntrega ? `<p style="color: #333; font-weight: 600; margin-bottom: 4px;">Receber: ${addr.nomeEntrega}</p>` : ''}

            <p>${addr.bairro} - ${addr.cidade}/${addr.estado}</p>
            <p>CEP: ${cepFormatado}</p>
            ${addr.complemento ? `<p style="color:var(--muted); font-size:0.9rem">Comp: ${addr.complemento}</p>` : ''}
            
            ${actionButtons}
        </div>
        <div class="check-icon"></div> 
    `;

    if (isChecked) label.classList.add('selected');
    return label;
}

// Funções Globais para serem acessadas pelo onclick (necessário pois é type="module")
window.editAddress = (id, event) => {
    event.preventDefault(); 
    window.location.href = `/adress/cadastro?id=${id}`; 
};

window.deleteAddress = async (id, event) => {
    event.preventDefault();
    event.stopPropagation(); 

    // Mantive o confirm nativo pois é uma ação destrutiva rápida
    if(!confirm("Tem certeza que deseja excluir este endereço?")) return;

    try {
        const response = await fetch(`/api/users/${currentUserId}/addresses/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showToast('Endereço excluído com sucesso!', 'success');
            loadAddresses(); // Recarrega a lista para atualizar a tela
        } else {
            showToast('Erro ao excluir endereço.', 'error');
        }
    } catch (error) {
        console.error('Erro ao excluir:', error);
        showToast('Erro de conexão ao excluir.', 'error');
    }
};

function setupCardSelectionEvents() {
    const inputs = document.querySelectorAll('.address-card input[type="radio"]');
    inputs.forEach(input => {
        input.addEventListener('change', (e) => {
            document.querySelectorAll('.address-card').forEach(c => c.classList.remove('selected'));
            e.target.closest('.address-card').classList.add('selected');
        });
    });
}
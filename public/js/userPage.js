import { initHeader } from './header.js';

document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  boot();
});

async function boot(){
  try{
    const me = await fetchJSON('/api/me');
    renderProfile(me);

    const pets = await fetchJSON('/api/me/pets');
    renderPets(pets);

    const orders = await fetchJSON('/api/me/orders');
    renderOrders(orders);

    wireActions(me);
  }catch(e){
    console.error(e);
    alert('Faça login para ver sua conta.');
    location.href = '/login';
  }
}

async function fetchJSON(url, opts={}){
  const r = await fetch(url, { credentials: 'include', ...opts });
  if(!r.ok) {
    let msg = 'Erro';
    try { const j = await r.json(); msg = j.error || JSON.stringify(j); } catch {}
    throw new Error(`${r.status}: ${msg}`);
  }
  return r.json();
}
function ageFromDOB(dob){
  if(!dob) return 'idade desconhecida';
  const b = new Date(dob);
  const now = new Date();
  let years = now.getFullYear() - b.getFullYear();
  let months = now.getMonth() - b.getMonth();
  if (now.getDate() < b.getDate()) months -= 1;
  if (months < 0) { years -= 1; months += 12; }
  if (years > 0) return `${years} ano(s) e ${months} mes(es)`;
  return `${months} mes(es)`;
}
function renderProfile(me){
  // Nome, email, membro desde
  const card = document.querySelector('.profile-card .profile-info');
  if(!card) return;
  card.querySelector('h2').textContent = me.nome || 'Usuário';
  const pTags = card.querySelectorAll('p');
  if(pTags[0]) pTags[0].textContent = `Email: ${me.email || '-'}`;
  if(pTags[1]){
    const dt = me.created_at ? new Date(me.created_at) : null;
    const mes = dt ? dt.toLocaleDateString('pt-BR', { month:'long', year:'numeric' }) : '-';
    pTags[1].textContent = `Membro desde: ${mes}`;
  }

  // Preenche seção "Minhas informações" se existir no back
  // (ajuste os seletores para seu HTML real)
   document.querySelector('.info-grid').innerHTML = `
    <div class="info-item"><strong>Nome:</strong> ${escapeHtml(me.nome || '-') }</div>
    <div class="info-item"><strong>Email:</strong> ${escapeHtml(me.email || '-') }</div>
    <div class="info-item"><strong>CPF:</strong> ${escapeHtml(me.cpf || '-') }</div>
    <div class="info-item"><strong>Telefone:</strong> ${escapeHtml(me.numero || '-') }</div>
    <div class="info-item"><strong>Endereço:</strong> ${escapeHtml(me.endereco || '-') }</div>
    `;
}

function renderPets(pets){
  const grid = document.querySelector('.pets-grid');
  if(!grid) return;
  grid.innerHTML = '';
  if(!pets || !pets.length){
    grid.innerHTML = '<div class="info-item">Você ainda não adotou pets.</div>';
    return;
  }
  for(const p of pets){
    const img = p.photo || defaultAvatar(p.breed);
    const el = document.createElement('div');
    el.className = 'pet-card';
    el.innerHTML = `
      <img src="${img}" alt="${escapeHtml(p.name || p.nome)}">
      <div class="pet-body">
        <h4>${escapeHtml(p.name || p.nome)}</h4>
        <p>
        ${escapeHtml(p.species || '')}
        ${p.species && (p.breed || p.raca) ? ' - ' : ''}
        ${escapeHtml(p.breed || p.raca || '')}
        </p>
        <p>
        ${ageFromDOB(p.dob)}
        ${p.weight ? ` - ${p.weight} kg` : ''}
        </p>

      </div>
    `;
    grid.appendChild(el);
  }
}

function renderOrders(orders){
  const list = document.querySelector('.orders-list');
  if(!list) return;
  list.innerHTML = '';
  if(!orders || !orders.length){
    list.innerHTML = '<div class="info-item">Você ainda não possui pedidos.</div>';
    return;
  }
  for(const o of orders){
    const dt = o.created_at ? new Date(o.created_at).toLocaleDateString('pt-BR') : '';
    const itens = (o.items || []).map(i => `${i.produto} (${i.qtd})`).join(', ');
    const statusClass = o.status === 'concluido' ? 'status-concluido'
                      : o.status === 'andamento' ? 'status-andamento'
                      : '';
    const el = document.createElement('div');
    el.className = 'order-item';
    el.innerHTML = `
      <div class="order-info">
        <strong>Pedido #${o.id}</strong>
        <span>Data: ${dt} — Total: R$ ${Number(o.total || 0).toFixed(2)}</span>
        <span>Itens: ${escapeHtml(itens)}</span>
      </div>
      <div class="order-status ${statusClass}">${o.status || ''}</div>
    `;
    list.appendChild(el);
  }
}

// Ações: editar perfil & alterar senha
function wireActions(me){
  const [btnEditar, btnSenha] = document.querySelectorAll('.account-actions .btn');
  if(btnEditar){
    btnEditar.addEventListener('click', async ()=>{
      const username = prompt('Novo nome de usuário:', me.username || '');
      const email = prompt('Novo e-mail:', me.email || '');
      if(username === null && email === null) return;
      try{
        const updated = await fetchJSON('/api/me', {
          method:'PUT',
          headers:{'Content-Type':'application/json'},
          credentials:'include',
          body: JSON.stringify({ username, email })
        });
        renderProfile(updated);
        alert('Perfil atualizado!');
      }catch(e){ alert(e.message); }
    });
  }
  if(btnSenha){
    btnSenha.addEventListener('click', async ()=>{
      const oldpw = prompt('Senha atual:');
      if(oldpw === null) return;
      const newpw = prompt('Nova senha (mín. 6 caracteres):');
      if(newpw === null) return;
      try{
        await fetchJSON('/api/me/password', {
          method:'PUT',
          headers:{'Content-Type':'application/json'},
          credentials:'include',
          body: JSON.stringify({ old_password: oldpw, new_password: newpw })
        });
        alert('Senha alterada com sucesso!');
      }catch(e){ alert(e.message); }
    });
  }
  // Excluir conta — só se você criar a rota; por enquanto desabilite/oculte
}

function defaultAvatar(breed){
  const b = (breed || '').toLowerCase();
  if(b.includes('gato')) return 'https://placekitten.com/400/250';
  if(b.includes('cach') || b.includes('dog')) return 'https://placedog.net/400/250';
  return 'https://placehold.co/400x250?text=PET';
}

function escapeHtml(s){
  if(!s) return '';
  return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
}

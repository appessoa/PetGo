(async function() {
  // ---------- CONFIG ----------
  const API_ADDRS = '/api/users/addresses'; // lista e create
  const EDIT_ADDRESS_URL_BASE = '/adress/cadastro'; // ajuste se necessário
  // Opcional: injete token CSRF via template: <meta name="csrf-token" content="{{ csrf_token() }}">
  const CSRF_TOKEN = window.CSRF_TOKEN || document.querySelector('meta[name="csrf-token"]')?.content || null;
  const API_TOKEN = window.API_TOKEN || null; // se usar JWT
  // ----------------------------

  const addressGrid = document.querySelector('.address-grid');
  if (!addressGrid) return;

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function buildCard(addr) {
    const label = document.createElement('label');
    label.className = 'address-card';
    label.dataset.addressId = addr.id;

    // badge PRINCIPAL
    const badge = addr.is_primary ? `<span class="badge-primary" title="Endereço principal">PRINCIPAL</span>` : '';

    label.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; width:100%">
        <div style="display:flex; align-items:center; gap:8px">
          <input type="radio" name="endereco_selecionado" value="${addr.id}" ${addr.is_primary ? 'checked' : ''}>
          <span class="address-tag">${escapeHtml(addr.tag || '')}</span>
        </div>
        ${badge}
      </div>
      <h4>${escapeHtml(addr.nome || '')}</h4>
      <p>${escapeHtml(addr.logradouro || '')}${addr.numero ? ', ' + escapeHtml(addr.numero) : ''}</p>
      ${addr.complemento ? `<p>${escapeHtml(addr.complemento)}</p>` : ''}
      <p>${escapeHtml(addr.bairro || '')}${addr.cidade ? ', ' + escapeHtml(addr.cidade) : ''} ${addr.estado ? '- ' + escapeHtml(addr.estado) : ''}</p>
      <p>CEP: ${escapeHtml(addr.cep || '')}</p>
      <a href="/adress/cadastro?id=${addr.id}" style="margin-top:10px; color:var(--primary); font-size:14px; font-weight:600;">Editar</a>
    `;
    return label;
  }

  function showLoading() {
    addressGrid.innerHTML = '<div class="loading">Carregando endereços...</div>';
  }
  function showError(msg) {
    addressGrid.innerHTML = `<div class="error" style="color:red">${escapeHtml(msg)}</div>`;
  }

  async function fetchAddresses() {
    showLoading();
    try {
      const headers = { 'Accept': 'application/json' };
      if (API_TOKEN) headers['Authorization'] = 'Bearer ' + API_TOKEN;
      const res = await fetch(API_ADDRS, { method: 'GET', headers, credentials: 'same-origin' });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Status ${res.status}: ${text}`);
      }
      return await res.json();
    } catch (err) {
      console.error(err);
      showError('Não foi possível carregar seus endereços. Tente novamente mais tarde.');
      return null;
    }
  }

  function renderAddresses(addresses) {
    addressGrid.innerHTML = '';
    if (!addresses || addresses.length === 0) {
      addressGrid.innerHTML = `
        <div class="no-addresses" style="grid-column:1/-1; text-align:center; padding:20px;">
          Você ainda não tem endereços salvos.
          <div style="margin-top:10px;"><a href="/adress/cadastro'" class="add-new-card">Adicionar novo endereço</a></div>
        </div>`;
      return;
    }

    addresses.forEach(addr => addressGrid.appendChild(buildCard(addr)));

    const addCard = document.createElement('a');
    addCard.href = '/adress/cadastro';
    addCard.className = 'add-new-card';
    addCard.innerHTML = `<div class="icon-plus">+</div><span style="font-weight: 600;">Adicionar novo endereço</span>`;
    addressGrid.appendChild(addCard);

    const radios = addressGrid.querySelectorAll('input[type="radio"][name="endereco_selecionado"]');
    radios.forEach(radio => radio.addEventListener('change', onAddressChange));
  }

  // chama rota POST /api/users/addresses/:addrId/primary
  async function setPrimaryAddress(addrId) {
    const url = `${API_ADDRS}/${addrId}/primary`;
    try {
      const headers = { 'Accept': 'application/json' };
      if (CSRF_TOKEN) headers['X-CSRFToken'] = CSRF_TOKEN; // ou X-CSRF-Token conforme sua config
      if (API_TOKEN) headers['Authorization'] = 'Bearer ' + API_TOKEN;
      const res = await fetch(url, { method: 'POST', headers, credentials: 'same-origin' });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Erro ao definir primary: ${res.status} ${text}`);
      }
      return await res.json();
    } catch (err) {
      console.error(err);
      alert('Não foi possível definir o endereço como principal no servidor. Tente novamente.');
      return null;
    }
  }

  async function onAddressChange(e) {
    const selectedId = e.target.value;

    // otimista: atualiza UI local
    document.querySelectorAll('.address-card').forEach(c => {
      c.classList.remove('primary-address', 'selected');
      c.querySelector('input[type="radio"]').checked = false;
      // remove badge se existir
      const b = c.querySelector('.badge-primary');
      if (b) b.remove();
    });
    const card = e.target.closest('.address-card');
    if (card) {
      card.classList.add('selected');
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
      // adiciona badge temporária
      const badgeEl = document.createElement('span');
      badgeEl.className = 'badge-primary';
      badgeEl.textContent = 'PRINCIPAL';
      badgeEl.title = 'Endereço principal';
      badgeEl.style.marginLeft = '8px';
      card.querySelector('div').appendChild(badgeEl);
    }

    // confirma no backend
    const updated = await setPrimaryAddress(selectedId);
    if (updated && updated.id) {
      // aplica estilo definitivo apenas no card atualizado
      document.querySelectorAll('.address-card').forEach(c => {
        if (String(c.dataset.addressId) === String(updated.id)) {
          c.classList.add('primary-address');
          const radio = c.querySelector('input[type="radio"]'); if (radio) radio.checked = true;
          // ensure badge present
          if (!c.querySelector('.badge-primary')) {
            const b = document.createElement('span');
            b.className = 'badge-primary';
            b.textContent = 'PRINCIPAL';
            b.title = 'Endereço principal';
            c.querySelector('div').appendChild(b);
          }
        } else {
          c.classList.remove('primary-address');
          const r = c.querySelector('input[type="radio"]'); if (r) r.checked = false;
          const b = c.querySelector('.badge-primary'); if (b) b.remove();
        }
      });
    } else {
      // se falhar, opcional: recarrega lista para voltar ao estado real
      const fresh = await fetchAddresses();
      if (fresh) renderAddresses(fresh);
    }
  }

  // validação no submit do form
  const form = document.querySelector('form[action="/checkout"]');
  if (form) {
    form.addEventListener('submit', (ev) => {
      const selected = form.querySelector('input[name="endereco_selecionado"]:checked');
      if (!selected) {
        ev.preventDefault();
        alert('Selecione um endereço de entrega antes de continuar.');
      }
    });
  }

  // execução
  const addresses = await fetchAddresses();
  if (addresses) renderAddresses(addresses);
})();

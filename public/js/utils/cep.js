(function () {
  const $cep = document.getElementById('cep');
  const $endereco = document.getElementById('endereco');
  const $bairro = document.getElementById('bairro');
  const $cidade = document.getElementById('cidade');
  const $estado = document.getElementById('estado');
  const $help = document.getElementById('cep-help');


  const help = (() => {
    // usa a help-text do CEP se existir; senão, cria uma
    let h = $cep.parentElement.querySelector('.help-text');
    if (!h) {
      h = document.createElement('p');
      h.className = 'help-text';
      $cep.parentElement.appendChild(h);
    }
    return h;
  })();

  // bloqueia edição manual dos campos auto
  [$endereco, $bairro, $cidade, $estado].forEach(el => el && el.setAttribute('disabled', 'disabled'));

  // máscara simples: XXXXX-XXX (sem plugins)
  $cep.addEventListener('input', (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
    if (digits.length > 5) {
      e.target.value = digits.slice(0, 5) + '-' + digits.slice(5);
    } else {
      e.target.value = digits;
    }
  });

  // tenta buscar ao sair do campo (blur) ou quando completar 8 dígitos
  $cep.addEventListener('blur', tryFetch);
  $cep.addEventListener('keyup', (e) => {
    const digits = e.target.value.replace(/\D/g, '');
    if (digits.length === 8) tryFetch();
  });

  async function tryFetch() {
    const raw = $cep.value.replace(/\D/g, '');
    clearAddress();

    if (raw.length !== 8) {
      setHelp('Digite um CEP válido com 8 dígitos (ex.: 01001-000).');
      return;
    }

    setLoading(true);
    setHelp('Buscando endereço pelo CEP…');

    try {
      const resp = await fetch(`https://viacep.com.br/ws/${raw}/json/`, { cache: 'no-store' });
      if (!resp.ok) throw new Error('Falha na consulta do CEP.');
      const data = await resp.json();

      if (data.erro) {
        setHelp('CEP não encontrado. Verifique e tente novamente.');
        setLoading(false);
        return;
      }

      // Preenche somente o que você pediu + UF para não quebrar o required
      fill($endereco, [data.logradouro, data.complemento].filter(Boolean).join(' ').trim() || data.logradouro || '');
      fill($bairro, data.bairro || '');
      fill($cidade, data.localidade || '');

      // UF (estado) – necessário porque seu select é required
      if ($estado) {
        $estado.value = data.uf || '';
        // garante que o select fica realmente selecionado mesmo estando disabled
        if (!$estado.value && data.uf) {
          const opt = [...$estado.options].find(o => o.value === data.uf);
          if (opt) opt.selected = true;
        }
      }

      setHelp('Endereço preenchido automaticamente. Confira antes de continuar.');
    } catch (err) {
      setHelp('Não foi possível buscar o CEP agora. Tente novamente ou preencha manualmente.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function fill(el, value) {
    if (!el) return;
    el.value = value || '';
  }

  function clearAddress() {
    fill($endereco, '');
    fill($bairro, '');
    fill($cidade, '');
    if ($estado) $estado.value = '';
  }

  function setLoading(isLoading) {
    if (isLoading) {
      $cep.setAttribute('aria-busy', 'true');
    } else {
      $cep.removeAttribute('aria-busy');
    }
  }

  function setHelp(msg){ if ($help) $help.textContent = msg || ''; }

})();

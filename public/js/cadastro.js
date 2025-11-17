import { showToast } from "./utils/toast.js";

/* ---------- máscaras ---------- */
function maskCPF(value) {
  value = value.replace(/\D/g, "");
  value = value.substring(0, 11);
  if (value.length > 9) {
    value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, "$1.$2.$3-$4");
  } else if (value.length > 6) {
    value = value.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
  } else if (value.length > 3) {
    value = value.replace(/(\d{3})(\d{1,3})/, "$1.$2");
  }
  return value;
}

function maskPhone(value) {
  value = value.replace(/\D/g, "");
  value = value.substring(0, 11);
  if (value.length > 6) {
    value = value.replace(/(\d{2})(\d{5})(\d{1,4})/, "($1) $2-$3");
  } else if (value.length > 2) {
    value = value.replace(/(\d{2})(\d{1,5})/, "($1) $2");
  } else if (value.length > 0) {
    value = value.replace(/(\d{1,2})/, "($1");
  }
  return value;
}

/* ---------- validação CPF ---------- */
function validarCPF(cpf) {
  if (!cpf) return false;
  const apenasDigitos = cpf.replace(/\D+/g, "");
  if (apenasDigitos.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(apenasDigitos)) return false;

  const calcularDigito = (base) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) {
      soma += parseInt(base[i], 10) * (base.length + 1 - i);
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const base9 = apenasDigitos.slice(0, 9);
  const dig1 = calcularDigito(base9);
  const dig2 = calcularDigito(base9 + dig1);
  return apenasDigitos === (base9 + dig1 + dig2);
}

function sanitizeDigits(value) {
  return (value || "").replace(/\D/g, "");
}

/* ---------- helpers UI de erro inline ---------- */
function ensureErrorNode(input) {
  if (!input) return null;
  let node = input.parentElement.querySelector(".error-message");
  if (!node) {
    node = document.createElement("span");
    node.className = "error-message";
    input.parentElement.appendChild(node);
  }
  return node;
}

function setFieldError(inputOrId, message) {
  const input = typeof inputOrId === "string" ? document.getElementById(inputOrId) : inputOrId;
  if (!input) return;
  input.classList.add("input-error");
  const node = ensureErrorNode(input);
  if (node) node.textContent = message;
}

function clearFieldError(inputOrId) {
  const input = typeof inputOrId === "string" ? document.getElementById(inputOrId) : inputOrId;
  if (!input) return;
  input.classList.remove("input-error");
  const node = input.parentElement.querySelector(".error-message");
  if (node) node.textContent = "";
}

function focusFirstError(form) {
  const first = form.querySelector(".input-error");
  if (first) first.focus();
}

/* ---------- formatação de erros vindos da API ---------- */
function formatApiError(data, fallback = "Erro ao processar requisição.") {
  if (!data || typeof data !== "object") return fallback;

  const base = data.error || data.message || fallback;
  const cause = data.cause || data.details || data.problems;

  if (!cause || typeof cause !== "object") {
    return base;
  }

  const entries = Object.entries(cause);
  const msgs = entries.map(([field, message]) => {
    // field pode ser string ou array — normaliza
    const text = Array.isArray(message) ? message.join(", ") : String(message);
    return { field, text };
  });

  // Se só tiver um erro, mostra só ele
  if (msgs.length === 1) return msgs[0].text.replace(/^•\s*/, "");

  // vários erros -> junta
  return `${base}\n\n${msgs.map(m => `${m.field}: ${m.text}`).join("\n")}`;
}

/* ---------- validações unitárias (front) ---------- */
function validarCamposBasicos(form) {
  // limpa erros
  ["username", "email", "name", "cpf", "phone", "password", "confirm-password"].forEach(clearFieldError);

  const vals = (id) => document.getElementById(id)?.value?.trim() || "";
  const errors = [];

  if (!vals("username")) {
    errors.push({ id: "username", msg: "Nome de usuário é obrigatório." });
  }
  if (!vals("email")) {
    errors.push({ id: "email", msg: "E-mail é obrigatório." });
  } else {
    // validação simples de e-mail
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(vals("email"))) {
      errors.push({ id: "email", msg: "E-mail em formato inválido." });
    }
  }
  if (!vals("name")) {
    errors.push({ id: "name", msg: "Nome é obrigatório." });
  }

  const cpfRaw = vals("cpf");
  if (!cpfRaw) {
    errors.push({ id: "cpf", msg: "CPF é obrigatório." });
  } else if (!validarCPF(cpfRaw)) {
    errors.push({ id: "cpf", msg: "CPF inválido." });
  }

  const password = vals("password");
  const confirm = vals("confirm-password");
  if (!password) {
    errors.push({ id: "password", msg: "Senha é obrigatória." });
  }
  if (!confirm) {
    errors.push({ id: "confirm-password", msg: "Confirmação de senha é obrigatória." });
  }
  if (password && confirm && password !== confirm) {
    errors.push({ id: "confirm-password", msg: "As senhas não coincidem." });
  }

  // telefone é opcional, mas se preenchido pode validar formato mínimo (10 ou 11 dígitos)
  const phoneDigits = sanitizeDigits(vals("phone"));
  if (phoneDigits && phoneDigits.length < 10) {
    errors.push({ id: "phone", msg: "Telefone inválido." });
  }

  // converte para visual e aplica erros inline
  for (const err of errors) {
    setFieldError(err.id, err.msg);
  }

  return errors.length === 0;
}

/* ---------- evento DOM ---------- */
document.addEventListener("DOMContentLoaded", () => {
  const cpfInput = document.getElementById("cpf");
  const phoneInput = document.getElementById("phone");
  const form = document.getElementById("signupForm");

  // --- máscaras em tempo real ---
  if (cpfInput) {
    cpfInput.addEventListener("input", (e) => {
      const pos = e.target.selectionStart;
      e.target.value = maskCPF(e.target.value);
      clearFieldError(e.target); // limpa erro assim que a pessoa mexe no campo
    });
    // valida ao sair do campo (blur)
    cpfInput.addEventListener("blur", (e) => {
      if (!e.target.value) return;
      if (!validarCPF(e.target.value)) {
        setFieldError(e.target, "CPF inválido.");
      } else {
        clearFieldError(e.target);
      }
    });
  }

  if (phoneInput) {
    phoneInput.addEventListener("input", (e) => {
      e.target.value = maskPhone(e.target.value);
      clearFieldError(e.target);
    });
  }

  // --- validação em "real-time" para outros campos (blur) ---
  ["email", "username", "name", "password", "confirm-password"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", () => clearFieldError(el));
    el.addEventListener("blur", () => {
      // validações simples
      if (id === "email") {
        const v = el.value?.trim();
        if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) setFieldError(el, "E-mail em formato inválido.");
      }
      if ((id === "password" || id === "confirm-password") && document.getElementById("password") && document.getElementById("confirm-password")) {
        const p = document.getElementById("password").value;
        const c = document.getElementById("confirm-password").value;
        if (p && c && p !== c) setFieldError("confirm-password", "As senhas não coincidem.");
      }
    });
  });

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // limpa erros globais
    ["username", "email", "name", "cpf", "phone", "password", "confirm-password"].forEach(clearFieldError);

    // valida front-end local
    const ok = validarCamposBasicos(form);
    if (!ok) {
      focusFirstError(form);
      showToast("Verifique os campos em destaque.", "error");
      return;
    }

    // montando payloads corretos (envia CPF só com dígitos)
    const gv = (id) => document.getElementById(id)?.value?.trim() || "";
    const userPayload = {
      username: gv("username"),
      email: gv("email"),
      name: gv("name"),
      cpf: sanitizeDigits(gv("cpf")), // envia só os dígitos
      phone: gv("phone"),
      password: gv("password"),
      confirm_password: gv("confirm-password"),
    };

    const addressPayload = {
      cep: gv("cep"),
      logradouro: gv("endereco"),
      numero: gv("numero"),
      complemento: gv("complemento"),
      bairro: gv("bairro"),
      cidade: gv("cidade"),
      estado: gv("estado"),
      pais: "BR",
      is_primary: true,
    };

    // validação rápida do endereço (cliente)
    const missing = [];
    if (!addressPayload.cep) missing.push("CEP");
    if (!addressPayload.logradouro) missing.push("Endereço");
    if (!addressPayload.numero) missing.push("Número");
    if (!addressPayload.bairro) missing.push("Bairro");
    if (!addressPayload.cidade) missing.push("Cidade");
    if (!addressPayload.estado) missing.push("UF");
    if (missing.length) {
      showToast("Preencha: " + missing.join(", ") + ".", "error");
      return;
    }

    try {
      // 1) cria usuário
      const rUser = await fetch("/api/create_user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(userPayload),
      });
      const userData = await rUser.json();

      if (!rUser.ok) {
        // tenta mapear erros por campo e marcar inline
        const cause = userData && (userData.cause || userData.details || userData.problems);
        if (cause && typeof cause === "object") {
          // exemplo de estrutura: { cpf: "já cadastrado", email: "inválido" } ou { cpf: ["mensagem1","mensagem2"] }
          Object.entries(cause).forEach(([field, message]) => {
            // mapeia nomes de campo do back para ids do input se necessário
            const fieldMap = {
              username: "username",
              email: "email",
              cpf: "cpf",
              phone: "phone",
              name: "name",
              password: "password",
            };
            const inputId = fieldMap[field] || field;
            const text = Array.isArray(message) ? message.join(", ") : String(message);
            setFieldError(inputId, text);
          });
          focusFirstError(form);
          showToast("Corrija os campos destacados.", "error");
          return;
        }

        // se não houver estrutura, mostra mensagem geral
        const msg = formatApiError(userData, "Erro ao criar usuário.");
        showToast(msg, "error");
        return;
      }

      // pega o id retornado pelo back (ele retorna { id, username, email, name })
      const userId = userData?.id;
      if (!userId) {
        console.error("Resposta sem id:", userData);
        showToast("Usuário criado, mas não recebi o ID para salvar o endereço.", "error");
        return;
      }

      // 2) cria endereço vinculado
      const rAddr = await fetch(`/api/users/${userId}/addresses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(addressPayload),
      });
      const addrData = await rAddr.json();

      if (!rAddr.ok) {
        // tenta mapear e marcar erros do endpoint de endereço
        const extra = addrData && (addrData.details || addrData.problems || addrData.cause);
        if (extra && typeof extra === "object") {
          Object.entries(extra).forEach(([field, message]) => {
            const inputId = field; // ajuste caso backend use nomes diferentes
            const text = Array.isArray(message) ? message.join(", ") : String(message);
            setFieldError(inputId, text);
          });
          focusFirstError(form);
          showToast("Corrija os campos de endereço destacados.", "error");
          return;
        }

        const msg = (addrData && (addrData.error || addrData.message)) || "Erro ao salvar endereço.";
        showToast(msg + (addrData && (addrData.details || addrData.problems) ? "\n" + JSON.stringify(addrData.details || addrData.problems, null, 2) : ""), "error");
        return;
      }

      showToast("Conta criada com sucesso!", "success");
      setTimeout(() => (window.location.href = "/UserPage"), 1200);
    } catch (err) {
      console.error(err);
      showToast("Falha de conexão com o servidor.", "error");
    }
  });
});

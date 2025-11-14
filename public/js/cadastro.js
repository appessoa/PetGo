// /public/js/cadastro.js
import { showToast } from "./utils/toast.js";

function maskCPF(value) {
  // remove tudo que não é número
  value = value.replace(/\D/g, "");

  // limita a 11 dígitos
  value = value.substring(0, 11);

  // monta a máscara 000.000.000-00
  if (value.length > 9) {
    value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, "$1.$2.$3-$4");
  } else if (value.length > 6) {
    value = value.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
  } else if (value.length > 3) {
    value = value.replace(/(\d{3})(\d{1,3})/, "$1.$2");
  }

  return value;
}
function formatApiError(data, fallback = "Erro ao processar requisição.") {
  if (!data || typeof data !== "object") return fallback;

  const base = data.error || data.message || fallback;
  const cause = data.cause || data.details || data.problems;

  // Se não tiver objeto de causa, só mostra a mensagem base
  if (!cause || typeof cause !== "object") {
    return base;
  }

  const entries = Object.entries(cause);

  // Monta mensagens bonitinhas por campo
  const msgs = entries.map(([field, message]) => {
    const labelMap = {
      email: "E-mail",
      cpf: "CPF",
      phone: "Telefone",
      username: "Nome de usuário",
      name: "Nome",
    };

    const label = labelMap[field] || field;
    return `${message}`;
  });

  // Se só tiver um erro, mostra só ele sem "Falha de validação."
  if (msgs.length === 1) {
    return msgs[0].replace(/^•\s*/, "");
  }

  // Se tiver vários, mostra a mensagem geral + lista
  return `${base}\n\n${msgs.join("\n")}`;
}

function maskPhone(value) {
  // remove tudo que não é número
  value = value.replace(/\D/g, "");

  // limita a 11 dígitos (DDD + 9 números)
  value = value.substring(0, 11);

  // monta a máscara (00) 00000-0000
  if (value.length > 6) {
    value = value.replace(/(\d{2})(\d{5})(\d{1,4})/, "($1) $2-$3");
  } else if (value.length > 2) {
    value = value.replace(/(\d{2})(\d{1,5})/, "($1) $2");
  } else if (value.length > 0) {
    value = value.replace(/(\d{1,2})/, "($1");
  }

  return value;
}

document.addEventListener("DOMContentLoaded", () => {
  const cpfInput = document.getElementById("cpf");
  const phoneInput = document.getElementById("phone");

  if (cpfInput) {
    cpfInput.addEventListener("input", (e) => {
      e.target.value = maskCPF(e.target.value);
    });
  }

  if (phoneInput) {
    phoneInput.addEventListener("input", (e) => {
      e.target.value = maskPhone(e.target.value);
    });
  }
});
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("signupForm");
  if (!form) return;

  const gv = (id) => document.getElementById(id)?.value?.trim() || "";

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // validação de senha local
    const password = gv("password");
    const confirm  = gv("confirm-password");
    if (!password || !confirm) {
      showToast("Informe a senha e a confirmação.", "error");
      return;
    }
    if (password !== confirm) {
      showToast("As senhas não coincidem.", "error");
      return;
    }

    // ----- payload do usuário (campos que o back exige) -----
    const userPayload = {
      username: gv("username"),
      email: gv("email"),
      name: gv("name"),
      cpf: gv("cpf"),
      phone: gv("phone"),
      password,
      confirm_password: confirm, // <-- EXATAMENTE como o back espera
    };

    // ----- payload do endereço (inclui campos disabled) -----
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

    // validação rápida do endereço
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
        credentials: "include", // mantém a sessão criada no back
        body: JSON.stringify(userPayload),
      });
      const userData = await rUser.json();

      if (!rUser.ok) {
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
        const msg = (addrData && (addrData.error || addrData.message)) || "Erro ao salvar endereço.";
        const extra = addrData && (addrData.details || addrData.problems);
        showToast(msg + (extra ? "\n" + JSON.stringify(extra, null, 2) : ""), "error");
        return;
      }

      showToast("Conta criada com sucesso!", "success");
      setTimeout(() => (window.location.href = "/UserPage"), 1500);
    } catch (err) {
      console.error(err);
      showToast("Falha de conexão com o servidor.", "error");
    }
  });
});

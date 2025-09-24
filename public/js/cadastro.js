// /public/js/cadastro.js
import { showToast } from "./utils/toast.js";

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
        // o back usa api_error(400, "mensagem", details)
        const msg = (userData && (userData.error || userData.message)) || "Erro ao criar usuário.";
        const extra = userData && (userData.details || userData.problems);
        showToast(msg + (extra ? "\n" + JSON.stringify(extra, null, 2) : ""), "error");
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

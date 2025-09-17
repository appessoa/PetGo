import { showToast } from "./utils/toast.js";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("signupForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = {
      username: document.getElementById("username").value.trim(),
      name: document.getElementById("name").value.trim(),
      cpf: document.getElementById("cpf").value.trim(),
      phone: document.getElementById("phone").value.trim(),
      email: document.getElementById("email").value.trim(),
      address: document.getElementById("address").value.trim(),
      password: document.getElementById("password").value,
      confirm_password: document.getElementById("confirm-password").value,
    };

    try {
      const r = await fetch("/api/create_user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await r.json();

      if (!r.ok) {
        let msg = data.error || "Erro desconhecido.";
        if (data.details) {
          msg += "\n" + JSON.stringify(data.details, null, 2);
        }
        showToast(msg, "error");
        return;
      }

      showToast("Conta criada com sucesso!", "success");

      // espera 1.5s antes de redirecionar para a página de perfil
      setTimeout(() => {
        window.location.href = "/UserPage";
      }, 1500);

    } catch (err) {
      console.error(err);
      showToast("Falha de conexão com o servidor.", "error");
    }
  });
});



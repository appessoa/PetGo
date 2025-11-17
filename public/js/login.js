document.getElementById("loginForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const username = document.getElementById("username").value;
      const password = document.getElementById("password").value;

try {
  const resp = await fetch("/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username, password })
  });

  // Se o servidor redirecionou (login com sucesso no Flask)
  if (resp.redirected) {
    window.location.href = resp.url;
    return;
  }

  // Lê o body conforme o content-type
  const contentType = resp.headers.get("content-type") || "";
  let data;
  if (contentType.includes("application/json")) {
    data = await resp.json();
  } else {
    // fallback: servidor devolveu texto (p.ex. HTML ou plain text)
    const text = await resp.text();
    data = { error: text };
  }

  const msg = document.getElementById("msg");
  msg.style.display = "block";

  if (resp.ok) {
    // 2xx, mas sem redirect — mostra mensagem de sucesso opcional
    msg.textContent = data.message || "Operação concluída com sucesso.";
  } else {
    // erro (p.ex. 401, 400, 500)
    msg.textContent = data.error || data.message || `Erro: ${resp.status}`;
  }

} catch (err) {
  console.error(err);
  const msg = document.getElementById("msg");
  msg.style.display = "block";
  msg.textContent = "Erro de conexão. Tente novamente.";
}
});
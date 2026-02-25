/* ===============================
   AUTH.JS
=============================== */

const DEV_MODE = true;

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("formLogin");
  if (!form) return;

  // 🔹 Pré-preenchimento (modo dev)
  if (DEV_MODE) {
    document.getElementById("email").value = "pedro.andrade@hc.eng.br";
    document.getElementById("senha").value = "Pm310318*";
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    await login();
  });
});

async function login() {
  const email = document.getElementById("email").value.trim();
  const senha = document.getElementById("senha").value.trim();
  const erro = document.getElementById("erro");

  erro.innerText = "";

  if (!email || !senha) {
    erro.innerText = "Preencha email e senha.";
    return;
  }

  if (!email.endsWith("@hc.eng.br")) {
    erro.innerText = "Use seu email corporativo.";
    return;
  }

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error) {
      console.log(error);
      erro.innerText = "Email ou senha inválidos.";
      return;
    }

    window.location.href = "index.html";
  } catch (err) {
    console.error(err);
    erro.innerText = "Erro ao autenticar.";
  }
}

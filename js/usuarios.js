/* ============================
   USUARIOS.JS
============================ */

let userId;
let perfilAtual;
let usuarios = [];

document.addEventListener("DOMContentLoaded", async () => {
  await inicializar();
});

async function inicializar() {
  userId = await protegerPagina();
  await validarPermissao();
  await carregarUsuarios();

  document.getElementById("btnCriar").addEventListener("click", criarUsuario);

  document.getElementById("btnLogout").addEventListener("click", logout);
}

/* ============================
   PROTEGER PÁGINA
============================ */
async function protegerPagina() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    window.location.href = "login.html";
    return;
  }

  return session.user.id;
}

/* ============================
   PERMISSÃO
============================ */
async function validarPermissao() {
  const { data } = await supabase
    .from("usuarios")
    .select("perfil")
    .eq("id", userId)
    .single();

  perfilAtual = data.perfil;

  if (perfilAtual !== "dev") {
    alert("Acesso restrito.");
    window.location.href = "index.html";
  }
}

/* ============================
   CARREGAR USUÁRIOS
============================ */
async function carregarUsuarios() {
  const { data } = await supabase
    .from("usuarios")
    .select("*")
    .order("nome", { ascending: true });

  usuarios = data || [];

  renderTabela();
}

/* ============================
   RENDER TABELA
============================ */
function renderTabela() {
  const tbody = document.getElementById("tabelaUsuarios");
  tbody.innerHTML = "";

  usuarios.forEach((u) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${u.nome}</td>
      <td>${u.email}</td>
      <td>
        <select onchange="alterarPerfil('${u.id}', this.value)"
          class="form-select form-select-sm">
          <option ${u.perfil === "supervisor" ? "selected" : ""}>supervisor</option>
          <option ${u.perfil === "coordenador" ? "selected" : ""}>coordenador</option>
          <option ${u.perfil === "gerente" ? "selected" : ""}>gerente</option>
          <option ${u.perfil === "dev" ? "selected" : ""}>dev</option>
        </select>
      </td>
      <td>
        <span class="badge bg-success">Ativo</span>
      </td>
      <td>
        <button class="btn btn-danger btn-sm"
          onclick="deletarUsuario('${u.id}')">
          Excluir
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

/* ============================
   CRIAR USUÁRIO
============================ */
async function criarUsuario() {
  const nome = document.getElementById("nome").value.trim();
  const email = document.getElementById("email").value.trim();
  const perfil = document.getElementById("perfil").value;

  if (!nome || !email) {
    alert("Preencha todos os campos.");
    return;
  }

  if (!email.endsWith("@hc.eng.br")) {
    alert("Use email corporativo.");
    return;
  }

  try {
    // 1️⃣ Cria usuário no Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password: "Temp@1234",
    });

    if (error) throw error;

    // 2️⃣ Insere na tabela usuarios
    await supabase.from("usuarios").insert({
      id: data.user.id,
      nome,
      email,
      perfil,
    });

    alert("Usuário criado. Oriente a redefinir a senha.");

    await carregarUsuarios();
  } catch (err) {
    console.error(err);
    alert("Erro ao criar usuário.");
  }
}

/* ============================
   ALTERAR PERFIL
============================ */
async function alterarPerfil(id, novoPerfil) {
  await supabase.from("usuarios").update({ perfil: novoPerfil }).eq("id", id);
}

/* ============================
   EXCLUIR
============================ */
async function deletarUsuario(id) {
  if (!confirm("Excluir usuário?")) return;

  await supabase.from("usuarios").delete().eq("id", id);
  await carregarUsuarios();
}

/* ============================
   LOGOUT
============================ */
async function logout() {
  await supabase.auth.signOut();
  window.location.href = "login.html";
}

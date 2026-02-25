/* ============================================================
   ADMIN.JS - Banco de Horas
   Painel Gerencial
   ============================================================ */

/* ============================
   VARIÁVEIS GLOBAIS
============================ */
let userId;
let perfil;
let registrosAdmin = [];
let paginaAtual = 1;
const registrosPorPagina = 10;
let graficoAdmin;

/* ============================
   INICIALIZAÇÃO
============================ */
document.addEventListener("DOMContentLoaded", async () => {
  await inicializar();

  const btnLogout = document.getElementById("btnLogout");
  if (btnLogout) btnLogout.addEventListener("click", logout);
});

async function inicializar() {
  try {
    userId = await protegerPagina();
    await validarPerfil();
    await carregarRegistros();
  } catch (err) {
    console.error(err);
    alert("Erro ao carregar sistema.");
  }
}

/* ============================
   PROTEGER PÁGINA
============================ */
async function protegerPagina() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) window.location.href = "login.html";
  return session.user.id;
}

/* ============================
   VALIDAR PERFIL
============================ */
async function validarPerfil() {
  const { data, error } = await supabase
    .from("usuarios")
    .select("perfil, nome")
    .eq("id", userId)
    .single();

  if (error || !data) {
    console.error("Erro ao validar perfil:", error);
    window.location.href = "login.html";
    return;
  }

  perfil = data.perfil;

  // 🔹 Se for supervisor, redireciona
  if (perfil === "supervisor") {
    window.location.href = "dashboard-supervisor.html";
    return;
  }

  // 🔹 Inserir nome no navbar
  const nomeEl = document.getElementById("nomeAdmin");

  if (nomeEl) {
    nomeEl.innerText = data.nome ? data.nome.split(" ")[0] : "Administrador";
  }
}

/* ============================
   CARREGAR TODOS REGISTROS
============================ */
async function carregarRegistros() {

  try {

    const { data, error } = await supabase
      .from("lancamentos")
      .select("*, usuarios(nome)")
      .order("created_at", { ascending: false });

    if (error) throw error;

    registrosAdmin = data || [];

    atualizarTabela();
    atualizarTotalBanco();
    gerarGraficoSupervisor();
    gerarRanking();

  } catch (err) {
    console.error("Erro real ao carregar registros:", err);
  }
}

/* ============================
   CALCULAR SALDO DE UM USUÁRIO
============================ */
function calcularSaldoUsuario(userId) {
  let saldo = 0;

  registrosAdmin.forEach((r) => {
    if (r.user_id === userId) {
      if (r.status === "aprovado") {
        saldo += r.horas;
      }
    }
  });

  return saldo;
}

/* ============================
   TABELA COM PAGINAÇÃO
============================ */
function atualizarTabela() {
  const tbody = document.getElementById("tabelaPendentes");
  tbody.innerHTML = "";

  const inicio = (paginaAtual - 1) * registrosPorPagina;
  const fim = inicio + registrosPorPagina;
  const pagina = registrosAdmin.slice(inicio, fim);

  pagina.forEach((r) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${r.usuarios?.nome || "-"}</td>
      <td>${formatarData(r.data)}</td>
      <td>${decimalParaHora(r.horas)}</td>
      <td>${r.observacao || "-"}</td>
      <td>${r.status}</td>
      <td>
        ${
          r.status === "pendente"
            ? `
          <button class="btn btn-success btn-sm me-1"
            onclick="aprovar('${r.id}')">Aprovar</button>

          <button class="btn btn-danger btn-sm me-1"
            onclick="rejeitar('${r.id}')">Rejeitar</button>
        `
            : ""
        }

        ${
          r.status === "aprovado"
            ? `
          <button class="btn btn-warning btn-sm"
            onclick="baixar('${r.id}')">Dar Baixa</button>
        `
            : ""
        }
      </td>
    `;

    tbody.appendChild(tr);
  });
}

/* ============================
   PAGINAÇÃO
============================ */
function proximaPagina() {
  if (paginaAtual * registrosPorPagina < registrosAdmin.length) {
    paginaAtual++;
    atualizarTabela();
  }
}

function paginaAnterior() {
  if (paginaAtual > 1) {
    paginaAtual--;
    atualizarTabela();
  }
}

window.proximaPagina = proximaPagina;
window.paginaAnterior = paginaAnterior;

/* ============================
   APROVAR / REJEITAR / BAIXAR
============================ */
async function aprovar(id) {
  await supabase
    .from("lancamentos")
    .update({ status: "aprovado", aprovado_por: userId })
    .eq("id", id);

  carregarRegistros();
}

async function rejeitar(id) {
  await supabase
    .from("lancamentos")
    .update({ status: "rejeitado", aprovado_por: userId })
    .eq("id", id);

  carregarRegistros();
}

async function baixar(id) {
  const btn = event.target;
  btn.disabled = true;

  const registro = registrosAdmin.find((r) => r.id === id);

  if (!registro) {
    alert("Registro não encontrado.");
    btn.disabled = false;
    return;
  }

  if (registro.status !== "aprovado") {
    alert("Este lançamento já foi baixado.");
    btn.disabled = false;
    return;
  }

  const saldoAtual = calcularSaldoUsuario(registro.user_id);

  if (registro.horas > saldoAtual) {
    alert("Saldo insuficiente.");
    btn.disabled = false;
    return;
  }

  const { error } = await supabase
    .from("lancamentos")
    .update({ status: "baixado" })
    .eq("id", id)
    .eq("status", "aprovado"); // 🔥 proteção extra

  if (error) {
    alert("Erro ao dar baixa.");
  }

  await carregarRegistros();
}

window.aprovar = aprovar;
window.rejeitar = rejeitar;
window.baixar = baixar;

/* ============================
   CARD TOTAL BANCO
============================ */
function atualizarTotalBanco() {
  let total = 0;

  registrosAdmin.forEach((r) => {
    if (r.status === "aprovado") {
      total += r.horas;
    }
  });

  document.getElementById("totalHorasBanco").innerText = decimalParaHora(total);
}

/* ============================
   GRÁFICO POR SUPERVISOR
============================ */
function gerarGraficoSupervisor() {
  const ctx = document.getElementById("graficoAdmin");
  if (!ctx) return;

  const mapa = {};

  registrosAdmin.forEach((r) => {
    if (r.status === "aprovado" || r.status === "baixado") {
      const nome = r.usuarios?.nome || "Desconhecido";

      if (!mapa[nome]) {
        mapa[nome] = {
          aprovado: 0,
          baixado: 0,
        };
      }

      if (r.status === "aprovado") {
        mapa[nome].aprovado += r.horas;
      }

      if (r.status === "baixado") {
        mapa[nome].baixado += r.horas;
      }
    }
  });

  const labels = Object.keys(mapa);
  const aprovadas = labels.map((nome) => mapa[nome].aprovado);
  const baixadas = labels.map((nome) => mapa[nome].baixado);

  if (graficoAdmin) graficoAdmin.destroy();

  graficoAdmin = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Horas Aprovadas",
          data: aprovadas,
          backgroundColor: "#0d6efd", // azul
        },
        {
          label: "Horas Baixadas",
          data: baixadas,
          backgroundColor: "#198754", // verde
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
    },
  });
}

/* ============================
   RANKING
============================ */
function gerarRanking() {
  const mapa = {};

  registrosAdmin.forEach((r) => {
    if (r.status === "aprovado" || r.status === "baixado") {
      const nome = r.usuarios?.nome || "Desconhecido";

      if (!mapa[nome]) mapa[nome] = 0;

      mapa[nome] += r.horas;
    }
  });

  const ranking = Object.entries(mapa).sort((a, b) => b[1] - a[1]);

  const lista = document.getElementById("rankingHoras");
  lista.innerHTML = "";

  ranking.forEach(([nome, total]) => {
    const li = document.createElement("li");
    li.className = "list-group-item d-flex justify-content-between";
    li.innerHTML = `
      <span>${nome}</span>
      <strong>${decimalParaHora(total)}</strong>
    `;
    lista.appendChild(li);
  });
}
/* ============================
   UTILITÁRIOS
============================ */
function decimalParaHora(decimal) {
  const horas = Math.floor(decimal);
  const minutos = Math.round((decimal - horas) * 60);
  return `${horas.toString().padStart(2, "0")}:${minutos
    .toString()
    .padStart(2, "0")}`;
}

function formatarData(dataISO) {
  if (!dataISO) return "-";

  const dataLimpa = dataISO.split("T")[0];
  const [ano, mes, dia] = dataLimpa.split("-");
  return `${dia}/${mes}/${ano}`;
}

/* ============================
   LOGOUT
============================ */
async function logout() {
  await supabase.auth.signOut();
  window.location.href = "login.html";
}

window.logout = logout;


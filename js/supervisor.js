/* ============================================================
   SUPERVISOR.JS - Banco de Horas
   Painel: Supervisor
   ============================================================ */

/* ============================
   VARIÁVEIS GLOBAIS
============================ */
let userId;
let perfil;
let registros = [];

// 🔹 PAGINAÇÃO
let paginaAtual = 1;
const itensPorPagina = 5;

/* ============================
   INICIALIZAÇÃO
============================ */
document.addEventListener("DOMContentLoaded", async () => {
  await inicializar();

  const btnLogout = document.getElementById("btnLogout");
  if (btnLogout) {
    btnLogout.addEventListener("click", logout);
  }

  const btnSalvar = document.getElementById("btnSalvar");
  if (btnSalvar) {
    btnSalvar.addEventListener("click", salvarLancamento);
  }

  // 🔥 Bloquear data futura
  const inputData = document.getElementById("data");
  if (inputData) {
    inputData.max = new Date().toISOString().split("T")[0];
  }
});

async function inicializar() {
  try {
    userId = await protegerPagina();
    await validarPerfil();
    await carregarDados();
  } catch (err) {
    console.error("Erro na inicialização:", err);
    alert("Erro ao carregar sistema.");
  }
}

/* ============================
   PROTEGER PÁGINA
============================ */
async function protegerPagina() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error || !session) {
    window.location.href = "login.html";
    return;
  }

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
    alert("Erro ao validar perfil.");
    window.location.href = "login.html";
    return;
  }

  perfil = data.perfil;

  if (perfil !== "supervisor") {
    window.location.href = "dashboard-admin.html";
    return;
  }

  // 🔹 Inserir nome no navbar
  const nomeEl = document.getElementById("nomeSupervisor");
  if (nomeEl) {
    nomeEl.innerText = data.nome.split(" ")[0]; // só primeiro nome
  }
}

/* ============================
   CARREGAR DADOS
============================ */
async function carregarDados() {
  try {
    const { data, error } = await supabase
      .from("lancamentos")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    registros = data || [];

    atualizarTabela();
    atualizarSaldo();
  } catch (err) {
    console.error("Erro ao carregar dados:", err);
    alert("Erro ao carregar dados.");
  }
}

async function salvarLancamento() {
  const data = document.getElementById("data").value;
  const horasInput = document.getElementById("horas").value.trim();
  const observacao = document.getElementById("observacao").value.trim();

  // ============================
  // VALIDAÇÕES BÁSICAS
  // ============================
  if (!data || !horasInput) {
    alert("Preencha todos os campos obrigatórios.");
    return;
  }

  // ============================
  // BLOQUEAR DATA FUTURA
  // ============================
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const dataSelecionada = new Date(data);
  dataSelecionada.setHours(0, 0, 0, 0);

  if (dataSelecionada > hoje) {
    alert("Não é permitido lançar horas em data futura.");
    return;
  }

  // ============================
  // VALIDAR FORMATO HH:MM
  // ============================
  const regex = /^([0-9]{1,2}):([0-5][0-9])$/;

  if (!regex.test(horasInput)) {
    alert("Informe as horas no formato HH:MM (ex: 02:30)");
    return;
  }

  const [h, m] = horasInput.split(":").map(Number);

  if (h === 0 && m === 0) {
    alert("Horas deve ser maior que zero.");
    return;
  }

  // Converter para decimal
  const horas = h + m / 60;

  // ============================
  // SALVAR NO BANCO
  // ============================
  try {
    const { error } = await supabase.from("lancamentos").insert({
      user_id: userId,
      data,
      tipo: "extra",
      horas,
      observacao,
      status: "pendente",
    });

    if (error) throw error;

    limparFormulario();
    await carregarDados();
  } catch (err) {
    console.error("Erro ao salvar:", err);
    alert("Erro ao salvar lançamento.");
  }
}

/* ============================
   DELETAR (somente pendente)
============================ */
async function deletar(id) {
  if (!confirm("Confirmar exclusão do lançamento?")) return;

  try {
    const { error } = await supabase.from("lancamentos").delete().eq("id", id);

    if (error) throw error;

    await carregarDados();
  } catch (err) {
    console.error("Erro ao deletar:", err);
    alert("Erro ao excluir.");
  }
}

/* ============================
   ATUALIZAR TABELA
============================ */
function atualizarTabela() {
  const tbody = document.querySelector("#tabelaLancamentos tbody");
  tbody.innerHTML = "";

  if (registros.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="text-center text-muted">
          Nenhum lançamento encontrado
        </td>
      </tr>
    `;
    return;
  }

  // 🔹 Calcular paginação
  const inicio = (paginaAtual - 1) * itensPorPagina;
  const fim = inicio + itensPorPagina;
  const registrosPagina = registros.slice(inicio, fim);

  registrosPagina.forEach((r) => {
    const badgeMap = {
      pendente: "warning",
      aprovado: "success",
      rejeitado: "danger",
      baixado: "primary",
    };

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${formatarData(r.data)}</td>

      <td class="fw-semibold">
        ${Number(r.horas).toFixed(1)}h
      </td>

      <td class="text-start">
        ${r.observacao ? r.observacao : "-"}
      </td>

      <td>
        <span class="badge bg-${badgeMap[r.status] || "secondary"}">
          ${r.status}
        </span>
      </td>

      <td>
        ${
          r.status === "pendente"
            ? `<button class="btn btn-outline-danger btn-sm"
                 onclick="deletar('${r.id}')">
                 Excluir
               </button>`
            : ""
        }
      </td>
    `;

    tbody.appendChild(tr);
  });

  atualizarControlesPaginacao();
}

/* ============================
   CALCULAR SALDO
============================ */
function calcularSaldoUsuario(userId) {
  let saldo = 0;

  registrosSupervisor.forEach((r) => {
    if (r.user_id === userId && r.status === "aprovado") {
      saldo += r.horas;
    }
  });

  return saldo;
}

/* ============================
   CALCULAR SALDO (APENAS APROVADO)
============================ */
function calcularSaldo() {
  let saldo = 0;

  registros.forEach((r) => {
    if (r.status === "aprovado") {
      saldo += r.horas;
    }
  });

  return saldo;
}

/* ============================
   TOTAL PENDENTE DE APROVAÇÃO
============================ */
function calcularPendentes() {
  let total = 0;

  registros.forEach((r) => {
    if (r.status === "pendente") {
      total += r.horas;
    }
  });

  return total;
}

/* ============================
   TOTAL HISTÓRICO (APROVADO + BAIXADO)
============================ */
function calcularTotalHistorico() {
  let total = 0;

  registros.forEach((r) => {
    if (r.status === "aprovado" || r.status === "baixado") {
      total += r.horas;
    }
  });

  return total;
}

/* ============================
   ATUALIZAR SALDO + FAROL
============================ */
function atualizarSaldo() {
  const saldo = calcularSaldo();
  const totalPendentes = calcularPendentes();
  const totalHistorico = calcularTotalHistorico();

  const saldoEl = document.getElementById("saldoAtual");
  const pendenteEl = document.getElementById("totalMes"); // mantém o mesmo ID do card
  const historicoEl = document.getElementById("totalHistorico");

  if (saldoEl) saldoEl.innerText = decimalParaHora(saldo);
  if (pendenteEl) pendenteEl.innerText = decimalParaHora(totalPendentes);
  if (historicoEl) historicoEl.innerText = decimalParaHora(totalHistorico);

  const farol = document.getElementById("farol");

  if (!farol) return;

  if (saldo <= 30) {
    farol.innerHTML = '<span class="badge bg-success">Normal</span>';
  } else if (saldo <= 50) {
    farol.innerHTML = '<span class="badge bg-warning text-dark">Atenção</span>';
  } else {
    farol.innerHTML = '<span class="badge bg-danger">CRÍTICO</span>';
  }
}

/* ============================
   LIMPAR FORMULÁRIO
============================ */
function limparFormulario() {
  document.getElementById("data").value = "";
  document.getElementById("horas").value = "";
  document.getElementById("observacao").value = "";
}

/* ============================
   FORMATAR DATA
============================ */
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

function atualizarControlesPaginacao() {
  const totalPaginas = Math.ceil(registros.length / itensPorPagina);

  const btnAnterior = document.getElementById("btnAnterior");
  const btnProximo = document.getElementById("btnProximo");
  const infoPagina = document.getElementById("infoPagina");

  if (btnAnterior) btnAnterior.disabled = paginaAtual === 1;
  if (btnProximo) btnProximo.disabled = paginaAtual >= totalPaginas;

  if (infoPagina)
    infoPagina.innerText =
      totalPaginas > 0
        ? `Página ${paginaAtual} de ${totalPaginas}`
        : `Página 0`;
}

/* ============================
   CONVERTER DECIMAL PARA HH:MM
============================ */
function decimalParaHora(valor) {
  const sinal = valor < 0 ? "-" : "";
  const absoluto = Math.abs(valor);

  const horas = Math.floor(absoluto);
  const minutos = Math.round((absoluto - horas) * 60);

  const horasFormatadas = String(horas).padStart(2, "0");
  const minutosFormatados = String(minutos).padStart(2, "0");

  return `${sinal}${horasFormatadas}:${minutosFormatados}`;
}

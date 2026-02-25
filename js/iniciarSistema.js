document.addEventListener("DOMContentLoaded", async () => {
  console.log("Index carregado");

  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    console.log("Session:", session);
    console.log("Session error:", error);

    if (!session) {
      console.log("Sem sessão → redirecionando");
      window.location.href = "login.html";
      return;
    }

    const { data, error: perfilError } = await supabase
      .from("usuarios")
      .select("perfil")
      .eq("id", session.user.id)
      .single();

    console.log("Perfil:", data);
    console.log("Erro perfil:", perfilError);

    if (!data || perfilError) {
      alert("Usuário não encontrado na tabela usuarios.");
      return;
    }

    if (data.perfil === "supervisor") {
      window.location.href = "dashboard-supervisor.html";
    } else {
      window.location.href = "dashboard-admin.html";
    }
  } catch (err) {
    console.error("Erro geral:", err);
    alert("Erro ao iniciar sistema.");
  }
});

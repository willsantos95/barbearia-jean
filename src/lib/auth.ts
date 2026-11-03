import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Papel = "dono" | "barbeiro";

export type UsuarioAtual = {
  id: string;
  nome: string;
  papel: Papel;
  email: string | null;
};

/** Usuário logado + papel. Redireciona para /login se não houver. */
export async function getUsuario(): Promise<UsuarioAtual> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("usuarios")
    .select("id, nome, papel, ativo")
    .eq("id", user.id)
    .maybeSingle();

  if (!data || !data.ativo) redirect("/login?erro=sem-acesso");

  return { id: data.id, nome: data.nome, papel: data.papel as Papel, email: user.email ?? null };
}

/** Garante que é o dono; senão volta para o painel. */
export async function exigirDono() {
  const u = await getUsuario();
  if (u.papel !== "dono") redirect("/app");
  return u;
}

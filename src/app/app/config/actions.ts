"use server";

import { revalidatePath } from "next/cache";
import { exigirDono } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type Estado = { erro?: string; ok?: string };

const reaisParaCentavos = (v: FormDataEntryValue | null) =>
  Math.round((parseFloat(String(v ?? "0").replace(/\./g, "").replace(",", ".")) || 0) * 100);

// ---------- Barbearia ----------
export async function salvarBarbearia(_: Estado, fd: FormData): Promise<Estado> {
  await exigirDono();
  const supabase = await createClient();
  const { error } = await supabase
    .from("configuracoes")
    .update({
      nome: String(fd.get("nome") ?? "").trim() || "Barbearia",
      telefone: String(fd.get("telefone") ?? "").trim() || null,
      endereco: String(fd.get("endereco") ?? "").trim() || null,
      dias_cliente_sumido: Math.max(7, Number(fd.get("dias_cliente_sumido")) || 45),
    })
    .eq("id", 1);
  if (error) return { erro: error.message };
  revalidatePath("/app/config");
  return { ok: "Salvo." };
}

// ---------- Serviços ----------
export async function salvarServico(id: string | null, _: Estado, fd: FormData): Promise<Estado> {
  await exigirDono();
  const supabase = await createClient();
  const dados = {
    nome: String(fd.get("nome") ?? "").trim(),
    preco_centavos: reaisParaCentavos(fd.get("preco")),
    duracao_min: Number(fd.get("duracao_min")) || 30,
    ordem: Number(fd.get("ordem")) || 0,
    ativo: fd.get("ativo") === "on",
  };
  if (!dados.nome) return { erro: "Informe o nome." };
  const { error } = id
    ? await supabase.from("servicos").update(dados).eq("id", id)
    : await supabase.from("servicos").insert({ ...dados, ativo: true });
  if (error) return { erro: error.message };
  revalidatePath("/app/config/servicos");
  return { ok: id ? "Salvo." : "Serviço criado." };
}

// ---------- Barbeiros ----------
export async function criarBarbeiro(_: Estado, fd: FormData): Promise<Estado> {
  await exigirDono();
  const nome = String(fd.get("nome") ?? "").trim();
  if (!nome) return { erro: "Informe o nome." };
  const supabase = await createClient();
  const { error } = await supabase.from("barbeiros").insert({ nome });
  if (error) return { erro: error.message };
  revalidatePath("/app/config/equipe");
  return { ok: "Barbeiro adicionado." };
}

export async function salvarBarbeiro(id: string, _: Estado, fd: FormData): Promise<Estado> {
  await exigirDono();
  const supabase = await createClient();
  const usuarioId = String(fd.get("usuario_id") ?? "") || null;
  const { error } = await supabase
    .from("barbeiros")
    .update({ nome: String(fd.get("nome") ?? "").trim(), ativo: fd.get("ativo") === "on", usuario_id: usuarioId })
    .eq("id", id);
  if (error) {
    if (error.code === "23505") return { erro: "Esse login já está vinculado a outro barbeiro." };
    return { erro: error.message };
  }
  revalidatePath("/app/config/equipe");
  return { ok: "Salvo." };
}

// ---------- Logins da equipe ----------
export async function criarLogin(_: Estado, fd: FormData): Promise<Estado> {
  await exigirDono();
  const admin = createAdminClient();
  if (!admin) return { erro: "Falta a variável SUPABASE_SERVICE_ROLE_KEY na Vercel." };

  const nome = String(fd.get("nome") ?? "").trim();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const senha = String(fd.get("senha") ?? "");
  const papel = fd.get("papel") === "dono" ? "dono" : "barbeiro";
  const barbeiroId = String(fd.get("barbeiro_id") ?? "");

  if (!nome || !email) return { erro: "Informe nome e e-mail." };
  if (senha.length < 6) return { erro: "A senha precisa ter pelo menos 6 caracteres." };

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome },
  });
  if (error || !data.user) {
    return { erro: error?.message.includes("already") ? "Já existe um login com esse e-mail." : (error?.message ?? "Erro ao criar login.") };
  }

  // o trigger cria o perfil como barbeiro; ajusta nome/papel e vínculo
  await admin.from("usuarios").upsert({ id: data.user.id, nome, papel, ativo: true });
  if (barbeiroId === "novo") {
    await admin.from("barbeiros").insert({ nome, usuario_id: data.user.id });
  } else if (barbeiroId) {
    await admin.from("barbeiros").update({ usuario_id: data.user.id }).eq("id", barbeiroId);
  }

  revalidatePath("/app/config/equipe");
  return { ok: `Login criado. ${nome} já pode entrar com ${email}.` };
}

export async function alternarUsuario(id: string, ativo: boolean) {
  const eu = await exigirDono();
  if (id === eu.id) throw new Error("Você não pode desativar o próprio acesso.");
  const supabase = await createClient();
  await supabase.from("usuarios").update({ ativo }).eq("id", id);
  revalidatePath("/app/config/equipe");
}

export async function redefinirSenha(id: string, _: Estado, fd: FormData): Promise<Estado> {
  await exigirDono();
  const admin = createAdminClient();
  if (!admin) return { erro: "Falta a variável SUPABASE_SERVICE_ROLE_KEY na Vercel." };
  const senha = String(fd.get("senha") ?? "");
  if (senha.length < 6) return { erro: "Mínimo de 6 caracteres." };
  const { error } = await admin.auth.admin.updateUserById(id, { password: senha });
  if (error) return { erro: error.message };
  return { ok: "Senha alterada." };
}

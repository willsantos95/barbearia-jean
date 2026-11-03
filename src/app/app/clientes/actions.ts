"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { soDigitos } from "@/lib/format";

export type FormState = { erro?: string; ok?: string };

function lerCliente(formData: FormData) {
  const telefone = soDigitos(String(formData.get("telefone") ?? ""));
  return {
    nome: String(formData.get("nome") ?? "").trim(),
    telefone,
    aniversario: String(formData.get("aniversario") ?? "") || null,
    instagram: String(formData.get("instagram") ?? "").trim() || null,
    preferencias: String(formData.get("preferencias") ?? "").trim() || null,
    observacoes: String(formData.get("observacoes") ?? "").trim() || null,
    aceita_contato: formData.get("aceita_contato") === "on",
  };
}

function validar(c: ReturnType<typeof lerCliente>) {
  if (!c.nome) return "Informe o nome.";
  if (c.telefone.length < 10 || c.telefone.length > 11) return "Telefone precisa ter DDD + número (10 ou 11 dígitos).";
  return null;
}

export async function criarCliente(_: FormState, formData: FormData): Promise<FormState> {
  const c = lerCliente(formData);
  const erro = validar(c);
  if (erro) return { erro };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clientes")
    .insert({ ...c, origem: "balcao" })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { erro: "Já existe um cliente com esse telefone." };
    return { erro: "Não foi possível salvar: " + error.message };
  }
  revalidatePath("/app/clientes");
  redirect(`/app/clientes/${data.id}`);
}

export async function atualizarCliente(id: string, _: FormState, formData: FormData): Promise<FormState> {
  const c = lerCliente(formData);
  const erro = validar(c);
  if (erro) return { erro };

  const supabase = await createClient();
  const { error } = await supabase.from("clientes").update(c).eq("id", id);
  if (error) {
    if (error.code === "23505") return { erro: "Já existe outro cliente com esse telefone." };
    return { erro: "Não foi possível salvar: " + error.message };
  }
  revalidatePath(`/app/clientes/${id}`);
  revalidatePath("/app/clientes");
  return { ok: "Dados salvos." };
}

export async function excluirCliente(id: string) {
  const supabase = await createClient();
  const { data: fotos } = await supabase.from("cliente_fotos").select("storage_path").eq("cliente_id", id);
  const { error } = await supabase.from("clientes").delete().eq("id", id);
  if (error) throw new Error("Só o dono pode excluir clientes.");
  if (fotos?.length) {
    await supabase.storage.from("fotos-clientes").remove(fotos.map((f) => f.storage_path));
  }
  revalidatePath("/app/clientes");
  redirect("/app/clientes");
}

export async function registrarFoto(clienteId: string, storagePath: string, legenda?: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("cliente_fotos")
    .insert({ cliente_id: clienteId, storage_path: storagePath, legenda: legenda || null });
  if (error) {
    await supabase.storage.from("fotos-clientes").remove([storagePath]);
    throw new Error(error.message);
  }
  revalidatePath(`/app/clientes/${clienteId}`);
}

export async function excluirFoto(fotoId: string, clienteId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cliente_fotos")
    .delete()
    .eq("id", fotoId)
    .select("storage_path")
    .maybeSingle();
  if (error || !data) throw new Error("Não foi possível excluir a foto.");
  await supabase.storage.from("fotos-clientes").remove([data.storage_path]);
  revalidatePath(`/app/clientes/${clienteId}`);
}

"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirDono } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type Estado = { erro?: string; ok?: string };

const num = (v: FormDataEntryValue | null) => parseFloat(String(v ?? "").replace(/\./g, "").replace(",", ".")) || 0;
const qtd = (v: FormDataEntryValue | null) => parseFloat(String(v ?? "").replace(",", ".")) || 0;
const centavos = (v: FormDataEntryValue | null) => Math.round(num(v) * 100);

function revalidar(id?: string) {
  revalidatePath("/app/estoque");
  revalidatePath("/app");
  if (id) revalidatePath(`/app/estoque/${id}`);
}

function lerProduto(fd: FormData) {
  const tipo = String(fd.get("tipo") ?? "venda");
  return {
    nome: String(fd.get("nome") ?? "").trim(),
    tipo,
    unidade: String(fd.get("unidade") ?? "un").trim() || "un",
    custo_centavos: centavos(fd.get("custo")),
    preco_venda_centavos: tipo === "insumo" ? null : centavos(fd.get("preco")),
    estoque_minimo: qtd(fd.get("estoque_minimo")),
    ativo: fd.get("ativo") === "on",
  };
}

export async function criarProduto(_: Estado, fd: FormData): Promise<Estado> {
  await exigirDono();
  const p = lerProduto(fd);
  if (!p.nome) return { erro: "Informe o nome." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("produtos").insert({ ...p, ativo: true }).select("id").single();
  if (error) return { erro: error.message };

  const inicial = qtd(fd.get("estoque_inicial"));
  if (inicial > 0) {
    await supabase.rpc("estoque_entrada", {
      p_produto_id: data.id,
      p_quantidade: inicial,
      p_custo_unit_centavos: p.custo_centavos,
      p_gerar_despesa: false,
      p_observacao: "Estoque inicial",
    });
  }
  revalidar();
  redirect(`/app/estoque/${data.id}`);
}

export async function salvarProduto(id: string, _: Estado, fd: FormData): Promise<Estado> {
  await exigirDono();
  const p = lerProduto(fd);
  if (!p.nome) return { erro: "Informe o nome." };
  const supabase = await createClient();
  const { error } = await supabase.from("produtos").update(p).eq("id", id);
  if (error) return { erro: error.message };
  revalidar(id);
  return { ok: "Salvo." };
}

export async function lancarEntrada(produtoId: string, _: Estado, fd: FormData): Promise<Estado> {
  await exigirDono();
  const quantidade = qtd(fd.get("quantidade"));
  if (quantidade <= 0) return { erro: "Informe a quantidade." };
  const custoTxt = String(fd.get("custo") ?? "").trim();
  const supabase = await createClient();
  const { error } = await supabase.rpc("estoque_entrada", {
    p_produto_id: produtoId,
    p_quantidade: quantidade,
    p_custo_unit_centavos: custoTxt ? centavos(custoTxt) : null,
    p_gerar_despesa: fd.get("gerar_despesa") === "on",
    p_observacao: String(fd.get("observacao") ?? ""),
  });
  if (error) return { erro: error.message };
  revalidar(produtoId);
  revalidatePath("/app/despesas");
  return { ok: "Entrada lançada." };
}

export async function lancarAjuste(produtoId: string, _: Estado, fd: FormData): Promise<Estado> {
  await exigirDono();
  const txt = String(fd.get("contado") ?? "").trim();
  if (txt === "") return { erro: "Informe quanto tem na prateleira." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("estoque_ajuste", {
    p_produto_id: produtoId,
    p_quantidade_contada: qtd(txt),
    p_observacao: String(fd.get("observacao") ?? ""),
  });
  if (error) return { erro: error.message };
  revalidar(produtoId);
  const d = Number(data);
  return { ok: d === 0 ? "Estoque já estava certo." : `Ajustado (${d > 0 ? "+" : ""}${d}).` };
}

// ---------- Fichas de insumo ----------
export async function adicionarInsumo(servicoId: string, _: Estado, fd: FormData): Promise<Estado> {
  await exigirDono();
  const produtoId = String(fd.get("produto_id") ?? "");
  const quantidade = qtd(fd.get("quantidade"));
  if (!produtoId || quantidade <= 0) return { erro: "Escolha o insumo e a quantidade." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("servico_insumos")
    .upsert({ servico_id: servicoId, produto_id: produtoId, quantidade });
  if (error) return { erro: error.message };
  revalidatePath("/app/estoque/fichas");
  return { ok: "Adicionado." };
}

export async function removerInsumo(servicoId: string, produtoId: string) {
  await exigirDono();
  const supabase = await createClient();
  await supabase.from("servico_insumos").delete().eq("servico_id", servicoId).eq("produto_id", produtoId);
  revalidatePath("/app/estoque/fichas");
}

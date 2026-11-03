"use server";

import { revalidatePath } from "next/cache";
import { exigirDono } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { intervaloMes, somarMes } from "@/lib/mes";

export type Estado = { erro?: string; ok?: string };

export async function criarDespesa(_: Estado, fd: FormData): Promise<Estado> {
  await exigirDono();
  const valor = Math.round(
    (parseFloat(String(fd.get("valor") ?? "").replace(/\./g, "").replace(",", ".")) || 0) * 100,
  );
  const descricao = String(fd.get("descricao") ?? "").trim();
  if (!descricao) return { erro: "Informe a descrição." };
  if (valor <= 0) return { erro: "Informe o valor." };

  const supabase = await createClient();
  const { error } = await supabase.from("despesas").insert({
    descricao,
    valor_centavos: valor,
    categoria_id: String(fd.get("categoria_id") ?? "") || null,
    data: String(fd.get("data") ?? "") || undefined,
    recorrente: fd.get("recorrente") === "on",
  });
  if (error) return { erro: error.message };
  revalidatePath("/app/despesas");
  revalidatePath("/app/resumo");
  return { ok: "Despesa lançada." };
}

export async function excluirDespesa(id: string) {
  await exigirDono();
  const supabase = await createClient();
  await supabase.from("despesas").delete().eq("id", id);
  revalidatePath("/app/despesas");
  revalidatePath("/app/resumo");
}

/** Copia as despesas recorrentes do mês anterior que ainda não foram lançadas neste mês */
export async function copiarRecorrentes(mes: string): Promise<number> {
  await exigirDono();
  const supabase = await createClient();
  const anterior = intervaloMes(somarMes(mes, -1));
  const atual = intervaloMes(mes);

  const [{ data: origem }, { data: jaTem }] = await Promise.all([
    supabase.from("despesas").select("descricao, valor_centavos, categoria_id, data")
      .eq("recorrente", true).gte("data", anterior.inicio).lt("data", anterior.fim),
    supabase.from("despesas").select("descricao").gte("data", atual.inicio).lt("data", atual.fim),
  ]);
  const existentes = new Set((jaTem ?? []).map((d) => d.descricao.toLowerCase()));
  const novas = (origem ?? [])
    .filter((d) => !existentes.has(d.descricao.toLowerCase()))
    .map((d) => {
      const dia = Math.min(Number(d.data.slice(8, 10)), 28);
      return {
        descricao: d.descricao,
        valor_centavos: d.valor_centavos,
        categoria_id: d.categoria_id,
        recorrente: true,
        data: `${mes}-${String(dia).padStart(2, "0")}`,
      };
    });
  if (novas.length) await supabase.from("despesas").insert(novas);
  revalidatePath("/app/despesas");
  revalidatePath("/app/resumo");
  return novas.length;
}

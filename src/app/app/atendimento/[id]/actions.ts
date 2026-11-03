"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ItemEnvio = { tipo: "servico" | "produto"; id: string; quantidade: number };

export async function finalizarAtendimento(input: {
  filaId: string;
  clienteId: string;
  barbeiroId: string;
  itens: ItemEnvio[];
  descontoCentavos: number;
  formaPagamento: string | null;
  observacoes: string;
}): Promise<{ erro: string } | void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("finalizar_atendimento", {
    p_fila_id: input.filaId,
    p_barbeiro_id: input.barbeiroId,
    p_itens: input.itens,
    p_desconto_centavos: Math.max(0, Math.round(input.descontoCentavos)),
    p_forma_pagamento: input.formaPagamento,
    p_observacoes: input.observacoes,
  });
  if (error) return { erro: error.message };

  revalidatePath("/app");
  revalidatePath(`/app/clientes/${input.clienteId}`);
  redirect(`/app?finalizado=${input.clienteId}`);
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Scissors } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Status = {
  status: "aguardando" | "em_atendimento" | "finalizado" | "desistiu";
  posicao: number;
  primeiro_nome: string;
  barbeiro: string | null;
} | null;

export function Posicao({ filaId }: { filaId: string }) {
  const supabase = useRef(createClient()).current;
  const [st, setSt] = useState<Status | undefined>(undefined);

  useEffect(() => {
    let vivo = true;
    const carregar = async () => {
      const { data } = await supabase.rpc("fila_status", { p_fila_id: filaId });
      if (vivo) setSt((data as Status) ?? null);
    };
    carregar();
    const t = setInterval(carregar, 10_000);
    const aoVoltar = () => document.visibilityState === "visible" && carregar();
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      vivo = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  }, [supabase, filaId]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-carvao px-6 text-center text-papel">
      <p className="text-xs font-semibold tracking-[0.25em] text-latao uppercase">Barbearia Jean Rodrigues</p>

      {st === undefined && <p className="mt-10 text-papel/60">Carregando...</p>}

      {st === null && (
        <>
          <h1 className="mt-8 text-2xl font-bold">Essa senha não está mais ativa</h1>
          <p className="mt-2 text-papel/60">Faça um novo check-in na recepção.</p>
        </>
      )}

      {st?.status === "aguardando" && (
        <>
          <h1 className="mt-8 text-2xl font-bold">{st.primeiro_nome}, você está na fila</h1>
          <p className="mt-8 text-papel/60">Sua posição</p>
          <p className="font-mono text-[8rem] leading-none font-black text-latao tabular-nums">{st.posicao}º</p>
          <p className="mt-6 max-w-xs text-papel/70">
            {st.posicao === 1 ? "Você é o próximo! Fique por perto." : `${st.posicao - 1} na sua frente. A página atualiza sozinha.`}
          </p>
        </>
      )}

      {st?.status === "em_atendimento" && (
        <>
          <Scissors className="mt-8 size-12 text-latao" />
          <h1 className="mt-4 text-3xl font-bold">Sua vez, {st.primeiro_nome}!</h1>
          {st.barbeiro && <p className="mt-2 text-xl text-papel/70">Com {st.barbeiro}</p>}
        </>
      )}

      {st?.status === "finalizado" && (
        <>
          <h1 className="mt-8 text-3xl font-bold">Valeu, {st.primeiro_nome}!</h1>
          <p className="mt-2 text-papel/60">Até a próxima.</p>
        </>
      )}

      {st?.status === "desistiu" && (
        <>
          <h1 className="mt-8 text-2xl font-bold">Você saiu da fila</h1>
          <p className="mt-2 text-papel/60">Se quiser voltar, faça um novo check-in.</p>
        </>
      )}
    </main>
  );
}

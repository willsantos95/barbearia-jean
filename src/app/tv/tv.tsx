"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Fila = {
  barbearia: string;
  atendendo: { barbeiro: string | null; cliente: string }[];
  aguardando: { posicao: number; cliente: string; preferencia: string | null }[];
};

export function TV() {
  const supabase = useRef(createClient()).current;
  const [fila, setFila] = useState<Fila | null>(null);
  const [agora, setAgora] = useState<Date | null>(null);

  useEffect(() => {
    const carregar = () =>
      supabase.rpc("fila_publica").then(({ data }) => data && setFila(data as Fila));
    carregar();
    const t = setInterval(carregar, 5_000);
    const r = setInterval(() => setAgora(new Date()), 1_000);
    setAgora(new Date());
    return () => {
      clearInterval(t);
      clearInterval(r);
    };
  }, [supabase]);

  const proximos = fila?.aguardando ?? [];

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-carvao p-[3vw] text-papel">
      <header className="flex items-end justify-between border-b border-papel/10 pb-[1.5vw]">
        <div>
          <p className="text-[1.1vw] font-semibold tracking-[0.3em] text-latao uppercase">Barbearia</p>
          <p className="text-[2.6vw] leading-none font-bold">{fila?.barbearia?.replace(/^Barbearia\s+/i, "") ?? ""}</p>
        </div>
        <p className="font-mono text-[3vw] leading-none font-bold tabular-nums">
          {agora?.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}
        </p>
      </header>

      <div className="grid flex-1 grid-cols-5 gap-[3vw] pt-[2.5vw]">
        <section className="col-span-2">
          <h2 className="text-[1.2vw] font-semibold tracking-[0.25em] text-papel/50 uppercase">Na cadeira</h2>
          <div className="mt-[1.5vw] space-y-[1.2vw]">
            {fila?.atendendo.length ? (
              fila.atendendo.map((a, i) => (
                <div key={i} className="rounded-[1vw] bg-carvao-2 p-[1.6vw]">
                  <p className="text-[1.2vw] text-latao">{a.barbeiro ?? "—"}</p>
                  <p className="text-[3vw] leading-tight font-bold">{a.cliente}</p>
                </div>
              ))
            ) : (
              <p className="text-[1.6vw] text-papel/40">Cadeiras livres</p>
            )}
          </div>
        </section>

        <section className="col-span-3">
          <h2 className="text-[1.2vw] font-semibold tracking-[0.25em] text-papel/50 uppercase">
            Próximos {proximos.length > 0 && <span className="text-latao">· {proximos.length} na fila</span>}
          </h2>
          {proximos.length === 0 ? (
            <div className="mt-[1.5vw]">
              <p className="text-[2.4vw] font-bold">Sem espera agora.</p>
              <p className="mt-[0.5vw] text-[1.4vw] text-papel/50">Faça seu check-in no tablet ou pelo QR code.</p>
            </div>
          ) : (
            <ol className="mt-[1.5vw] space-y-[0.8vw]">
              {proximos.slice(0, 8).map((p) => (
                <li
                  key={p.posicao}
                  className={
                    p.posicao === 1
                      ? "flex items-center gap-[1.5vw] rounded-[1vw] bg-latao px-[1.6vw] py-[1.2vw] text-carvao"
                      : "flex items-center gap-[1.5vw] border-b border-papel/10 px-[1.6vw] py-[0.9vw]"
                  }
                >
                  <span className="w-[4vw] font-mono text-[2.6vw] font-black tabular-nums">{p.posicao}º</span>
                  <span className={p.posicao === 1 ? "flex-1 text-[3vw] font-bold" : "flex-1 text-[2.2vw] font-semibold"}>
                    {p.cliente}
                  </span>
                  {p.preferencia && (
                    <span className={p.posicao === 1 ? "text-[1.2vw] font-semibold" : "text-[1.2vw] text-papel/50"}>
                      com {p.preferencia}
                    </span>
                  )}
                </li>
              ))}
              {proximos.length > 8 && (
                <li className="px-[1.6vw] pt-[0.5vw] text-[1.4vw] text-papel/50">+ {proximos.length - 8} aguardando</li>
              )}
            </ol>
          )}
        </section>
      </div>
    </main>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { Plus, Scissors, UserX } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Entrada = {
  id: string;
  status: "aguardando" | "em_atendimento";
  chegou_em: string;
  chamado_em: string | null;
  barbeiro_id: string | null;
  barbeiro_preferido_id: string | null;
  clientes: { id: string; nome: string; preferencias: string | null } | null;
  servicos: { nome: string } | null;
  barbeiro: { nome: string } | null;
};

type Barbeiro = { id: string; nome: string };

function minutosDesde(iso: string) {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
}

export function FilaAoVivo({ barbeiros, meuBarbeiroId, hoje }: { barbeiros: Barbeiro[]; meuBarbeiroId: string | null; hoje: string }) {
  const supabase = useRef(createClient()).current;
  const [fila, setFila] = useState<Entrada[]>([]);
  const [carregado, setCarregado] = useState(false);
  const [escolha, setEscolha] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const [adicionando, setAdicionando] = useState(false);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from("fila")
      .select(
        "id, status, chegou_em, chamado_em, barbeiro_id, barbeiro_preferido_id, clientes(id, nome, preferencias), servicos(nome), barbeiro:barbeiros!fila_barbeiro_id_fkey(nome)",
      )
      .eq("data", hoje)
      .in("status", ["aguardando", "em_atendimento"])
      .order("chegou_em");
    if (!error) setFila((data ?? []) as unknown as Entrada[]);
    setCarregado(true);
  }, [supabase, hoje]);

  useEffect(() => {
    carregar();
    const canal = supabase
      .channel("fila-painel")
      .on("postgres_changes", { event: "*", schema: "public", table: "fila" }, () => carregar())
      .subscribe();
    const poll = setInterval(carregar, 30_000); // reserva, caso o realtime caia
    const relogio = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => {
      supabase.removeChannel(canal);
      clearInterval(poll);
      clearInterval(relogio);
    };
  }, [supabase, carregar]);

  const nomeBarbeiro = (id: string | null) => barbeiros.find((b) => b.id === id)?.nome;
  const barbeiroPadrao = (e: Entrada) =>
    escolha[e.id] ?? e.barbeiro_preferido_id ?? meuBarbeiroId ?? barbeiros[0]?.id ?? "";

  async function chamar(e: Entrada) {
    setErro(null);
    setOcupado(e.id);
    const { error } = await supabase.rpc("fila_chamar", { p_fila_id: e.id, p_barbeiro_id: barbeiroPadrao(e) });
    setOcupado(null);
    if (error) setErro(error.message);
    carregar();
  }

  async function desistiu(e: Entrada) {
    if (!confirm(`${e.clientes?.nome ?? "Cliente"} saiu da fila?`)) return;
    setOcupado(e.id);
    await supabase.from("fila").update({ status: "desistiu", finalizado_em: new Date().toISOString() }).eq("id", e.id);
    setOcupado(null);
    carregar();
  }

  const aguardando = fila.filter((f) => f.status === "aguardando");
  const atendendo = fila.filter((f) => f.status === "em_atendimento");

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <section className="lg:col-span-2">
        <h2 className="text-xs font-semibold tracking-[0.18em] text-cinza uppercase">Na cadeira</h2>
        <div className="mt-3 space-y-3">
          {atendendo.length === 0 && <p className="cartao p-5 text-sm text-cinza">Ninguém sendo atendido.</p>}
          {atendendo.map((e) => (
            <div key={e.id} className="cartao border-l-4 border-l-latao p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-latao-escuro">{e.barbeiro?.nome ?? nomeBarbeiro(e.barbeiro_id)}</p>
                  <Link href={`/app/clientes/${e.clientes?.id}`} className="block truncate text-lg font-bold text-carvao hover:underline">
                    {e.clientes?.nome}
                  </Link>
                  <p className="text-sm text-cinza">
                    {e.servicos?.nome ?? "Serviço a definir"} · há {minutosDesde(e.chamado_em ?? e.chegou_em)} min
                  </p>
                  {e.clientes?.preferencias && (
                    <p className="mt-2 rounded-md bg-papel px-2 py-1 text-xs text-tinta">{e.clientes.preferencias}</p>
                  )}
                </div>
                <Link href={`/app/atendimento/${e.id}`} className="btn-primario shrink-0 py-2">
                  Finalizar
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="lg:col-span-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold tracking-[0.18em] text-cinza uppercase">
            Aguardando {aguardando.length > 0 && <span className="text-latao-escuro">· {aguardando.length}</span>}
          </h2>
          <button onClick={() => setAdicionando((v) => !v)} className="btn-secundario py-1.5 text-xs">
            <Plus className="size-3.5" /> Adicionar na fila
          </button>
        </div>

        {adicionando && <AdicionarNaFila onFeito={() => { setAdicionando(false); carregar(); }} />}
        {erro && <p className="mt-3 text-sm text-perigo">{erro}</p>}

        <div className="cartao mt-3 divide-y divide-linha">
          {carregado && aguardando.length === 0 && (
            <p className="p-5 text-sm text-cinza">Fila vazia. Os check-ins do tablet e do QR code aparecem aqui na hora.</p>
          )}
          {aguardando.map((e, i) => (
            <div key={e.id} className={clsx("flex flex-wrap items-center gap-3 p-4", i === 0 && "bg-latao/5")}>
              <span className="w-8 font-mono text-xl font-black text-latao-escuro tabular-nums">{i + 1}º</span>
              <div className="min-w-40 flex-1">
                <Link href={`/app/clientes/${e.clientes?.id}`} className="font-semibold text-carvao hover:underline">
                  {e.clientes?.nome}
                </Link>
                <p className="text-xs text-cinza">
                  {e.servicos?.nome ?? "Serviço a definir"}
                  {e.barbeiro_preferido_id && ` · prefere ${nomeBarbeiro(e.barbeiro_preferido_id)}`}
                  {` · esperando ${minutosDesde(e.chegou_em)} min`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {barbeiros.length > 1 && (
                  <select
                    value={barbeiroPadrao(e)}
                    onChange={(ev) => setEscolha((s) => ({ ...s, [e.id]: ev.target.value }))}
                    className="campo w-auto py-2"
                    aria-label="Barbeiro"
                  >
                    {barbeiros.map((b) => (
                      <option key={b.id} value={b.id}>{b.nome}</option>
                    ))}
                  </select>
                )}
                <button onClick={() => chamar(e)} disabled={ocupado === e.id} className="btn-latao py-2">
                  <Scissors className="size-4" /> Chamar
                </button>
                <button onClick={() => desistiu(e)} disabled={ocupado === e.id} className="btn-secundario px-2.5 py-2" title="Desistiu">
                  <UserX className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function AdicionarNaFila({ onFeito }: { onFeito: () => void }) {
  const supabase = useRef(createClient()).current;
  const [telefone, setTelefone] = useState("");
  const [nome, setNome] = useState("");
  const [precisaNome, setPrecisaNome] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault();
    setErro(null);
    setEnviando(true);
    const { error } = await supabase.rpc("checkin_registrar", {
      p_telefone: telefone,
      p_nome: nome || null,
      p_origem: "balcao",
    });
    setEnviando(false);
    if (error) {
      if (error.message.includes("nome")) {
        setPrecisaNome(true);
        return setErro("Cliente novo: informe o nome.");
      }
      return setErro(error.message);
    }
    onFeito();
  }

  return (
    <form onSubmit={enviar} className="cartao mt-3 flex flex-wrap items-end gap-3 p-4">
      <div className="min-w-44 flex-1">
        <label className="rotulo">Telefone</label>
        <input value={telefone} onChange={(e) => setTelefone(e.target.value)} inputMode="tel" required className="campo" autoFocus />
      </div>
      {precisaNome && (
        <div className="min-w-44 flex-1">
          <label className="rotulo">Nome</label>
          <input value={nome} onChange={(e) => setNome(e.target.value)} required className="campo" autoFocus />
        </div>
      )}
      <button disabled={enviando} className="btn-primario">{enviando ? "..." : "Colocar na fila"}</button>
      {erro && <p className="w-full text-sm text-perigo">{erro}</p>}
    </form>
  );
}

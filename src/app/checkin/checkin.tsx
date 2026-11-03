"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { ArrowLeft, Delete, Scissors } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { reais, telefoneParcial } from "@/lib/format";

type Opcoes = {
  barbearia: string;
  servicos: { id: string; nome: string; preco_centavos: number }[];
  barbeiros: { id: string; nome: string }[];
};

type Etapa = "telefone" | "confirmar" | "cadastro" | "escolha" | "pronto" | "ja-na-fila";

const INATIVIDADE_MS = 60_000;
const RESET_PRONTO_S = 10;

export function Checkin({ origem }: { origem: "totem" | "qr" }) {
  const router = useRouter();
  const supabase = useRef(createClient()).current;

  const [opcoes, setOpcoes] = useState<Opcoes | null>(null);
  const [etapa, setEtapa] = useState<Etapa>("telefone");
  const [telefone, setTelefone] = useState("");
  const [primeiroNome, setPrimeiroNome] = useState("");
  const [nome, setNome] = useState("");
  const [aceite, setAceite] = useState(false);
  const [servicoId, setServicoId] = useState<string | null>(null);
  const [barbeiroId, setBarbeiroId] = useState<string | null>(null);
  const [posicao, setPosicao] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [contagem, setContagem] = useState(RESET_PRONTO_S);

  const reiniciar = useCallback(() => {
    setEtapa("telefone");
    setTelefone("");
    setPrimeiroNome("");
    setNome("");
    setAceite(false);
    setServicoId(null);
    setBarbeiroId(null);
    setPosicao(null);
    setErro(null);
    setContagem(RESET_PRONTO_S);
  }, []);

  useEffect(() => {
    supabase.rpc("checkin_opcoes").then(({ data }) => setOpcoes(data as Opcoes));
  }, [supabase]);

  // Totem: volta ao início se ninguém mexer
  useEffect(() => {
    if (origem !== "totem" || etapa === "telefone") return;
    const t = setTimeout(reiniciar, INATIVIDADE_MS);
    return () => clearTimeout(t);
  }, [origem, etapa, telefone, nome, servicoId, barbeiroId, reiniciar]);

  // Tela final do totem com contagem regressiva
  useEffect(() => {
    if (origem !== "totem" || (etapa !== "pronto" && etapa !== "ja-na-fila")) return;
    if (contagem <= 0) {
      reiniciar();
      return;
    }
    const t = setTimeout(() => setContagem((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [origem, etapa, contagem, reiniciar]);

  async function buscar() {
    setErro(null);
    setCarregando(true);
    const { data, error } = await supabase.rpc("checkin_buscar", { p_telefone: telefone });
    setCarregando(false);
    if (error) return setErro("Confira o número com DDD.");
    const r = data as { encontrado: boolean; primeiro_nome?: string; fila_id?: string | null };
    if (r.encontrado && r.fila_id) {
      const { data: st } = await supabase.rpc("fila_status", { p_fila_id: r.fila_id });
      setPrimeiroNome(r.primeiro_nome ?? "");
      setPosicao((st as { posicao?: number } | null)?.posicao ?? null);
      if (origem === "qr") return router.push(`/fila/${r.fila_id}`);
      return setEtapa("ja-na-fila");
    }
    if (r.encontrado) {
      setPrimeiroNome(r.primeiro_nome ?? "");
      setEtapa("confirmar");
    } else {
      setEtapa("cadastro");
    }
  }

  async function registrar() {
    setErro(null);
    setCarregando(true);
    const { data, error } = await supabase.rpc("checkin_registrar", {
      p_telefone: telefone,
      p_nome: nome || null,
      p_servico_id: servicoId,
      p_barbeiro_id: barbeiroId,
      p_aceita_contato: aceite,
      p_origem: origem,
    });
    setCarregando(false);
    if (error) return setErro(error.message || "Não foi possível entrar na fila. Chame alguém da equipe.");
    const r = data as { fila_id: string; posicao: number; primeiro_nome: string };
    setPrimeiroNome(r.primeiro_nome);
    setPosicao(r.posicao);
    if (origem === "qr") return router.push(`/fila/${r.fila_id}`);
    setEtapa("pronto");
  }

  const digitos = telefone.replace(/\D/g, "");
  const tecla = (k: string) => {
    setErro(null);
    if (k === "apagar") return setTelefone((t) => t.slice(0, -1));
    if (digitos.length < 11) setTelefone((t) => t + k);
  };

  return (
    <main
      className={clsx(
        "flex min-h-dvh flex-col bg-carvao text-papel select-none",
        origem === "totem" && "touch-manipulation",
      )}
    >
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <div>
          <p className="text-xs font-semibold tracking-[0.25em] text-latao uppercase">Check-in</p>
          <p className="text-lg font-bold">{opcoes?.barbearia ?? "Barbearia"}</p>
        </div>
        {etapa !== "telefone" && etapa !== "pronto" && etapa !== "ja-na-fila" && (
          <button onClick={reiniciar} className="flex items-center gap-2 text-sm text-papel/60">
            <ArrowLeft className="size-4" /> Recomeçar
          </button>
        )}
      </header>

      <div className="flex flex-1 items-center justify-center px-6 pb-10">
        <div className="w-full max-w-xl">
          {etapa === "telefone" && (
            <div className="text-center">
              <h1 className="text-3xl font-bold sm:text-4xl">Digite seu celular</h1>
              <p className="mt-2 text-papel/60">Com DDD. É assim que a gente te encontra.</p>
              <p className="mt-8 h-14 font-mono text-4xl tracking-wider tabular-nums sm:text-5xl">
                {digitos ? telefoneParcial(digitos) : <span className="text-papel/25">(00) 00000-0000</span>}
              </p>
              <div className="mx-auto mt-8 grid max-w-sm grid-cols-3 gap-3">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((k) => (
                  <Tecla key={k} onClick={() => tecla(k)}>{k}</Tecla>
                ))}
                <span />
                <Tecla onClick={() => tecla("0")}>0</Tecla>
                <Tecla onClick={() => tecla("apagar")} aria-label="Apagar">
                  <Delete className="mx-auto size-7" />
                </Tecla>
              </div>
              {erro && <p className="mt-4 text-red-300">{erro}</p>}
              <button
                onClick={buscar}
                disabled={digitos.length < 10 || carregando}
                className="mt-8 w-full max-w-sm rounded-xl bg-latao py-5 text-xl font-bold text-carvao disabled:opacity-30"
              >
                {carregando ? "Buscando..." : "Continuar"}
              </button>
            </div>
          )}

          {etapa === "confirmar" && (
            <div className="text-center">
              <h1 className="text-4xl font-bold">Olá, {primeiroNome}!</h1>
              <p className="mt-3 text-xl text-papel/70">É você mesmo?</p>
              <div className="mx-auto mt-10 grid max-w-md grid-cols-2 gap-4">
                <button onClick={reiniciar} className="rounded-xl border border-papel/20 py-5 text-lg font-semibold">
                  Não sou eu
                </button>
                <button onClick={() => setEtapa("escolha")} className="rounded-xl bg-latao py-5 text-lg font-bold text-carvao">
                  Sou eu
                </button>
              </div>
            </div>
          )}

          {etapa === "cadastro" && (
            <div>
              <h1 className="text-3xl font-bold">Primeira vez aqui?</h1>
              <p className="mt-2 text-papel/60">Só precisamos do seu nome para te chamar.</p>
              <input
                autoFocus
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome"
                className="mt-8 w-full rounded-xl border border-papel/20 bg-carvao-2 px-5 py-4 text-2xl text-papel outline-none placeholder:text-papel/30 focus:border-latao"
              />
              <label className="mt-6 flex items-start gap-3 text-papel/80">
                <input
                  type="checkbox"
                  checked={aceite}
                  onChange={(e) => setAceite(e.target.checked)}
                  className="mt-1 size-5 accent-latao"
                />
                <span>Aceito receber mensagens da barbearia no WhatsApp (lembretes e promoções).</span>
              </label>
              <button
                onClick={() => setEtapa("escolha")}
                disabled={nome.trim().length < 2}
                className="mt-8 w-full rounded-xl bg-latao py-5 text-xl font-bold text-carvao disabled:opacity-30"
              >
                Continuar
              </button>
            </div>
          )}

          {etapa === "escolha" && opcoes && (
            <div>
              <h1 className="text-3xl font-bold">O que vai ser hoje?</h1>
              <div className="mt-6 grid grid-cols-2 gap-3">
                {opcoes.servicos.map((s) => (
                  <Opcao key={s.id} ativo={servicoId === s.id} onClick={() => setServicoId(servicoId === s.id ? null : s.id)}>
                    <span className="block text-lg font-bold">{s.nome}</span>
                    <span className="text-sm opacity-70">{reais(s.preco_centavos)}</span>
                  </Opcao>
                ))}
              </div>

              <h2 className="mt-8 text-xl font-bold">Com qual barbeiro?</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Opcao ativo={barbeiroId === null} onClick={() => setBarbeiroId(null)}>
                  <span className="font-bold">Quem estiver livre</span>
                </Opcao>
                {opcoes.barbeiros.map((b) => (
                  <Opcao key={b.id} ativo={barbeiroId === b.id} onClick={() => setBarbeiroId(b.id)}>
                    <span className="font-bold">{b.nome}</span>
                  </Opcao>
                ))}
              </div>

              {erro && <p className="mt-4 text-red-300">{erro}</p>}
              <button
                onClick={registrar}
                disabled={carregando}
                className="mt-8 w-full rounded-xl bg-latao py-5 text-xl font-bold text-carvao disabled:opacity-30"
              >
                {carregando ? "Entrando..." : "Entrar na fila"}
              </button>
            </div>
          )}

          {(etapa === "pronto" || etapa === "ja-na-fila") && (
            <div className="text-center">
              <Scissors className="mx-auto size-10 text-latao" />
              <h1 className="mt-4 text-3xl font-bold">
                {etapa === "pronto" ? `Pronto, ${primeiroNome}!` : `${primeiroNome}, você já está na fila`}
              </h1>
              {posicao ? (
                <>
                  <p className="mt-8 text-papel/60">Sua posição</p>
                  <p className="font-mono text-[9rem] leading-none font-black text-latao tabular-nums">{posicao}º</p>
                  <p className="mt-4 text-papel/70">Fique de olho na TV. A gente chama pelo nome.</p>
                </>
              ) : (
                <p className="mt-6 text-xl text-papel/70">Você está sendo atendido agora.</p>
              )}
              <button onClick={reiniciar} className="mt-10 text-sm text-papel/50">
                Voltar ao início ({contagem}s)
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function Tecla({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="rounded-xl bg-carvao-2 py-5 text-3xl font-semibold transition-colors active:bg-latao active:text-carvao"
    >
      {children}
    </button>
  );
}

function Opcao({ ativo, children, onClick }: { ativo: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "rounded-xl border-2 px-4 py-4 text-left transition-colors",
        ativo ? "border-latao bg-latao text-carvao" : "border-papel/15 bg-carvao-2 text-papel",
      )}
    >
      {children}
    </button>
  );
}

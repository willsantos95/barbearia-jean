import Link from "next/link";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { getUsuario } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { reais } from "@/lib/format";
import { FilaAoVivo } from "./fila-ao-vivo";

function hojeSP() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

type AtendimentoHoje = {
  id: string;
  data: string;
  total_centavos: number;
  clientes: { nome: string } | null;
  barbeiros: { nome: string } | null;
};

export default async function PainelPage({ searchParams }: { searchParams: Promise<{ finalizado?: string }> }) {
  const { finalizado } = await searchParams;
  const usuario = await getUsuario();
  const supabase = await createClient();
  const hoje = hojeSP();
  // início do dia em São Paulo (UTC-3)
  const inicioDia = new Date(`${hoje}T00:00:00-03:00`).toISOString();

  const [{ data: barbeiros }, { data: atendimentosRaw }, alertas, clienteFinalizado] = await Promise.all([
    supabase.from("barbeiros").select("id, nome, usuario_id").eq("ativo", true).order("nome"),
    supabase
      .from("atendimentos")
      .select("id, data, total_centavos, clientes(nome), barbeiros(nome)")
      .gte("data", inicioDia)
      .order("data", { ascending: false }),
    usuario.papel === "dono"
      ? supabase.from("alertas").select("id, mensagem").eq("lido", false).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as { id: string; mensagem: string }[] }),
    finalizado
      ? supabase.from("clientes").select("id, nome").eq("id", finalizado).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const atendimentos = (atendimentosRaw ?? []) as unknown as AtendimentoHoje[];
  const meuBarbeiro = barbeiros?.find((b) => b.usuario_id === usuario.id)?.id ?? null;
  const faturamentoHoje = atendimentos.reduce((s, a) => s + a.total_centavos, 0);

  const dataExtenso = new Date().toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-cinza capitalize">{dataExtenso}</p>
          <h1 className="titulo-pagina">Olá, {usuario.nome.split(" ")[0]}</h1>
        </div>
        <div className="flex gap-6 text-right">
          <div>
            <p className="text-xs font-semibold tracking-wide text-cinza uppercase">{usuario.papel === "dono" ? "Atendidos hoje" : "Seus atendimentos hoje"}</p>
            <p className="font-mono text-2xl font-bold tabular-nums">{atendimentos.length}</p>
          </div>
          {usuario.papel === "dono" && (
            <div>
              <p className="text-xs font-semibold tracking-wide text-cinza uppercase">Faturado hoje</p>
              <p className="font-mono text-2xl font-bold tabular-nums">{reais(faturamentoHoje)}</p>
            </div>
          )}
        </div>
      </div>

      {clienteFinalizado.data && (
        <div className="cartao flex flex-wrap items-center justify-between gap-3 border-ok/30 bg-ok/5 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-ok">
            <CircleCheck className="size-4" /> Atendimento de {clienteFinalizado.data.nome} salvo.
          </p>
          <Link href={`/app/clientes/${clienteFinalizado.data.id}`} className="text-sm font-semibold underline underline-offset-4">
            Adicionar foto do corte
          </Link>
        </div>
      )}

      {(alertas.data?.length ?? 0) > 0 && (
        <div className="cartao border-latao/40 bg-latao/5 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-latao-escuro">
            <TriangleAlert className="size-4" /> Estoque baixo
          </p>
          <ul className="mt-1 text-sm">
            {alertas.data!.map((a) => (
              <li key={a.id}>{a.mensagem}</li>
            ))}
          </ul>
          <Link href="/app/estoque" className="mt-2 inline-block text-sm font-semibold underline underline-offset-4">
            Ver estoque
          </Link>
        </div>
      )}

      <FilaAoVivo barbeiros={(barbeiros ?? []).map(({ id, nome }) => ({ id, nome }))} meuBarbeiroId={meuBarbeiro} hoje={hoje} />

      <section>
        <h2 className="text-xs font-semibold tracking-[0.18em] text-cinza uppercase">
          {usuario.papel === "dono" ? "Atendimentos de hoje" : "Seus atendimentos de hoje"}
        </h2>
        <div className="cartao mt-3 divide-y divide-linha">
          {atendimentos.length === 0 && <p className="p-5 text-sm text-cinza">Nenhum atendimento finalizado ainda.</p>}
          {atendimentos.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="w-12 font-mono text-cinza tabular-nums">
                {new Date(a.data).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className="flex-1 font-semibold">{a.clientes?.nome ?? "—"}</span>
              <span className="text-cinza">{a.barbeiros?.nome}</span>
              {usuario.papel === "dono" && <span className="w-24 text-right font-mono tabular-nums">{reais(a.total_centavos)}</span>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

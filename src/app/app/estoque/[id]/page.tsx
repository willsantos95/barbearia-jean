import Link from "next/link";
import { notFound } from "next/navigation";
import { clsx } from "clsx";
import { ArrowLeft } from "lucide-react";
import { exigirDono } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dataHoraFmt, reais } from "@/lib/format";
import { ProdutoForm } from "../produto-form";
import { Movimentar } from "../movimentar";
import { salvarProduto } from "../actions";

const TIPO_MOV: Record<string, string> = {
  entrada: "Entrada",
  saida_venda: "Venda",
  saida_insumo: "Uso em serviço",
  ajuste: "Ajuste",
};

type Mov = {
  id: string;
  created_at: string;
  tipo: string;
  quantidade: number;
  custo_unit_centavos: number | null;
  observacao: string | null;
  usuarios: { nome: string } | null;
};

export default async function ProdutoPage({ params }: { params: Promise<{ id: string }> }) {
  await exigirDono();
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: p }, { data: movsRaw }, { data: fichas }] = await Promise.all([
    supabase.from("produtos").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("movimentacoes_estoque")
      .select("id, created_at, tipo, quantidade, custo_unit_centavos, observacao, usuarios(nome)")
      .eq("produto_id", id)
      .order("created_at", { ascending: false })
      .limit(60),
    supabase.from("servico_insumos").select("quantidade, servicos(nome)").eq("produto_id", id),
  ]);
  if (!p) notFound();

  const atual = Number(p.estoque_atual);
  const minimo = Number(p.estoque_minimo);
  const movs = (movsRaw ?? []) as unknown as Mov[];
  const usos = (fichas ?? []) as unknown as { quantidade: number; servicos: { nome: string } | null }[];

  return (
    <div className="space-y-6">
      <Link href="/app/estoque" className="inline-flex items-center gap-1 text-sm text-cinza hover:text-carvao">
        <ArrowLeft className="size-4" /> Estoque
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="titulo-pagina">{p.nome}</h1>
          <p className={clsx("mt-1 text-sm", atual <= minimo ? "font-semibold text-perigo" : "text-cinza")}>
            {atual.toLocaleString("pt-BR")} {p.unidade} em estoque · mínimo {minimo.toLocaleString("pt-BR")}
          </p>
        </div>
        <Movimentar produtoId={p.id} nome={p.nome} unidade={p.unidade} atual={atual} custoCentavos={p.custo_centavos} />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-2">
          <section className="cartao p-6">
            <h2 className="mb-4 font-semibold text-carvao">Dados</h2>
            <ProdutoForm action={salvarProduto.bind(null, p.id)} inicial={{ ...p, estoque_minimo: minimo }} />
          </section>
          {usos.length > 0 && (
            <section className="cartao p-6">
              <h2 className="font-semibold text-carvao">Usado nos serviços</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {usos.map((u, i) => (
                  <li key={i}>{u.servicos?.nome}: {Number(u.quantidade)} {p.unidade} por atendimento</li>
                ))}
              </ul>
              <Link href="/app/estoque/fichas" className="mt-2 inline-block text-sm underline underline-offset-4">Editar fichas</Link>
            </section>
          )}
        </div>

        <section className="cartao lg:col-span-3">
          <h2 className="border-b border-linha px-6 py-4 font-semibold text-carvao">Movimentações</h2>
          {movs.length === 0 ? (
            <p className="p-6 text-sm text-cinza">Nenhuma movimentação ainda.</p>
          ) : (
            <ul className="divide-y divide-linha">
              {movs.map((m) => {
                const q = Number(m.quantidade);
                return (
                  <li key={m.id} className="flex items-center gap-4 px-6 py-3 text-sm">
                    <span className={clsx("w-16 text-right font-mono font-bold tabular-nums", q > 0 ? "text-ok" : "text-perigo")}>
                      {q > 0 ? "+" : ""}{q.toLocaleString("pt-BR")}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium">{TIPO_MOV[m.tipo] ?? m.tipo}{m.observacao ? ` · ${m.observacao}` : ""}</p>
                      <p className="text-xs text-cinza">
                        {dataHoraFmt(m.created_at)}
                        {m.usuarios?.nome && ` · ${m.usuarios.nome}`}
                        {m.custo_unit_centavos != null && ` · ${reais(m.custo_unit_centavos)}/${p.unidade}`}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

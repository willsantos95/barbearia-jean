import Link from "next/link";
import { clsx } from "clsx";
import { FileSpreadsheet, ListChecks, Plus } from "lucide-react";
import { exigirDono } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { reais } from "@/lib/format";
import { Movimentar } from "./movimentar";

type Filtro = "todos" | "venda" | "insumo" | "bar" | "baixo" | "inativos";

const TIPO: Record<string, string> = { venda: "Venda", insumo: "Insumo", bar: "Bar" };

const fmtQtd = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });

export default async function EstoquePage({ searchParams }: { searchParams: Promise<{ f?: Filtro }> }) {
  await exigirDono();
  const { f = "todos" } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("produtos").select("*").order("nome");

  const todos = (data ?? []).map((p) => ({
    ...p,
    estoque_atual: Number(p.estoque_atual),
    estoque_minimo: Number(p.estoque_minimo),
  }));
  const ativos = todos.filter((p) => p.ativo);
  const baixo = ativos.filter((p) => p.estoque_atual <= p.estoque_minimo);
  const valorEstoque = ativos.reduce((s, p) => s + Math.max(p.estoque_atual, 0) * p.custo_centavos, 0);

  const lista =
    f === "baixo" ? baixo
    : f === "inativos" ? todos.filter((p) => !p.ativo)
    : f === "todos" ? ativos
    : ativos.filter((p) => p.tipo === f);

  const filtros: { id: Filtro; label: string }[] = [
    { id: "todos", label: "Todos" },
    { id: "venda", label: "Venda" },
    { id: "insumo", label: "Insumos" },
    { id: "bar", label: "Bar" },
    { id: "baixo", label: `Abaixo do mínimo (${baixo.length})` },
    { id: "inativos", label: "Inativos" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="titulo-pagina">Estoque</h1>
        <div className="flex flex-wrap gap-2">
          <a href="/app/exportar/estoque" download className="btn-secundario">
            <FileSpreadsheet className="size-4" /> Exportar Excel
          </a>
          <Link href="/app/estoque/fichas" className="btn-secundario">
            <ListChecks className="size-4" /> Fichas de insumo
          </Link>
          <Link href="/app/estoque/novo" className="btn-primario">
            <Plus className="size-4" /> Novo produto
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="cartao p-4">
          <p className="text-xs font-semibold tracking-wide text-cinza uppercase">Produtos ativos</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums">{ativos.length}</p>
        </div>
        <Link href="/app/estoque?f=baixo" className={clsx("cartao p-4", baixo.length > 0 && "border-perigo/30 bg-perigo/5")}>
          <p className="text-xs font-semibold tracking-wide text-cinza uppercase">Abaixo do mínimo</p>
          <p className={clsx("mt-1 font-mono text-2xl font-bold tabular-nums", baixo.length > 0 && "text-perigo")}>{baixo.length}</p>
        </Link>
        <div className="cartao p-4">
          <p className="text-xs font-semibold tracking-wide text-cinza uppercase">Valor parado (custo)</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums">{reais(valorEstoque)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border border-linha bg-white p-1">
        {filtros.map((x) => (
          <Link
            key={x.id}
            href={x.id === "todos" ? "/app/estoque" : `/app/estoque?f=${x.id}`}
            className={clsx("rounded-md px-3 py-1.5 text-sm font-medium", f === x.id ? "bg-carvao text-papel" : "text-cinza hover:text-carvao")}
          >
            {x.label}
          </Link>
        ))}
      </div>

      <div className="cartao overflow-x-auto">
        {lista.length === 0 ? (
          <p className="p-10 text-center text-sm text-cinza">Nenhum produto aqui.</p>
        ) : (
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-linha bg-papel-2/60 text-left text-xs tracking-wide text-cinza uppercase">
              <tr>
                <th className="px-4 py-3 font-semibold">Produto</th>
                <th className="px-4 py-3 text-right font-semibold">Estoque</th>
                <th className="px-4 py-3 text-right font-semibold">Mínimo</th>
                <th className="hidden px-4 py-3 text-right font-semibold md:table-cell">Custo</th>
                <th className="hidden px-4 py-3 text-right font-semibold md:table-cell">Venda</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-linha">
              {lista.map((p) => {
                const abaixo = p.estoque_atual <= p.estoque_minimo;
                return (
                  <tr key={p.id} className="hover:bg-papel/60">
                    <td className="px-4 py-3">
                      <Link href={`/app/estoque/${p.id}`} className="font-semibold text-carvao hover:underline">{p.nome}</Link>
                      <span className="block text-xs text-cinza">{TIPO[p.tipo]} · {p.unidade}</span>
                    </td>
                    <td className={clsx("px-4 py-3 text-right font-mono font-bold tabular-nums", abaixo ? "text-perigo" : "text-carvao")}>
                      {fmtQtd(p.estoque_atual)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-cinza tabular-nums">{fmtQtd(p.estoque_minimo)}</td>
                    <td className="hidden px-4 py-3 text-right font-mono tabular-nums md:table-cell">{reais(p.custo_centavos)}</td>
                    <td className="hidden px-4 py-3 text-right font-mono tabular-nums md:table-cell">
                      {p.preco_venda_centavos != null ? reais(p.preco_venda_centavos) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <Movimentar
                          compacto
                          produtoId={p.id}
                          nome={p.nome}
                          unidade={p.unidade}
                          atual={p.estoque_atual}
                          custoCentavos={p.custo_centavos}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-sm text-cinza">
        Vendas e serviços dão baixa sozinhos ao finalizar o atendimento. Use <b>Entrada</b> quando chegar mercadoria e <b>Ajustar</b> depois de contar a prateleira.
      </p>
    </div>
  );
}

import { Repeat } from "lucide-react";
import { exigirDono } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dataFmt, reais } from "@/lib/format";
import { intervaloMes, mesAtual, mesValido } from "@/lib/mes";
import { FormAcao } from "@/components/form-acao";
import { MesSeletor } from "@/components/mes-seletor";
import { criarDespesa } from "./actions";
import { CopiarRecorrentes, ExcluirDespesa } from "./botoes";

type Despesa = {
  id: string;
  descricao: string;
  valor_centavos: number;
  data: string;
  recorrente: boolean;
  movimentacao_id: string | null;
  categorias_despesa: { nome: string } | null;
};

export default async function DespesasPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  await exigirDono();
  const mes = mesValido((await searchParams).mes);
  const { inicio, fim } = intervaloMes(mes);
  const supabase = await createClient();

  const [{ data: raw }, { data: categorias }] = await Promise.all([
    supabase
      .from("despesas")
      .select("id, descricao, valor_centavos, data, recorrente, movimentacao_id, categorias_despesa(nome)")
      .gte("data", inicio)
      .lt("data", fim)
      .order("data", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("categorias_despesa").select("id, nome").order("nome"),
  ]);
  const despesas = (raw ?? []) as unknown as Despesa[];
  const total = despesas.reduce((s, d) => s + d.valor_centavos, 0);

  const porCategoria = Object.entries(
    despesas.reduce<Record<string, number>>((acc, d) => {
      const k = d.categorias_despesa?.nome ?? "Sem categoria";
      acc[k] = (acc[k] ?? 0) + d.valor_centavos;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const dataPadrao = mes === mesAtual() ? hoje : `${mes}-01`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="titulo-pagina">Despesas</h1>
          <p className="text-sm text-cinza">Total do mês: <span className="font-mono font-semibold text-carvao">{reais(total)}</span></p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CopiarRecorrentes mes={mes} />
          <MesSeletor mes={mes} base="/app/despesas" />
        </div>
      </div>

      <section className="cartao p-5">
        <h2 className="font-semibold text-carvao">Nova despesa</h2>
        <FormAcao action={criarDespesa} botao="Lançar" resetar className="mt-3 grid items-end gap-3 md:grid-cols-[1fr_12rem_8rem_10rem_auto_auto]">
          <div>
            <label className="rotulo">Descrição</label>
            <input name="descricao" required placeholder="Ex.: Aluguel de novembro" className="campo" />
          </div>
          <div>
            <label className="rotulo">Categoria</label>
            <select name="categoria_id" className="campo" defaultValue="">
              <option value="">Sem categoria</option>
              {(categorias ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="rotulo">Valor (R$)</label>
            <input name="valor" inputMode="decimal" required placeholder="0,00" className="campo" />
          </div>
          <div>
            <label className="rotulo">Data</label>
            <input name="data" type="date" defaultValue={dataPadrao} className="campo" />
          </div>
          <label className="flex items-center gap-2 pb-2.5 text-sm whitespace-nowrap">
            <input type="checkbox" name="recorrente" className="size-4 accent-latao" /> Fixa todo mês
          </label>
        </FormAcao>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="cartao lg:col-span-2">
          {despesas.length === 0 ? (
            <p className="p-8 text-center text-sm text-cinza">Nenhuma despesa neste mês.</p>
          ) : (
            <ul className="divide-y divide-linha">
              {despesas.map((d) => (
                <li key={d.id} className="flex items-center gap-4 px-5 py-3 text-sm">
                  <span className="w-20 font-mono text-cinza tabular-nums">{dataFmt(d.data).slice(0, 5)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {d.descricao}
                      {d.recorrente && <Repeat className="ml-1.5 inline size-3.5 text-latao-escuro" aria-label="Fixa" />}
                    </p>
                    <p className="text-xs text-cinza">
                      {d.categorias_despesa?.nome ?? "Sem categoria"}
                      {d.movimentacao_id && " · gerada pela entrada de estoque"}
                    </p>
                  </div>
                  <span className="font-mono font-semibold tabular-nums">{reais(d.valor_centavos)}</span>
                  <ExcluirDespesa id={d.id} descricao={d.descricao} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="cartao p-5">
          <h2 className="font-semibold text-carvao">Por categoria</h2>
          {porCategoria.length === 0 ? (
            <p className="mt-2 text-sm text-cinza">—</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {porCategoria.map(([nome, valor]) => (
                <li key={nome} className="text-sm">
                  <div className="flex justify-between">
                    <span>{nome}</span>
                    <span className="font-mono tabular-nums">{reais(valor)}</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-papel-2">
                    <div className="h-1.5 rounded-full bg-latao" style={{ width: `${(valor / total) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

import Link from "next/link";
import { clsx } from "clsx";
import { Cake, MessageCircle } from "lucide-react";
import { getUsuario } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dataFmt, diasDesde, reais, telefoneFmt, whatsappLink } from "@/lib/format";
import { mesValido } from "@/lib/mes";
import { MesSeletor } from "@/components/mes-seletor";
import { BarrasDia } from "./barras-dia";

type Resumo = {
  mes: string;
  atendimentos: number;
  por_barbeiro: { barbeiro: string; atendimentos: number; faturamento_centavos?: number }[];
  faturamento_centavos?: number;
  descontos_centavos?: number;
  despesas_centavos?: number;
  lucro_centavos?: number;
  ticket_medio_centavos?: number;
  por_dia?: { dia: string; atendimentos: number; faturamento_centavos: number }[];
  por_pagamento?: { forma: string; qtd: number; total_centavos: number }[];
  top_servicos?: { nome: string; qtd: number; receita_centavos: number }[];
  top_produtos?: { nome: string; qtd: number; receita_centavos: number }[];
  despesas_por_categoria?: { categoria: string; total_centavos: number }[];
  clientes_atendidos?: number;
  clientes_novos?: number;
  clientes_recorrentes?: number;
  clientes_cadastrados_no_mes?: number;
};

type ClienteMini = { id: string; nome: string; telefone: string; aniversario: string | null; ultima_visita: string | null; aceita_contato: boolean };

const PAGAMENTO: Record<string, string> = {
  pix: "Pix", dinheiro: "Dinheiro", debito: "Débito", credito: "Crédito", outro: "Outro", nao_informado: "Não informado",
};

function Kpi({ rotulo, valor, detalhe, destaque }: { rotulo: string; valor: string; detalhe?: string; destaque?: "neg" }) {
  return (
    <div className="cartao p-4">
      <p className="text-xs font-semibold tracking-wide text-cinza uppercase">{rotulo}</p>
      <p className={clsx("mt-1 font-mono text-2xl font-bold tabular-nums", destaque === "neg" ? "text-perigo" : "text-carvao")}>{valor}</p>
      {detalhe && <p className="mt-0.5 text-xs text-cinza">{detalhe}</p>}
    </div>
  );
}

/** Lista com barra horizontal proporcional (uma cor, rótulo e valor em texto) */
function ListaBarras({ itens, vazio }: { itens: { nome: string; valor: number; texto: string; sub?: string }[]; vazio: string }) {
  if (!itens.length) return <p className="mt-2 text-sm text-cinza">{vazio}</p>;
  const max = Math.max(...itens.map((i) => i.valor), 1);
  return (
    <ul className="mt-3 space-y-3">
      {itens.map((i) => (
        <li key={i.nome} className="text-sm">
          <div className="flex justify-between gap-3">
            <span className="truncate">{i.nome}{i.sub && <span className="text-cinza"> · {i.sub}</span>}</span>
            <span className="shrink-0 font-mono tabular-nums">{i.texto}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-papel-2">
            <div className="h-1.5 rounded-full bg-latao" style={{ width: `${(i.valor / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function ResumoPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const mes = mesValido((await searchParams).mes);
  const usuario = await getUsuario();
  const dono = usuario.papel === "dono";
  const supabase = await createClient();

  const [{ data, error }, { data: aniv }, { data: sumidos }] = await Promise.all([
    supabase.rpc("resumo_mensal", { p_mes: `${mes}-01` }),
    supabase.rpc("aniversariantes", { p_mes: Number(mes.slice(5, 7)) }),
    supabase.rpc("clientes_sumidos", {}).limit(10),
  ]);
  const r = data as Resumo | null;
  const aniversariantes = (aniv ?? []) as ClienteMini[];
  const listaSumidos = (sumidos ?? []) as ClienteMini[];

  const fmtQtd = (n: number) => Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 3 });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="titulo-pagina">Resumo mensal</h1>
        <MesSeletor mes={mes} base="/app/resumo" />
      </div>

      {error || !r ? (
        <p className="cartao p-6 text-sm text-perigo">Não foi possível carregar o resumo. {error?.message}</p>
      ) : (
        <>
          {dono ? (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                <Kpi rotulo="Faturamento" valor={reais(r.faturamento_centavos)} detalhe={r.descontos_centavos ? `${reais(r.descontos_centavos)} em descontos` : undefined} />
                <Kpi rotulo="Despesas" valor={reais(r.despesas_centavos)} />
                <Kpi rotulo="Lucro" valor={reais(r.lucro_centavos)} destaque={(r.lucro_centavos ?? 0) < 0 ? "neg" : undefined} detalhe="faturamento − despesas" />
                <Kpi rotulo="Atendimentos" valor={String(r.atendimentos)} />
                <Kpi rotulo="Ticket médio" valor={reais(r.ticket_medio_centavos)} />
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Kpi rotulo="Clientes atendidos" valor={String(r.clientes_atendidos ?? 0)} />
                <Kpi rotulo="Novos" valor={String(r.clientes_novos ?? 0)} detalhe="primeira visita no mês" />
                <Kpi rotulo="Recorrentes" valor={String(r.clientes_recorrentes ?? 0)} detalhe="já tinham vindo antes" />
                <Kpi rotulo="Cadastros no mês" valor={String(r.clientes_cadastrados_no_mes ?? 0)} />
              </div>

              <section className="cartao p-5">
                <h2 className="font-semibold text-carvao">Faturamento por dia</h2>
                <BarrasDia mes={mes} dias={r.por_dia ?? []} />
              </section>

              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                <section className="cartao p-5">
                  <h2 className="font-semibold text-carvao">Por barbeiro</h2>
                  <ListaBarras
                    vazio="Sem atendimentos."
                    itens={r.por_barbeiro.map((b) => ({
                      nome: b.barbeiro,
                      sub: `${b.atendimentos} atend.`,
                      valor: b.faturamento_centavos ?? 0,
                      texto: reais(b.faturamento_centavos),
                    }))}
                  />
                </section>
                <section className="cartao p-5">
                  <h2 className="font-semibold text-carvao">Formas de pagamento</h2>
                  <ListaBarras
                    vazio="Sem pagamentos."
                    itens={(r.por_pagamento ?? []).map((p) => ({
                      nome: PAGAMENTO[p.forma] ?? p.forma,
                      sub: `${p.qtd}×`,
                      valor: p.total_centavos,
                      texto: reais(p.total_centavos),
                    }))}
                  />
                </section>
                <section className="cartao p-5">
                  <h2 className="font-semibold text-carvao">Despesas por categoria</h2>
                  <ListaBarras
                    vazio="Sem despesas lançadas."
                    itens={(r.despesas_por_categoria ?? []).map((d) => ({ nome: d.categoria, valor: d.total_centavos, texto: reais(d.total_centavos) }))}
                  />
                  <Link href={`/app/despesas?mes=${mes}`} className="mt-3 inline-block text-sm underline underline-offset-4">Ver despesas</Link>
                </section>
                <section className="cartao p-5">
                  <h2 className="font-semibold text-carvao">Serviços mais feitos</h2>
                  <ListaBarras
                    vazio="Nenhum serviço."
                    itens={(r.top_servicos ?? []).map((s) => ({ nome: s.nome, sub: reais(s.receita_centavos), valor: s.qtd, texto: `${fmtQtd(s.qtd)}×` }))}
                  />
                </section>
                <section className="cartao p-5">
                  <h2 className="font-semibold text-carvao">Produtos mais vendidos</h2>
                  <ListaBarras
                    vazio="Nenhum produto vendido."
                    itens={(r.top_produtos ?? []).map((s) => ({ nome: s.nome, sub: reais(s.receita_centavos), valor: s.qtd, texto: `${fmtQtd(s.qtd)}×` }))}
                  />
                </section>
              </div>
            </>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              <Kpi rotulo="Atendimentos no mês" valor={String(r.atendimentos)} />
              <section className="cartao p-5">
                <h2 className="font-semibold text-carvao">Atendimentos por barbeiro</h2>
                <ListaBarras
                  vazio="Sem atendimentos."
                  itens={r.por_barbeiro.map((b) => ({ nome: b.barbeiro, valor: b.atendimentos, texto: String(b.atendimentos) }))}
                />
              </section>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="cartao p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-carvao">Clientes sumidos</h2>
                <Link href="/app/clientes?f=sumidos" className="text-sm underline underline-offset-4">Ver todos</Link>
              </div>
              {listaSumidos.length === 0 ? (
                <p className="mt-2 text-sm text-cinza">Ninguém sumido. Boa!</p>
              ) : (
                <ul className="mt-2 divide-y divide-linha text-sm">
                  {listaSumidos.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                      <Link href={`/app/clientes/${c.id}`} className="truncate font-medium hover:underline">{c.nome}</Link>
                      <span className="flex shrink-0 items-center gap-3 text-cinza">
                        há {diasDesde(c.ultima_visita)} dias
                        {c.aceita_contato && (
                          <a href={whatsappLink(c.telefone)} target="_blank" className="text-latao-escuro" aria-label={`WhatsApp de ${c.nome}`}>
                            <MessageCircle className="size-4" />
                          </a>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="cartao p-5">
              <h2 className="flex items-center gap-2 font-semibold text-carvao">
                <Cake className="size-4 text-latao-escuro" /> Aniversariantes do mês
              </h2>
              {aniversariantes.length === 0 ? (
                <p className="mt-2 text-sm text-cinza">Nenhum aniversário cadastrado neste mês.</p>
              ) : (
                <ul className="mt-2 divide-y divide-linha text-sm">
                  {aniversariantes.map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                      <span className="flex items-center gap-3">
                        <span className="w-12 font-mono text-cinza tabular-nums">{dataFmt(c.aniversario).slice(0, 5)}</span>
                        <Link href={`/app/clientes/${c.id}`} className="font-medium hover:underline">{c.nome}</Link>
                      </span>
                      <span className="flex items-center gap-3 text-cinza">
                        <span className="hidden font-mono sm:inline">{telefoneFmt(c.telefone)}</span>
                        {c.aceita_contato && (
                          <a href={whatsappLink(c.telefone)} target="_blank" className="text-latao-escuro" aria-label={`WhatsApp de ${c.nome}`}>
                            <MessageCircle className="size-4" />
                          </a>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { exigirDono } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { FormAcao } from "@/components/form-acao";
import { adicionarInsumo } from "../actions";
import { RemoverInsumo } from "./remover";

type Ficha = { servico_id: string; produto_id: string; quantidade: number; produtos: { nome: string; unidade: string } | null };

export default async function FichasPage() {
  await exigirDono();
  const supabase = await createClient();
  const [{ data: servicos }, { data: fichasRaw }, { data: insumos }] = await Promise.all([
    supabase.from("servicos").select("id, nome, ativo").order("ordem").order("nome"),
    supabase.from("servico_insumos").select("servico_id, produto_id, quantidade, produtos(nome, unidade)"),
    supabase.from("produtos").select("id, nome, unidade, tipo").eq("ativo", true).order("tipo").order("nome"),
  ]);
  const fichas = (fichasRaw ?? []) as unknown as Ficha[];

  return (
    <div className="space-y-6">
      <Link href="/app/estoque" className="inline-flex items-center gap-1 text-sm text-cinza hover:text-carvao">
        <ArrowLeft className="size-4" /> Estoque
      </Link>
      <div>
        <h1 className="titulo-pagina">Fichas de insumo</h1>
        <p className="mt-1 max-w-2xl text-sm text-cinza">
          O que cada serviço consome. Ao finalizar um atendimento, essas quantidades saem do estoque automaticamente.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {(servicos ?? []).map((s) => {
          const itens = fichas.filter((f) => f.servico_id === s.id);
          return (
            <section key={s.id} className="cartao p-5">
              <h2 className="font-semibold text-carvao">
                {s.nome} {!s.ativo && <span className="text-xs font-normal text-cinza">(inativo)</span>}
              </h2>
              {itens.length === 0 ? (
                <p className="mt-2 text-sm text-cinza">Não consome insumos.</p>
              ) : (
                <ul className="mt-2 divide-y divide-linha text-sm">
                  {itens.map((f) => (
                    <li key={f.produto_id} className="flex items-center justify-between py-2">
                      <span>{f.produtos?.nome}</span>
                      <span className="flex items-center gap-3">
                        <span className="font-mono tabular-nums">{Number(f.quantidade).toLocaleString("pt-BR")} {f.produtos?.unidade}</span>
                        <RemoverInsumo servicoId={s.id} produtoId={f.produto_id} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <FormAcao
                action={adicionarInsumo.bind(null, s.id)}
                botao="Adicionar"
                botaoClasse="btn-secundario py-2"
                resetar
                className="mt-3 flex flex-wrap items-end gap-2 border-t border-linha pt-3"
              >
                <select name="produto_id" className="campo min-w-0 flex-1 py-2" defaultValue="">
                  <option value="" disabled>Insumo...</option>
                  {(insumos ?? []).map((p) => (
                    <option key={p.id} value={p.id}>{p.nome} ({p.unidade})</option>
                  ))}
                </select>
                <input name="quantidade" inputMode="decimal" placeholder="Qtd" className="campo w-20 py-2" />
              </FormAcao>
            </section>
          );
        })}
      </div>
    </div>
  );
}

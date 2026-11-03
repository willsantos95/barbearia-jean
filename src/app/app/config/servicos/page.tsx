import { createClient } from "@/lib/supabase/server";
import { FormAcao } from "@/components/form-acao";
import { salvarServico } from "../actions";

const centavosParaTexto = (c: number) => (c / 100).toFixed(2).replace(".", ",");

export default async function ServicosPage() {
  const supabase = await createClient();
  const { data: servicos } = await supabase.from("servicos").select("*").order("ordem").order("nome");

  return (
    <div className="space-y-6">
      <section className="cartao p-6">
        <h2 className="font-semibold text-carvao">Novo serviço</h2>
        <FormAcao action={salvarServico.bind(null, null)} botao="Adicionar" resetar className="mt-4 grid items-end gap-3 sm:grid-cols-[1fr_8rem_7rem_6rem_auto]">
          <div>
            <label className="rotulo">Nome</label>
            <input name="nome" required className="campo" placeholder="Ex.: Platinado" />
          </div>
          <div>
            <label className="rotulo">Preço (R$)</label>
            <input name="preco" inputMode="decimal" required className="campo" placeholder="0,00" />
          </div>
          <div>
            <label className="rotulo">Duração</label>
            <input name="duracao_min" type="number" defaultValue={30} className="campo" />
          </div>
          <div>
            <label className="rotulo">Ordem</label>
            <input name="ordem" type="number" defaultValue={(servicos?.length ?? 0) + 1} className="campo" />
          </div>
          <input type="hidden" name="ativo" value="on" />
        </FormAcao>
      </section>

      <section className="cartao divide-y divide-linha">
        <div className="hidden grid-cols-[1fr_8rem_7rem_6rem_5rem_auto] gap-3 px-6 py-3 text-xs font-semibold tracking-wide text-cinza uppercase sm:grid">
          <span>Serviço</span><span>Preço (R$)</span><span>Duração (min)</span><span>Ordem</span><span>Ativo</span><span />
        </div>
        {(servicos ?? []).map((s) => (
          <FormAcao
            key={s.id}
            action={salvarServico.bind(null, s.id)}
            botaoClasse="btn-secundario py-2"
            className="grid items-center gap-3 px-6 py-3 sm:grid-cols-[1fr_8rem_7rem_6rem_5rem_auto]"
          >
            <input name="nome" defaultValue={s.nome} className="campo" aria-label="Nome" />
            <input name="preco" defaultValue={centavosParaTexto(s.preco_centavos)} inputMode="decimal" className="campo" aria-label="Preço" />
            <input name="duracao_min" type="number" defaultValue={s.duracao_min} className="campo" aria-label="Duração" />
            <input name="ordem" type="number" defaultValue={s.ordem} className="campo" aria-label="Ordem" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="ativo" defaultChecked={s.ativo} className="size-4 accent-latao" /> Ativo
            </label>
          </FormAcao>
        ))}
      </section>
      <p className="text-sm text-cinza">
        Serviços inativos somem do check-in e do atendimento, mas continuam no histórico. A ficha de insumos de cada serviço fica na tela de Estoque.
      </p>
    </div>
  );
}

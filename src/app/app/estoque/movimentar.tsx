"use client";

import { useState } from "react";
import { PackagePlus, SlidersHorizontal, X } from "lucide-react";
import { FormAcao } from "@/components/form-acao";
import { lancarAjuste, lancarEntrada } from "./actions";

type Props = {
  produtoId: string;
  nome: string;
  unidade: string;
  atual: number;
  custoCentavos: number;
  compacto?: boolean;
};

export function Movimentar({ produtoId, nome, unidade, atual, custoCentavos, compacto = false }: Props) {
  const [modo, setModo] = useState<"entrada" | "ajuste" | null>(null);
  const fechar = () => setModo(null);

  return (
    <>
      <div className="flex gap-1.5">
        <button onClick={() => setModo("entrada")} className={compacto ? "btn-secundario px-2.5 py-1.5 text-xs" : "btn-secundario"}>
          <PackagePlus className="size-4" /> Entrada
        </button>
        <button onClick={() => setModo("ajuste")} className={compacto ? "btn-secundario px-2.5 py-1.5 text-xs" : "btn-secundario"}>
          <SlidersHorizontal className="size-4" /> Ajustar
        </button>
      </div>

      {modo && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={fechar}>
          <div className="cartao w-full max-w-md p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold tracking-[0.18em] text-latao-escuro uppercase">
                  {modo === "entrada" ? "Entrada / compra" : "Ajuste por contagem"}
                </p>
                <p className="text-lg font-bold text-carvao">{nome}</p>
                <p className="text-sm text-cinza">Hoje no sistema: {atual} {unidade}</p>
              </div>
              <button onClick={fechar} className="text-cinza" aria-label="Fechar"><X className="size-5" /></button>
            </div>

            {modo === "entrada" ? (
              <FormAcao action={lancarEntrada.bind(null, produtoId)} botao="Lançar entrada" resetar className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="rotulo">Quantidade ({unidade})</label>
                    <input name="quantidade" inputMode="decimal" required autoFocus className="campo" />
                  </div>
                  <div>
                    <label className="rotulo">Custo unitário (R$)</label>
                    <input
                      name="custo"
                      inputMode="decimal"
                      defaultValue={custoCentavos ? (custoCentavos / 100).toFixed(2).replace(".", ",") : ""}
                      className="campo"
                    />
                  </div>
                </div>
                <div>
                  <label className="rotulo">Observação</label>
                  <input name="observacao" placeholder="Fornecedor, nota..." className="campo" />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="gerar_despesa" defaultChecked className="size-4 accent-latao" />
                  Lançar como despesa (Compra de estoque)
                </label>
              </FormAcao>
            ) : (
              <FormAcao action={lancarAjuste.bind(null, produtoId)} botao="Ajustar estoque" className="space-y-4">
                <div>
                  <label className="rotulo">Quanto tem na prateleira? ({unidade})</label>
                  <input name="contado" inputMode="decimal" required autoFocus className="campo" />
                  <p className="mt-1 text-xs text-cinza">O sistema registra a diferença como ajuste.</p>
                </div>
                <div>
                  <label className="rotulo">Motivo</label>
                  <input name="observacao" placeholder="Contagem, quebra, perda, uso pessoal..." className="campo" />
                </div>
              </FormAcao>
            )}
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { useState } from "react";
import { FormAcao } from "@/components/form-acao";
import type { Estado } from "./actions";

export type ProdutoDados = {
  nome: string;
  tipo: string;
  unidade: string;
  custo_centavos: number;
  preco_venda_centavos: number | null;
  estoque_minimo: number;
  ativo: boolean;
};

const txt = (c: number | null | undefined) => (c == null ? "" : (c / 100).toFixed(2).replace(".", ","));

export function ProdutoForm({
  action,
  inicial,
  novo = false,
}: {
  action: (s: Estado, fd: FormData) => Promise<Estado>;
  inicial?: ProdutoDados;
  novo?: boolean;
}) {
  const [tipo, setTipo] = useState(inicial?.tipo ?? "venda");

  return (
    <FormAcao action={action} botao={novo ? "Cadastrar produto" : "Salvar"} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="rotulo">Nome</label>
        <input name="nome" required defaultValue={inicial?.nome} className="campo" />
      </div>
      <div>
        <label className="rotulo">Tipo</label>
        <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className="campo">
          <option value="venda">Venda (pomada, óleo...)</option>
          <option value="insumo">Insumo (uso interno)</option>
          <option value="bar">Bar (bebidas)</option>
        </select>
      </div>
      <div>
        <label className="rotulo">Unidade</label>
        <input name="unidade" defaultValue={inicial?.unidade ?? "un"} placeholder="un, ml, g, cx" className="campo" />
      </div>
      <div>
        <label className="rotulo">Custo unitário (R$)</label>
        <input name="custo" inputMode="decimal" defaultValue={txt(inicial?.custo_centavos)} placeholder="0,00" className="campo" />
      </div>
      {tipo !== "insumo" && (
        <div>
          <label className="rotulo">Preço de venda (R$)</label>
          <input name="preco" inputMode="decimal" defaultValue={txt(inicial?.preco_venda_centavos)} placeholder="0,00" className="campo" />
        </div>
      )}
      <div>
        <label className="rotulo">Estoque mínimo (alerta)</label>
        <input name="estoque_minimo" inputMode="decimal" defaultValue={inicial ? String(inicial.estoque_minimo) : "0"} className="campo" />
      </div>
      {novo ? (
        <div>
          <label className="rotulo">Quantidade que tem hoje</label>
          <input name="estoque_inicial" inputMode="decimal" placeholder="0" className="campo" />
        </div>
      ) : (
        <label className="flex items-center gap-2 self-end pb-2.5 text-sm">
          <input type="checkbox" name="ativo" defaultChecked={inicial?.ativo ?? true} className="size-4 accent-latao" /> Ativo
        </label>
      )}
    </FormAcao>
  );
}

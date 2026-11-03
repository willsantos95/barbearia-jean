"use client";

import { useActionState } from "react";
import type { FormState } from "./actions";
import { telefoneFmt } from "@/lib/format";

export type ClienteDados = {
  nome: string;
  telefone: string;
  aniversario: string | null;
  instagram: string | null;
  preferencias: string | null;
  observacoes: string | null;
  aceita_contato: boolean;
};

export function ClienteForm({
  action,
  inicial,
  textoBotao,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  inicial?: ClienteDados;
  textoBotao: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor="nome">Nome *</label>
        <input id="nome" name="nome" required defaultValue={inicial?.nome} className="campo" />
      </div>
      <div>
        <label className="rotulo" htmlFor="telefone">Telefone (WhatsApp) *</label>
        <input
          id="telefone"
          name="telefone"
          required
          inputMode="tel"
          placeholder="(11) 98888-7777"
          defaultValue={inicial ? telefoneFmt(inicial.telefone) : undefined}
          className="campo"
        />
      </div>
      <div>
        <label className="rotulo" htmlFor="aniversario">Aniversário</label>
        <input id="aniversario" name="aniversario" type="date" defaultValue={inicial?.aniversario ?? ""} className="campo" />
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor="instagram">Instagram</label>
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-cinza">@</span>
          <input id="instagram" name="instagram" defaultValue={inicial?.instagram ?? ""} className="campo pl-7" />
        </div>
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor="preferencias">Preferências de corte</label>
        <textarea
          id="preferencias"
          name="preferencias"
          rows={3}
          placeholder="Ex.: degradê navalhado, máquina 1 nas laterais, risca do lado esquerdo"
          defaultValue={inicial?.preferencias ?? ""}
          className="campo"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="rotulo" htmlFor="observacoes">Observações do barbeiro</label>
        <textarea id="observacoes" name="observacoes" rows={3} defaultValue={inicial?.observacoes ?? ""} className="campo" />
      </div>
      <label className="flex items-start gap-3 text-sm sm:col-span-2">
        <input
          type="checkbox"
          name="aceita_contato"
          defaultChecked={inicial?.aceita_contato ?? false}
          className="mt-0.5 size-4 accent-latao"
        />
        <span>
          Cliente aceita receber mensagens da barbearia (lembretes, aniversário, promoções).
          <span className="block text-xs text-cinza">Consentimento exigido pela LGPD.</span>
        </span>
      </label>

      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className="btn-primario">
          {pending ? "Salvando..." : textoBotao}
        </button>
        {state.erro && <p className="text-sm text-perigo">{state.erro}</p>}
        {state.ok && <p className="text-sm text-ok">{state.ok}</p>}
      </div>
    </form>
  );
}

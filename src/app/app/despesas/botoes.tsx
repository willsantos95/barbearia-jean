"use client";

import { useState, useTransition } from "react";
import { Copy, Trash2 } from "lucide-react";
import { copiarRecorrentes, excluirDespesa } from "./actions";

export function ExcluirDespesa({ id, descricao }: { id: string; descricao: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => confirm(`Excluir "${descricao}"?`) && start(() => excluirDespesa(id))}
      className="text-cinza hover:text-perigo disabled:opacity-40"
      aria-label="Excluir"
    >
      <Trash2 className="size-4" />
    </button>
  );
}

export function CopiarRecorrentes({ mes }: { mes: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="flex items-center gap-2">
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const n = await copiarRecorrentes(mes);
            setMsg(n ? `${n} despesa(s) copiada(s).` : "Nada novo para copiar.");
          })
        }
        className="btn-secundario"
      >
        <Copy className="size-4" /> {pending ? "Copiando..." : "Copiar fixas do mês anterior"}
      </button>
      {msg && <span className="text-sm text-cinza">{msg}</span>}
    </span>
  );
}

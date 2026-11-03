"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { excluirCliente } from "../actions";

export function ExcluirCliente({ id, nome }: { id: string; nome: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (confirm(`Excluir ${nome}? O histórico de atendimentos continua no resumo, mas a ficha e as fotos somem.`)) {
          start(() => excluirCliente(id));
        }
      }}
      className="btn-perigo py-2"
    >
      <Trash2 className="size-4" /> {pending ? "Excluindo..." : "Excluir cliente"}
    </button>
  );
}

"use client";

import { useState, useTransition } from "react";
import { alternarUsuario } from "../actions";

export function AlternarUsuario({ id, ativo, proprio }: { id: string; ativo: boolean; proprio: boolean }) {
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  if (proprio) return <span className="text-xs text-cinza">Você</span>;
  return (
    <span className="flex items-center gap-2">
      <button
        disabled={pending}
        onClick={() => start(() => alternarUsuario(id, !ativo).catch((e) => setErro(e.message)))}
        className={ativo ? "btn-perigo px-3 py-1.5 text-xs" : "btn-secundario px-3 py-1.5 text-xs"}
      >
        {ativo ? "Bloquear acesso" : "Reativar"}
      </button>
      {erro && <span className="text-xs text-perigo">{erro}</span>}
    </span>
  );
}

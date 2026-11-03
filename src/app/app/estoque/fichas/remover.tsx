"use client";

import { useTransition } from "react";
import { X } from "lucide-react";
import { removerInsumo } from "../actions";

export function RemoverInsumo({ servicoId, produtoId }: { servicoId: string; produtoId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => start(() => removerInsumo(servicoId, produtoId))}
      className="text-cinza hover:text-perigo disabled:opacity-40"
      aria-label="Remover"
    >
      <X className="size-4" />
    </button>
  );
}

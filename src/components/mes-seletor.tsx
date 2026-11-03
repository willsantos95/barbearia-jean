import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { mesAtual, nomeMes, somarMes } from "@/lib/mes";

export function MesSeletor({ mes, base }: { mes: string; base: string }) {
  const proximo = somarMes(mes, 1);
  const futuro = proximo > mesAtual();
  return (
    <div className="flex items-center gap-1 rounded-lg border border-linha bg-white p-1">
      <Link href={`${base}?mes=${somarMes(mes, -1)}`} className="rounded-md p-1.5 text-cinza hover:bg-papel hover:text-carvao" aria-label="Mês anterior">
        <ChevronLeft className="size-4" />
      </Link>
      <span className="min-w-36 text-center text-sm font-semibold">{nomeMes(mes)}</span>
      {futuro ? (
        <span className="p-1.5 text-linha"><ChevronRight className="size-4" /></span>
      ) : (
        <Link href={`${base}?mes=${proximo}`} className="rounded-md p-1.5 text-cinza hover:bg-papel hover:text-carvao" aria-label="Próximo mês">
          <ChevronRight className="size-4" />
        </Link>
      )}
    </div>
  );
}

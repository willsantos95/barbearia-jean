import { clsx } from "clsx";

/** Marca provisória (até receber o logo do Jean) */
export function Marca({ claro = false, compacta = false }: { claro?: boolean; compacta?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={clsx(
          "grid size-10 shrink-0 place-items-center rounded-lg border-2 text-sm font-black tracking-tighter",
          claro ? "border-latao text-latao" : "border-carvao text-carvao",
        )}
        aria-hidden
      >
        JR
      </div>
      {!compacta && (
        <div className="leading-tight">
          <p className={clsx("text-xs font-semibold tracking-[0.2em] uppercase", claro ? "text-latao" : "text-latao-escuro")}>
            Barbearia
          </p>
          <p className={clsx("font-bold tracking-tight", claro ? "text-papel" : "text-carvao")}>Jean Rodrigues</p>
        </div>
      )}
    </div>
  );
}

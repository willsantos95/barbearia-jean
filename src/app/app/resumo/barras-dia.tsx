"use client";

import { useState } from "react";
import { reais } from "@/lib/format";

type Dia = { dia: string; atendimentos: number; faturamento_centavos: number };

/** Faturamento por dia do mês: barra única, cor latão, tooltip no hover/toque */
export function BarrasDia({ mes, dias }: { mes: string; dias: Dia[] }) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const [y, m] = mes.split("-").map(Number);
  const total = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const porDia = new Map(dias.map((d) => [Number(d.dia.slice(8, 10)), d]));
  const serie = Array.from({ length: total }, (_, i) => {
    const d = porDia.get(i + 1);
    return { dia: i + 1, valor: d?.faturamento_centavos ?? 0, qtd: d?.atendimentos ?? 0 };
  });
  const max = Math.max(...serie.map((s) => s.valor), 1);
  // escala "redonda" para a grade
  const passo = Math.pow(10, Math.floor(Math.log10(max)));
  const topo = Math.ceil(max / passo) * passo;

  const sel = ativo != null ? serie[ativo] : null;

  return (
    <div>
      <div className="mb-2 h-10 text-sm">
        {sel ? (
          <p>
            <span className="font-semibold text-carvao">
              {String(sel.dia).padStart(2, "0")}/{String(m).padStart(2, "0")}
            </span>
            <span className="ml-3 font-mono tabular-nums">{reais(sel.valor)}</span>
            <span className="ml-3 text-cinza">{sel.qtd} atendimento{sel.qtd === 1 ? "" : "s"}</span>
          </p>
        ) : (
          <p className="text-cinza">Passe o mouse ou toque numa barra para ver o dia.</p>
        )}
      </div>

      <div className="relative h-48">
        {/* grade recessiva */}
        {[1, 0.5].map((f) => (
          <div key={f} className="absolute inset-x-0 border-t border-dashed border-linha" style={{ bottom: `${f * 100}%` }}>
            <span className="absolute -top-2.5 right-0 bg-white pl-1 font-mono text-[10px] text-cinza tabular-nums">
              {reais(topo * f).replace(",00", "")}
            </span>
          </div>
        ))}
        <div className="absolute inset-0 flex items-end gap-[2px] border-b border-linha pr-14" onMouseLeave={() => setAtivo(null)}>
          {serie.map((s, i) => (
            <button
              key={s.dia}
              type="button"
              onMouseEnter={() => setAtivo(i)}
              onFocus={() => setAtivo(i)}
              onClick={() => setAtivo(i)}
              className="group relative flex h-full flex-1 items-end"
              aria-label={`Dia ${s.dia}: ${reais(s.valor)}, ${s.qtd} atendimentos`}
            >
              <span
                className="w-full rounded-t-[4px] bg-latao transition-opacity"
                style={{
                  height: s.valor ? `${Math.max((s.valor / topo) * 100, 1.5)}%` : 0,
                  opacity: ativo == null || ativo === i ? 1 : 0.45,
                }}
              />
            </button>
          ))}
        </div>
      </div>
      <div className="mt-1 flex pr-14 font-mono text-[10px] text-cinza tabular-nums">
        {serie.map((s) => (
          <span key={s.dia} className="flex-1 text-center">
            {s.dia === 1 || s.dia % 5 === 0 ? s.dia : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

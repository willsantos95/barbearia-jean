"use client";

import { useMemo, useState, useTransition } from "react";
import { clsx } from "clsx";
import { Minus, Plus } from "lucide-react";
import { reais } from "@/lib/format";
import { finalizarAtendimento, type ItemEnvio } from "./actions";

type Servico = { id: string; nome: string; preco_centavos: number };
type Produto = { id: string; nome: string; tipo: string; preco_venda_centavos: number | null; estoque_atual: number };
type Barbeiro = { id: string; nome: string };

const FORMAS = [
  { id: "pix", label: "Pix" },
  { id: "dinheiro", label: "Dinheiro" },
  { id: "debito", label: "Débito" },
  { id: "credito", label: "Crédito" },
];

export function FinalizarForm(props: {
  filaId: string;
  clienteId: string;
  servicoInicial: string | null;
  barbeiroInicial: string | null;
  servicos: Servico[];
  produtos: Produto[];
  barbeiros: Barbeiro[];
}) {
  const [barbeiroId, setBarbeiroId] = useState(props.barbeiroInicial ?? props.barbeiros[0]?.id ?? "");
  const [servicos, setServicos] = useState<string[]>(props.servicoInicial ? [props.servicoInicial] : []);
  const [qtdProdutos, setQtdProdutos] = useState<Record<string, number>>({});
  const [desconto, setDesconto] = useState("");
  const [forma, setForma] = useState<string | null>(null);
  const [obs, setObs] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const descontoCentavos = Math.round((parseFloat(desconto.replace(",", ".")) || 0) * 100);

  const subtotal = useMemo(() => {
    const s = props.servicos.filter((x) => servicos.includes(x.id)).reduce((t, x) => t + x.preco_centavos, 0);
    const p = props.produtos.reduce((t, x) => t + (qtdProdutos[x.id] ?? 0) * (x.preco_venda_centavos ?? 0), 0);
    return s + p;
  }, [servicos, qtdProdutos, props.servicos, props.produtos]);
  const total = Math.max(subtotal - descontoCentavos, 0);

  const alterarQtd = (id: string, delta: number) =>
    setQtdProdutos((q) => ({ ...q, [id]: Math.max(0, (q[id] ?? 0) + delta) }));

  function salvar() {
    setErro(null);
    const itens: ItemEnvio[] = [
      ...servicos.map((id) => ({ tipo: "servico" as const, id, quantidade: 1 })),
      ...Object.entries(qtdProdutos)
        .filter(([, q]) => q > 0)
        .map(([id, quantidade]) => ({ tipo: "produto" as const, id, quantidade })),
    ];
    if (!itens.length) return setErro("Marque pelo menos um serviço ou produto.");
    if (!forma) return setErro("Escolha a forma de pagamento.");
    if (!barbeiroId) return setErro("Escolha o barbeiro.");
    start(async () => {
      const r = await finalizarAtendimento({
        filaId: props.filaId,
        clienteId: props.clienteId,
        barbeiroId,
        itens,
        descontoCentavos,
        formaPagamento: forma,
        observacoes: obs,
      });
      if (r?.erro) setErro(r.erro);
    });
  }

  const grupos = [
    { tipo: "venda", titulo: "Produtos" },
    { tipo: "bar", titulo: "Bar" },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <section className="cartao p-5">
          <h2 className="font-semibold text-carvao">Barbeiro</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {props.barbeiros.map((b) => (
              <Chip key={b.id} ativo={barbeiroId === b.id} onClick={() => setBarbeiroId(b.id)}>{b.nome}</Chip>
            ))}
          </div>
        </section>

        <section className="cartao p-5">
          <h2 className="font-semibold text-carvao">Serviços</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {props.servicos.map((s) => {
              const ativo = servicos.includes(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => setServicos((v) => (ativo ? v.filter((x) => x !== s.id) : [...v, s.id]))}
                  className={clsx(
                    "rounded-lg border-2 px-3 py-3 text-left transition-colors",
                    ativo ? "border-carvao bg-carvao text-papel" : "border-linha bg-white hover:border-cinza",
                  )}
                >
                  <span className="block font-semibold">{s.nome}</span>
                  <span className={clsx("text-sm", ativo ? "text-latao" : "text-cinza")}>{reais(s.preco_centavos)}</span>
                </button>
              );
            })}
          </div>
        </section>

        {grupos.map((g) => {
          const lista = props.produtos.filter((p) => p.tipo === g.tipo);
          if (!lista.length) return null;
          return (
            <section key={g.tipo} className="cartao p-5">
              <h2 className="font-semibold text-carvao">{g.titulo}</h2>
              <div className="mt-2 divide-y divide-linha">
                {lista.map((p) => {
                  const q = qtdProdutos[p.id] ?? 0;
                  return (
                    <div key={p.id} className="flex items-center gap-3 py-2.5">
                      <div className="flex-1">
                        <p className="font-medium">{p.nome}</p>
                        <p className={clsx("text-xs", p.estoque_atual <= 0 ? "text-perigo" : "text-cinza")}>
                          {reais(p.preco_venda_centavos)} · {p.estoque_atual > 0 ? `${Number(p.estoque_atual)} em estoque` : "sem estoque registrado"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => alterarQtd(p.id, -1)} disabled={!q} className="btn-secundario size-9 p-0" aria-label="Menos">
                          <Minus className="size-4" />
                        </button>
                        <span className="w-8 text-center font-mono font-bold tabular-nums">{q}</span>
                        <button onClick={() => alterarQtd(p.id, 1)} className="btn-secundario size-9 p-0" aria-label="Mais">
                          <Plus className="size-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="cartao space-y-5 p-5">
          <div>
            <p className="rotulo">Pagamento</p>
            <div className="grid grid-cols-2 gap-2">
              {FORMAS.map((f) => (
                <Chip key={f.id} ativo={forma === f.id} onClick={() => setForma(f.id)}>{f.label}</Chip>
              ))}
            </div>
          </div>
          <div>
            <label className="rotulo" htmlFor="desconto">Desconto (R$)</label>
            <input
              id="desconto"
              inputMode="decimal"
              value={desconto}
              onChange={(e) => setDesconto(e.target.value)}
              placeholder="0,00"
              className="campo"
            />
          </div>
          <div>
            <label className="rotulo" htmlFor="obs">Observações</label>
            <textarea id="obs" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} className="campo" />
          </div>

          <div className="space-y-1 border-t border-linha pt-4 text-sm">
            <div className="flex justify-between text-cinza">
              <span>Subtotal</span>
              <span className="font-mono tabular-nums">{reais(subtotal)}</span>
            </div>
            {descontoCentavos > 0 && (
              <div className="flex justify-between text-cinza">
                <span>Desconto</span>
                <span className="font-mono tabular-nums">− {reais(descontoCentavos)}</span>
              </div>
            )}
            <div className="flex justify-between pt-1 text-xl font-bold text-carvao">
              <span>Total</span>
              <span className="font-mono tabular-nums">{reais(total)}</span>
            </div>
          </div>

          {erro && <p className="text-sm text-perigo">{erro}</p>}
          <button onClick={salvar} disabled={pending} className="btn-primario w-full py-3.5 text-base">
            {pending ? "Salvando..." : "Finalizar atendimento"}
          </button>
        </div>
      </aside>
    </div>
  );
}

function Chip({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors",
        ativo ? "border-carvao bg-carvao text-papel" : "border-linha bg-white text-tinta hover:border-cinza",
      )}
    >
      {children}
    </button>
  );
}

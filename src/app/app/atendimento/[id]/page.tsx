import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUsuario } from "@/lib/auth";
import { telefoneFmt } from "@/lib/format";
import { FinalizarForm } from "./finalizar-form";

type FilaRow = {
  id: string;
  status: string;
  servico_id: string | null;
  barbeiro_id: string | null;
  barbeiro_preferido_id: string | null;
  clientes: { id: string; nome: string; telefone: string; preferencias: string | null; observacoes: string | null } | null;
};

export default async function AtendimentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await getUsuario();
  const supabase = await createClient();

  const [{ data: filaRaw }, { data: servicos }, { data: produtos }, { data: barbeiros }] = await Promise.all([
    supabase
      .from("fila")
      .select("id, status, servico_id, barbeiro_id, barbeiro_preferido_id, clientes(id, nome, telefone, preferencias, observacoes)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("servicos").select("id, nome, preco_centavos").eq("ativo", true).order("ordem").order("nome"),
    supabase
      .from("produtos")
      .select("id, nome, tipo, preco_venda_centavos, estoque_atual")
      .eq("ativo", true)
      .in("tipo", ["venda", "bar"])
      .order("nome"),
    supabase.from("barbeiros").select("id, nome, usuario_id").eq("ativo", true).order("nome"),
  ]);

  const fila = filaRaw as unknown as FilaRow | null;
  if (!fila || !fila.clientes) notFound();

  const meuBarbeiro = barbeiros?.find((b) => b.usuario_id === usuario.id)?.id ?? null;
  const encerrado = fila.status === "finalizado" || fila.status === "desistiu";

  return (
    <div className="space-y-6">
      <Link href="/app" className="inline-flex items-center gap-1 text-sm text-cinza hover:text-carvao">
        <ArrowLeft className="size-4" /> Painel
      </Link>

      <div>
        <p className="text-xs font-semibold tracking-[0.18em] text-latao-escuro uppercase">Finalizar atendimento</p>
        <h1 className="titulo-pagina">{fila.clientes.nome}</h1>
        <p className="font-mono text-sm text-cinza">{telefoneFmt(fila.clientes.telefone)}</p>
        {(fila.clientes.preferencias || fila.clientes.observacoes) && (
          <div className="mt-3 max-w-2xl rounded-lg bg-papel-2 px-4 py-3 text-sm">
            {fila.clientes.preferencias && <p><span className="font-semibold">Preferências:</span> {fila.clientes.preferencias}</p>}
            {fila.clientes.observacoes && <p><span className="font-semibold">Obs.:</span> {fila.clientes.observacoes}</p>}
          </div>
        )}
      </div>

      {encerrado ? (
        <div className="cartao p-6 text-sm text-cinza">
          Este atendimento já foi encerrado. <Link href={`/app/clientes/${fila.clientes.id}`} className="underline">Ver ficha do cliente</Link>
        </div>
      ) : (
        <FinalizarForm
          filaId={fila.id}
          clienteId={fila.clientes.id}
          servicoInicial={fila.servico_id}
          barbeiroInicial={fila.barbeiro_id ?? fila.barbeiro_preferido_id ?? meuBarbeiro}
          servicos={servicos ?? []}
          produtos={(produtos ?? []).map((p) => ({ ...p, estoque_atual: Number(p.estoque_atual) }))}
          barbeiros={(barbeiros ?? []).map(({ id, nome }) => ({ id, nome }))}
        />
      )}
    </div>
  );
}

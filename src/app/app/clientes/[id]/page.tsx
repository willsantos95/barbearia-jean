import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Cake, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUsuario } from "@/lib/auth";
import { dataFmt, dataHoraFmt, diasDesde, reais, telefoneFmt, whatsappLink } from "@/lib/format";
import { ClienteForm } from "../cliente-form";
import { atualizarCliente } from "../actions";
import { Fotos, type Foto } from "./fotos";
import { ExcluirCliente } from "./excluir";

const PAGAMENTO: Record<string, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  debito: "Débito",
  credito: "Crédito",
  outro: "Outro",
};

type Atendimento = {
  id: string;
  data: string;
  total_centavos: number | null;
  forma_pagamento: string | null;
  observacoes: string | null;
  barbeiro: string | null;
  itens: { descricao: string; quantidade: number }[];
};

export default async function ClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await getUsuario();
  const supabase = await createClient();

  const [{ data: cliente }, { data: fotosRaw }, { data: atendimentosRaw }] = await Promise.all([
    supabase.from("vw_clientes").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("cliente_fotos")
      .select("id, storage_path, legenda, created_at")
      .eq("cliente_id", id)
      .order("created_at", { ascending: false }),
    // valores só voltam para o dono (regra no banco)
    supabase.rpc("historico_cliente", { p_cliente_id: id }),
  ]);

  if (!cliente) notFound();

  let fotos: Foto[] = [];
  if (fotosRaw?.length) {
    const { data: urls } = await supabase.storage
      .from("fotos-clientes")
      .createSignedUrls(fotosRaw.map((f) => f.storage_path), 60 * 60);
    fotos = fotosRaw.map((f, i) => ({
      id: f.id,
      url: urls?.[i]?.signedUrl ?? null,
      legenda: f.legenda,
      created_at: f.created_at,
    }));
  }

  const atendimentos = (atendimentosRaw ?? []) as unknown as Atendimento[];
  const dias = diasDesde(cliente.ultima_visita);
  const gastoTotal = atendimentos.reduce((s, a) => s + (a.total_centavos ?? 0), 0);
  const dono = usuario.papel === "dono";

  return (
    <div className="space-y-6">
      <Link href="/app/clientes" className="inline-flex items-center gap-1 text-sm text-cinza hover:text-carvao">
        <ArrowLeft className="size-4" /> Clientes
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="titulo-pagina">{cliente.nome}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-cinza">
            <span className="font-mono">{telefoneFmt(cliente.telefone)}</span>
            {cliente.instagram && (
              <a href={`https://instagram.com/${cliente.instagram}`} target="_blank" className="hover:text-carvao">
                @{cliente.instagram}
              </a>
            )}
            {cliente.aniversario && (
              <span className="flex items-center gap-1">
                <Cake className="size-3.5" /> {dataFmt(cliente.aniversario).slice(0, 5)}
              </span>
            )}
          </div>
        </div>
        <a href={whatsappLink(cliente.telefone)} target="_blank" className="btn-latao py-2">
          <MessageCircle className="size-4" /> WhatsApp
        </a>
      </div>

      <div className={dono ? "grid grid-cols-3 gap-3" : "grid grid-cols-2 gap-3"}>
        <div className="cartao p-4">
          <p className="text-xs font-semibold tracking-wide text-cinza uppercase">Visitas</p>
          <p className="mt-1 font-mono text-2xl font-bold tabular-nums">{cliente.total_visitas}</p>
        </div>
        <div className="cartao p-4">
          <p className="text-xs font-semibold tracking-wide text-cinza uppercase">Última visita</p>
          <p className="mt-1 text-lg font-bold">{cliente.ultima_visita ? `há ${dias} d` : "—"}</p>
        </div>
        {dono && (
          <div className="cartao p-4">
            <p className="text-xs font-semibold tracking-wide text-cinza uppercase">Gasto (últ. 30)</p>
            <p className="mt-1 text-lg font-bold">{reais(gastoTotal)}</p>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <section className="cartao p-6">
            <h2 className="mb-4 font-semibold text-carvao">Dados</h2>
            <ClienteForm action={atualizarCliente.bind(null, id)} inicial={cliente} textoBotao="Salvar alterações" />
          </section>

          {usuario.papel === "dono" && (
            <div className="flex justify-end">
              <ExcluirCliente id={id} nome={cliente.nome} />
            </div>
          )}
        </div>

        <div className="space-y-6 lg:col-span-2">
          <section className="cartao p-6">
            <Fotos clienteId={id} fotos={fotos} />
          </section>

          <section className="cartao p-6">
            <h2 className="font-semibold text-carvao">Histórico</h2>
            {atendimentos.length === 0 ? (
              <p className="mt-3 text-sm text-cinza">Nenhum atendimento registrado.</p>
            ) : (
              <ol className="mt-3 divide-y divide-linha">
                {atendimentos.map((a) => (
                  <li key={a.id} className="py-3 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="font-semibold">{dataHoraFmt(a.data)}</span>
                      {a.total_centavos != null && <span className="font-mono tabular-nums">{reais(a.total_centavos)}</span>}
                    </div>
                    <p className="text-cinza">
                      {a.itens.map((i) => (i.quantidade > 1 ? `${i.quantidade}× ${i.descricao}` : i.descricao)).join(", ") || "—"}
                    </p>
                    <p className="text-xs text-cinza">
                      {a.barbeiro ?? "—"}
                      {a.forma_pagamento && ` · ${PAGAMENTO[a.forma_pagamento] ?? a.forma_pagamento}`}
                    </p>
                    {a.observacoes && <p className="mt-1 text-xs italic">{a.observacoes}</p>}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { getUsuario } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function hojeSP() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export default async function PainelPage() {
  const usuario = await getUsuario();
  const supabase = await createClient();
  const hoje = hojeSP();

  const [aguardando, emAtendimento, finalizados, clientes, alertas] = await Promise.all([
    supabase.from("fila").select("id", { count: "exact", head: true }).eq("data", hoje).eq("status", "aguardando"),
    supabase.from("fila").select("id", { count: "exact", head: true }).eq("data", hoje).eq("status", "em_atendimento"),
    supabase.from("fila").select("id", { count: "exact", head: true }).eq("data", hoje).eq("status", "finalizado"),
    supabase.from("clientes").select("id", { count: "exact", head: true }),
    usuario.papel === "dono"
      ? supabase.from("alertas").select("id, mensagem").eq("lido", false).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as { id: string; mensagem: string }[] }),
  ]);

  const kpis = [
    { label: "Aguardando", valor: aguardando.count ?? 0 },
    { label: "Em atendimento", valor: emAtendimento.count ?? 0 },
    { label: "Atendidos hoje", valor: finalizados.count ?? 0 },
    { label: "Clientes na base", valor: clientes.count ?? 0 },
  ];

  const dataExtenso = new Date().toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-cinza capitalize">{dataExtenso}</p>
        <h1 className="titulo-pagina">Olá, {usuario.nome.split(" ")[0]}</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="cartao p-5">
            <p className="text-xs font-semibold tracking-wide text-cinza uppercase">{k.label}</p>
            <p className="mt-2 font-mono text-3xl font-bold text-carvao tabular-nums">{k.valor}</p>
          </div>
        ))}
      </div>

      {(alertas.data?.length ?? 0) > 0 && (
        <div className="cartao border-latao/40 bg-latao/5 p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-latao-escuro">
            <TriangleAlert className="size-4" /> Estoque baixo
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {alertas.data!.map((a) => (
              <li key={a.id}>{a.mensagem}</li>
            ))}
          </ul>
          <Link href="/app/estoque" className="mt-3 inline-block text-sm font-semibold underline underline-offset-4">
            Ver estoque
          </Link>
        </div>
      )}

      <div className="cartao p-6">
        <p className="font-semibold text-carvao">Fila do dia</p>
        <p className="mt-1 text-sm text-cinza">
          A fila ao vivo, com o botão de chamar o próximo e finalizar o atendimento, entra no dia 2.
        </p>
      </div>
    </div>
  );
}

import Link from "next/link";
import { clsx } from "clsx";
import { Cake, FileSpreadsheet, Plus, Search } from "lucide-react";
import { getUsuario } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dataFmt, diasDesde, soDigitos, telefoneFmt } from "@/lib/format";

type Filtro = "todos" | "sumidos" | "aniversariantes";

type ClienteLinha = {
  id: string;
  nome: string;
  telefone: string;
  instagram: string | null;
  aniversario: string | null;
  ultima_visita: string | null;
  total_visitas: number;
};

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; f?: Filtro }>;
}) {
  const { q = "", f = "todos" } = await searchParams;
  const usuario = await getUsuario();
  const supabase = await createClient();
  const termo = q.trim();
  const mesAtual = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", month: "numeric" }).format(new Date()),
  );

  let clientes: ClienteLinha[] = [];
  if (f === "sumidos") {
    const { data } = await supabase.rpc("clientes_sumidos", {}).limit(200);
    clientes = (data ?? []) as ClienteLinha[];
  } else if (f === "aniversariantes") {
    const { data } = await supabase.rpc("aniversariantes", { p_mes: mesAtual });
    clientes = (data ?? []) as ClienteLinha[];
  } else {
    let query = supabase
      .from("vw_clientes")
      .select("id, nome, telefone, instagram, aniversario, ultima_visita, total_visitas")
      .order("nome")
      .limit(200);
    if (termo) {
      const dig = soDigitos(termo);
      query = dig.length >= 3 && /^[\d\s()+-]+$/.test(termo)
        ? query.ilike("telefone", `%${dig}%`)
        : query.ilike("nome", `%${termo}%`);
    }
    const { data } = await query;
    clientes = (data ?? []) as ClienteLinha[];
  }

  const { count: total } = await supabase.from("clientes").select("id", { count: "exact", head: true });

  const filtros: { id: Filtro; label: string }[] = [
    { id: "todos", label: "Todos" },
    { id: "sumidos", label: "Sumidos" },
    { id: "aniversariantes", label: "Aniversariantes do mês" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="titulo-pagina">Clientes</h1>
          <p className="text-sm text-cinza">{total ?? 0} cadastrados</p>
        </div>
        <div className="flex gap-2">
          {usuario.papel === "dono" && (
            // eslint-disable-next-line @next/next/no-html-link-for-pages
            <a href="/app/exportar/clientes" download className="btn-secundario">
              <FileSpreadsheet className="size-4" /> Exportar Excel
            </a>
          )}
          <Link href="/app/clientes/novo" className="btn-primario">
            <Plus className="size-4" /> Novo cliente
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <form className="relative min-w-64 flex-1" action="/app/clientes">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-cinza" />
          <input name="q" defaultValue={termo} placeholder="Buscar por nome ou telefone" className="campo pl-9" />
        </form>
        <div className="flex gap-1 rounded-lg border border-linha bg-white p-1">
          {filtros.map((x) => (
            <Link
              key={x.id}
              href={x.id === "todos" ? "/app/clientes" : `/app/clientes?f=${x.id}`}
              className={clsx(
                "rounded-md px-3 py-1.5 text-sm font-medium",
                f === x.id ? "bg-carvao text-papel" : "text-cinza hover:text-carvao",
              )}
            >
              {x.label}
            </Link>
          ))}
        </div>
      </div>

      {f === "sumidos" && (
        <p className="text-sm text-cinza">
          Clientes que não voltam há mais tempo que o limite definido em Configurações (padrão: 45 dias).
        </p>
      )}

      <div className="cartao overflow-hidden">
        {clientes.length === 0 ? (
          <p className="p-10 text-center text-sm text-cinza">
            {termo ? `Nenhum cliente encontrado para "${termo}".` : "Nenhum cliente aqui ainda."}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-linha bg-papel-2/60 text-left text-xs tracking-wide text-cinza uppercase">
              <tr>
                <th className="px-4 py-3 font-semibold">Nome</th>
                <th className="hidden px-4 py-3 font-semibold sm:table-cell">Telefone</th>
                <th className="px-4 py-3 font-semibold">Última visita</th>
                <th className="hidden px-4 py-3 text-right font-semibold md:table-cell">Visitas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linha">
              {clientes.map((c) => {
                const dias = diasDesde(c.ultima_visita);
                return (
                  <tr key={c.id} className="hover:bg-papel/60">
                    <td className="px-4 py-3">
                      <Link href={`/app/clientes/${c.id}`} className="font-semibold text-carvao hover:underline">
                        {c.nome}
                      </Link>
                      <span className="block text-xs text-cinza sm:hidden">{telefoneFmt(c.telefone)}</span>
                      {f === "aniversariantes" && c.aniversario && (
                        <span className="mt-0.5 flex items-center gap-1 text-xs text-latao-escuro">
                          <Cake className="size-3" /> {dataFmt(c.aniversario).slice(0, 5)}
                        </span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 font-mono text-cinza sm:table-cell">{telefoneFmt(c.telefone)}</td>
                    <td className="px-4 py-3">
                      {c.ultima_visita ? (
                        <>
                          {dataFmt(c.ultima_visita)}
                          <span className={clsx("block text-xs", dias! > 45 ? "text-perigo" : "text-cinza")}>
                            há {dias} {dias === 1 ? "dia" : "dias"}
                          </span>
                        </>
                      ) : (
                        <span className="text-cinza">Sem visitas</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-right font-mono tabular-nums md:table-cell">{c.total_visitas}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

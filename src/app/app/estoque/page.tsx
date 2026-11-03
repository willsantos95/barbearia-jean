import { FileSpreadsheet } from "lucide-react";
import { EmBreve } from "@/components/em-breve";
import { exigirDono } from "@/lib/auth";

export default async function Page() {
  await exigirDono();
  return (
    <div className="space-y-4">
      <EmBreve titulo="Estoque" quando="dia 3" itens={["Produtos de venda, insumos e bar", "Entradas e ajustes", "Fichas de insumo por serviço", "Alertas de estoque mínimo"]} />
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/app/exportar/estoque" download className="btn-secundario">
        <FileSpreadsheet className="size-4" /> Exportar estoque para Excel
      </a>
    </div>
  );
}

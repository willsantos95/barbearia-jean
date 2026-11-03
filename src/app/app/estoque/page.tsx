import { EmBreve } from "@/components/em-breve";
import { exigirDono } from "@/lib/auth";

export default async function Page() {
  await exigirDono();
  return <EmBreve titulo="Estoque" quando="dia 3" itens={["Produtos de venda, insumos e bar", "Entradas e ajustes", "Fichas de insumo por serviço", "Alertas de estoque mínimo"]} />;
}

import { EmBreve } from "@/components/em-breve";
import { exigirDono } from "@/lib/auth";

export default async function Page() {
  await exigirDono();
  return <EmBreve titulo="Despesas" quando="dia 3" itens={["Lançamentos por categoria", "Compra de estoque gera despesa"]} />;
}

import { EmBreve } from "@/components/em-breve";

export default function Page() {
  return <EmBreve titulo="Resumo mensal" quando="dia 3" itens={["Faturamento, despesas e lucro", "Atendimentos por barbeiro e ticket médio", "Serviços e produtos mais vendidos", "Clientes novos x recorrentes, sumidos e aniversariantes"]} />;
}

import { EmBreve } from "@/components/em-breve";
import { exigirDono } from "@/lib/auth";

export default async function Page() {
  await exigirDono();
  return <EmBreve titulo="Configurações" quando="dia 2" itens={["Dados da barbearia", "Barbeiros e usuários", "Serviços e preços", "QR code do check-in"]} />;
}

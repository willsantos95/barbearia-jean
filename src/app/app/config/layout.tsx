import { exigirDono } from "@/lib/auth";
import { Abas } from "./abas";

export default async function ConfigLayout({ children }: { children: React.ReactNode }) {
  await exigirDono();
  return (
    <div className="space-y-6">
      <h1 className="titulo-pagina">Configurações</h1>
      <Abas />
      {children}
    </div>
  );
}

import { getUsuario } from "@/lib/auth";
import { Nav } from "./nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const usuario = await getUsuario();

  return (
    <div className="min-h-dvh">
      <Nav nome={usuario.nome} papel={usuario.papel} />
      <main className="lg:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</div>
      </main>
    </div>
  );
}

import { LoginForm } from "./login-form";
import { Marca } from "@/components/marca";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; erro?: string }>;
}) {
  const { next, erro } = await searchParams;
  const aviso =
    erro === "sem-acesso" ? "Seu usuário não tem acesso ativo. Fale com o Jean." : undefined;

  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-carvao p-12 text-papel lg:flex">
        <Marca claro />
        <div>
          <p className="text-4xl leading-tight font-bold tracking-tight">
            Fila, clientes, estoque
            <br />e o mês inteiro
            <span className="text-latao"> num lugar só.</span>
          </p>
          <p className="mt-4 max-w-sm text-papel/60">
            Painel da equipe. Clientes fazem check-in pelo tablet ou pelo QR code da recepção.
          </p>
        </div>
        <div className="h-1 w-24 bg-[repeating-linear-gradient(90deg,var(--color-latao)_0_12px,transparent_12px_20px)]" />
      </section>

      <section className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Marca />
          </div>
          <h1 className="titulo-pagina">Entrar</h1>
          <p className="mt-1 mb-6 text-sm text-cinza">Acesso do Jean e dos barbeiros.</p>
          <LoginForm next={next ?? "/app"} aviso={aviso} />
        </div>
      </section>
    </main>
  );
}

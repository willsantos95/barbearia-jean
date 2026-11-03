import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ClienteForm } from "../cliente-form";
import { criarCliente } from "../actions";

export default function NovoClientePage() {
  return (
    <div className="max-w-2xl">
      <Link href="/app/clientes" className="mb-4 inline-flex items-center gap-1 text-sm text-cinza hover:text-carvao">
        <ArrowLeft className="size-4" /> Clientes
      </Link>
      <h1 className="titulo-pagina">Novo cliente</h1>
      <div className="cartao mt-6 p-6">
        <ClienteForm action={criarCliente} textoBotao="Cadastrar cliente" />
      </div>
    </div>
  );
}

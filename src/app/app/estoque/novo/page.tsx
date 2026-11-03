import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { exigirDono } from "@/lib/auth";
import { ProdutoForm } from "../produto-form";
import { criarProduto } from "../actions";

export default async function NovoProdutoPage() {
  await exigirDono();
  return (
    <div className="max-w-2xl">
      <Link href="/app/estoque" className="mb-4 inline-flex items-center gap-1 text-sm text-cinza hover:text-carvao">
        <ArrowLeft className="size-4" /> Estoque
      </Link>
      <h1 className="titulo-pagina">Novo produto</h1>
      <div className="cartao mt-6 p-6">
        <ProdutoForm action={criarProduto} novo />
      </div>
    </div>
  );
}

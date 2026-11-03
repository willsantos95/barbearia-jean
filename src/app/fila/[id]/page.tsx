import type { Metadata } from "next";
import { Posicao } from "./posicao";

export const metadata: Metadata = { title: "Minha posição · Barbearia Jean Rodrigues" };

export default async function FilaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Posicao filaId={id} />;
}

import type { Metadata } from "next";
import { TV } from "./tv";

export const metadata: Metadata = { title: "Fila · Barbearia Jean Rodrigues" };

export default function TVPage() {
  return <TV />;
}

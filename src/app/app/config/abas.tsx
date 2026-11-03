"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

const ABAS = [
  { href: "/app/config", label: "Barbearia e QR code" },
  { href: "/app/config/servicos", label: "Serviços" },
  { href: "/app/config/equipe", label: "Equipe e logins" },
];

export function Abas() {
  const path = usePathname();
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-linha">
      {ABAS.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className={clsx(
            "-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap",
            path === a.href ? "border-latao text-carvao" : "border-transparent text-cinza hover:text-carvao",
          )}
        >
          {a.label}
        </Link>
      ))}
    </div>
  );
}

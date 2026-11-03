"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { clsx } from "clsx";
import {
  ChartColumn,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Receipt,
  Settings,
  TabletSmartphone,
  Tv,
  Users,
  X,
} from "lucide-react";
import { Marca } from "@/components/marca";
import { sair } from "@/app/login/actions";
import type { Papel } from "@/lib/auth";

const ITENS = [
  { href: "/app", label: "Painel do dia", icon: LayoutDashboard, dono: false },
  { href: "/app/clientes", label: "Clientes", icon: Users, dono: false },
  { href: "/app/estoque", label: "Estoque", icon: Package, dono: true },
  { href: "/app/despesas", label: "Despesas", icon: Receipt, dono: true },
  { href: "/app/resumo", label: "Resumo mensal", icon: ChartColumn, dono: false },
  { href: "/app/config", label: "Configurações", icon: Settings, dono: true },
];

export function Nav({ nome, papel }: { nome: string; papel: Papel }) {
  const path = usePathname();
  const [aberto, setAberto] = useState(false);
  const itens = ITENS.filter((i) => !i.dono || papel === "dono");

  const ativo = (href: string) => (href === "/app" ? path === "/app" : path.startsWith(href));

  const conteudo = (
    <>
      <div className="px-5 py-6">
        <Marca claro />
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {itens.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={() => setAberto(false)}
            className={clsx(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              ativo(href)
                ? "bg-papel text-carvao"
                : "text-papel/70 hover:bg-carvao-2 hover:text-papel",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}

        <p className="px-3 pt-6 pb-2 text-[11px] font-semibold tracking-[0.18em] text-papel/40 uppercase">
          Telas da recepção
        </p>
        <a href="/checkin" target="_blank" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-papel/70 hover:bg-carvao-2 hover:text-papel">
          <TabletSmartphone className="size-4" /> Check-in (totem)
        </a>
        <a href="/tv" target="_blank" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-papel/70 hover:bg-carvao-2 hover:text-papel">
          <Tv className="size-4" /> TV da fila
        </a>
      </nav>
      <div className="border-t border-carvao-2 p-4">
        <p className="truncate text-sm font-semibold text-papel">{nome}</p>
        <p className="text-xs text-latao capitalize">{papel}</p>
        <form action={sair} className="mt-3">
          <button className="flex items-center gap-2 text-sm text-papel/60 hover:text-papel">
            <LogOut className="size-4" /> Sair
          </button>
        </form>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-carvao lg:flex">{conteudo}</aside>

      {/* Mobile / tablet */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-carvao px-4 py-3 lg:hidden">
        <Marca claro />
        <button onClick={() => setAberto(true)} className="text-papel" aria-label="Abrir menu">
          <Menu className="size-6" />
        </button>
      </header>
      {aberto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setAberto(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-carvao">
            <button onClick={() => setAberto(false)} className="absolute top-6 right-4 text-papel/70" aria-label="Fechar menu">
              <X className="size-5" />
            </button>
            {conteudo}
          </aside>
        </div>
      )}
    </>
  );
}

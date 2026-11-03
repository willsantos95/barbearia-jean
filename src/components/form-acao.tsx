"use client";

import { useActionState, useEffect, useRef } from "react";

type Estado = { erro?: string; ok?: string };

/** Formulário com Server Action e mensagem de retorno (ok/erro). `resetar` limpa os campos após sucesso. */
export function FormAcao({
  action,
  children,
  className,
  botao = "Salvar",
  botaoClasse = "btn-primario",
  resetar = false,
}: {
  action: (s: Estado, fd: FormData) => Promise<Estado>;
  children: React.ReactNode;
  className?: string;
  botao?: string;
  botaoClasse?: string;
  resetar?: boolean;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [estado, formAction, pending] = useActionState<Estado, FormData>(action, {});

  useEffect(() => {
    if (resetar && estado.ok) ref.current?.reset();
  }, [estado, resetar]);

  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={botaoClasse}>
          {pending ? "Salvando..." : botao}
        </button>
        {estado.erro && <span className="text-sm text-perigo">{estado.erro}</span>}
        {estado.ok && <span className="text-sm text-ok">{estado.ok}</span>}
      </div>
    </form>
  );
}

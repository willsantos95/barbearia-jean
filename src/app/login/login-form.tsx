"use client";

import { useActionState } from "react";
import { entrar, type LoginState } from "./actions";

export function LoginForm({ next, aviso }: { next: string; aviso?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(entrar, {});

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="rotulo" htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="campo" />
      </div>
      <div>
        <label className="rotulo" htmlFor="senha">Senha</label>
        <input id="senha" name="senha" type="password" autoComplete="current-password" required className="campo" />
      </div>
      {(state.erro || aviso) && (
        <p className="rounded-lg bg-perigo/10 px-3 py-2 text-sm text-perigo">{state.erro ?? aviso}</p>
      )}
      <button type="submit" disabled={pending} className="btn-primario w-full py-3">
        {pending ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}

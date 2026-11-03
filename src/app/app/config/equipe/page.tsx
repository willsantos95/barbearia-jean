import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUsuario } from "@/lib/auth";
import { FormAcao } from "@/components/form-acao";
import { criarBarbeiro, criarLogin, redefinirSenha, salvarBarbeiro } from "../actions";
import { AlternarUsuario } from "./alternar";

export default async function EquipePage() {
  const eu = await getUsuario();
  const supabase = await createClient();
  const [{ data: barbeiros }, { data: usuarios }] = await Promise.all([
    supabase.from("barbeiros").select("*").order("nome"),
    supabase.from("usuarios").select("*").order("nome"),
  ]);

  // e-mails vêm do Auth (precisa da service role)
  const admin = createAdminClient();
  const emails = new Map<string, string>();
  if (admin) {
    const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
    data?.users.forEach((u) => emails.set(u.id, u.email ?? ""));
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="space-y-6">
        <section className="cartao">
          <div className="border-b border-linha px-6 py-4">
            <h2 className="font-semibold text-carvao">Barbeiros</h2>
            <p className="text-sm text-cinza">Quem aparece no check-in, na fila e no resumo.</p>
          </div>
          <div className="divide-y divide-linha">
            {(barbeiros ?? []).map((b) => (
              <FormAcao
                key={b.id}
                action={salvarBarbeiro.bind(null, b.id)}
                botaoClasse="btn-secundario py-2"
                className="grid items-end gap-3 px-6 py-4 sm:grid-cols-[1fr_1fr_auto_auto]"
              >
                <div>
                  <label className="rotulo">Nome</label>
                  <input name="nome" defaultValue={b.nome} className="campo" />
                </div>
                <div>
                  <label className="rotulo">Login vinculado</label>
                  <select name="usuario_id" defaultValue={b.usuario_id ?? ""} className="campo">
                    <option value="">Sem login</option>
                    {(usuarios ?? []).map((u) => (
                      <option key={u.id} value={u.id}>{u.nome}</option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-2 pb-2.5 text-sm">
                  <input type="checkbox" name="ativo" defaultChecked={b.ativo} className="size-4 accent-latao" /> Ativo
                </label>
              </FormAcao>
            ))}
          </div>
          <FormAcao action={criarBarbeiro} botao="Adicionar" resetar className="flex items-end gap-3 border-t border-linha px-6 py-4">
            <div className="flex-1">
              <label className="rotulo">Novo barbeiro (sem login)</label>
              <input name="nome" className="campo" placeholder="Nome" />
            </div>
          </FormAcao>
        </section>
      </div>

      <div className="space-y-6">
        <section className="cartao">
          <div className="border-b border-linha px-6 py-4">
            <h2 className="font-semibold text-carvao">Logins da equipe</h2>
            <p className="text-sm text-cinza">Quem pode entrar no painel. Barbeiro não vê valores, estoque nem despesas.</p>
          </div>
          <div className="divide-y divide-linha">
            {(usuarios ?? []).map((u) => (
              <div key={u.id} className="px-6 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {u.nome}{" "}
                      <span className="ml-1 rounded bg-papel-2 px-1.5 py-0.5 text-xs font-medium text-cinza capitalize">{u.papel}</span>
                      {!u.ativo && <span className="ml-1 rounded bg-perigo/10 px-1.5 py-0.5 text-xs font-medium text-perigo">bloqueado</span>}
                    </p>
                    <p className="text-sm text-cinza">
                      {emails.get(u.id) || "—"}
                      {barbeiros?.some((b) => b.usuario_id === u.id) && " · barbeiro vinculado"}
                    </p>
                  </div>
                  <AlternarUsuario id={u.id} ativo={u.ativo} proprio={u.id === eu.id} />
                </div>
                {admin && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-cinza">Trocar senha</summary>
                    <FormAcao action={redefinirSenha.bind(null, u.id)} botao="Trocar" botaoClasse="btn-secundario py-2" resetar className="mt-2 flex items-end gap-2">
                      <input name="senha" type="text" minLength={6} placeholder="Nova senha" className="campo max-w-56" />
                    </FormAcao>
                  </details>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="cartao p-6">
          <h2 className="font-semibold text-carvao">Criar login</h2>
          {!admin ? (
            <p className="mt-2 text-sm text-perigo">
              Para criar logins pelo sistema, cadastre a variável <span className="font-mono">SUPABASE_SERVICE_ROLE_KEY</span> na Vercel e faça um novo deploy.
            </p>
          ) : (
            <FormAcao action={criarLogin} botao="Criar login" resetar className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="rotulo">Nome</label>
                <input name="nome" required className="campo" />
              </div>
              <div>
                <label className="rotulo">E-mail</label>
                <input name="email" type="email" required className="campo" />
              </div>
              <div>
                <label className="rotulo">Senha inicial</label>
                <input name="senha" type="text" minLength={6} required className="campo" />
              </div>
              <div>
                <label className="rotulo">Papel</label>
                <select name="papel" className="campo" defaultValue="barbeiro">
                  <option value="barbeiro">Barbeiro</option>
                  <option value="dono">Dono (acesso total)</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="rotulo">Vincular ao barbeiro</label>
                <select name="barbeiro_id" className="campo" defaultValue="">
                  <option value="">Não vincular</option>
                  <option value="novo">Criar novo barbeiro com esse nome</option>
                  {(barbeiros ?? []).filter((b) => !b.usuario_id).map((b) => (
                    <option key={b.id} value={b.id}>{b.nome}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-cinza">
                  Vinculado, o barbeiro já aparece selecionado quando ele chama alguém da fila.
                </p>
              </div>
            </FormAcao>
          )}
        </section>
      </div>
    </div>
  );
}

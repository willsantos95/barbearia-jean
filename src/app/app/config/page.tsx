import { TabletSmartphone, Tv } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { FormAcao } from "@/components/form-acao";
import { salvarBarbearia } from "./actions";
import { QrCheckin } from "./qr";

export default async function ConfigPage() {
  const supabase = await createClient();
  const { data: c } = await supabase.from("configuracoes").select("*").eq("id", 1).maybeSingle();

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="cartao p-6">
        <h2 className="mb-4 font-semibold text-carvao">Dados da barbearia</h2>
        <FormAcao action={salvarBarbearia} className="space-y-4">
          <div>
            <label className="rotulo" htmlFor="nome">Nome</label>
            <input id="nome" name="nome" defaultValue={c?.nome ?? ""} className="campo" required />
          </div>
          <div>
            <label className="rotulo" htmlFor="telefone">Telefone</label>
            <input id="telefone" name="telefone" defaultValue={c?.telefone ?? ""} className="campo" />
          </div>
          <div>
            <label className="rotulo" htmlFor="endereco">Endereço</label>
            <input id="endereco" name="endereco" defaultValue={c?.endereco ?? ""} className="campo" />
          </div>
          <div>
            <label className="rotulo" htmlFor="dias">Cliente &quot;sumido&quot; depois de (dias)</label>
            <input id="dias" name="dias_cliente_sumido" type="number" min={7} defaultValue={c?.dias_cliente_sumido ?? 45} className="campo w-32" />
          </div>
        </FormAcao>
      </section>

      <div className="space-y-6">
        <section className="cartao p-6">
          <h2 className="mb-4 font-semibold text-carvao">QR code do check-in</h2>
          <QrCheckin nome={c?.nome ?? "Barbearia"} />
        </section>

        <section className="cartao p-6">
          <h2 className="font-semibold text-carvao">Telas da recepção</h2>
          <p className="mt-1 text-sm text-cinza">Abra no navegador do aparelho e deixe em tela cheia.</p>
          <div className="mt-4 space-y-3 text-sm">
            <a href="/checkin" target="_blank" className="flex items-center gap-3 rounded-lg border border-linha p-3 hover:bg-papel">
              <TabletSmartphone className="size-5 text-latao-escuro" />
              <span><span className="font-semibold">Tablet (totem)</span> · <span className="font-mono">/checkin</span></span>
            </a>
            <a href="/tv" target="_blank" className="flex items-center gap-3 rounded-lg border border-linha p-3 hover:bg-papel">
              <Tv className="size-5 text-latao-escuro" />
              <span><span className="font-semibold">TV da fila</span> · <span className="font-mono">/tv</span></span>
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}

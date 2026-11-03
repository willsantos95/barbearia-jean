import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hoje, planilhaClientes, planilhaEstoque } from "@/lib/excel";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params;
  if (tipo !== "clientes" && tipo !== "estoque") {
    return NextResponse.json({ erro: "Tipo inválido" }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", _req.url));

  const { data: perfil } = await supabase.from("usuarios").select("papel, ativo").eq("id", user.id).maybeSingle();
  if (perfil?.papel !== "dono" || !perfil.ativo) {
    return NextResponse.json({ erro: "Só o dono pode exportar." }, { status: 403 });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Barbearia Jean Rodrigues";
  wb.created = new Date();

  try {
    if (tipo === "clientes") await planilhaClientes(supabase, wb);
    else await planilhaEstoque(supabase, wb);
  } catch (e) {
    return NextResponse.json({ erro: e instanceof Error ? e.message : "Falha ao exportar" }, { status: 500 });
  }

  const buffer = await wb.xlsx.writeBuffer();
  const nome = `${tipo}-barbearia-jean-${hoje()}.xlsx`;
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nome}"`,
      "Cache-Control": "no-store",
    },
  });
}

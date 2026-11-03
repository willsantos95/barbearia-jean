import "server-only";
import ExcelJS from "exceljs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = any;

const COR_CABECALHO = "FF17140F";
const COR_TEXTO_CABECALHO = "FFF6F3EE";
const MOEDA = '"R$" #,##0.00';
const TZ = "America/Sao_Paulo";

const TIPO_PRODUTO: Record<string, string> = { venda: "Venda", insumo: "Insumo", bar: "Bar" };
const TIPO_MOV: Record<string, string> = {
  entrada: "Entrada",
  saida_venda: "Saída (venda)",
  saida_insumo: "Saída (insumo)",
  ajuste: "Ajuste",
};
const ORIGEM: Record<string, string> = { totem: "Tablet", qr: "QR code", balcao: "Balcão" };

export function hoje() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

/** Converte timestamp para Date "local" de São Paulo (Excel não tem fuso) */
function dataLocal(iso: string | null) {
  if (!iso) return null;
  const s = new Date(iso).toLocaleString("sv-SE", { timeZone: TZ }).replace(" ", "T");
  return new Date(s + "Z");
}

function dataPura(d: string | null) {
  return d ? new Date(d + "T00:00:00Z") : null;
}

function telefone(t: string) {
  return t.length === 11 ? `(${t.slice(0, 2)}) ${t.slice(2, 7)}-${t.slice(7)}` : t.length === 10 ? `(${t.slice(0, 2)}) ${t.slice(2, 6)}-${t.slice(6)}` : t;
}

function prepararAba(ws: ExcelJS.Worksheet) {
  const cab = ws.getRow(1);
  cab.font = { bold: true, color: { argb: COR_TEXTO_CABECALHO } };
  cab.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COR_CABECALHO } };
  cab.alignment = { vertical: "middle" };
  cab.height = 22;
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
}

export async function planilhaClientes(supabase: Supa, wb: ExcelJS.Workbook) {
  const { data, error } = await supabase
    .from("vw_clientes")
    .select("nome, telefone, aniversario, instagram, preferencias, observacoes, aceita_contato, origem, created_at, ultima_visita, total_visitas")
    .order("nome")
    .limit(20000);
  if (error) throw error;

  const ws = wb.addWorksheet("Clientes");
  ws.columns = [
    { header: "Nome", key: "nome", width: 30 },
    { header: "Telefone", key: "telefone", width: 17 },
    { header: "WhatsApp", key: "whatsapp", width: 26 },
    { header: "Aniversário", key: "aniversario", width: 13, style: { numFmt: "dd/mm/yyyy" } },
    { header: "Instagram", key: "instagram", width: 20 },
    { header: "Visitas", key: "total_visitas", width: 9 },
    { header: "Última visita", key: "ultima_visita", width: 14, style: { numFmt: "dd/mm/yyyy" } },
    { header: "Dias sem vir", key: "dias", width: 12 },
    { header: "Aceita mensagens", key: "aceita", width: 16 },
    { header: "Preferências de corte", key: "preferencias", width: 40 },
    { header: "Observações", key: "observacoes", width: 40 },
    { header: "Origem", key: "origem", width: 10 },
    { header: "Cadastrado em", key: "created_at", width: 14, style: { numFmt: "dd/mm/yyyy" } },
  ];

  type Cli = {
    nome: string; telefone: string; aniversario: string | null; instagram: string | null; preferencias: string | null;
    observacoes: string | null; aceita_contato: boolean; origem: string; created_at: string; ultima_visita: string | null; total_visitas: number;
  };
  for (const c of (data ?? []) as Cli[]) {
    const ultima = dataLocal(c.ultima_visita);
    const row = ws.addRow({
      nome: c.nome,
      telefone: telefone(c.telefone),
      whatsapp: { text: `wa.me/55${c.telefone}`, hyperlink: `https://wa.me/55${c.telefone}` },
      aniversario: dataPura(c.aniversario),
      instagram: c.instagram ? `@${c.instagram}` : null,
      total_visitas: c.total_visitas,
      ultima_visita: ultima,
      dias: c.ultima_visita ? Math.floor((Date.now() - new Date(c.ultima_visita).getTime()) / 86_400_000) : null,
      aceita: c.aceita_contato ? "Sim" : "Não",
      preferencias: c.preferencias,
      observacoes: c.observacoes,
      origem: ORIGEM[c.origem] ?? c.origem,
      created_at: dataLocal(c.created_at),
    });
    row.getCell("whatsapp").font = { color: { argb: "FF8F6A2E" }, underline: true };
    row.alignment = { vertical: "top", wrapText: false };
  }
  prepararAba(ws);
}

export async function planilhaEstoque(supabase: Supa, wb: ExcelJS.Workbook) {
  const [{ data: produtos, error }, { data: movs }] = await Promise.all([
    supabase
      .from("produtos")
      .select("nome, tipo, unidade, estoque_atual, estoque_minimo, custo_centavos, preco_venda_centavos, ativo")
      .order("tipo")
      .order("nome"),
    supabase
      .from("movimentacoes_estoque")
      .select("created_at, tipo, quantidade, custo_unit_centavos, observacao, produtos(nome, unidade)")
      .order("created_at", { ascending: false })
      .limit(20000),
  ]);
  if (error) throw error;

  const ws = wb.addWorksheet("Produtos");
  ws.columns = [
    { header: "Produto", key: "nome", width: 30 },
    { header: "Tipo", key: "tipo", width: 10 },
    { header: "Unidade", key: "unidade", width: 9 },
    { header: "Estoque atual", key: "atual", width: 14, style: { numFmt: "#,##0.###" } },
    { header: "Estoque mínimo", key: "minimo", width: 15, style: { numFmt: "#,##0.###" } },
    { header: "Situação", key: "situacao", width: 16 },
    { header: "Custo unitário", key: "custo", width: 15, style: { numFmt: MOEDA } },
    { header: "Preço de venda", key: "preco", width: 15, style: { numFmt: MOEDA } },
    { header: "Valor em estoque (custo)", key: "valor", width: 23, style: { numFmt: MOEDA } },
    { header: "Ativo", key: "ativo", width: 8 },
  ];

  type Produto = {
    nome: string; tipo: string; unidade: string; estoque_atual: number; estoque_minimo: number;
    custo_centavos: number; preco_venda_centavos: number | null; ativo: boolean;
  };
  ((produtos ?? []) as Produto[]).forEach((p, i) => {
    const linha = i + 2;
    const atual = Number(p.estoque_atual);
    const minimo = Number(p.estoque_minimo);
    const row = ws.addRow({
      nome: p.nome,
      tipo: TIPO_PRODUTO[p.tipo] ?? p.tipo,
      unidade: p.unidade,
      atual,
      minimo,
      situacao: atual <= minimo ? "Abaixo do mínimo" : "OK",
      custo: p.custo_centavos / 100,
      preco: p.preco_venda_centavos != null ? p.preco_venda_centavos / 100 : null,
      valor: { formula: `MAX(D${linha},0)*G${linha}`, result: Math.max(atual, 0) * (p.custo_centavos / 100) },
      ativo: p.ativo ? "Sim" : "Não",
    });
    if (atual <= minimo) row.getCell("situacao").font = { bold: true, color: { argb: "FFB23A2B" } };
  });

  const n = (produtos?.length ?? 0) + 1;
  const total = ws.addRow({ nome: "Total", valor: { formula: `SUM(I2:I${n})` } });
  total.font = { bold: true };
  total.getCell("valor").numFmt = MOEDA;
  prepararAba(ws);
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: n, column: 10 } };

  const wm = wb.addWorksheet("Movimentações");
  wm.columns = [
    { header: "Data", key: "data", width: 17, style: { numFmt: "dd/mm/yyyy hh:mm" } },
    { header: "Produto", key: "produto", width: 30 },
    { header: "Tipo", key: "tipo", width: 15 },
    { header: "Quantidade", key: "quantidade", width: 12, style: { numFmt: "#,##0.###;[Red]-#,##0.###" } },
    { header: "Unidade", key: "unidade", width: 9 },
    { header: "Custo unitário", key: "custo", width: 15, style: { numFmt: MOEDA } },
    { header: "Observação", key: "obs", width: 40 },
  ];
  type Mov = {
    created_at: string;
    tipo: string;
    quantidade: number;
    custo_unit_centavos: number | null;
    observacao: string | null;
    produtos: { nome: string; unidade: string } | null;
  };
  for (const m of (movs ?? []) as unknown as Mov[]) {
    wm.addRow({
      data: dataLocal(m.created_at),
      produto: m.produtos?.nome ?? "—",
      tipo: TIPO_MOV[m.tipo] ?? m.tipo,
      quantidade: Number(m.quantidade),
      unidade: m.produtos?.unidade ?? "",
      custo: m.custo_unit_centavos != null ? m.custo_unit_centavos / 100 : null,
      obs: m.observacao,
    });
  }
  prepararAba(wm);
}


export function reais(centavos: number | null | undefined) {
  return ((centavos ?? 0) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** "11988887777" -> "(11) 98888-7777" */
export function telefoneFmt(t: string | null | undefined) {
  const d = (t ?? "").replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return t ?? "";
}

export function soDigitos(t: string) {
  let d = t.replace(/\D/g, "");
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  return d;
}

const TZ = "America/Sao_Paulo";

export function dataFmt(iso: string | null | undefined) {
  if (!iso) return "—";
  // datas puras (YYYY-MM-DD) não devem sofrer fuso
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: TZ });
}

export function dataHoraFmt(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function diasDesde(iso: string | null | undefined) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export function whatsappLink(telefone: string) {
  return `https://wa.me/55${soDigitos(telefone)}`;
}

/** Formata enquanto digita: "1198" -> "(11) 98" */
export function telefoneParcial(d: string) {
  if (d.length <= 2) return d.length ? `(${d}` : "";
  const ddd = `(${d.slice(0, 2)}) `;
  const resto = d.slice(2);
  const corte = d.length === 11 ? 5 : 4;
  return resto.length > corte ? `${ddd}${resto.slice(0, corte)}-${resto.slice(corte)}` : ddd + resto;
}

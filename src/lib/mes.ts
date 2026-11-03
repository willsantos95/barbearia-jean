/** Utilidades de mês no formato "YYYY-MM" (fuso de São Paulo) */

export function mesAtual() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()).slice(0, 7);
}

export function mesValido(m: string | undefined) {
  return m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m) ? m : mesAtual();
}

export function somarMes(m: string, delta: number) {
  const [y, mm] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mm - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function intervaloMes(m: string) {
  return { inicio: `${m}-01`, fim: `${somarMes(m, 1)}-01` };
}

export function nomeMes(m: string) {
  const [y, mm] = m.split("-").map(Number);
  const s = new Date(Date.UTC(y, mm - 1, 15)).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

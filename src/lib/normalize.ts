/** Contrato: remove tudo que não é dígito e mantém o PRIMEIRO número. */
export function normalizeContrato(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  const match = s.match(/\d+/);
  return match ? match[0].replace(/^0+/, "") || "0" : "";
}

/** Nota: apenas dígitos. */
export function normalizeNota(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\D+/g, "").replace(/^0+/, "") || (String(value).match(/\d/) ? "0" : "");
}

/** Placa: trim + uppercase, apenas alfanumérico. */
export function normalizePlaca(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const s = String(value).trim().replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function key(contrato: string, nota: string): string {
  return `${contrato}|${nota}`;
}

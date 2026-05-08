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

interface DateParts {
  year: number;
  month: number;
  day: number;
}

const isValidDateParts = ({ year, month, day }: DateParts) => {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (year < 1900 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
};

const pad2 = (value: number) => String(value).padStart(2, "0");

const excelSerialToDateParts = (value: number): DateParts | null => {
  if (!Number.isFinite(value) || value < 1) return null;

  // SheetJS entrega datas do Excel como número quando `raw: true`; a parte decimal representa horário.
  const daySerial = Math.floor(value);
  const utc = Date.UTC(1899, 11, 30) + daySerial * 24 * 60 * 60 * 1000;
  const d = new Date(utc);
  const parts = { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
  return isValidDateParts(parts) ? parts : null;
};

export function parseDataEmissaoParts(value: unknown): DateParts | null {
  if (value === null || value === undefined || value === "") return null;

  if (value instanceof Date) {
    const parts = { year: value.getFullYear(), month: value.getMonth() + 1, day: value.getDate() };
    return isValidDateParts(parts) ? parts : null;
  }

  if (typeof value === "number") return excelSerialToDateParts(value);

  const s = String(value).trim();
  if (!s) return null;

  const br = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})(?:\s+.*)?$/);
  if (br) {
    const parts = { day: Number(br[1]), month: Number(br[2]), year: Number(br[3]) };
    return isValidDateParts(parts) ? parts : null;
  }

  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (iso) {
    const parts = { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) };
    return isValidDateParts(parts) ? parts : null;
  }

  return null;
}

export function formatDataEmissao(value: unknown): string {
  const parts = parseDataEmissaoParts(value);
  return parts ? `${pad2(parts.day)}/${pad2(parts.month)}/${parts.year}` : "—";
}

export function dataEmissaoToTime(value: unknown): number | null {
  const parts = parseDataEmissaoParts(value);
  return parts ? Date.UTC(parts.year, parts.month - 1, parts.day) : null;
}

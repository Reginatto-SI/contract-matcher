import * as XLSX from "xlsx";

export type RawRow = Record<string, unknown>;

export async function readXlsx(file: File): Promise<RawRow[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json<RawRow>(ws, { defval: "", raw: true });
}

/** Procura coluna por nome exato (case/space-insensitive). */
export function getCol(row: RawRow, names: string[]): unknown {
  const keys = Object.keys(row);
  const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
  for (const n of names) {
    const target = norm(n);
    const k = keys.find((k) => norm(k) === target);
    if (k !== undefined) return row[k];
  }
  return undefined;
}

export function assertColumns(rows: RawRow[], required: string[], fileLabel: string) {
  if (rows.length === 0) throw new Error(`${fileLabel}: planilha vazia.`);
  const first = rows[0];
  const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
  const present = new Set(Object.keys(first).map(norm));
  const missing = required.filter((r) => !present.has(norm(r)));
  if (missing.length) {
    throw new Error(`${fileLabel}: coluna(s) obrigatória(s) ausente(s): ${missing.join(", ")}`);
  }
}

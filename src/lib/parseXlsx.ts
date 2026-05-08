import * as XLSX from "xlsx";

export type RawRow = Record<string, unknown>;

export interface ReadXlsxOptions {
  /** Linha visual do Excel (1-based) definida pelo layout fixo da V1. */
  headerRow: number;
  requiredColumns: string[];
  fileLabel: string;
}

const EXCEL_EXTENSIONS = [".xlsx", ".xls"];

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

function assertExcelExtension(file: File, fileLabel: string) {
  const lower = file.name.toLowerCase();
  const valid = EXCEL_EXTENSIONS.some((ext) => lower.endsWith(ext));
  if (!valid) {
    throw new Error(`${fileLabel}: formato inválido. Selecione um arquivo .xlsx ou .xls.`);
  }
}

function getHeaderValues(ws: XLSX.WorkSheet, headerRow: number): string[] {
  if (!ws["!ref"]) return [];
  const usedRange = XLSX.utils.decode_range(ws["!ref"]);
  const headerIndex = headerRow - 1;
  const headerRange = {
    s: { r: headerIndex, c: usedRange.s.c },
    e: { r: headerIndex, c: usedRange.e.c },
  };
  const [headerValues = []] = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    range: headerRange,
    defval: "",
    raw: true,
    blankrows: false,
  });
  return headerValues.map((value) => String(value ?? "").trim()).filter(Boolean);
}

function assertColumns(headers: string[], required: string[], fileLabel: string, sheetName: string, headerRow: number) {
  if (headers.length === 0) {
    throw new Error(
      `${fileLabel}: cabeçalho não encontrado. ` +
        `Aba lida: "${sheetName}". Linha de cabeçalho validada: ${headerRow}.`,
    );
  }

  const present = new Set(headers.map(norm));
  const missing = required.filter((r) => !present.has(norm(r)));
  if (missing.length) {
    const missingText = missing.map((column) => `"${column}"`).join(", ");
    const foundText = headers.length ? headers.join(", ") : "nenhuma coluna encontrada";
    const missingLabel =
      missing.length === 1 ? "coluna obrigatória não encontrada" : "colunas obrigatórias não encontradas";
    throw new Error(
      `${fileLabel}: ${missingLabel}: ${missingText}. ` +
        `Aba lida: "${sheetName}". Linha de cabeçalho validada: ${headerRow}. ` +
        `Colunas encontradas: ${foundText}`,
    );
  }
}

export async function readXlsx(file: File, options: ReadXlsxOptions): Promise<RawRow[]> {
  assertExcelExtension(file, options.fileLabel);

  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames[0];
  const ws = sheetName ? wb.Sheets[sheetName] : undefined;
  if (!ws) throw new Error(`${options.fileLabel}: planilha vazia ou sem abas.`);

  const headers = getHeaderValues(ws, options.headerRow);
  assertColumns(headers, options.requiredColumns, options.fileLabel, sheetName, options.headerRow);

  const rows = XLSX.utils.sheet_to_json<RawRow>(ws, {
    defval: "",
    raw: true,
    // A V1 usa linha de cabeçalho fixa por layout (PRD-02/03), sem detecção automática.
    // O valor recebido é a linha visual do Excel; a biblioteca usa índice zero.
    range: options.headerRow - 1,
  });

  if (rows.length === 0) {
    throw new Error(
      `${options.fileLabel}: planilha sem dados após o cabeçalho. ` +
        `Aba lida: "${sheetName}". Linha de cabeçalho validada: ${options.headerRow}.`,
    );
  }

  return rows;
}

/** Procura coluna por nome exato (case/space-insensitive). */
export function getCol(row: RawRow, names: string[]): unknown {
  const keys = Object.keys(row);
  for (const n of names) {
    const target = norm(n);
    const k = keys.find((k) => norm(k) === target);
    if (k !== undefined) return row[k];
  }
  return undefined;
}

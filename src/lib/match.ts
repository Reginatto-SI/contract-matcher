import { getCol, RawRow } from "./parseXlsx";
import {
  key,
  normalizeContrato,
  normalizeNota,
  normalizePlaca,
  toNumber,
} from "./normalize";

export type Situacao =
  | "OK"
  | "REGISTRO_BASE_INVALIDO"
  | "CONTRATO_NAO_ENCONTRADO"
  | "NOTA_NAO_ENCONTRADA"
  | "NOTA_OUTRO_CONTRATO"
  | "CONTRATO_OUTRA_NOTA"
  | "DUPLICIDADE";

export const situacaoLabel: Record<Situacao, string> = {
  OK: "Vínculo OK",
  REGISTRO_BASE_INVALIDO: "Registro base inválido",
  CONTRATO_NAO_ENCONTRADO: "Contrato não encontrado",
  NOTA_NAO_ENCONTRADA: "Nota não encontrada",
  NOTA_OUTRO_CONTRATO: "Nota vinculada a outro contrato",
  CONTRATO_OUTRA_NOTA: "Contrato vinculado a outra nota",
  DUPLICIDADE: "Duplicidade",
};

export interface BaseRow {
  placa: string;
  contrato: string;
  modalidade: string;
  nota: string;
  contratoCliente: string;
  chaveAcesso: string;
  data_emissao: unknown;
  observacaoNF: string;
  aposDesc: number | null;
  raw: RawRow;
}

export interface ParseBaseResult {
  base: BaseRow[];
  totalArquivo: number;
  ignoradasModalidade: number;
}

export interface CompRow {
  placa: string;
  numeroNF: string;
  nrContrOriginal: string;
  totalLiquido: number | null;
  raw: RawRow;
}

export interface MatchedRow {
  id: number;
  situacao: Situacao;
  detalhe: string;
  placaDivergente: boolean;
  base: BaseRow;
  comp: CompRow | null;
  /** Outras ocorrências encontradas no complementar (úteis no detalhe). */
  hintsContrato: CompRow[];
  hintsNota: CompRow[];
}

export function normalizeModalidade(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

export interface EmpresaDetectionResult {
  empresa: string;
  multiplas: boolean;
}

export function normalizeEmpresaDisplay(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\d+\s*-\s*/, "");
}

export function detectEmpresaFromGrl053(
  rows: RawRow[],
): EmpresaDetectionResult {
  const validasExp = rows.filter(
    (r) => normalizeModalidade(getCol(r, ["MOD"])) === "EXP",
  );
  const rowsParaAnalise = validasExp.length > 0 ? validasExp : rows;
  const empresas = rowsParaAnalise
    .map((r) => normalizeEmpresaDisplay(getCol(r, ["EMPRESA"])))
    .filter((empresa) => empresa.length > 0);

  const unicas = Array.from(new Set(empresas));

  return {
    empresa: unicas[0] ?? "",
    multiplas: unicas.length > 1,
  };
}

export function parseBaseWithStats(rows: RawRow[]): ParseBaseResult {
  const base: BaseRow[] = [];
  let ignoradasModalidade = 0;

  rows.forEach((r) => {
    const modalidade = normalizeModalidade(getCol(r, ["MOD"]));

    // Regra operacional do GRL053: somente expedições (MOD = EXP) entram na conferência e no matching.
    if (modalidade !== "EXP") {
      ignoradasModalidade += 1;
      return;
    }

    base.push({
      placa: normalizePlaca(getCol(r, ["PLACA"])),
      contrato: normalizeContrato(getCol(r, ["CONTRATO"])),
      modalidade,
      // No layout GRL053 da V1, a nota fiscal usada no matching vem da primeira coluna "NOTA" (coluna M).
      // Quando há duplicidade de cabeçalho, o SheetJS mantém a primeira ocorrência como "NOTA" e sufixa as demais.
      nota: normalizeNota(getCol(r, ["NOTA"])),
      contratoCliente: normalizeContrato(
        getCol(r, ["CONTR. CLIENTE", "CONTR CLIENTE", "CONTRATO CLIENTE"]),
      ),
      // A chave de acesso do GRL053 é exibida apenas para conferência manual e não participa do matching da V1.
      chaveAcesso: String(getCol(r, ["CHAVE DE ACESSO"]) ?? "").trim(),
      // DATA ROMANEIO é informativa para tela/exportação; não entra na chave, status ou divergências.
      data_emissao: getCol(r, ["DATA ROMANEIO"]),
      // OBSERVAÇÃO NF é apenas informativa para o drawer; não participa do matching.
      observacaoNF: String(getCol(r, ["OBSERVAÇÃO NF", "OBSERVACAO NF"]) ?? "").trim(),
      aposDesc: toNumber(getCol(r, ["APOS DESC", "APÓS DESC"])),
      raw: r,
    });
  });

  return {
    base,
    totalArquivo: rows.length,
    ignoradasModalidade,
  };
}

export function parseBase(rows: RawRow[]): BaseRow[] {
  return parseBaseWithStats(rows).base;
}

export function parseComp(rows: RawRow[]): CompRow[] {
  return rows.map((r) => ({
    placa: normalizePlaca(getCol(r, ["Placa"])),
    numeroNF: normalizeNota(
      getCol(r, ["Número NF", "Numero NF", "Nº NF", "Nr NF"]),
    ),
    nrContrOriginal: normalizeContrato(
      getCol(r, [
        "Nr Contr Original",
        "Nro Contr Original",
        "Numero Contr Original",
      ]),
    ),
    totalLiquido: toNumber(getCol(r, ["Total Líquido", "Total Liquido"])),
    raw: r,
  }));
}

export function isValidMatchValue(value: string): boolean {
  // Na V1, nota/contrato normalizados como "0" não são valores úteis para matching operacional.
  return value !== "" && value !== "0";
}

function getBaseInvalidDetail(b: BaseRow): string | null {
  const hasContrato = isValidMatchValue(b.contratoCliente);
  const hasNota = isValidMatchValue(b.nota);

  if (hasContrato && hasNota) return null;
  if (!hasContrato && !hasNota)
    return "Registro do GRL053 sem contrato cliente e sem nota fiscal válidos.";
  if (!hasContrato) return "Registro do GRL053 sem contrato cliente válido.";
  return "Registro do GRL053 sem nota fiscal válida.";
}

export function match(base: BaseRow[], comp: CompRow[]): MatchedRow[] {
  const byKey = new Map<string, CompRow[]>();
  const byContrato = new Map<string, CompRow[]>();
  const byNota = new Map<string, CompRow[]>();

  for (const c of comp) {
    // Complementar inválido não entra nos índices porque não é apto para matching operacional.
    if (!isValidMatchValue(c.nrContrOriginal) || !isValidMatchValue(c.numeroNF))
      continue;

    const k = key(c.nrContrOriginal, c.numeroNF);
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(c);

    if (!byContrato.has(c.nrContrOriginal))
      byContrato.set(c.nrContrOriginal, []);
    byContrato.get(c.nrContrOriginal)!.push(c);

    if (!byNota.has(c.numeroNF)) byNota.set(c.numeroNF, []);
    byNota.get(c.numeroNF)!.push(c);
  }

  const result: MatchedRow[] = [];
  base.forEach((b, idx) => {
    const invalidBaseDetail = getBaseInvalidDetail(b);

    // GRL053 é fonte de verdade: linha inválida da base permanece na grid com status próprio.
    if (invalidBaseDetail) {
      result.push({
        id: idx,
        situacao: "REGISTRO_BASE_INVALIDO",
        detalhe: invalidBaseDetail,
        placaDivergente: false,
        base: b,
        comp: null,
        hintsContrato: [],
        hintsNota: [],
      });
      return;
    }

    const k = key(b.contratoCliente, b.nota);
    const matchesKey = byKey.get(k) || [];
    const matchesContrato = byContrato.get(b.contratoCliente) || [];
    const matchesNota = byNota.get(b.nota) || [];

    let situacao: Situacao;
    let detalhe = "";
    let comp: CompRow | null = null;

    if (matchesKey.length > 1) {
      situacao = "DUPLICIDADE";
      comp = matchesKey[0];
      detalhe = `Encontradas ${matchesKey.length} ocorrências do mesmo contrato + nota no complementar.`;
    } else if (matchesKey.length === 1) {
      situacao = "OK";
      comp = matchesKey[0];
      detalhe = "Contrato e nota conferem com o complementar.";
    } else if (matchesContrato.length === 0 && matchesNota.length === 0) {
      situacao = "CONTRATO_NAO_ENCONTRADO";
      detalhe = "Contrato e nota não foram localizados no complementar.";
    } else if (matchesContrato.length === 0) {
      situacao = "CONTRATO_NAO_ENCONTRADO";
      comp = matchesNota[0];
      detalhe = `Nota ${b.nota} existe no complementar, mas vinculada ao contrato ${matchesNota[0].nrContrOriginal}.`;
    } else if (matchesNota.length === 0) {
      situacao = "NOTA_NAO_ENCONTRADA";
      comp = matchesContrato[0];
      detalhe = `Contrato ${b.contratoCliente} existe no complementar, mas com outra nota (ex.: ${matchesContrato[0].numeroNF}).`;
    } else {
      // Existem registros para ambos, mas nenhum par exato → divergência cruzada.
      situacao = "NOTA_OUTRO_CONTRATO";
      comp = matchesNota[0];
      detalhe = `Nota ${b.nota} aparece no complementar com contrato ${matchesNota[0].nrContrOriginal} (esperado ${b.contratoCliente}).`;
    }

    // Reclassificação: se contrato existe vinculado a outra nota e nota existe vinculada a outro contrato,
    // considerar "Contrato vinculado a outra nota" quando a divergência principal é por nota mismatched no mesmo contrato.
    if (situacao === "NOTA_OUTRO_CONTRATO" && matchesContrato.length > 0) {
      // Mantém NOTA_OUTRO_CONTRATO; mas se a nota só tem 1 ocorrência e é exatamente um swap,
      // o detalhe acima já é suficiente.
    }

    const placaDivergente = !!(
      comp &&
      b.placa &&
      comp.placa &&
      b.placa !== comp.placa
    );

    result.push({
      id: idx,
      situacao,
      detalhe,
      placaDivergente,
      base: b,
      comp,
      hintsContrato: matchesContrato.slice(0, 5),
      hintsNota: matchesNota.slice(0, 5),
    });
  });

  return result;
}

export interface Kpis {
  total: number;
  ok: number;
  baseInvalida: number;
  contratoNaoEncontrado: number;
  notaNaoEncontrada: number;
  divergencias: number;
  alertas: number;
}

export function computeKpis(rows: MatchedRow[]): Kpis {
  let ok = 0,
    bi = 0,
    cn = 0,
    nn = 0,
    div = 0,
    alertas = 0;
  for (const r of rows) {
    if (r.situacao === "OK") ok++;
    else if (r.situacao === "REGISTRO_BASE_INVALIDO") bi++;
    else if (r.situacao === "CONTRATO_NAO_ENCONTRADO") cn++;
    else if (r.situacao === "NOTA_NAO_ENCONTRADA") nn++;
    else if (
      r.situacao === "NOTA_OUTRO_CONTRATO" ||
      r.situacao === "CONTRATO_OUTRA_NOTA" ||
      r.situacao === "DUPLICIDADE"
    )
      div++;
    if (r.placaDivergente) alertas++;
  }
  return {
    total: rows.length,
    ok,
    baseInvalida: bi,
    contratoNaoEncontrado: cn,
    notaNaoEncontrada: nn,
    divergencias: div,
    alertas,
  };
}

import { describe, expect, it, vi } from "vitest";
import type { MatchedRow } from "@/lib/match";

const mocks = vi.hoisted(() => {
  const state = {
    excelData: [] as Record<string, unknown>[],
    pdfOptions: null as { body: unknown[][] } | null,
    jsonToSheet: undefined as unknown as ReturnType<typeof vi.fn>,
    writeFile: vi.fn(),
    autoTable: undefined as unknown as ReturnType<typeof vi.fn>,
  };

  state.jsonToSheet = vi.fn((data: Record<string, unknown>[]) => {
    state.excelData = data;
    return { "!ref": "A1" };
  });
  state.autoTable = vi.fn((_: unknown, options: { body: unknown[][] }) => {
    state.pdfOptions = options;
  });

  return state;
});

vi.mock("xlsx", () => ({
  utils: {
    json_to_sheet: mocks.jsonToSheet,
    book_new: vi.fn(() => ({})),
    book_append_sheet: vi.fn(),
  },
  writeFile: mocks.writeFile,
}));

vi.mock("jspdf", () => ({
  default: vi.fn().mockImplementation(() => ({
    internal: {
      pageSize: {
        getWidth: () => 800,
        getHeight: () => 600,
      },
    },
    setFontSize: vi.fn(),
    text: vi.fn(),
    splitTextToSize: vi.fn((text: string) => [text]),
    getTextWidth: vi.fn((text: string) => text.length),
    setTextColor: vi.fn(),
    save: vi.fn(),
  })),
}));

vi.mock("jspdf-autotable", () => ({
  default: mocks.autoTable,
}));

import { exportExcel, exportPDF } from "@/lib/exporters";

const row = (overrides: Partial<MatchedRow> = {}): MatchedRow => ({
  id: 1,
  situacao: "OK",
  detalhe: "Rel. GRL053 e Armazém OK",
  placaDivergente: false,
  base: {
    placa: "BASE123",
    contrato: "10",
    contrato_interno: "10",
    modalidade: "EXP",
    nota: "456",
    contratoCliente: "123",
    chaveAcesso: "",
    data_emissao: "09/06/2025",
    observacaoNF: "",
    aposDesc: 100,
    raw: {},
  },
  comp: {
    placa: "COMP123",
    numeroNF: "456",
    nrContrOriginal: "123",
    totalLiquido: 200,
    raw: {},
  },
  hintsContrato: [],
  hintsNota: [],
  ...overrides,
});

const rows = [
  row({ comp: { ...row().comp!, placa: "OKP1234", totalLiquido: 1234.56 } }),
  row({
    id: 2,
    situacao: "NOTA_NAO_ENCONTRADA",
    detalhe: "Contrato existe no complementar, mas com outra nota.",
    base: { ...row().base, contratoCliente: "4700025098", nota: "26294" },
    comp: {
      ...row().comp!,
      nrContrOriginal: "4700025098",
      numeroNF: "11111",
      placa: "AUXN123",
      totalLiquido: 9876.54,
    },
  }),
];

describe("exportadores da conferência", () => {
  it("não exporta placa nem peso auxiliar como correspondência no Excel", () => {
    exportExcel({ empresa: "Cooperativa", cliente: "Inpasa", rows });

    expect(mocks.excelData[0]["Placa Cliente"]).toBe("OKP1234");
    expect(mocks.excelData[0]["Peso Físico (Total Líquido)"]).toBe("1.234,56");
    expect(mocks.excelData[1]["Placa Cliente"]).toBe("");
    expect(mocks.excelData[1]["Peso Físico (Total Líquido)"]).toBe("");
  });

  it("não exporta placa nem peso auxiliar como correspondência no PDF", () => {
    exportPDF({ empresa: "Cooperativa", cliente: "Inpasa", rows });

    expect(mocks.pdfOptions?.body[0][5]).toBe("OKP1234");
    expect(mocks.pdfOptions?.body[0][7]).toBe("1.234,56");
    expect(mocks.pdfOptions?.body[1][5]).toBe("");
    expect(mocks.pdfOptions?.body[1][7]).toBe("");
  });
});

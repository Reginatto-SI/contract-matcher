import { describe, expect, it } from "vitest";
import { computeKpis, match, parseBase, parseBaseWithStats } from "@/lib/match";
import type { BaseRow, CompRow } from "@/lib/match";

const baseRow = (overrides: Partial<BaseRow> = {}): BaseRow => ({
  placa: "ABC1234",
  contrato: "10",
  modalidade: "EXP",
  contratoCliente: "123",
  nota: "456",
  chaveAcesso: "",
  aposDesc: 100,
  raw: {},
  ...overrides,
});

const compRow = (overrides: Partial<CompRow> = {}): CompRow => ({
  placa: "ABC1234",
  nrContrOriginal: "123",
  numeroNF: "456",
  totalLiquido: 100,
  raw: {},
  ...overrides,
});

describe("parseBase", () => {
  it("ignora linhas do GRL053 com modalidade diferente de EXP antes do matching", () => {
    const result = parseBaseWithStats([
      { PLACA: "ABC1234", CONTRATO: "10", MOD: " exp ", NOTA: "456", "CONTR. CLIENTE": "123", "APOS DESC": 100 },
      { PLACA: "DEF5678", CONTRATO: "11", MOD: "FIX", NOTA: "0", "CONTR. CLIENTE": "999", "APOS DESC": 50 },
      { PLACA: "GHI9012", CONTRATO: "12", MOD: "DEV", NOTA: "", "CONTR. CLIENTE": "888", "APOS DESC": 20 },
    ]);

    expect(result.totalArquivo).toBe(3);
    expect(result.ignoradasModalidade).toBe(2);
    expect(result.base).toHaveLength(1);
    expect(result.base[0].modalidade).toBe("EXP");
  });

  it("lê a chave de acesso informativa do GRL053 pela coluna CHAVE DE ACESSO", () => {
    const [row] = parseBase([
      {
        PLACA: "ABC1234",
        CONTRATO: "10",
        MOD: "EXP",
        NOTA: "456",
        "CONTR. CLIENTE": "123",
        "CHAVE DE ACESSO": " 35123456789012345678901234567890123456789012 ",
        "APOS DESC": 100,
      },
    ]);

    expect(row.chaveAcesso).toBe("35123456789012345678901234567890123456789012");
  });
});

describe("match", () => {
  it("ignora complementar sem contrato nos índices operacionais", () => {
    const [row] = match([baseRow({ contratoCliente: "123", nota: "456" })], [compRow({ nrContrOriginal: "" })]);

    expect(row.situacao).toBe("CONTRATO_NAO_ENCONTRADO");
    expect(row.comp).toBeNull();
    expect(row.hintsContrato).toHaveLength(0);
    expect(row.hintsNota).toHaveLength(0);
  });

  it("ignora complementar sem nota nos índices operacionais", () => {
    const [row] = match([baseRow({ contratoCliente: "123", nota: "456" })], [compRow({ numeroNF: "" })]);

    expect(row.situacao).toBe("CONTRATO_NAO_ENCONTRADO");
    expect(row.comp).toBeNull();
    expect(row.hintsContrato).toHaveLength(0);
    expect(row.hintsNota).toHaveLength(0);
  });

  it("ignora complementar com contrato zero nos índices operacionais", () => {
    const [row] = match([baseRow({ contratoCliente: "123", nota: "456" })], [compRow({ nrContrOriginal: "0" })]);

    expect(row.situacao).toBe("CONTRATO_NAO_ENCONTRADO");
    expect(row.comp).toBeNull();
  });

  it("ignora complementar com nota zero nos índices operacionais", () => {
    const [row] = match([baseRow({ contratoCliente: "123", nota: "456" })], [compRow({ numeroNF: "0" })]);

    expect(row.situacao).toBe("CONTRATO_NAO_ENCONTRADO");
    expect(row.comp).toBeNull();
  });

  it("classifica base sem contrato como REGISTRO_BASE_INVALIDO", () => {
    const [row] = match([baseRow({ contratoCliente: "" })], [compRow()]);

    expect(row.situacao).toBe("REGISTRO_BASE_INVALIDO");
    expect(row.detalhe).toBe("Registro do GRL053 sem contrato cliente válido.");
    expect(row.comp).toBeNull();
    expect(row.hintsContrato).toHaveLength(0);
    expect(row.hintsNota).toHaveLength(0);
  });

  it("classifica base sem nota como REGISTRO_BASE_INVALIDO", () => {
    const [row] = match([baseRow({ nota: "" })], [compRow()]);

    expect(row.situacao).toBe("REGISTRO_BASE_INVALIDO");
    expect(row.detalhe).toBe("Registro do GRL053 sem nota fiscal válida.");
    expect(row.comp).toBeNull();
  });

  it("classifica base com contrato zero como REGISTRO_BASE_INVALIDO", () => {
    const [row] = match([baseRow({ contratoCliente: "0" })], [compRow()]);

    expect(row.situacao).toBe("REGISTRO_BASE_INVALIDO");
    expect(row.detalhe).toBe("Registro do GRL053 sem contrato cliente válido.");
  });

  it("classifica base com nota zero como REGISTRO_BASE_INVALIDO", () => {
    const [row] = match([baseRow({ nota: "0" })], [compRow()]);

    expect(row.situacao).toBe("REGISTRO_BASE_INVALIDO");
    expect(row.detalhe).toBe("Registro do GRL053 sem nota fiscal válida.");
  });

  it("mantém o matching normal para base e complementar válidos", () => {
    const [row] = match([baseRow()], [compRow()]);

    expect(row.situacao).toBe("OK");
    expect(row.comp).toEqual(compRow());
  });

  it("mantém o total da grid derivado da quantidade de linhas da base", () => {
    const rows = match(
      [baseRow({ contratoCliente: "123", nota: "456" }), baseRow({ contratoCliente: "789", nota: "999" })],
      [compRow({ nrContrOriginal: "123", numeroNF: "456" }), compRow({ nrContrOriginal: "", numeroNF: "999" })],
    );
    const kpis = computeKpis(rows);

    expect(rows).toHaveLength(2);
    expect(kpis.total).toBe(2);
    expect(kpis.ok).toBe(1);
    expect(kpis.contratoNaoEncontrado).toBe(1);
  });
});

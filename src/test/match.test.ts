import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import {
  computeKpis,
  detectEmpresaFromGrl053,
  match,
  normalizeEmpresaDisplay,
  parseBase,
  parseBaseWithStats,
  parseComp,
  parseCompWithStats,
} from "@/lib/match";
import type { BaseRow, CompRow } from "@/lib/match";
import { dataEmissaoToTime, formatDataEmissao } from "@/lib/normalize";
import { filterRowsByResultsSearch, sortMatchedRows } from "@/components/ResultsScreen";
import {
  CLIENTES_SUPORTADOS,
  GRL053_LAYOUT,
  DEFAULT_CLIENTE_ID,
  getClienteSuportado,
} from "@/lib/layouts";
import { readXlsx } from "@/lib/parseXlsx";

const baseRow = (overrides: Partial<BaseRow> = {}): BaseRow => ({
  placa: "ABC1234",
  contrato: "10",
  contrato_interno: "10",
  modalidade: "EXP",
  contratoCliente: "123",
  nota: "456",
  chaveAcesso: "",
  data_emissao: "09/06/2025",
  observacaoNF: "",
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

describe("layouts fixos de clientes", () => {
  it("mantém Inpasa como cliente padrão da V1", () => {
    const cliente = getClienteSuportado(DEFAULT_CLIENTE_ID);

    expect(cliente.label).toBe("Inpasa");
    expect(CLIENTES_SUPORTADOS.map((item) => item.label)).toEqual([
      "Inpasa",
      "FS",
    ]);
  });

  it("não exige Denom. Status nas colunas obrigatórias do GRL053", () => {
    expect(GRL053_LAYOUT.requiredColumns).toEqual([
      "PLACA",
      "CONTRATO",
      "MOD",
      "NOTA",
      "CONTR. CLIENTE",
      "APOS DESC",
    ]);
    expect(GRL053_LAYOUT.requiredColumns).not.toContain("Denom. Status");
  });

  it("permite importar GRL053 sem Denom. Status", async () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      [],
      [],
      ["PLACA", "CONTRATO", "MOD", "NOTA", "CONTR. CLIENTE", "APOS DESC"],
      ["ABC1234", "10", "EXP", "456", "123", 100],
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, "GRL053");
    const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    const file = new File([buffer], "grl053.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    await expect(
      readXlsx(file, {
        headerRow: GRL053_LAYOUT.headerRow,
        requiredColumns: GRL053_LAYOUT.requiredColumns,
        fileLabel: "Relatório Base (GRL053)",
      }),
    ).resolves.toHaveLength(1);
  });

  it("mantém as colunas obrigatórias do layout complementar Inpasa", () => {
    const cliente = getClienteSuportado("inpasa");

    expect(cliente.headerRow).toBe(2);
    expect(cliente.requiredColumns).toEqual([
      "Placa",
      "Número NF",
      "Nr Contr Original",
      "Total Líquido",
    ]);
  });

  it("mantém as colunas obrigatórias do layout complementar FS", () => {
    const cliente = getClienteSuportado("fs");

    expect(cliente.headerRow).toBe(1);
    expect(cliente.requiredColumns).toEqual([
      "Placa Caminhão",
      "Nº Nota Fiscal",
      "Peso Líquido",
      "Pedido",
      "Denom. Status",
    ]);
  });

  it("bloqueia importação FS quando coluna obrigatória está ausente", async () => {
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["Placa Caminhão", "Nº Nota Fiscal", "Peso Líquido"],
      ["ABC1234", "456", 100],
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, "FS Entrada");
    const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    const file = new File([buffer], "fs.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const cliente = getClienteSuportado("fs");

    await expect(
      readXlsx(file, {
        headerRow: cliente.headerRow,
        requiredColumns: cliente.requiredColumns,
        fileLabel: `Relatório Complementar (${cliente.label})`,
      }),
    ).rejects.toThrow(
      [
        'Relatório Complementar (FS): coluna obrigatória não encontrada: "Pedido".',
        'Aba lida: "FS Entrada". Linha de cabeçalho validada: 1.',
        'Colunas encontradas: Placa Caminhão, Nº Nota Fiscal, Peso Líquido',
      ].join(" "),
    );
  });
});

describe("parseBase", () => {
  it("ignora linhas do GRL053 com modalidade diferente de EXP antes do matching", () => {
    const result = parseBaseWithStats([
      {
        PLACA: "ABC1234",
        CONTRATO: "10",
        MOD: " exp ",
        NOTA: "456",
        "CONTR. CLIENTE": "123",
        "APOS DESC": 100,
      },
      {
        PLACA: "DEF5678",
        CONTRATO: "11",
        MOD: "FIX",
        NOTA: "0",
        "CONTR. CLIENTE": "999",
        "APOS DESC": 50,
      },
      {
        PLACA: "GHI9012",
        CONTRATO: "12",
        MOD: "DEV",
        NOTA: "",
        "CONTR. CLIENTE": "888",
        "APOS DESC": 20,
      },
    ]);

    expect(result.totalArquivo).toBe(3);
    expect(result.ignoradasModalidade).toBe(2);
    expect(result.base).toHaveLength(1);
    expect(result.base[0].modalidade).toBe("EXP");
  });

  it("ignora linhas EXP do GRL053 com Denom. Status igual a Carga recusada antes do matching", () => {
    const result = parseBaseWithStats([
      {
        PLACA: "MBP8A19",
        CONTRATO: "2688",
        MOD: "EXP",
        NOTA: "26159",
        "CONTR. CLIENTE": "4700025330",
        "Denom. Status": "  carga   recusada  ",
        "APOS DESC": 30000,
      },
      {
        PLACA: "ABC1234",
        CONTRATO: "10",
        MOD: "EXP",
        NOTA: "456",
        "CONTR. CLIENTE": "123",
        "Denom. Status": "Entregue",
        "APOS DESC": 100,
      },
    ]);

    expect(result.totalArquivo).toBe(2);
    expect(result.ignoradasModalidade).toBe(0);
    expect(result.ignoradasCargaRecusada).toBe(1);
    expect(result.base).toHaveLength(1);
    expect(result.base[0].nota).toBe("456");
  });

  it("não deixa carga recusada gerar contrato não encontrado nem entrar nos KPIs", () => {
    const baseImport = parseBaseWithStats([
      {
        PLACA: "MBP8A19",
        CONTRATO: "2688",
        MOD: "EXP",
        NOTA: "26159",
        "CONTR. CLIENTE": "4700025330",
        "Denom. Status": "Carga recusada",
        "APOS DESC": 30000,
      },
    ]);
    const rows = match(baseImport.base, []);
    const kpis = computeKpis(rows);

    expect(rows).toHaveLength(0);
    expect(kpis.total).toBe(0);
    expect(kpis.contratoNaoEncontrado).toBe(0);
  });

  it("captura CONTRATO como contrato_interno informativo do GRL053 preservando letras e traços", () => {
    const [row] = parseBase([
      {
        PLACA: "ABC1234",
        CONTRATO: "  MX-10   Safra 2025  ",
        MOD: "EXP",
        NOTA: "456",
        "CONTR. CLIENTE": "123",
        "APOS DESC": 100,
      },
    ]);

    expect(row.contrato_interno).toBe("MX-10 Safra 2025");
    expect(row.contrato).toBe("10");
    expect(row.contratoCliente).toBe("123");
  });

  it("captura DATA ROMANEIO como data_emissao informativa do GRL053", () => {
    const [row] = parseBase([
      {
        PLACA: "ABC1234",
        CONTRATO: "10",
        MOD: "EXP",
        NOTA: "456",
        "CONTR. CLIENTE": "123",
        "DATA ROMANEIO": "09/06/2025 15:02",
        "APOS DESC": 100,
      },
    ]);

    expect(row.data_emissao).toBe("09/06/2025 15:02");
  });

  it("captura OBSERVAÇÃO NF como observacaoNF informativa do GRL053", () => {
    const [row] = parseBase([
      {
        PLACA: "ABC1234",
        CONTRATO: "10",
        MOD: "EXP",
        NOTA: "456",
        "CONTR. CLIENTE": "123",
        "OBSERVAÇÃO NF": "  Ref. NF produtor 123\nFazenda Modelo  ",
        "APOS DESC": 100,
      },
    ]);

    expect(row.observacaoNF).toBe("Ref. NF produtor 123\nFazenda Modelo");
  });

  it("mantém OBSERVAÇÃO NF fora da regra de matching", () => {
    const [comObservacao] = match(
      [baseRow({ observacaoNF: "texto operacional diferente" })],
      [compRow()],
    );
    const [semObservacao] = match(
      [baseRow({ observacaoNF: "" })],
      [compRow()],
    );

    expect(comObservacao.situacao).toBe("OK");
    expect(semObservacao.situacao).toBe("OK");
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

    expect(row.chaveAcesso).toBe(
      "35123456789012345678901234567890123456789012",
    );
  });
});

describe("parseComp FS", () => {
  it("mapeia Pedido, Nº Nota Fiscal, Placa Caminhão e Peso Líquido para campos internos", () => {
    const [row] = parseComp(
      [
        {
          Pedido: " MTP 00123 ",
          "Nº Nota Fiscal": " NF 000456 ",
          "Placa Caminhão": " abc-1d23 ",
          "Peso Líquido": "1.234,50",
          "Denom. Status": "Entregue",
        },
      ],
      "fs",
    );

    expect(row).toMatchObject({
      nrContrOriginal: "123",
      numeroNF: "456",
      placa: "ABC1D23",
      totalLiquido: 1234.5,
    });
  });

  it("ignora cargas recusadas do layout FS antes do matching e dos KPIs", () => {
    const result = parseCompWithStats(
      [
        {
          Pedido: "123",
          "Nº Nota Fiscal": "456",
          "Placa Caminhão": "ABC1234",
          "Peso Líquido": 100,
          "Denom. Status": " carga recusada ",
        },
        {
          Pedido: "789",
          "Nº Nota Fiscal": "999",
          "Placa Caminhão": "DEF5678",
          "Peso Líquido": 200,
          "Denom. Status": "CARGA RECUSADA",
        },
        {
          Pedido: "123",
          "Nº Nota Fiscal": "456",
          "Placa Caminhão": "ABC1234",
          "Peso Líquido": 100,
          "Denom. Status": "Autorizada",
        },
      ],
      "fs",
    );

    const rows = match([baseRow()], result.comp);
    const kpis = computeKpis(rows);

    expect(result.totalArquivo).toBe(3);
    expect(result.ignoradasFsCargaRecusada).toBe(2);
    expect(result.comp).toHaveLength(1);
    expect(rows).toHaveLength(1);
    expect(rows[0].situacao).toBe("OK");
    expect(kpis).toMatchObject({
      total: 1,
      ok: 1,
      contratoNaoEncontrado: 0,
      notaNaoEncontrada: 0,
      divergencias: 0,
    });
  });

  it("mantém cargas recusadas em outros layouts sem alterar o parsing existente", () => {
    const result = parseCompWithStats([
      {
        "Nr Contr Original": "MTP 00123",
        "Número NF": "000456",
        Placa: "ABC1234",
        "Total Líquido": "100,5",
        "Denom. Status": "Carga recusada",
      },
    ]);

    expect(result.ignoradasFsCargaRecusada).toBe(0);
    expect(result.comp).toHaveLength(1);
    expect(result.comp[0]).toMatchObject({
      nrContrOriginal: "123",
      numeroNF: "456",
      placa: "ABC1234",
      totalLiquido: 100.5,
    });
  });

  it("preserva o parsing Inpasa existente", () => {
    const [row] = parseComp([
      {
        "Nr Contr Original": "MTP 00123",
        "Número NF": "000456",
        Placa: "ABC1234",
        "Total Líquido": "100,5",
      },
    ]);

    expect(row).toMatchObject({
      nrContrOriginal: "123",
      numeroNF: "456",
      placa: "ABC1234",
      totalLiquido: 100.5,
    });
  });
});

describe("empresa do GRL053", () => {
  it("captura a primeira EMPRESA de linhas EXP e remove prefixo numérico simples", () => {
    const result = detectEmpresaFromGrl053([
      { MOD: "FIX", EMPRESA: "2 - EMPRESA IGNORADA" },
      {
        MOD: "EXP",
        EMPRESA:
          " 1 - COOPERATIVA AGROPECUARIA DE NOVA MUTUM COOPERAGRO MUTUM ",
      },
    ]);

    expect(result).toEqual({
      empresa: "COOPERATIVA AGROPECUARIA DE NOVA MUTUM COOPERAGRO MUTUM",
      multiplas: false,
    });
  });

  it("informa ausência de empresa detectável sem impedir preenchimento manual", () => {
    expect(detectEmpresaFromGrl053([{ MOD: "EXP", EMPRESA: " " }])).toEqual({
      empresa: "",
      multiplas: false,
    });
  });

  it("sinaliza múltiplas empresas diferentes no GRL053", () => {
    expect(
      detectEmpresaFromGrl053([
        { MOD: "EXP", EMPRESA: "1 - COOPERATIVA A" },
        { MOD: "EXP", EMPRESA: "2 - COOPERATIVA B" },
      ]),
    ).toEqual({ empresa: "COOPERATIVA A", multiplas: true });
  });

  it("não usa EMPRESA na chave de matching", () => {
    const [row] = match(
      [baseRow({ raw: { EMPRESA: "1 - COOPERATIVA A" } })],
      [compRow({ raw: { EMPRESA: "2 - COOPERATIVA B" } })],
    );

    expect(row.situacao).toBe("OK");
  });

  it("normaliza somente espaços e prefixo numérico para exibição", () => {
    expect(normalizeEmpresaDisplay(" 1 -  COOPERATIVA   TESTE ")).toBe(
      "COOPERATIVA TESTE",
    );
  });
});

describe("match", () => {
  it("ignora complementar sem contrato nos índices operacionais", () => {
    const [row] = match(
      [baseRow({ contratoCliente: "123", nota: "456" })],
      [compRow({ nrContrOriginal: "" })],
    );

    expect(row.situacao).toBe("CONTRATO_NAO_ENCONTRADO");
    expect(row.comp).toBeNull();
    expect(row.hintsContrato).toHaveLength(0);
    expect(row.hintsNota).toHaveLength(0);
  });

  it("ignora complementar sem nota nos índices operacionais", () => {
    const [row] = match(
      [baseRow({ contratoCliente: "123", nota: "456" })],
      [compRow({ numeroNF: "" })],
    );

    expect(row.situacao).toBe("CONTRATO_NAO_ENCONTRADO");
    expect(row.comp).toBeNull();
    expect(row.hintsContrato).toHaveLength(0);
    expect(row.hintsNota).toHaveLength(0);
  });

  it("ignora complementar com contrato zero nos índices operacionais", () => {
    const [row] = match(
      [baseRow({ contratoCliente: "123", nota: "456" })],
      [compRow({ nrContrOriginal: "0" })],
    );

    expect(row.situacao).toBe("CONTRATO_NAO_ENCONTRADO");
    expect(row.comp).toBeNull();
  });

  it("ignora complementar com nota zero nos índices operacionais", () => {
    const [row] = match(
      [baseRow({ contratoCliente: "123", nota: "456" })],
      [compRow({ numeroNF: "0" })],
    );

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

  it("cruza GRL053 CONTR. CLIENTE + NOTA com FS Pedido + Nº Nota Fiscal", () => {
    const fsComp = parseComp(
      [
        {
          Pedido: "PED 00123",
          "Nº Nota Fiscal": "NF-000456",
          "Placa Caminhão": "ZZZ9999",
          "Peso Líquido": 999,
        },
      ],
      "fs",
    );

    const [row] = match([baseRow({ placa: "ABC1234", aposDesc: 100 })], fsComp);

    expect(row.situacao).toBe("OK");
    expect(row.placaDivergente).toBe(true);
    expect(row.comp?.nrContrOriginal).toBe("123");
    expect(row.comp?.numeroNF).toBe("456");
  });

  it("não usa placa nem peso da FS para definir vínculo ou divergência principal", () => {
    const fsComp = parseComp(
      [
        {
          Pedido: "123",
          "Nº Nota Fiscal": "456",
          "Placa Caminhão": "ZZZ9999",
          "Peso Líquido": 999,
        },
      ],
      "fs",
    );
    const [row] = match([baseRow({ placa: "ABC1234", aposDesc: 100 })], fsComp);
    const kpis = computeKpis([row]);

    expect(row.situacao).toBe("OK");
    expect(row.placaDivergente).toBe(true);
    expect(kpis.ok).toBe(1);
    expect(kpis.divergencias).toBe(0);
  });

  it("mantém o total da grid derivado da quantidade de linhas da base", () => {
    const rows = match(
      [
        baseRow({ contratoCliente: "123", nota: "456" }),
        baseRow({ contratoCliente: "789", nota: "999" }),
      ],
      [
        compRow({ nrContrOriginal: "123", numeroNF: "456" }),
        compRow({ nrContrOriginal: "", numeroNF: "999" }),
      ],
    );
    const kpis = computeKpis(rows);

    expect(rows).toHaveLength(2);
    expect(kpis.total).toBe(2);
    expect(kpis.ok).toBe(1);
    expect(kpis.contratoNaoEncontrado).toBe(1);
  });

  it("não usa Contrato MX para matching nem altera KPIs", () => {
    const base = [baseRow({ contrato_interno: "MX-999", contratoCliente: "123", nota: "456" })];
    const complementar = [compRow({ nrContrOriginal: "123", numeroNF: "456" })];

    const [row] = match(base, complementar);
    const kpis = computeKpis([row]);

    expect(row.situacao).toBe("OK");
    expect(kpis).toMatchObject({ total: 1, ok: 1 });
  });
});

describe("data emissão", () => {
  it("formata datas brasileiras, remove horário e exibe traço para valores inválidos", () => {
    expect(formatDataEmissao("09/06/2025 15:02")).toBe("09/06/2025");
    expect(formatDataEmissao(45817)).toBe("09/06/2025");
    expect(formatDataEmissao("2025-06-09T15:02:00")).toBe("09/06/2025");
    expect(formatDataEmissao("31/02/2025")).toBe("—");
    expect(formatDataEmissao("")).toBe("—");
  });

  it("gera valor temporal real para ordenação de data", () => {
    expect(dataEmissaoToTime("01/05/2025")).toBeLessThan(
      dataEmissaoToTime("10/05/2025")!,
    );
    expect(dataEmissaoToTime("10/05/2025")).toBeLessThan(
      dataEmissaoToTime("02/06/2025")!,
    );
  });
});

describe("sortMatchedRows", () => {
  it("ordena nota numericamente", () => {
    const sorted = sortMatchedRows(
      [
        {
          ...match(
            [baseRow({ nota: "1000" })],
            [compRow({ numeroNF: "1000" })],
          )[0],
          id: 1,
        },
        {
          ...match(
            [baseRow({ nota: "999" })],
            [compRow({ numeroNF: "999" })],
          )[0],
          id: 2,
        },
        {
          ...match(
            [baseRow({ nota: "1001" })],
            [compRow({ numeroNF: "1001" })],
          )[0],
          id: 3,
        },
      ],
      { key: "nota", direction: "asc" },
    );

    expect(sorted.map((row) => row.base.nota)).toEqual(["999", "1000", "1001"]);
  });

  it("ordena Contrato MX preservado sem usar na regra de matching", () => {
    const rows = [
      {
        ...match(
          [baseRow({ contrato: "20", contrato_interno: "MX-20", nota: "1" })],
          [compRow({ numeroNF: "1" })],
        )[0],
        id: 1,
      },
      {
        ...match(
          [baseRow({ contrato: "3", contrato_interno: "MX-3", nota: "2" })],
          [compRow({ numeroNF: "2" })],
        )[0],
        id: 2,
      },
    ];

    expect(
      sortMatchedRows(rows, { key: "contratoInterno", direction: "asc" }).map(
        (row) => row.base.contrato_interno,
      ),
    ).toEqual(["MX-3", "MX-20"]);
    expect(rows.map((row) => row.situacao)).toEqual(["OK", "OK"]);
  });

  it("ordena peso numericamente e mantém vazios ao final em ordem decrescente", () => {
    const rows = [
      {
        ...match(
          [baseRow({ aposDesc: null, nota: "1" })],
          [compRow({ numeroNF: "1" })],
        )[0],
        id: 1,
      },
      {
        ...match(
          [baseRow({ aposDesc: 2, nota: "2" })],
          [compRow({ numeroNF: "2" })],
        )[0],
        id: 2,
      },
      {
        ...match(
          [baseRow({ aposDesc: 10, nota: "3" })],
          [compRow({ numeroNF: "3" })],
        )[0],
        id: 3,
      },
    ];

    expect(
      sortMatchedRows(rows, { key: "pesoFiscal", direction: "asc" }).map(
        (row) => row.base.aposDesc,
      ),
    ).toEqual([2, 10, null]);
    expect(
      sortMatchedRows(rows, { key: "pesoFiscal", direction: "desc" }).map(
        (row) => row.base.aposDesc,
      ),
    ).toEqual([10, 2, null]);
  });

  it("ordena data por valor real e preserva valores inválidos ao final", () => {
    const rows = [
      {
        ...match(
          [baseRow({ data_emissao: "02/06/2025", nota: "1" })],
          [compRow({ numeroNF: "1" })],
        )[0],
        id: 1,
      },
      {
        ...match(
          [baseRow({ data_emissao: "01/05/2025", nota: "2" })],
          [compRow({ numeroNF: "2" })],
        )[0],
        id: 2,
      },
      {
        ...match(
          [baseRow({ data_emissao: "inválida", nota: "3" })],
          [compRow({ numeroNF: "3" })],
        )[0],
        id: 3,
      },
      {
        ...match(
          [baseRow({ data_emissao: "10/05/2025", nota: "4" })],
          [compRow({ numeroNF: "4" })],
        )[0],
        id: 4,
      },
    ];

    expect(
      sortMatchedRows(rows, { key: "data_emissao", direction: "asc" }).map(
        (row) => formatDataEmissao(row.base.data_emissao),
      ),
    ).toEqual(["01/05/2025", "10/05/2025", "02/06/2025", "—"]);
  });

  it("ordena depois da lista já filtrada sem incluir registros externos ao filtro", () => {
    const rows = match(
      [
        baseRow({ nota: "1001" }),
        baseRow({ nota: "999", contratoCliente: "999" }),
      ],
      [compRow({ numeroNF: "1001" })],
    );
    const filtered = rows.filter((row) => row.situacao === "OK");

    expect(
      sortMatchedRows(filtered, { key: "nota", direction: "asc" }).map(
        (row) => row.situacao,
      ),
    ).toEqual(["OK"]);
  });
});

describe("KPIs filtrados da conferência", () => {
  it("recalcula KPIs sobre a mesma busca textual usada pela grid", () => {
    const rows = match(
      [
        baseRow({ contratoCliente: "16883", nota: "26384", placa: "MPQ9A17" }),
        baseRow({ contratoCliente: "16883", nota: "26385", placa: "ISF6455" }),
        baseRow({ contratoCliente: "99999", nota: "77777", placa: "ZZZ9999" }),
      ],
      [
        compRow({ nrContrOriginal: "16883", numeroNF: "26384", placa: "QBG4784" }),
        compRow({ nrContrOriginal: "16883", numeroNF: "26385", placa: "ISF6455" }),
      ],
    );

    const searchedRows = filterRowsByResultsSearch(rows, "16883");
    const kpis = computeKpis(searchedRows);

    expect(searchedRows).toHaveLength(2);
    expect(kpis.total).toBe(2);
    expect(kpis.ok).toBe(2);
    expect(kpis.contratoNaoEncontrado).toBe(0);
    expect(kpis.alertas).toBe(1);
  });

  it("busca textual encontra registros por Contrato MX, contrato cliente, nota e placas", () => {
    const rows = match(
      [
        baseRow({ contrato_interno: "1467", contratoCliente: "16883", nota: "26384", placa: "MPQ9A17" }),
        baseRow({ contrato_interno: "2500", contratoCliente: "17000", nota: "30000", placa: "ISF6455" }),
        baseRow({ contrato_interno: "3000", contratoCliente: "18000", nota: "40000", placa: "ZZZ9999" }),
      ],
      [
        compRow({ nrContrOriginal: "16883", numeroNF: "26384", placa: "QBG4784" }),
        compRow({ nrContrOriginal: "17000", numeroNF: "30000", placa: "AAA0000" }),
        compRow({ nrContrOriginal: "18000", numeroNF: "40000", placa: "SPN5B89" }),
      ],
    );

    expect(filterRowsByResultsSearch(rows, "1467").map((row) => row.base.contrato_interno)).toEqual(["1467"]);
    expect(filterRowsByResultsSearch(rows, "16883").map((row) => row.base.contratoCliente)).toEqual(["16883"]);
    expect(filterRowsByResultsSearch(rows, "26384").map((row) => row.base.nota)).toEqual(["26384"]);
    expect(filterRowsByResultsSearch(rows, "isf6455").map((row) => row.base.placa)).toEqual(["ISF6455"]);
    expect(filterRowsByResultsSearch(rows, "spn5b89").map((row) => row.comp?.placa)).toEqual(["SPN5B89"]);
  });
});

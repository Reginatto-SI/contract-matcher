import { describe, expect, it } from "vitest";
import {
  computeKpis,
  detectEmpresaFromGrl053,
  match,
  normalizeEmpresaDisplay,
  parseBase,
  parseBaseWithStats,
} from "@/lib/match";
import type { BaseRow, CompRow } from "@/lib/match";
import { dataEmissaoToTime, formatDataEmissao } from "@/lib/normalize";
import { sortMatchedRows } from "@/components/ResultsScreen";
import {
  CLIENTES_SUPORTADOS,
  DEFAULT_CLIENTE_ID,
  getClienteSuportado,
} from "@/lib/layouts";

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
    expect(CLIENTES_SUPORTADOS.map((item) => item.label)).toEqual(["Inpasa"]);
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

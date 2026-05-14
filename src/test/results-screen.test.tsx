// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ResultsScreen } from "@/components/ResultsScreen";
import type { MatchedRow } from "@/lib/match";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

const row = (overrides: Partial<MatchedRow> = {}): MatchedRow => ({
  id: 1,
  situacao: "OK",
  detalhe: "Rel. GRL053 e Armazém OK",
  placaDivergente: false,
  base: {
    placa: "ABC1234",
    contrato: "10",
    contrato_interno: "MX-ABC-10",
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
    placa: "ABC1234",
    numeroNF: "456",
    nrContrOriginal: "123",
    totalLiquido: 100,
    raw: {},
  },
  hintsContrato: [],
  hintsNota: [],
  ...overrides,
});

describe("ResultsScreen Contrato MX", () => {
  it("exibe a coluna Contrato MX e localiza registros pela busca global", () => {
    render(
      <ResultsScreen
        empresa="Cooperativa"
        cliente="Inpasa"
        rows={[
          row(),
          row({
            id: 2,
            base: { ...row().base, contrato_interno: "MX-ZZ-20", nota: "789", contratoCliente: "987" },
            comp: { ...row().comp!, numeroNF: "789", nrContrOriginal: "987" },
          }),
        ]}
        baseTotalArquivo={2}
        baseIgnoradasModalidade={0}
        baseIgnoradasCargaRecusada={0}
        compIgnoradasFsCargaRecusada={0}
        onReset={() => {}}
      />,
    );

    expect(screen.getByText("Contrato MX")).toBeTruthy();
    expect(screen.getByText("MX-ABC-10")).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("Buscar por Contrato MX, contrato cliente, nota ou placa..."), {
      target: { value: "ABC-10" },
    });

    expect(screen.getByText("MX-ABC-10")).toBeTruthy();
    expect(screen.queryByText("MX-ZZ-20")).toBeNull();
  });

  it("exibe Divergências de vínculo com classe crítica vermelha, não informativa azul", () => {
    render(
      <ResultsScreen
        empresa="Cooperativa"
        cliente="Inpasa"
        rows={[
          row({
            situacao: "NOTA_OUTRO_CONTRATO",
            detalhe: "Nota vinculada a outro contrato.",
            base: { ...row().base, nota: "999" },
            comp: { ...row().comp!, numeroNF: "999", nrContrOriginal: "987" },
          }),
        ]}
        baseTotalArquivo={1}
        baseIgnoradasModalidade={0}
        baseIgnoradasCargaRecusada={0}
        compIgnoradasFsCargaRecusada={0}
        onReset={() => {}}
      />,
    );

    const label = screen.getByText("Divergências de vínculo");
    const card = label.closest("button");

    expect(card?.innerHTML).toContain("text-destructive");
    expect(card?.innerHTML).not.toContain("text-info");
  });
});

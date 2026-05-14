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

  it("exibe Placa Cliente e Peso Físico para linha com vínculo OK", () => {
    render(
      <ResultsScreen
        empresa="Cooperativa"
        cliente="Inpasa"
        rows={[
          row({
            comp: { ...row().comp!, placa: "OKP1234", totalLiquido: 1234.56 },
          }),
        ]}
        baseTotalArquivo={1}
        baseIgnoradasModalidade={0}
        baseIgnoradasCargaRecusada={0}
        compIgnoradasFsCargaRecusada={0}
        onReset={() => {}}
      />,
    );

    expect(screen.getByText("OKP1234")).toBeTruthy();
    expect(screen.getByText("1.234,56")).toBeTruthy();
  });

  it("não exibe placa nem peso auxiliar na grid para linhas sem vínculo OK", () => {
    render(
      <ResultsScreen
        empresa="Cooperativa"
        cliente="Inpasa"
        rows={[
          row({
            id: 1,
            situacao: "NOTA_NAO_ENCONTRADA",
            detalhe: "Contrato 4700025098 existe no complementar, mas com outra nota.",
            base: { ...row().base, contratoCliente: "4700025098", nota: "26294" },
            comp: {
              ...row().comp!,
              nrContrOriginal: "4700025098",
              numeroNF: "11111",
              placa: "AUXN123",
              totalLiquido: 9876.54,
            },
          }),
          row({
            id: 2,
            situacao: "CONTRATO_NAO_ENCONTRADO",
            detalhe: "Nota 555 existe no complementar, mas vinculada a outro contrato.",
            base: { ...row().base, contratoCliente: "999999", nota: "555" },
            comp: {
              ...row().comp!,
              nrContrOriginal: "123456",
              numeroNF: "555",
              placa: "AUXC456",
              totalLiquido: 8765.43,
            },
          }),
        ]}
        baseTotalArquivo={2}
        baseIgnoradasModalidade={0}
        baseIgnoradasCargaRecusada={0}
        compIgnoradasFsCargaRecusada={0}
        onReset={() => {}}
      />,
    );

    expect(screen.queryByText("AUXN123")).toBeNull();
    expect(screen.queryByText("9.876,54")).toBeNull();
    expect(screen.queryByText("AUXC456")).toBeNull();
    expect(screen.queryByText("8.765,43")).toBeNull();
  });

  it("filtra Alertas (placa) sem exibir linhas de nota não encontrada", () => {
    render(
      <ResultsScreen
        empresa="Cooperativa"
        cliente="Inpasa"
        rows={[
          row({
            id: 1,
            placaDivergente: true,
            base: { ...row().base, nota: "456", placa: "ABC1234" },
            comp: { ...row().comp!, numeroNF: "456", placa: "XYZ9876" },
          }),
          row({
            id: 2,
            situacao: "NOTA_NAO_ENCONTRADA",
            detalhe: "Contrato 4700025098 existe no complementar, mas com outra nota.",
            placaDivergente: false,
            base: {
              ...row().base,
              contratoCliente: "4700025098",
              nota: "26294",
              placa: "BYH8I88",
            },
            comp: {
              ...row().comp!,
              nrContrOriginal: "4700025098",
              numeroNF: "11111",
              placa: "KDG1H50",
            },
          }),
        ]}
        baseTotalArquivo={2}
        baseIgnoradasModalidade={0}
        baseIgnoradasCargaRecusada={0}
        compIgnoradasFsCargaRecusada={0}
        onReset={() => {}}
      />,
    );

    fireEvent.click(screen.getByText("Alertas (placa)").closest("button")!);

    expect(screen.getByText("456")).toBeTruthy();
    expect(screen.queryByText("26294")).toBeNull();
    expect(screen.queryByText("KDG1H50")).toBeNull();
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

  it("não exibe na grid uma carga recusada da FS já removida do resultado operacional", () => {
    render(
      <ResultsScreen
        empresa="Cooperativa"
        cliente="FS"
        rows={[
          row({
            id: 2,
            base: { ...row().base, contratoCliente: "123", nota: "456" },
            comp: { ...row().comp!, nrContrOriginal: "123", numeroNF: "456" },
          }),
        ]}
        baseTotalArquivo={2}
        baseIgnoradasModalidade={0}
        baseIgnoradasCargaRecusada={0}
        compIgnoradasFsCargaRecusada={1}
        onReset={() => {}}
      />,
    );

    expect(screen.queryByText("26159")).toBeNull();
    expect(screen.queryByText("4700025330")).toBeNull();
    expect(screen.getByText(/cargas recusadas da FS foram desconsideradas da análise/)).toBeTruthy();
  });
});

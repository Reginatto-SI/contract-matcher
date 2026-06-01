export type ClienteComplementarId = "inpasa" | "fs" | "inpasa-nova-mutum";

export interface FixedLayoutConfig {
  id: string;
  label: string;
  requiredColumns: string[];
  headerRow: number;
}

export const GRL053_LAYOUT: FixedLayoutConfig = {
  id: "grl053",
  label: "GRL053",
  requiredColumns: [
    "PLACA",
    "CONTRATO",
    "MOD",
    "NOTA",
    "CONTR. CLIENTE",
    "APOS DESC",
  ],
  headerRow: 3,
};

// Lista fixa da V1. Novos clientes devem entrar aqui somente quando o layout complementar fixo for homologado.
export const CLIENTES_SUPORTADOS: Array<
  FixedLayoutConfig & { id: ClienteComplementarId }
> = [
  {
    id: "inpasa",
    // Label operacional exibido ao usuário; o id e as colunas permanecem o layout fixo Inpasa da V1.
    label: "Inpasa - Sinop",
    requiredColumns: [
      "Placa",
      "Número NF",
      "Nr Contr Original",
      "Total Líquido",
    ],
    headerRow: 2,
  },
  {
    id: "fs",
    label: "FS",
    // Layout complementar FS real: cabeçalho na linha 1; Pedido e Nº Nota Fiscal são os únicos campos de vínculo.
    // Placa Caminhão e Peso Líquido são importados apenas como informação visual.
    requiredColumns: [
      "Placa Caminhão",
      "Nº Nota Fiscal",
      "Peso Líquido",
      "Pedido",
      // Coluna específica do complementar FS usada para descartar cargas recusadas antes da análise.
      "Denom. Status",
    ],
    headerRow: 1,
  },
  {
    id: "inpasa-nova-mutum",
    label: "Inpasa - Nova Mutum",
    // Layout complementar Inpasa - Nova Mutum: não possui coluna de placa nem dados de transporte.
    // Vínculo é feito apenas por Contrato Original + Número; Peso Final é informativo.
    requiredColumns: ["Contrato Original", "Número", "Peso Final"],
    headerRow: 1,
  },
];

export const DEFAULT_CLIENTE_ID = "inpasa";

export function getClienteSuportado(
  id: string,
): FixedLayoutConfig & { id: ClienteComplementarId } {
  const fallback = CLIENTES_SUPORTADOS[0];
  if (!fallback) {
    throw new Error("Nenhum cliente suportado configurado.");
  }

  return CLIENTES_SUPORTADOS.find((cliente) => cliente.id === id) ?? fallback;
}

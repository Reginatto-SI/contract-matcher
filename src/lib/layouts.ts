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
export const CLIENTES_SUPORTADOS: FixedLayoutConfig[] = [
  {
    id: "inpasa",
    label: "Inpasa",
    requiredColumns: [
      "Placa",
      "Número NF",
      "Nr Contr Original",
      "Total Líquido",
    ],
    headerRow: 2,
  },
];

export const DEFAULT_CLIENTE_ID = "inpasa";

export function getClienteSuportado(id: string): FixedLayoutConfig {
  const fallback = CLIENTES_SUPORTADOS[0];
  if (!fallback) {
    throw new Error("Nenhum cliente suportado configurado.");
  }

  return CLIENTES_SUPORTADOS.find((cliente) => cliente.id === id) ?? fallback;
}

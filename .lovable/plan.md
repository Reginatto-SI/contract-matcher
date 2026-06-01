# Plano — Novo layout complementar "Inpasa - Nova Mutum"

Adicionar terceiro layout fixo ao sistema, mantendo Inpasa - Sinop e FS intactos. Layout sem placa; matching continua por contrato cliente + nota.

## 1. `src/lib/layouts.ts`

- Ampliar `ClienteComplementarId` para `"inpasa" | "fs" | "inpasa-nova-mutum"`.
  - Nota: manter o ID `"inpasa"` para Sinop preserva compatibilidade do `DEFAULT_CLIENTE_ID` e do parser atual sem refactor (atende a regra "não quebrar layouts existentes" e "seguir padrão de IDs existente").
- Adicionar entrada em `CLIENTES_SUPORTADOS`:
  - `id: "inpasa-nova-mutum"`
  - `label: "Inpasa - Nova Mutum"`
  - `requiredColumns: ["Contrato Original", "Número", "Peso Final"]`
  - `headerRow: 1` (ajustar se validação inicial indicar outro; padrão dos demais novos layouts FS é linha 1)
- Comentário curto: layout sem placa nem dados de transporte.

## 2. `src/lib/match.ts` — `parseCompWithStats`

Adicionar ramo `if (clienteId === "inpasa-nova-mutum")` antes do fallback Inpasa Sinop:

```ts
return {
  comp: rows.map((r) => ({
    placa: "",                       // layout sem placa — não exigida, sem alerta
    numeroNF: normalizeNota(getCol(r, ["Número"])),
    nrContrOriginal: normalizeContrato(getCol(r, ["Contrato Original"])),
    totalLiquido: toNumber(getCol(r, ["Peso Final"])),
    raw: r,
  })),
  totalArquivo: rows.length,
  ignoradasFsCargaRecusada: 0,
  ignoredKeys: [],
};
```

A regra atual de `placaDivergente` em `match()` já exige `b.placa && comp.placa` — com `comp.placa = ""` nenhum alerta é gerado. Nenhuma alteração no motor de matching.

## 3. UI / Tela de conferência

`UploadScreen.tsx` já popula o select a partir de `CLIENTES_SUPORTADOS` — o novo layout aparece automaticamente. `ResultsScreen` exibe `cliente` recebido (label), também automático.

Verificar rapidamente exportadores (`src/lib/exporters.ts`) para garantir que `placa` vazia e ausência de divergência de placa não quebram colunas — deve seguir o mesmo tratamento já usado para registros sem `comp`.

## 4. Testes (`src/test/match.test.ts`)

Adicionar casos:
- Parse válido Nova Mutum mapeia Contrato Original → `nrContrOriginal`, Número → `numeroNF`, Peso Final → `totalLiquido`, `placa = ""`.
- Match OK com base GRL053 quando contrato+nota batem.
- `placaDivergente = false` mesmo com base tendo placa.
- Layout Sinop e FS continuam funcionando (testes existentes não devem regredir).

Validação manual sugerida: erros de coluna ausente (Contrato Original / Número / Peso Final) já são cobertos pelo `readXlsx` via `requiredColumns`, com mensagem padrão do projeto.

## Arquivos alterados

- `src/lib/layouts.ts`
- `src/lib/match.ts`
- `src/test/match.test.ts`
- `docs/Analises/analise-novo-layout-inpasa-nova-mutum.md` (registro da decisão)

## Restrições respeitadas

Sem cadastro dinâmico, sem DE/PARA, sem alteração do GRL053, do filtro MOD=EXP, do motor de matching, nem dos layouts Sinop/FS. Peso permanece informativo. Placa não exigida e sem alerta para Nova Mutum.

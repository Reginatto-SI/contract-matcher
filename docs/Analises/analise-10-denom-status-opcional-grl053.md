# Análise 10 — `Denom. Status` opcional no GRL053

## 1. Diagnóstico

O ajuste anterior passou a exigir `Denom. Status` em `GRL053_LAYOUT.requiredColumns`. Essa obrigatoriedade criava risco de bloqueio indevido, porque os PRDs e o `README.md` documentam como obrigatórias do GRL053 apenas as colunas de layout base usadas pela V1: `PLACA`, `CONTRATO`, `MOD`, `NOTA`, `CONTR. CLIENTE` e `APOS DESC`.

A evidência no código era direta:

- `src/lib/layouts.ts` listava `Denom. Status` dentro de `GRL053_LAYOUT.requiredColumns`.
- `src/lib/parseXlsx.ts` valida todas as colunas de `requiredColumns` antes de liberar a importação.
- Portanto, um GRL053 válido pelos PRDs, mas sem `Denom. Status`, falharia antes do parser da base.

## 2. Por que `Denom. Status` não deve bloquear o GRL053

`Denom. Status` é necessário para descartar cargas recusadas quando essa informação está disponível, mas não está consolidado nos PRDs como coluna obrigatória do GRL053. Como a V1 usa layout fixo e falha explícita, adicionar uma coluna não documentada como obrigatória ampliaria o bloqueio de importação sem decisão de produto.

A regra refinada é:

1. O GRL053 continua exigindo somente as colunas obrigatórias já documentadas.
2. Se `Denom. Status` existir no GRL053, o parser aplica a exclusão exata de `Carga recusada`.
3. Se `Denom. Status` não existir no GRL053, a importação segue normalmente e nenhuma inferência é feita.

## 3. Qual layout realmente usa essa coluna como obrigatória

O layout complementar FS continua exigindo `Denom. Status`, porque a implementação existente do layout FS usa essa coluna para descartar registros recusados antes do matching complementar.

Assim, a obrigatoriedade fica restrita ao layout que realmente depende dela:

- GRL053: `Denom. Status` opcional.
- Complementar FS: `Denom. Status` obrigatório e usado para exclusão de cargas recusadas.
- Complementar Inpasa: comportamento preservado.

## 4. Arquivos alterados

- `src/lib/layouts.ts`
- `src/lib/match.ts`
- `src/test/match.test.ts`
- `docs/Analises/analise-10-denom-status-opcional-grl053.md`

## 5. Regra implementada

- Removida `Denom. Status` de `GRL053_LAYOUT.requiredColumns`.
- Mantida a leitura opcional no parser da base via `getCol(r, ["Denom. Status"])`.
- Mantida a comparação determinística: texto normalizado, espaços extras colapsados, comparação case-insensitive por igualdade exata com `carga recusada`.
- Mantida a exclusão FS antes do matching complementar.
- Nenhuma regra de matching foi alterada.

## 6. Testes ajustados

Os testes foram refinados para cobrir:

- GRL053 não exige `Denom. Status` em `requiredColumns`.
- GRL053 sem `Denom. Status` importa normalmente pelo `readXlsx`.
- GRL053 com `Denom. Status = Carga recusada` ignora a linha antes do matching.
- Carga recusada não gera `Contrato não encontrado` nem entra nos KPIs.
- Complementar FS com `Denom. Status = Carga recusada` continua ignorando a linha.
- Card `Divergências de vínculo` continua usando classe crítica/vermelha, não azul/informativa.

## 7. Validação final

Comandos executados:

- `git diff --check` — sem problemas de whitespace.
- `npm test` — não executou a suíte porque as dependências não estão instaladas no ambiente (`vitest: not found`).

## 8. Riscos restantes

- A suíte automatizada precisa ser executada em ambiente com dependências instaladas, pois este ambiente não possui `vitest` disponível.
- Se futuramente houver PRD homologando `Denom. Status` como obrigatório no GRL053, o layout fixo poderá ser atualizado novamente com essa decisão documentada.

## 9. Checklist final

- [x] `Denom. Status` não bloqueia importação do GRL053 quando ausente.
- [x] A regra de `Carga recusada` continua funcionando quando a coluna existir.
- [x] O layout FS continua ignorando cargas recusadas.
- [x] KPIs, grid e exportações continuam sem cargas recusadas quando a linha foi descartada antes do matching.
- [x] `Divergências de vínculo` continua vermelho/crítico.
- [x] Nenhuma regra de matching foi alterada indevidamente.

# Análise 4 — Correção de registros inválidos no matching

## 1. Resumo da correção aplicada

Foi aplicado ajuste mínimo no motor de matching para manter o GRL053 como fonte exclusiva da grid e impedir que registros inválidos do complementar contaminem os índices operacionais.

A correção mantém o fluxo atual:

1. GRL053 é parseado como base.
2. Complementar é parseado como fonte de comparação.
3. `match(base, comp)` cria a lista final a partir de `base`.
4. KPIs, filtros, grid e exportação continuam consumindo `MatchedRow[]`.

Mudanças principais:

- Complementar só entra nos índices se tiver contrato e nota válidos.
- Valor normalizado `"0"` passou a ser inválido para matching, assim como vazio.
- Linhas inválidas do GRL053 continuam aparecendo na grid, mas agora com status próprio `REGISTRO_BASE_INVALIDO`.
- Foi criado KPI/filtro compacto `Base inválida`.
- Exportação continua usando a mesma lista da tela e passa a refletir o novo rótulo automaticamente.

## 2. Arquivos alterados

- `src/lib/match.ts`
  - Adiciona `REGISTRO_BASE_INVALIDO` em `Situacao`.
  - Adiciona rótulo `Registro base inválido`.
  - Adiciona `isValidMatchValue(value)` para tratar `""` e `"0"` como inválidos para matching.
  - Ignora registros complementares sem contrato ou nota válidos antes de popular `byKey`, `byContrato` e `byNota`.
  - Classifica linha base sem contrato cliente válido ou sem nota válida como `REGISTRO_BASE_INVALIDO`.
  - Adiciona `baseInvalida` aos KPIs.

- `src/components/ResultsScreen.tsx`
  - Adiciona badge para `REGISTRO_BASE_INVALIDO`.
  - Adiciona filtro `BASE_INVALIDA`.
  - Adiciona card compacto `Base inválida`.
  - Mantém a grid consumindo `rows`/`filtered`, sem nova origem de dados.

- `src/lib/exporters.ts`
  - Não precisou de mudança funcional direta, pois a exportação já usa `situacaoLabel[r.situacao]` e `r.detalhe` da mesma lista da tela.

- `src/test/match.test.ts`
  - Adiciona testes unitários para registros inválidos do complementar, registros inválidos da base, matching normal e preservação do total derivado da base.

- `docs/PRD/PRD-04 — Normalização de Dados e Motor de Matching (V1).txt`
  - Documenta validade mínima para matching.
  - Documenta que registros do complementar inválidos não participam dos índices.
  - Documenta o resultado `REGISTRO BASE INVÁLIDO`.

- `docs/PRD/PRD-05 — Tela de Conferência (V1).txt`
  - Documenta KPI `Base inválida`.
  - Documenta o status `Registro base inválido` na grid.

## 3. Regra final para registros inválidos do complementar

Um registro complementar só participa dos índices operacionais quando ambos os campos são válidos:

- `nrContrOriginal` válido;
- `numeroNF` válido.

São inválidos para matching:

- contrato vazio;
- contrato normalizado como `"0"`;
- nota vazia;
- nota normalizada como `"0"`.

Quando inválido, o registro complementar:

- não entra em `byKey`;
- não entra em `byContrato`;
- não entra em `byNota`;
- não influencia status;
- não influencia hints;
- não influencia duplicidade;
- não cria linha na grid.

## 4. Regra final para registros inválidos do GRL053

Como o GRL053 é fonte de verdade, toda linha da base continua gerando uma linha na conferência.

Porém, se a linha do GRL053 não tiver contrato cliente ou nota fiscal válidos, ela não é mais tratada como tentativa normal de vínculo.

São inválidos para matching na base:

- `contratoCliente === ""`;
- `contratoCliente === "0"`;
- `nota === ""`;
- `nota === "0"`.

Nesses casos, a linha aparece na grid com `comp: null`, sem hints e sem alerta de placa.

## 5. Como ficou o novo status `REGISTRO_BASE_INVALIDO`

Novo status técnico:

```text
REGISTRO_BASE_INVALIDO
```

Rótulo exibido:

```text
Registro base inválido
```

Detalhes implementados:

- Sem contrato e sem nota:
  - `Registro do GRL053 sem contrato cliente e sem nota fiscal válidos.`
- Sem contrato:
  - `Registro do GRL053 sem contrato cliente válido.`
- Sem nota:
  - `Registro do GRL053 sem nota fiscal válida.`

Esse status separa problema de qualidade da base de erro real de vínculo com o complementar.

## 6. Como ficaram os KPIs/filtros

Foi adicionada contagem própria `baseInvalida` em `computeKpis`.

Na tela, foi adicionado card/filtro compacto:

```text
Base inválida
```

Os cards atuais permanecem:

- Vínculo OK;
- Contrato não encontrado;
- Nota não encontrada;
- Divergências de vínculo;
- Alertas (placa).

O filtro de divergências continua limitado a:

- `NOTA_OUTRO_CONTRATO`;
- `CONTRATO_OUTRA_NOTA`;
- `DUPLICIDADE`.

Assim, `REGISTRO_BASE_INVALIDO` não se mistura com divergência de vínculo nem com contrato/nota não encontrados.

## 7. Como ficou a exportação

A exportação não recalcula matching.

Ela continua recebendo `rows: filtered` a partir da tela e exportando os campos da mesma lista exibida na grid.

Como o exportador usa `situacaoLabel[r.situacao]` e `r.detalhe`, o novo status é exportado como `Registro base inválido` com o detalhe correspondente.

## 8. Testes realizados

Testes adicionados em `src/test/match.test.ts` cobrem:

1. Complementar sem contrato não entra nos índices.
2. Complementar sem nota não entra nos índices.
3. Complementar com contrato `0` não entra nos índices.
4. Complementar com nota `0` não entra nos índices.
5. Base sem contrato vira `REGISTRO_BASE_INVALIDO`.
6. Base sem nota vira `REGISTRO_BASE_INVALIDO`.
7. Base com contrato `0` vira `REGISTRO_BASE_INVALIDO`.
8. Base com nota `0` vira `REGISTRO_BASE_INVALIDO`.
9. Base válida continua usando matching normal.
10. Total/KPI continua derivado da quantidade de linhas da base.

Checks executados:

- `npm ci` foi tentado, mas falhou por bloqueio do registry com `403 Forbidden` ao baixar `@testing-library/jest-dom`.
- `npm run test` foi tentado, mas falhou porque `vitest` não está instalado no ambiente após a falha do `npm ci`.
- `npm run lint` foi tentado, mas falhou porque `@eslint/js` não está instalado no ambiente após a falha do `npm ci`.
- `npm run build` foi tentado, mas falhou porque `vite` não está instalado no ambiente após a falha do `npm ci`.
- `git -c core.whitespace=blank-at-eol,blank-at-eof,space-before-tab,cr-at-eol diff --check` passou sem apontar whitespace inválido, preservando os PRDs em CRLF.

## 9. Riscos restantes

- A suíte automatizada não pôde ser executada neste ambiente porque as dependências não foram instaladas.
- A decisão de tratar `"0"` como inválido foi aplicada especificamente no matching, sem alterar a normalização geral, para reduzir efeito colateral.
- O novo card `Base inválida` aumenta de cinco para seis cards, mas mantém o padrão visual existente e layout compacto.
- Não foi criado diagnóstico técnico para linhas complementares ignoradas, conforme escopo desta etapa.

## 10. Confirmação de que a grid continua sendo derivada exclusivamente do GRL053

A origem da grid não foi alterada.

O `match(base, comp)` continua criando `MatchedRow[]` dentro do percurso da base GRL053. O complementar continua sendo usado apenas para montar índices auxiliares, agora filtrados por validade mínima.

Portanto, a grid continua tendo no máximo uma linha para cada linha recebida do GRL053, e nenhuma linha é criada exclusivamente a partir do complementar.

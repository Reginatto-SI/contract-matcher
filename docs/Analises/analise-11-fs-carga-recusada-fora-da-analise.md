# Análise 11 — FS: cargas recusadas fora da análise operacional

## Diagnóstico do bug

O problema ocorre no fluxo do cliente/layout complementar **FS** quando o relatório complementar contém linhas com `Denom. Status = Carga recusada`.

O parser do complementar FS já removia essas linhas do array analisável do complementar e incrementava o contador técnico de cargas recusadas. Porém, a base GRL053 continuava sendo percorrida integralmente pelo motor de matching.

Com isso, quando a linha recusada era retirada apenas do complementar, a linha correspondente da base GRL053 ainda entrava no matching com `CONTR. CLIENTE + NOTA`. Como a chave já não existia nos índices do complementar, o resultado operacional era classificado como `Contrato não encontrado`.

## Por que remover somente do complementar não era suficiente

A conferência usa a base GRL053 como fonte principal de linhas analisadas. Portanto, remover a carga recusada apenas do complementar elimina a evidência de vínculo, mas não elimina a linha da base que possui a mesma chave operacional.

Para o layout FS, uma carga recusada não significa uma divergência operacional entre GRL053 e complementar. Ela significa que aquela combinação de `Pedido + Nº Nota Fiscal` deve ficar fora da análise. Por isso, a mesma chave também precisa ser reconhecida na base GRL053 e ignorada antes da geração de `MatchedRow`.

## Tratamento implementado

Foi criado o controle de chaves recusadas do layout FS:

- contrato normalizado a partir de `Pedido`;
- nota normalizada a partir de `Nº Nota Fiscal`;
- chave no formato `contrato_normalizado + "_" + nota_normalizada`.

Exemplo:

```text
Pedido: 4700025330
Nº Nota Fiscal: 26159
Denom. Status: Carga recusada
Chave ignorada: 4700025330_26159
```

Durante o matching, quando as opções recebem essas chaves ignoradas, a linha da base GRL053 com `CONTR. CLIENTE + NOTA` equivalente é descartada antes de produzir resultado operacional. Assim, ela não gera:

- `Contrato não encontrado`;
- `Nota não encontrada`;
- divergência de vínculo;
- `Vínculo OK`;
- linha na grid;
- contagem nos KPIs;
- saída em exportações, já que as exportações recebem as mesmas linhas resultantes da grid.

A regra permanece específica do layout complementar FS, porque apenas o parser FS popula `ignoredKeys`. O layout Inpasa continua retornando lista vazia e seguindo o comportamento anterior.

## Arquivos alterados

- `src/lib/match.ts`
  - adiciona `ignoredKeys` ao resultado do parser complementar;
  - cria chave recusada FS baseada em `Pedido + Nº Nota Fiscal`;
  - filtra a base GRL053 durante o matching quando a chave está recusada.

- `src/pages/Index.tsx`
  - repassa as chaves recusadas retornadas pelo parser FS para o matching.

- `src/components/ResultsScreen.tsx`
  - ajusta o texto do resumo técnico para deixar claro que as cargas recusadas da FS foram desconsideradas da análise.

- `src/test/match.test.ts`
  - cobre geração de chave recusada FS;
  - cobre exclusão da base GRL053 por chave recusada;
  - valida que KPIs não recebem a carga recusada;
  - preserva comportamento Inpasa e importação GRL053 sem `Denom. Status` já cobertos no arquivo.

- `src/test/results-screen.test.tsx`
  - cobre ausência da carga recusada na grid quando a linha já foi removida do resultado operacional.

## Testes criados/ajustados

- `parseCompWithStats(..., "fs")` gera `ignoredKeys` no formato esperado para `Carga recusada`.
- `match(..., { ignoredKeys })` descarta a linha equivalente da base GRL053.
- `computeKpis` não contabiliza a carga recusada removida.
- `ResultsScreen` não exibe a nota/contrato recusados na grid.
- Testes existentes continuam cobrindo:
  - Inpasa sem regra específica FS;
  - GRL053 sem `Denom. Status` como importação válida;
  - matching normal de FS por `Pedido + Nº Nota Fiscal`.

## Limitações de validação

A execução local de testes ficou bloqueada porque as dependências do projeto não estavam instaladas e o `npm install` recebeu `403 Forbidden` ao tentar baixar pacotes do registry configurado. Antes disso, `npm test -- --runInBand` falhou porque o binário `vitest` não estava disponível no ambiente.

## Checklist final

- [x] Confirmou que o bug ocorre no cliente/layout `FS`.
- [x] Confirmou que `Denom. Status` pertence ao relatório complementar FS.
- [x] Criou controle de chaves recusadas da FS com `Pedido + Nº Nota Fiscal`.
- [x] Impediu que a base GRL053 gere erro quando a chave estiver recusada na FS.
- [x] Garantiu que essas linhas não entram em KPIs.
- [x] Garantiu que essas linhas não aparecem na grid.
- [x] Garantiu que essas linhas não saem nas exportações por não comporem o resultado exportável.
- [x] Não alterou o layout Inpasa.
- [x] Não tornou `Denom. Status` obrigatório no GRL053.
- [x] Não alterou regra principal de matching.
- [x] Criou análise Markdown em `/docs/Analises/`.

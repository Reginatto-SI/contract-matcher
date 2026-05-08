# Análise 2 — Correção de Importação com Cabeçalho Fixo por Layout

## 1. Resumo da correção aplicada

A correção implementa a decisão oficial da V1 registrada nos PRDs e na análise anterior:

- GRL053 usa a primeira aba do arquivo e cabeçalho fixo na linha 3.
- Inpasa usa a primeira aba do arquivo e cabeçalho fixo na linha 2.
- A linha informada ao parser é a linha visual do Excel (1-based) e é convertida para o índice zero usado pela biblioteca `xlsx`.
- A validação de colunas obrigatórias passa a ser feita contra a linha de cabeçalho fixa do layout, não contra a primeira linha do intervalo usado da planilha.
- O upload agora comunica e permite `.xlsx` e `.xls`.
- A mensagem de erro de importação passa a informar relatório, aba lida, linha de cabeçalho validada, colunas ausentes e colunas encontradas.

Não foi implementada busca automática de cabeçalho, DE/PARA, heurística, fuzzy match ou alteração na regra de matching.

## 2. Arquivos alterados

- `src/lib/parseXlsx.ts`
  - Adiciona opções de leitura com `headerRow`, `requiredColumns` e `fileLabel`.
  - Valida extensão `.xlsx`/`.xls`.
  - Lê a primeira aba.
  - Extrai somente a linha fixa de cabeçalho para validar colunas.
  - Converte `headerRow` visual para índice zero no `range` do SheetJS.
  - Gera mensagem de erro com aba, linha e colunas encontradas.
- `src/pages/Index.tsx`
  - Chama o parser com `headerRow: 3` para GRL053.
  - Chama o parser com `headerRow: 2` para Inpasa.
  - Mantém o fluxo existente de `parseBase`, `parseComp` e `match`.
- `src/components/UploadScreen.tsx`
  - Altera `accept` para `.xlsx,.xls`.
  - Atualiza textos e hints para `.xlsx ou .xls`.
- `src/lib/match.ts`
  - Mantém a regra de matching existente.
  - Adiciona comentário documentando que, na V1, a nota fiscal do GRL053 usada no matching vem da primeira coluna `NOTA`, coluna M, conforme layout oficial validado.
- `docs/Analises/analise-2-correcao-importacao-cabecalho-fixo.md`
  - Documenta esta correção.

## 3. Como ficou a leitura do GRL053

O GRL053 é lido com:

- primeira aba do workbook;
- `headerRow: 3`;
- dados iniciando após a linha 3;
- colunas obrigatórias validadas na linha 3:
  - `PLACA`
  - `CONTRATO`
  - `NOTA`
  - `CONTR. CLIENTE`
  - `APOS DESC`

A coluna `NOTA` usada para o campo interno `nota` permanece a chave `NOTA`. No arquivo real analisado, como há duas colunas com o mesmo nome, o SheetJS mantém a primeira ocorrência como `NOTA` e sufixa a segunda. Assim, a V1 usa a primeira `NOTA`, correspondente à coluna M do GRL053, conforme confirmação oficial do usuário.

## 4. Como ficou a leitura do Inpasa

O relatório complementar Inpasa é lido com:

- primeira aba do workbook;
- `headerRow: 2`;
- dados iniciando após a linha 2;
- colunas obrigatórias validadas na linha 2:
  - `Placa`
  - `Número NF`
  - `Nr Contr Original`
  - `Total Líquido`

A implementação continua determinística e não tenta procurar cabeçalhos em outras linhas.

## 5. Como ficou o suporte a `.xls` e `.xlsx`

O componente de upload agora usa:

```tsx
accept=".xlsx,.xls"
```

Os textos da tela também passaram a informar `.xlsx ou .xls`.

O parser valida o nome do arquivo antes da leitura e bloqueia extensões fora de `.xlsx`/`.xls` com mensagem clara.

## 6. Como ficou a mensagem de erro

Quando uma coluna obrigatória não é encontrada na linha fixa de cabeçalho, a mensagem informa:

- tipo do relatório;
- colunas obrigatórias ausentes;
- aba lida;
- linha de cabeçalho validada;
- colunas encontradas na linha validada.

Exemplo de formato implementado:

```text
Relatório Complementar (Inpasa): coluna(s) obrigatória(s) não encontrada(s): "Nr Contr Original". Aba lida: "Relatório de Entrada". Linha de cabeçalho validada: 2. Colunas encontradas: Safra, Desc. Tipo Frete, Placa, Número NF, ...
```

Também foram mantidas mensagens claras para arquivo sem abas, cabeçalho vazio, planilha sem dados após o cabeçalho e extensão inválida.

## 7. Testes realizados

### Checks executados com sucesso

- `python3` com asserções estáticas no código:
  - confirmou `accept=".xlsx,.xls"`;
  - confirmou textos `.xlsx ou .xls`;
  - confirmou `headerRow: 3` para GRL053;
  - confirmou `headerRow: 2` para Inpasa;
  - confirmou `range: options.headerRow - 1` no parser;
  - confirmou comentário da `NOTA` da coluna M.
- Script temporário `/tmp/inspect_excel.py`:
  - confirmou que o GRL053 possui aba `Plan1`;
  - confirmou que a linha 3 do GRL053 contém as colunas obrigatórias;
  - confirmou que a primeira `NOTA` do GRL053 está na coluna M;
  - confirmou que o Inpasa possui aba `Relatório de Entrada`;
  - confirmou que a linha 2 do Inpasa contém as colunas obrigatórias.
- `git diff --check` passou sem problemas.

### Checks com limitação de ambiente

- `npm ci` não pôde ser concluído porque o registry retornou `403 Forbidden` ao tentar baixar dependências.
- `npm run lint` não pôde carregar `@eslint/js` porque as dependências não estão instaladas no ambiente.
- `npm run test` não pôde executar `vitest` porque as dependências não estão instaladas no ambiente.
- `npm run build` não pôde executar `vite` porque as dependências não estão instaladas no ambiente.

## 8. Riscos restantes

- A correção depende do comportamento do SheetJS para cabeçalhos duplicados: a primeira coluna `NOTA` permanece como `NOTA` e as próximas recebem sufixo. Esse comportamento é compatível com a regra definida para a V1, mas deve ser coberto por teste automatizado quando as dependências estiverem instaláveis.
- O ambiente atual não permitiu executar a suíte Vitest nem o build completo porque `npm ci` foi bloqueado pelo registry com `403 Forbidden`, deixando as dependências ausentes.
- A V1 continua assumindo primeira aba. Se arquivos futuros tiverem múltiplas abas com outra aba oficial, será necessária nova decisão de produto.

## 9. Confirmação explícita sobre matching

O matching não foi alterado.

A regra continua sendo exclusivamente:

```text
GRL053: CONTR. CLIENTE + NOTA
Inpasa: Nr Contr Original + Número NF
```

Não houve alteração em normalização de contrato, normalização de nota, classificação de vínculo, exportação, persistência, backend ou tela de resultados.

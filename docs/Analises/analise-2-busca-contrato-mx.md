# Análise 2 — Inclusão do Contrato MX na busca global

## Diagnóstico
A tela de conferência já exibia a coluna **Contrato MX** usando o campo informativo do GRL053 preservado no registro base. Porém, a busca global montava um texto pesquisável apenas com situação, data de emissão, detalhe, contrato cliente, nota, placa base, placa cliente e campos do complementar.

Por isso, o usuário conseguia visualizar valores como `1467` na coluna **Contrato MX**, mas a digitação desse mesmo valor no input não reduzia a grid para os registros correspondentes.

## Causa
A função `filterRowsByResultsSearch`, em `src/components/ResultsScreen.tsx`, não incluía o campo `r.base.contrato_interno` no texto usado pela busca textual global.

Esse campo é o valor usado para renderizar a coluna **Contrato MX** na tabela de resultados.

## Correção aplicada
Foi incluído `r.base.contrato_interno` no texto pesquisável montado por `filterRowsByResultsSearch`.

A alteração mantém a busca global existente e apenas adiciona o campo informativo **Contrato MX** ao mesmo mecanismo já usado para contrato cliente, nota, placa base, placa cliente e demais campos previamente pesquisáveis.

## Arquivos alterados
- `src/components/ResultsScreen.tsx`
- `src/test/match.test.ts`
- `docs/Analises/analise-2-busca-contrato-mx.md`

## Critérios de validação
- Busca por Contrato MX: digitar um valor como `1467` deve listar os registros em que **Contrato MX** corresponde a esse valor.
- Busca por contrato cliente: digitar o contrato cliente deve continuar retornando os registros vinculados a esse contrato.
- Busca por nota: digitar a nota fiscal deve continuar retornando os registros com a nota correspondente.
- Busca por placa: digitar a placa base ou a placa cliente deve continuar retornando os registros correspondentes.
- Limpeza dos filtros: clicar em **Limpar filtros** deve esvaziar a busca textual, voltar o filtro para `ALL` e exibir todos os registros disponíveis.
- KPIs recalculando após busca por Contrato MX: como os KPIs são calculados sobre `searchedRows`, uma busca por **Contrato MX** deve recalcular os cards com base apenas no subconjunto encontrado.

## Observações
O **Contrato MX** continua sendo apenas um campo informativo da conferência.

Ele foi incluído somente na busca e visualização. Não participa do vínculo, não altera status, não altera matching, não altera importação e não substitui a regra de vínculo existente baseada em **CONTR. CLIENTE + NOTA**.

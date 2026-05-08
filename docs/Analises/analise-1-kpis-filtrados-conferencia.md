# Análise 1 — Correção dos KPIs filtrados da conferência

## Diagnóstico

A tela de conferência possuía uma divergência entre o subconjunto exibido na grid e os cards de KPI. A busca global por contrato, nota ou placa reduzia corretamente a listagem e o contador da tabela, mas os KPIs continuavam mostrando os totais gerais da conferência.

Isso ficava visível, por exemplo, ao pesquisar o contrato cliente `16883`: a grid passava a exibir somente os registros compatíveis com a busca, enquanto os cards “Vínculo OK”, “Base inválida”, “Contrato não encontrado”, “Nota não encontrada”, “Divergências de vínculo” e “Alertas (placa)” permaneciam com os números do conjunto completo analisado.

## Causa

O problema estava em `src/components/ResultsScreen.tsx`.

Antes da correção, os KPIs eram calculados diretamente sobre `rows`, que representa o resultado completo do matching recebido pela tela. Em paralelo, a grid aplicava busca textual e filtro clicável de KPI para gerar a lista filtrada exibida ao usuário.

Na prática, havia dois fluxos diferentes:

```text
KPIs → rows completos
Grid/contador → rows filtrados por busca e/ou card
```

Com isso, a busca textual afetava apenas a tabela, mas não afetava o resumo operacional.

## Correção aplicada

A lógica da tela foi reorganizada de forma localizada para separar três conceitos:

1. `rows`: total bruto/analisado vindo do matching, preservado para cabeçalho, alerta superior e total geral da tabela.
2. `searchedRows`: lista reduzida pela busca textual global, usada como base dos KPIs operacionais.
3. `filtered`: lista final da grid, calculada aplicando o filtro clicável de KPI sobre `searchedRows`.

O novo fluxo ficou:

```text
rows brutos/analisados
→ busca textual por contrato, nota, placa e campos já pesquisáveis
→ searchedRows
→ KPIs calculados sobre searchedRows
→ filtro clicável de card de KPI
→ filtered
→ ordenação/paginação
→ grid renderizada
```

Essa abordagem mantém o padrão atual dos cards clicáveis, evita que o card ativo zere/oculte conceitualmente os demais cards, e garante que a busca textual influencie o resumo exibido em tempo real.

O cabeçalho e o alerta superior continuam exibindo o total geral analisado da conferência, sem serem reduzidos pela busca textual, para preservar a diferença entre total importado/analisado e diagnóstico operacional filtrado.

## Arquivos alterados

- `src/components/ResultsScreen.tsx`
  - Separação explícita entre total analisado (`rows.length`), lista filtrada por busca (`searchedRows`) e lista final da grid (`filtered`).
  - KPIs passam a ser recalculados com `computeKpis(searchedRows)`.
  - Cabeçalho e alerta superior deixam de depender de `kpis.total` e passam a usar o total geral analisado.
  - Comentários pontuais adicionados para documentar total bruto/analisado, lista filtrada e KPIs filtrados.
- `docs/Analises/analise-1-kpis-filtrados-conferencia.md`
  - Registro do diagnóstico, causa, correção, critérios de validação e observação sobre exportação.

## Critérios de validação

- Sem filtro:
  - Abrir uma conferência importada.
  - Confirmar que os KPIs mostram os totais gerais dos registros analisados.
  - Confirmar que o cabeçalho/alerta superior continuam mostrando o total importado e o total analisado.

- Filtro por contrato:
  - Pesquisar um contrato cliente, por exemplo `16883`.
  - Confirmar que a grid exibe apenas registros compatíveis com esse contrato.
  - Confirmar que os KPIs passam a representar apenas o subconjunto encontrado pela busca textual.

- Filtro por nota:
  - Pesquisar uma nota fiscal específica.
  - Confirmar que a grid exibe apenas registros compatíveis com a nota.
  - Confirmar que os KPIs recalculam conforme esse subconjunto.

- Filtro por placa:
  - Pesquisar uma placa da base ou do complementar.
  - Confirmar que a grid exibe apenas registros compatíveis com a placa.
  - Confirmar que os KPIs recalculam conforme esse subconjunto, inclusive o card de alertas de placa quando aplicável.

- Filtro combinado com card de KPI:
  - Aplicar uma busca textual.
  - Clicar em um card de KPI, como “Vínculo OK” ou “Nota não encontrada”.
  - Confirmar que a grid respeita a combinação entre busca textual e card ativo.
  - Confirmar que os KPIs continuam refletindo a distribuição do subconjunto da busca textual, preservando a leitura dos demais cards enquanto o card ativo filtra a grid.

## Observações

A exportação já recebia `sorted`, que é derivado da lista filtrada e ordenada da tela. Portanto, o comportamento atual é exportar os registros filtrados/ordenados conforme a visualização operacional atual, e não apenas a página atual.

Esse comportamento não foi alterado nesta correção.

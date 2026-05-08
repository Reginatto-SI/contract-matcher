# Análise 3 — Fonte de verdade da conferência: GRL053 comanda a grid

## 1. Resumo executivo

A análise do fluxo atual indica que a **grid principal já é derivada exclusivamente do relatório base GRL053**: o `match(base, comp)` cria índices do complementar, mas só faz `push` em `MatchedRow[]` dentro de um `base.forEach(...)`. Portanto, não há evidência no código de linhas criadas exclusivamente a partir do relatório complementar.

Também foi confirmado que os **KPIs e o total “Registros” são calculados a partir de `MatchedRow[]`**, e essa lista vem diretamente de `match(base, comp)`. Como `MatchedRow[]` é produzido iterando a base, o total exibido no topo representa o número de linhas parseadas do GRL053 que entraram no matching, não a soma de GRL053 + complementar.

Por consequência, se a tela exibiu **Registros: 6558**, a evidência de código aponta que esse número corresponde a `rows.length` de `MatchedRow[]`, que por sua vez corresponde ao número de linhas retornadas por `parseBase(baseRaw)` e percorridas pelo `match`. Não há composição com linhas extras do complementar nesse total.

O ponto de atenção encontrado não é a origem da grid, mas sim a **entrada de linhas inválidas nos índices auxiliares**:

- Complementar sem contrato, mas com nota, entra em `byNota`.
- Complementar sem nota, mas com contrato, entra em `byContrato`.
- Complementar com contrato e nota entra também em `byKey`.
- Complementar sem ambos não entra em nenhum índice útil.

Isso significa que linhas complementares com nota vazia, nota zero ou contrato vazio **não aparecem como linhas próprias**, mas podem influenciar a classificação de uma linha do GRL053 quando ainda possuem um dos dois campos usados para busca auxiliar (`contrato` ou `nota`).

Também não há tratamento específico para linha do GRL053 sem contrato cliente ou sem nota fiscal. Essas linhas continuam aparecendo na conferência, mas são classificadas pelos mesmos status operacionais existentes, principalmente `Contrato não encontrado`, sem diferenciar “registro base inválido para match”.

## 2. Regra oficial validada: GRL053 é a fonte de verdade

Os PRDs sustentam que a conferência deve partir do relatório base:

- O PRD-01 define a entrada como 1 relatório base GRL053 e 1 relatório complementar, com processamento em memória e conferência via regra fixa.
- O PRD-01 declara que, para cada registro do relatório base, o sistema verifica correspondência no complementar, classifica o resultado e exibe os detalhes.
- O PRD-04 define a estratégia como criação de uma estrutura indexada do complementar e, para cada linha da base, normalizar contrato + nota, buscar no complementar e avaliar o resultado.
- O PRD-05 define a tela de conferência como exibição do resultado do matching entre GRL053 e complementar, com total de registros e KPIs de diagnóstico.

Regra validada nesta análise:

```text
A origem da lista principal da conferência deve ser o GRL053.
O complementar deve ser usado somente como fonte de comparação/indexação.
```

## 3. Arquivos de código analisados

Arquivos efetivamente localizados e analisados:

| Responsabilidade | Arquivo localizado | Observação |
|---|---|---|
| Leitura genérica de `.xlsx`/`.xls` | `src/lib/parseXlsx.ts` | Lê primeira aba, valida extensão, valida cabeçalho fixo e retorna `RawRow[]`. |
| Parser/mapeamento do GRL053 | `src/lib/match.ts` (`parseBase`) | Converte `RawRow[]` em `BaseRow[]`. |
| Parser/mapeamento do Inpasa | `src/lib/match.ts` (`parseComp`) | Converte `RawRow[]` em `CompRow[]`. |
| Normalização de contrato, nota, placa e número | `src/lib/normalize.ts` | Centraliza normalização usada pelos parsers. |
| Orquestração importação → parse → match → tela | `src/pages/Index.tsx` | Chama `readXlsx`, `parseBase`, `parseComp`, `match` e entrega `rows` à tela. |
| Motor de matching | `src/lib/match.ts` (`match`) | Indexa complementar e percorre base para criar `MatchedRow[]`. |
| KPIs | `src/lib/match.ts` (`computeKpis`) | Calcula KPIs a partir de `MatchedRow[]`. |
| Filtros e grid principal | `src/components/ResultsScreen.tsx` | Filtra `rows`, pagina e renderiza tabela. |
| Exportação Excel/PDF | `src/lib/exporters.ts` e chamadas em `src/components/ResultsScreen.tsx` | Exporta a lista filtrada recebida da tela; não recalcula matching. |

Não foram encontrados arquivos separados como `importador-base-grl053.ts`, `importador-inpasa.ts`, `base-grl053.ts` ou `complementar-inpasa.ts` no estado atual do repositório.

## 4. Fluxo atual de geração da lista de conferência

Fluxo identificado:

1. `src/pages/Index.tsx` recebe `baseFile` e `compFile` no `handleSubmit`.
2. O GRL053 é lido por `readXlsx(baseFile, { headerRow: 3, requiredColumns: [...] })`.
3. O complementar Inpasa é lido por `readXlsx(compFile, { headerRow: 2, requiredColumns: [...] })`.
4. `parseBase(baseRaw)` transforma as linhas lidas do GRL053 em `BaseRow[]`.
5. `parseComp(compRaw)` transforma as linhas lidas do complementar em `CompRow[]`.
6. `match(base, comp)` gera `MatchedRow[]`.
7. `setResults({ empresa, cliente, rows })` guarda somente `rows`, sem guardar `baseRaw` ou `compRaw` separados para a tela.
8. `ResultsScreen` recebe `rows` e usa a mesma lista para KPIs, filtros, grid, detalhe e exportação.

Evidência central:

```ts
const base = parseBase(baseRaw);
const comp = parseComp(compRaw);
const rows = match(base, comp);
setResults({ empresa: empresa.trim(), cliente: cliente.trim(), rows });
```

## 5. Fluxo atual de cálculo dos KPIs

Os KPIs são calculados em `ResultsScreen` com:

```ts
const kpis = useMemo(() => computeKpis(rows), [rows]);
```

`computeKpis(rows)` percorre a lista `MatchedRow[]` recebida e incrementa contadores conforme `r.situacao` e `r.placaDivergente`.

O total retornado é:

```ts
return { total: rows.length, ... };
```

Logo:

- `Registros` = `kpis.total` = `rows.length`.
- `Vínculo OK` = contagem de `rows` com `situacao === "OK"`.
- `Contrato não encontrado` = contagem de `rows` com `situacao === "CONTRATO_NAO_ENCONTRADO"`.
- `Nota não encontrada` = contagem de `rows` com `situacao === "NOTA_NAO_ENCONTRADA"`.
- `Divergências de vínculo` = contagem de `NOTA_OUTRO_CONTRATO`, `CONTRATO_OUTRA_NOTA` ou `DUPLICIDADE`.
- `Alertas de placa` = contagem de `rows` com `placaDivergente === true`.

Não foi encontrado cálculo paralelo de KPI fora de `computeKpis`.

## 6. Evidência se a grid percorre apenas GRL053 ou também complementar

O `match(base, comp)` tem duas fases:

### 6.1 Fase 1 — percorre complementar para criar índices auxiliares

```ts
for (const c of comp) {
  const k = key(c.nrContrOriginal, c.numeroNF);
  if (c.nrContrOriginal && c.numeroNF) { ... byKey ... }
  if (c.nrContrOriginal) { ... byContrato ... }
  if (c.numeroNF) { ... byNota ... }
}
```

Essa fase percorre o complementar, mas não cria nenhuma linha da grid. Ela apenas monta mapas de consulta.

### 6.2 Fase 2 — percorre base para criar `MatchedRow[]`

```ts
const result: MatchedRow[] = [];
base.forEach((b, idx) => {
  ...
  result.push({
    id: idx,
    situacao,
    detalhe,
    placaDivergente,
    base: b,
    comp,
    hintsContrato: matchesContrato.slice(0, 5),
    hintsNota: matchesNota.slice(0, 5),
  });
});

return result;
```

A única chamada a `result.push(...)` está dentro de `base.forEach(...)`. Portanto, a lista final `MatchedRow[]` é gerada somente a partir de linhas da base GRL053.

Conclusão: **a grid percorre o complementar para indexação, mas não cria linhas a partir do complementar; as linhas exibidas são derivadas do GRL053.**

## 7. Evidência se o total de registros vem do GRL053

O total exibido no cabeçalho vem de `kpis.total`:

```tsx
<span className="text-muted-foreground">Registros: </span>
<span className="font-medium">{kpis.total}</span>
```

`kpis.total` vem de `computeKpis(rows)`, e `computeKpis` retorna `total: rows.length`.

Como `rows` vem de `match(base, comp)` e `match` faz `result.push(...)` uma vez para cada item de `base`, o total exibido no topo é o tamanho de `MatchedRow[]`, isto é, o total de linhas parseadas da base GRL053 que entraram no matching.

Conclusão para o caso observado:

- `Registros: 6558` vem de `rows.length`.
- `rows.length` vem do resultado de `match(base, comp)`.
- O resultado de `match(base, comp)` é criado dentro de `base.forEach(...)`.
- Portanto, pelo código atual, os 6558 registros correspondem ao conjunto da base GRL053 parseada, não a uma soma com o complementar.

## 8. Diagnóstico sobre notas vazias/zero do complementar

### 8.1 Normalização atual

`normalizeNota(value)` retorna:

- `""` para `null`/`undefined` ou texto sem dígitos.
- somente dígitos sem zeros à esquerda quando houver número relevante.
- `"0"` quando o valor contém algum dígito, mas todos são zeros, por exemplo `0`, `"0"`, `"000"`.

`normalizeContrato(value)` usa o primeiro grupo de dígitos e remove zeros à esquerda, retornando também `"0"` quando o conteúdo numérico é zero.

### 8.2 Entrada no índice do complementar

No índice do complementar:

- Linha complementar com contrato e nota entra em `byKey`, `byContrato` e `byNota`.
- Linha complementar com contrato, mas sem nota, entra em `byContrato`.
- Linha complementar com nota, mas sem contrato, entra em `byNota`.
- Linha complementar sem contrato e sem nota não entra em nenhum dos três mapas.
- Linha complementar com nota normalizada como `"0"` é tratada como valor presente, pois string `"0"` é truthy em JavaScript.
- Linha complementar com contrato normalizado como `"0"` também é tratada como valor presente.

### 8.3 Influência possível nos status

Linhas complementares inválidas ou incompletas **não viram linhas próprias da conferência**, mas podem influenciar a classificação de uma linha do GRL053:

- Se uma linha complementar tem `nrContrOriginal` preenchido e `numeroNF` vazio, ela entra em `byContrato`. Uma linha GRL053 com o mesmo contrato e uma nota não encontrada poderá virar `NOTA_NAO_ENCONTRADA`, com exemplo de nota vazia no detalhe (`ex.: `), porque o contrato foi considerado existente no complementar.
- Se uma linha complementar tem `numeroNF` preenchido/zero e contrato vazio, ela entra em `byNota`. Uma linha GRL053 com a mesma nota poderá influenciar `CONTRATO_NAO_ENCONTRADO` ou divergência cruzada, mesmo que o registro complementar esteja incompleto para matching operacional.
- Se uma linha complementar tem `numeroNF === "0"`, ela pode entrar em `byNota` como nota válida `0`, e também em `byKey` se houver contrato. Isso pode afetar buscas de linhas base cuja nota normalize para `"0"`.

Conclusão: **notas vazias do complementar não entram em `byNota`, mas contratos de linhas com nota vazia entram em `byContrato`; notas zero entram nos índices como valor válido `"0"`.** Isso pode contaminar o diagnóstico de linhas da base, embora não aumente o número de linhas da grid.

## 9. Diagnóstico sobre linhas inválidas do GRL053

O parser do GRL053 (`parseBase`) normaliza campos, mas não descarta nem classifica previamente linhas sem `contratoCliente` ou sem `nota`.

No `match`:

```ts
const matchesKey = (b.contratoCliente && b.nota && byKey.get(k)) || [];
const matchesContrato = (b.contratoCliente && byContrato.get(b.contratoCliente)) || [];
const matchesNota = (b.nota && byNota.get(b.nota)) || [];
```

Se a linha base estiver sem contrato cliente ou sem nota:

- Não há status específico para “registro base inválido”.
- A linha continua aparecendo na conferência porque o `result.push(...)` sempre ocorre para cada linha da base.
- Se contrato e nota ficarem vazios, tende a cair em `CONTRATO_NAO_ENCONTRADO` com detalhe “Contrato e nota não foram localizados no complementar.”
- Se faltar somente contrato, mas a nota existir no complementar, pode cair em `CONTRATO_NAO_ENCONTRADO` com detalhe de nota vinculada a outro contrato.
- Se faltar somente nota, mas o contrato existir no complementar, pode cair em `NOTA_NAO_ENCONTRADA`.

Conclusão: o sistema respeita o princípio de que a linha base aparece na conferência, mas **não diferencia linha inválida da base de erro operacional de vínculo**.

## 10. Riscos operacionais do comportamento atual

1. **KPIs podem misturar erro de vínculo com qualidade da base**
   Linhas do GRL053 sem contrato cliente ou sem nota são contabilizadas nos status existentes, principalmente `Contrato não encontrado` ou `Nota não encontrada`, sem evidenciar que o problema inicial é falta de dado na própria base.

2. **Complementar incompleto pode alterar a classificação de uma linha base**
   Uma linha do complementar sem nota, mas com contrato, pode fazer o sistema entender que o contrato existe no complementar e classificar a linha base como `Nota não encontrada`, mesmo que aquele registro complementar não seja apto para match por contrato + nota.

3. **Nota zero pode ser tratada como nota válida**
   A normalização transforma valores compostos só por zeros em `"0"`. Como `"0"` é valor truthy, essas ocorrências entram nos índices e podem gerar vínculo, duplicidade ou divergência se a base também tiver nota zero.

4. **Detalhes podem ficar confusos**
   Quando o registro complementar usado como hint possui nota vazia, o detalhe pode exibir “com outra nota (ex.: )”, reduzindo clareza operacional.

5. **Status `Contrato não encontrado` pode estar superdimensionado por linhas base inválidas**
   Como não existe status próprio para linha base sem contrato/nota, parte dos 2286 casos pode ser falta de dados no GRL053, não necessariamente contrato ausente no complementar.

6. **Status `Nota não encontrada` pode ser influenciado por linhas complementares incompletas**
   Contratos vindos de registros complementares sem nota entram em `byContrato`, podendo aumentar casos em que o sistema considera o contrato existente, mas a nota ausente.

## 11. Recomendação de correção mínima, se necessária

A conferência já usa o GRL053 como fonte da grid. Portanto, **não é necessário corrigir a origem da grid** para impedir linhas extras do complementar, pois o código atual não cria essas linhas.

A correção mínima recomendada para uma próxima etapa é focada em validação de aptidão para match:

### 11.1 Complementar

Antes de inserir registros do complementar nos índices de matching operacional, considerar somente registros com:

```text
nrContrOriginal válido e diferente de vazio/zero
numeroNF válido e diferente de vazio/zero
```

Efeito esperado:

- Complementar sem contrato ou sem nota não vira origem da grid.
- Complementar sem contrato ou sem nota também não influencia `byKey`, `byContrato` ou `byNota` usados para status operacional.
- Opcionalmente, essas linhas podem ser contadas em diagnóstico técnico separado, fora dos KPIs principais.

### 11.2 Base GRL053

Para linhas do GRL053 sem `contratoCliente` ou sem `nota`, manter a linha na conferência, porque o GRL053 é fonte de verdade, mas não classificá-la como se fosse uma tentativa normal de vínculo.

Opção sugerida para validação de produto:

```text
Registro base inválido
```

ou rótulo equivalente, caso o produto prefira outro nome.

Não foi encontrado status semelhante já existente. Os status atuais são:

- `OK`
- `CONTRATO_NAO_ENCONTRADO`
- `NOTA_NAO_ENCONTRADA`
- `NOTA_OUTRO_CONTRATO`
- `CONTRATO_OUTRA_NOTA`
- `DUPLICIDADE`

Portanto, criar um novo status impactaria tipo `Situacao`, labels, cores, KPIs, filtros, grid, detalhe e exportação. Como a tarefa pediu apenas análise, essa alteração **não foi implementada**.

### 11.3 Sobre nota zero

Recomenda-se validar com o usuário se nota fiscal `0` pode ser considerada valor operacional válido. Pela premissa desta análise, nota zero deve ser tratada como inválida para matching no complementar e provavelmente também como inválida na base, mas essa decisão deve ser confirmada antes de implementação.

## 12. Lista exata de arquivos que precisariam ser alterados em uma próxima etapa

Correção mínima provável:

1. `src/lib/match.ts`
   - Adicionar regra de aptidão para match no complementar antes de popular índices.
   - Adicionar tratamento explícito para base sem contrato cliente ou sem nota, se validado novo status.
   - Ajustar `Situacao`, `situacaoLabel` e `computeKpis`, caso novo status seja criado.

2. `src/components/ResultsScreen.tsx`
   - Ajustar badge/cor/filtro/KPI se houver novo status para registro base inválido.
   - Ajustar busca/filtros se o novo status precisar de card ou filtro próprio.

3. `src/lib/exporters.ts`
   - Garantir que o novo status e detalhe sejam exportados corretamente.
   - Não precisa recalcular nada, apenas refletir os campos de `MatchedRow[]`.

4. `src/test/...` ou novo arquivo de teste a definir no padrão existente
   - Cobrir casos de:
     - complementar sem contrato;
     - complementar sem nota;
     - complementar com nota zero;
     - base sem contrato cliente;
     - base sem nota;
     - base válida com contrato/nota sem correspondência.

Possivelmente não seria necessário alterar `src/pages/Index.tsx`, pois a orquestração atual já passa `base` e `comp` ao `match` corretamente.

## 13. Perguntas obrigatórias da análise — respostas objetivas

1. **O `match(base, comp)` percorre somente `base` ou também percorre `comp`?**
   Percorre ambos, mas com finalidades diferentes: percorre `comp` para montar índices auxiliares e percorre `base` para criar `MatchedRow[]`.

2. **A lista final `MatchedRow[]` tem tamanho igual ao número de linhas válidas do GRL053?**
   Tem tamanho igual ao número de linhas em `base` recebido pelo `match`. O código atual não filtra “linhas válidas”; portanto, é igual ao número de linhas parseadas do GRL053, não necessariamente ao número de linhas válidas para match.

3. **Existem linhas criadas exclusivamente a partir do complementar?**
   Não. A única criação de linha (`result.push`) ocorre dentro de `base.forEach`.

4. **Os KPIs são calculados a partir de `MatchedRow[]` ou existe outro cálculo paralelo?**
   São calculados a partir de `MatchedRow[]` por `computeKpis(rows)`. Não foi encontrado cálculo paralelo.

5. **O total “Registros” exibido no topo vem de qual lista?**
   Vem de `kpis.total`, que é `rows.length`, onde `rows` é a lista `MatchedRow[]` entregue à `ResultsScreen`.

6. **A busca/filtro pode estar misturando registros base e complementar?**
   A busca consulta campos de `r.base` e campos do `r.comp` associado como texto pesquisável, mas filtra a lista `rows`. Ela não adiciona linhas do complementar nem troca a origem da grid.

7. **A exportação usa a mesma lista da tela ou recalcula algo?**
   Usa a lista filtrada da tela (`filtered`) passada para `exportExcel`/`exportPDF`. Os exportadores fazem `rows.map(...)` e não recalculam matching.

8. **Linhas do complementar com nota vazia ou zero entram no índice?**
   Nota vazia não entra em `byNota` nem em `byKey`, mas a linha ainda pode entrar em `byContrato` se tiver contrato. Nota zero (`"0"`) entra nos índices porque é string truthy.

9. **Se entram no índice, elas podem influenciar status indevidamente?**
   Sim. Podem influenciar `matchesContrato`, `matchesNota`, `matchesKey`, duplicidade, divergência e hints usados no detalhe, dependendo dos campos preenchidos.

10. **Existe tratamento para ignorar linhas complementares sem contrato ou sem nota?**
    Parcialmente e apenas por índice: sem contrato não entra em `byContrato`; sem nota não entra em `byNota`; sem ambos não entra em mapas. Porém não existe regra única para ignorar a linha complementar inteira quando falta contrato ou nota.

11. **Existe tratamento para ignorar linhas base sem contrato ou sem nota?**
    Não. Toda linha da base recebida por `match` gera uma `MatchedRow`.

12. **O sistema diferencia “linha inválida para match” de “contrato não encontrado”?**
    Não. Não há status específico para linha base inválida ou complementar inválido.

13. **O comportamento atual está alinhado com os PRDs?**
    Está alinhado quanto à origem da grid e ao uso do complementar como índice auxiliar. Há lacuna quanto ao tratamento de linhas inválidas, pois os PRDs descrevem o matching por contrato + nota, mas o código permite que linhas incompletas influenciem índices auxiliares e não separa base inválida de erro de vínculo.

14. **Se não estiver, qual ajuste mínimo deve ser feito?**
    Manter a grid derivada do GRL053, mas filtrar/invalidar registros do complementar sem contrato ou sem nota antes de montar índices operacionais; e criar ou validar um tratamento explícito para linhas do GRL053 sem contrato cliente ou sem nota, sem classificá-las como contrato/nota não encontrados.

## 14. Perguntas para validação com o usuário

1. Nota fiscal `0` no GRL053 deve ser considerada inválida para match?
2. Nota fiscal `0` no complementar deve ser ignorada no índice operacional?
3. Contrato `0` deve ser tratado como inválido em base e complementar?
4. O status sugerido `Registro base inválido` é aceitável ou o produto prefere outro rótulo?
5. Esse novo status deve ter KPI próprio ou deve aparecer apenas dentro de divergências/erros?
6. Linhas complementares ignoradas por falta de contrato/nota devem ser apenas descartadas silenciosamente do matching ou exibidas em diagnóstico técnico separado?

## 15. Confirmação de que nenhuma correção foi aplicada nesta análise

Nenhuma correção de matching, UI, exportação, parser, normalização ou arquitetura foi aplicada nesta etapa.

Este documento é apenas uma análise técnica e recomendações para próxima etapa.

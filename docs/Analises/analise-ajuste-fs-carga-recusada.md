# Análise — Ajuste FS para ignorar cargas recusadas

## 1. Diagnóstico

### Sintoma

O layout complementar FS possuía importação das colunas operacionais de vínculo (`Pedido` e `Nº Nota Fiscal`) e dos campos informativos (`Placa Caminhão` e `Peso Líquido`), mas não havia mapeamento obrigatório da coluna `Denom. Status` nem descarte prévio de registros com status `Carga recusada`.

### Onde ocorre

O fluxo de importação da tela principal lê o relatório base GRL053 e o complementar selecionado, transforma os dados e executa o matching em seguida. A transformação do complementar fica centralizada em `parseComp`/`parseCompWithStats` no módulo de matching.

### Evidência no código

- A configuração fixa do layout FS estava em `src/lib/layouts.ts`, dentro de `CLIENTES_SUPORTADOS`.
- A transformação específica do layout FS estava em `src/lib/match.ts`, no parser do complementar.
- A grid, KPIs e status operacionais são derivados do resultado de `match(base, comp)`, portanto o descarte precisava ocorrer antes de chamar `match`.

### Causa provável

Como `Denom. Status` não era validada/mapeada no layout FS, linhas com `Carga recusada` eram transformadas como registros complementares comuns. Assim, podiam alimentar os índices de vínculo por contrato/nota, impactar a análise, KPIs e detalhes de conferência.

## 2. Correção mínima aplicada

### Arquivos alterados

- `src/lib/layouts.ts`
- `src/lib/match.ts`
- `src/pages/Index.tsx`
- `src/components/ResultsScreen.tsx`
- `src/test/match.test.ts`
- `src/test/results-screen.test.tsx`

## 3. Onde a coluna `Denom. Status` foi mapeada

A coluna `Denom. Status` foi adicionada como coluna obrigatória apenas no layout complementar FS, dentro de `CLIENTES_SUPORTADOS`.

Isso mantém a validação determinística do layout FS e não altera o layout Inpasa nem o relatório base GRL053/GRL53.

## 4. Onde a regra de exclusão de `Carga recusada` foi aplicada

A regra foi aplicada na transformação do complementar FS, antes de montar a lista `CompRow[]` usada no matching.

Foi criada uma versão com estatísticas (`parseCompWithStats`) que:

1. percorre as linhas brutas do complementar;
2. verifica `Denom. Status` somente quando `clienteId === "fs"`;
3. descarta a linha quando o status normalizado é `CARGA RECUSADA`;
4. incrementa o contador `ignoradasFsCargaRecusada`;
5. só inclui os demais registros em `comp`.

A função `parseComp` foi preservada como wrapper compatível, retornando apenas `CompRow[]` para chamadas e testes existentes.

## 5. Normalização da comparação

A comparação aplica normalização simples, conforme solicitado:

- converte o valor para string;
- remove espaços no início e fim com `trim()`;
- converte para caixa alta com `toUpperCase()`;
- compara com `CARGA RECUSADA`.

Com isso, os seguintes exemplos são descartados corretamente:

- `Carga recusada`
- ` carga recusada `
- `CARGA RECUSADA`
- `carga recusada`

Não foi aplicada normalização agressiva adicional.

## 6. Impacto em KPIs e resultados

Como o descarte acontece antes da chamada de `match(base, comp)`, registros FS com `Denom. Status = Carga recusada`:

- não entram na lista de registros complementares transformados;
- não alimentam índices por contrato/nota;
- não participam do vínculo com o GRL053;
- não aparecem como pendentes, divergentes, duplicados ou sem vínculo;
- não alteram KPIs;
- não aparecem na tabela de conferência.

Os KPIs continuam sendo calculados apenas sobre as linhas resultantes da análise da base GRL053 contra o complementar já filtrado.

## 7. Retorno para o usuário

A tela de resultados já possuía um resumo de importação. Foi reaproveitada essa estrutura para exibir, quando houver descarte FS, a mensagem:

> N registros da FS foram ignorados por estarem com status "Carga recusada".

Nenhuma tela nova, fluxo novo ou persistência adicional foi criada.

## 8. Validações realizadas

Foram adicionados testes unitários cobrindo:

- mapeamento obrigatório da coluna `Denom. Status` no layout FS;
- descarte de FS com `Denom. Status` em variações de espaço/caixa (` carga recusada ` e `CARGA RECUSADA`);
- preservação de linhas FS com outros status;
- ausência de impacto em KPIs porque apenas linhas não recusadas chegam ao matching;
- preservação do comportamento Inpasa, onde `Carga recusada` não é tratado como regra global.

### Execução local

- Tentativa de executar `npm test -- --run src/test/match.test.ts src/test/results-screen.test.tsx` falhou porque o binário `vitest` não está instalado no ambiente.
- Tentativa de instalar dependências com `npm install` falhou com HTTP 403 ao baixar `@testing-library/jest-dom` do registry configurado.

## 9. Pontos de atenção

- A coluna `Denom. Status` passou a ser obrigatória somente para FS. Arquivos FS sem essa coluna serão bloqueados pela validação de layout, conforme a regra de mapear/localizar essa coluna durante a importação.
- O relatório base GRL053/GRL53 não foi alterado.
- O layout Inpasa não teve regra de descarte por status aplicada.
- A regra está comentada no código como específica do complementar FS.

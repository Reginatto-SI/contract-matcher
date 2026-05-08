# Análise 1 — Layout Complementar FS

## Diagnóstico

O projeto já possuía uma lista fixa de layouts complementares em `src/lib/layouts.ts`, com o layout Inpasa configurado com cabeçalho na linha 2. O novo layout FS foi implementado no mesmo ponto para manter o padrão determinístico e sem cadastro dinâmico de layouts.

A importação do complementar continua usando a primeira aba do arquivo e a linha de cabeçalho definida no layout selecionado. Como não havia no código uma evidência específica para uma linha de cabeçalho diferente do FS, o FS foi configurado com `headerRow: 2`, seguindo a mesma estrutura existente para o complementar Inpasa. Essa decisão deve ser validada com arquivo real da FS caso o cabeçalho oficial esteja em outra linha.

## Mapeamento

Mapeamento final do layout complementar FS:

- Pedido → contrato_cliente
- Nº Nota Fiscal → nota
- Placa Caminhão → placa
- Peso Líquido → peso_fisico

## Regra de vínculo

O matching permanece usando somente:

- contrato_cliente
- nota

No cruzamento com FS, isso significa:

- GRL053 `CONTR. CLIENTE` → FS `Pedido`
- GRL053 `NOTA` → FS `Nº Nota Fiscal`

## Campos informativos

Placa e peso são apenas informativos. A placa complementar da FS pode gerar alerta visual de placa divergente, mas não altera o vínculo. O peso complementar da FS é exibido como peso físico e não gera divergência operacional.

## Arquivos alterados

- `README.md`
- `src/lib/layouts.ts`
- `src/lib/match.ts`
- `src/pages/Index.tsx`
- `src/components/ResultsScreen.tsx`
- `src/test/match.test.ts`
- `docs/Analises/analise-1-layout-complementar-fs.md`

## Validações realizadas

Foram adicionados testes para validar:

- existência das colunas obrigatórias do layout FS;
- bloqueio de importação FS quando uma coluna obrigatória está ausente;
- mapeamento de `Pedido`, `Nº Nota Fiscal`, `Placa Caminhão` e `Peso Líquido` para os campos internos;
- matching entre GRL053 e FS usando somente contrato cliente + nota;
- placa fora da chave de vínculo;
- peso fora da regra de divergência;
- preservação do parsing Inpasa existente.

## Pontos de atenção

A linha de cabeçalho do FS foi definida como linha 2 porque o código atual já tratava o complementar Inpasa dessa forma e não havia confirmação de uma linha diferente para FS no repositório. Se um arquivo real da FS confirmar outro cabeçalho, ajustar apenas o `headerRow` do layout FS em `src/lib/layouts.ts`.

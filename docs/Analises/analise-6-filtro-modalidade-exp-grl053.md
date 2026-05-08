# Análise 6 — Filtro de modalidade EXP no GRL053

## Diagnóstico

O relatório base GRL053 contém movimentos operacionais que não representam expedição efetiva com carga, como fixação, devolução, recebimento, retorno, complemento, frete e acertos. Essas linhas podem conter `NOTA = 0`, nota vazia ou ausência de chave fiscal válida.

Antes desta alteração, o fluxo de importação validava somente colunas de vínculo e informativas do GRL053, transformava todas as linhas em registros base e enviava todos os registros ao motor de matching. Como consequência, movimentos fora do escopo operacional podiam ser classificados como “Registro base inválido”, “Contrato não encontrado” ou “Nota não encontrada”.

A regra oficializada é que o GRL053 deve entrar na conferência somente quando a coluna `MOD` for exatamente `EXP` após normalização simples de texto (`trim` + maiúsculo). Modalidades diferentes de `EXP` são movimentos fora do escopo da análise com cliente e devem ser ignoradas antes do matching.

## PRDs impactados

- **PRD-01 — Visão Geral e Escopo da V1**: atualização do fluxo de processamento para explicitar que apenas `MOD = EXP` entra na análise.
- **PRD-02 — Importação de Relatórios**: inclusão de `MOD` como coluna obrigatória, regra de bloqueio quando ausente e regra de descarte antes do matching.
- **PRD-03 — Mapeamento Fixo de Colunas**: inclusão do campo interno `modalidade`, origem `MOD`, tipo texto, função filtro operacional.
- **PRD-04 — Normalização de Dados e Motor de Matching**: definição de que o motor recebe apenas registros base de expedição e não classifica `FIX`, `DEV`, `REC` ou outras modalidades.
- **PRD-05 — Tela de Conferência**: ajuste de UX para KPIs baseados em registros analisados e resumo simples de linhas ignoradas.
- **README**: alinhamento das regras principais de importação e matching.

## Alterações realizadas nos PRDs

- `MOD` passou a constar como coluna obrigatória do GRL053.
- A importação do GRL053 deve falhar se `MOD` não existir, com mensagem clara de coluna obrigatória ausente.
- Linhas com `MOD` diferente de `EXP` devem ser descartadas antes da normalização de contrato/nota e antes do matching.
- Linhas ignoradas por modalidade não geram erro, base inválida, contrato não encontrado nem nota não encontrada.
- `MOD` não participa do vínculo principal, que permanece `CONTR. CLIENTE + NOTA` contra `Nr Contr Original + Número NF`.
- KPIs e totais da tela devem refletir registros analisados, não todas as linhas brutas do arquivo.

## Arquivos de código alterados

- `src/pages/Index.tsx`: adiciona `MOD` às colunas obrigatórias do GRL053, usa o parse da base com estatísticas e envia totais para a tela de resultados.
- `src/lib/match.ts`: adiciona normalização simples de modalidade, filtro `MOD = EXP` no parse do GRL053 e contadores de linhas ignoradas.
- `src/lib/parseXlsx.ts`: melhora a mensagem de coluna obrigatória ausente para singular/plural claro.
- `src/components/UploadScreen.tsx`: atualiza o texto de layout esperado do GRL053 para incluir `MOD`.
- `src/components/ResultsScreen.tsx`: troca o cabeçalho para “Registros analisados” e exibe resumo simples de linhas ignoradas por modalidade.
- `src/test/match.test.ts`: cobre a regra de ignorar modalidades diferentes de `EXP` antes do matching.

## Critérios de validação

- Importar GRL053 sem coluna `MOD` deve bloquear a importação com erro de coluna obrigatória ausente.
- Linhas `MOD = EXP`, inclusive com espaços e minúsculas, devem ser analisadas normalmente.
- Linhas `MOD = FIX`, `DEV`, `REC` ou qualquer valor diferente de `EXP` devem ser ignoradas antes do matching.
- Linhas ignoradas por modalidade não devem aparecer na grid nem inflar o card “Base inválida”.
- Linha `MOD = EXP` com nota vazia, zero ou inválida continua sendo tratada como base inválida.
- A chave de matching permanece somente contrato cliente + nota fiscal.
- Placa e peso continuam apenas informativos.

## Riscos ou dúvidas encontradas

- O resumo técnico de importação foi implementado de forma simples na tela de resultados, sem criação de tela nova, para preservar o padrão existente.
- A contagem “Registros no arquivo” considera as linhas retornadas pelo parser após o cabeçalho fixo e sem mudar a lógica existente de leitura do SheetJS.
- O código mantém compatibilidade com chamadas existentes a `parseBase`, delegando para a nova função com estatísticas.

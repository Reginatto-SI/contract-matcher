# Análise 9 — Exclusão de cargas recusadas e ajuste de cores dos KPIs

## 1. Diagnóstico do problema

Foi identificado que linhas do relatório base GRL053 com `MOD = EXP` e `Denom. Status = Carga recusada` continuavam chegando ao motor de matching. Como o matching usa somente `CONTR. CLIENTE + NOTA`, essas linhas podiam ser classificadas como `Contrato não encontrado`, `Nota não encontrada`, divergência ou outro diagnóstico operacional, mesmo não representando embarque válido para cobrança.

A regra consolidada nos PRDs e no `README.md` já determina que:

- o sistema deve ser simples, determinístico e explicável;
- somente linhas elegíveis do GRL053 devem entrar no matching;
- registros fora do escopo operacional não devem alimentar cards de erro;
- KPIs devem considerar apenas registros realmente analisados;
- exportações devem refletir a mesma base exibida na conferência.

## 2. Arquivos analisados

- `README.md`
- `docs/PRD/PRD-01 — Visão Geral e Escopo da V1.txt`
- `docs/PRD/PRD-02 — Importação de Relatórios (V1).txt`
- `docs/PRD/PRD-03 — Mapeamento Fixo de Colunas (V1).txt`
- `docs/PRD/PRD-04 — Normalização de Dados e Motor de Matching (V1).txt`
- `docs/PRD/PRD-05 — Tela de Conferência (V1).txt`
- `src/lib/layouts.ts`
- `src/lib/parseXlsx.ts`
- `src/lib/match.ts`
- `src/components/ResultsScreen.tsx`
- `src/pages/Index.tsx`
- `src/lib/exporters.ts`
- `src/test/match.test.ts`
- `src/test/results-screen.test.tsx`

## 3. Arquivos alterados

- `src/lib/layouts.ts`
- `src/lib/match.ts`
- `src/pages/Index.tsx`
- `src/components/ResultsScreen.tsx`
- `src/test/match.test.ts`
- `src/test/results-screen.test.tsx`
- `docs/Analises/analise-9-exclusao-cargas-recusadas-e-cores-kpis.md`

## 4. Regra implementada

A elegibilidade do GRL053 ficou explícita no parser da base:

1. A linha entra somente se `MOD`, normalizado, for exatamente `EXP`.
2. Depois disso, a linha é ignorada se `Denom. Status`, convertido para texto, com espaços extras removidos e comparação case-insensitive, for exatamente `carga recusada`.

Não foi usado fuzzy match, `includes`, IA, inferência ou nova arquitetura.

## 5. Como cargas recusadas passaram a ser tratadas

- `Denom. Status` foi incluída no layout fixo do GRL053 como coluna operacional necessária para aplicar a exclusão antes do matching.
- Linhas `EXP` com `Denom. Status = Carga recusada` são contadas em `ignoradasCargaRecusada` e não entram no array `base` enviado ao motor de matching.
- Como o matching recebe apenas a base filtrada, essas linhas não podem gerar:
  - `Contrato não encontrado`;
  - `Nota não encontrada`;
  - `Registro base inválido`;
  - `Nota vinculada a outro contrato`;
  - `Contrato vinculado a outra nota`;
  - `Duplicidade`;
  - `Vínculo OK`;
  - alertas de placa.
- KPIs, grid, filtros, busca, paginação e exportações continuam operando sobre `rows`, que é produzido pelo matching após a filtragem.
- O resumo técnico da conferência passa a exibir: `Linhas ignoradas por carga recusada: X`, quando houver linhas descartadas por esse motivo.

## 6. Critério visual aplicado aos cards

A hierarquia visual foi ajustada sem criar novos componentes:

- `Vínculo OK`: verde (`success`).
- `Divergências de vínculo`: vermelho crítico (`critical`), usando base visual destrutiva forte em vez de azul/informativo.
- `Contrato não encontrado`, `Nota não encontrada` e `Base inválida`: vermelho normal (`destructive`).
- `Alertas (placa)`: amarelo/laranja (`warning`).
- Informações auxiliares permanecem neutras ou informativas conforme padrão existente.

## 7. Evidências de validação

Foram adicionados/ajustados testes automatizados para cobrir:

- coluna `Denom. Status` presente no layout fixo do GRL053;
- linha `MOD = EXP` com `Denom. Status = Carga recusada` ignorada antes do matching;
- carga recusada não gerando `Contrato não encontrado`;
- carga recusada não entrando nos KPIs;
- linha normal `MOD = EXP` com status diferente continuando na análise;
- card `Divergências de vínculo` com classe vermelha/crítica e não azul/informativa.

Comandos executados:

- `npm test -- --runInBand` — não executou os testes porque as dependências não estão instaladas (`vitest: not found`).
- `npm test` — não executou os testes porque as dependências não estão instaladas (`vitest: not found`).
- `npm run build` — gerou o arquivo temporário de versão, que foi revertido, mas não concluiu porque as dependências não estão instaladas (`vite: not found`).
- `git diff --check` — executado sem apontar problemas de whitespace.
- `npm ci --ignore-scripts --no-audit --no-fund` — não instalou dependências porque `package.json` e `package-lock.json` já estão dessincronizados no repositório.
- `bun install` — não instalou dependências por bloqueio de rede/registro com respostas HTTP 403.

## 8. Riscos restantes

- A validação automatizada não pôde ser executada neste ambiente por limitação de dependências/registry. Os testes foram atualizados no código e devem ser executados em ambiente com dependências instaláveis.
- Como `Denom. Status` virou coluna operacional do GRL053, arquivos antigos sem essa coluna serão bloqueados pela validação fixa de layout, o que é coerente com a regra atual de excluir cargas recusadas sem inferência.

## 9. Checklist final

- [x] Codex leu `/docs/PRD/` e `README.md`.
- [x] Confirmou que `Denom. Status` já existia no complementar FS, mas não no layout/parsing da base GRL053.
- [x] Implementou exclusão de `Carga recusada` no parser da base, antes do matching.
- [x] Garantiu por fluxo que cargas recusadas não entram em KPIs, grid e exportações.
- [x] Ajustou `Divergências de vínculo` para vermelho/crítico.
- [x] Não alterou regras de matching além do filtro de elegibilidade da carga recusada.
- [x] Não criou arquitetura nova.
- [x] Comentou no código a regra de exclusão.
- [x] Criou análise em Markdown dentro de `/docs/Analises/`.
- [x] Documentou limitações de validação automatizada neste ambiente.

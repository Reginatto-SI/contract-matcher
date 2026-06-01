# Análise — Novo layout complementar "Inpasa - Nova Mutum"

## Decisão

Adicionado um terceiro layout complementar fixo, mantendo Inpasa - Sinop e FS sem alterações. O matching continua sendo exclusivamente por `CONTR. CLIENTE + NOTA` do GRL053 contra `Contrato Original + Número` do complementar.

## Mapeamento

| Campo interno     | Coluna no Nova Mutum | Função      |
| ----------------- | -------------------- | ----------- |
| contrato_cliente  | Contrato Original    | Vínculo     |
| nota              | Número               | Vínculo     |
| peso_fisico       | Peso Final           | Informativo |

## Particularidades

- O layout Nova Mutum não tem coluna de placa. A placa do complementar é importada como string vazia e nunca gera alerta de placa divergente (a regra atual em `match()` exige `b.placa && comp.placa`).
- Peso Final é apenas informativo; não altera situação nem KPIs.
- Cabeçalho na linha 1.

## Arquivos alterados

- `src/lib/layouts.ts` — novo id `inpasa-nova-mutum` e entrada em `CLIENTES_SUPORTADOS`.
- `src/lib/match.ts` — ramo dedicado em `parseCompWithStats` para o novo layout.
- `src/test/match.test.ts` — testes de parse e matching.
- `docs/Analises/analise-novo-layout-inpasa-nova-mutum.md`

## ID técnico

`inpasa-nova-mutum` (mantém `inpasa` como id de Sinop para preservar compatibilidade do `DEFAULT_CLIENTE_ID`).

## Restrições respeitadas

Sem cadastro dinâmico, sem DE/PARA, sem alteração no GRL053, no filtro `MOD = EXP`, no motor de matching, nem nos layouts Sinop/FS.

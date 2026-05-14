# Análise 12 — Alerta de placa somente com vínculo OK

## Diagnóstico do bug

O card **Alertas (placa)** podia contar linhas cuja situação principal era erro de vínculo, especialmente **Nota não encontrada**. A causa estava no motor de matching: após definir a situação, o campo `placaDivergente` era calculado sempre que existisse algum `comp` associado à linha.

Em cenários de erro, esse `comp` pode ser apenas um registro auxiliar usado para montar o detalhe da inconsistência, por exemplo um registro encontrado pelo mesmo contrato, mas com outra nota fiscal. Assim, uma linha sem match exato de **CONTR. CLIENTE + NOTA** podia receber alerta de placa por comparar a placa da base com a placa de um registro complementar que não era o vínculo correto.

## Por que o alerta era calculado cedo demais

A situação da linha era definida corretamente primeiro, mas o cálculo de placa não respeitava essa classificação. A expressão verificava apenas:

- existência de `comp`;
- placa da base preenchida;
- placa do complementar preenchida;
- placas diferentes.

Como `comp` também era preenchido em alguns erros para explicar o problema no detalhe, registros auxiliares de `hintsContrato`/`hintsNota` acabavam influenciando o KPI e o filtro de alerta de placa.

## Regra ajustada

A placa permanece fora da chave de vínculo e continua sendo apenas alerta visual secundário. A regra foi ajustada para `placaDivergente` ser verdadeira somente quando:

1. `situacao === "OK"`;
2. existe `comp` do match exato;
3. placa da base está preenchida;
4. placa do complementar está preenchida;
5. as placas são diferentes.

Para qualquer situação diferente de `OK`, incluindo **Nota não encontrada**, **Contrato não encontrado**, **Nota vinculada a outro contrato**, **Contrato vinculado a outra nota**, **Duplicidade** ou base inválida, `placaDivergente` permanece `false`.

## Arquivos alterados

- `src/lib/match.ts`: restringe o cálculo de `placaDivergente` a vínculos `OK`, preservando o matching principal por contrato + nota.
- `src/components/ResultsScreen.tsx`: mantém o filtro **Alertas (placa)** baseado em `placaDivergente` e passa a tratar a coluna **Placa Cliente** como placa correspondente somente em linhas `OK`; registros auxiliares continuam disponíveis no detalhe da linha.
- `src/lib/exporters.ts`: alinha Excel/PDF com a grid, evitando exportar placa/peso do complementar como correspondência quando a linha não tem vínculo `OK`.
- `src/test/match.test.ts`: adiciona cobertura para vínculo OK com placas iguais/diferentes, erros de vínculo sem alerta e KPI de alertas.
- `src/test/results-screen.test.tsx`: adiciona cobertura do filtro **Alertas (placa)** para não exibir linha de **Nota não encontrada**.

## Testes criados/ajustados

Foram adicionados testes para validar:

- vínculo OK com placas iguais não gera alerta;
- vínculo OK com placas diferentes gera alerta;
- **Nota não encontrada** não gera alerta mesmo com registro auxiliar do mesmo contrato e placa diferente;
- **Contrato não encontrado** não gera alerta;
- **Nota vinculada a outro contrato** não gera alerta;
- KPI **Alertas (placa)** conta apenas vínculos OK com placa divergente;
- filtro **Alertas (placa)** não exibe linha de **Nota não encontrada**.

## Validação final

Foi tentada a execução dos testes focalizados com `npm test -- --run src/test/match.test.ts src/test/results-screen.test.tsx`, porém o ambiente não possuía `vitest` instalado. Em seguida, foi tentado `npm install`, mas o registry retornou **403 Forbidden** para dependências do projeto, impedindo a instalação local das ferramentas de teste.

Apesar da limitação de ambiente, a alteração é localizada e mantém a sequência de negócio esperada:

1. status do vínculo é definido por contrato + nota;
2. somente status `OK` pode calcular divergência de placa;
3. KPIs e filtro continuam usando o campo `placaDivergente`, agora protegido contra registros auxiliares.

## Riscos restantes

- A validação automatizada precisa ser executada em ambiente com dependências disponíveis.
- O campo `comp` continua preservado para detalhes auxiliares em erros de vínculo; portanto, qualquer nova tela/exportação futura deve seguir a mesma regra: só tratar placa do complementar como correspondência quando `situacao === "OK"`.

## Refinamento — Peso físico somente em vínculo OK

Após a correção do alerta de placa, foi revisada a tabela principal para procurar usos diretos de `r.comp?.placa` e `r.comp?.totalLiquido` em campos que representam correspondência direta. A placa cliente já estava protegida por `getExactMatchComp(row)`, mas a ordenação e a célula de **Peso Físico** ainda usavam `r.comp?.totalLiquido` diretamente.

Esse ponto poderia manter a incoerência visual em linhas sem vínculo exato: uma linha de **Nota não encontrada** poderia exibir peso físico de um registro auxiliar encontrado por contrato/nota, sugerindo uma correspondência inexistente.

O refinamento aplicado foi:

- usar `getExactMatchComp(row)?.totalLiquido` na ordenação por **Peso Físico**;
- usar `getExactMatchComp(row)?.totalLiquido` na coluna **Peso Físico** da grid;
- manter o drawer/detalhe sem alteração, pois ele ainda pode usar `comp` auxiliar para explicar o erro;
- manter Excel/PDF já alinhados com `getExactMatchComp(row)` para placa e peso;
- adicionar testes para exibição da grid, ordenação por peso físico e exportações Excel/PDF.

Com isso, a tabela principal e as exportações passam a seguir a mesma regra: dados do complementar que pareçam correspondência real só aparecem quando `situacao === "OK"`.

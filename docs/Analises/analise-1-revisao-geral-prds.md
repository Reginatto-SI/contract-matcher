# Análise 1 — Revisão Geral dos PRDs da V1

## 1. Resumo Executivo

Os PRDs apresentam uma direção de produto clara e majoritariamente consistente: uma ferramenta interna, local, sem persistência, baseada em layout fixo e matching determinístico por **contrato cliente + nota fiscal**. A visão geral, importação, mapeamento, motor de matching e tela de conferência convergem para os mesmos princípios centrais: simplicidade, explicabilidade e ausência de heurísticas.

O nível de consistência é **bom**, especialmente nos pilares arquiteturais e na regra de ouro do vínculo. Ainda assim, há pontos que precisam de decisão antes de virar código definitivo, porque permitem múltiplas interpretações operacionais. Os maiores riscos estão em: normalização de valores, tratamento de linhas inválidas, prioridade dos status, duplicidade, nomenclatura de situações e comportamento de exportação.

Pontos fortes encontrados:

- Escopo da V1 bem delimitado.
- Arquitetura simples e coerente com uso operacional local.
- Regra de matching explícita e repetida nos PRDs principais.
- Proibição consistente de IA, fuzzy match, heurísticas e DE/PARA dinâmico.
- Ênfase correta em diagnóstico explicável, não apenas exibição de dados brutos.

Riscos principais encontrados:

- Alguns campos obrigatórios divergem entre PRD-02, PRD-03 e PRD-04.
- A regra de normalização de contrato possui frase contraditória com os exemplos.
- A normalização de nota fiscal não define claramente zeros à esquerda.
- A ordem de prioridade entre duplicidade, vínculo OK e alertas pode gerar status diferentes para o mesmo caso.
- A placa divergente é tratada como alerta visual, mas não está claro se altera agrupamento, KPI ou filtro.
- A exportação está prevista, mas seu conteúdo exato não está definido.

---

## 2. Inconsistências Encontradas

### 2.1 Regras contraditórias

#### Item 01 — Normalização de contrato: “remover tudo que não for número” vs “primeiro bloco numérico”

- **PRD envolvido:** PRD-04.
- **Trecho conflitante:** a regra diz para remover tudo que não for número e também extrair apenas o primeiro bloco numérico. No exemplo `AFX 33610-33316`, o resultado esperado é `33610`, não `3361033316`.
- **Impacto técnico:** implementações diferentes podem gerar chaves diferentes para o mesmo contrato.
- **Risco operacional:** falso erro ou falso vínculo quando contratos contêm mais de um bloco numérico.
- **Sugestão mínima:** reescrever a regra como: “Identificar o primeiro bloco contínuo de dígitos no texto original e usar somente esse bloco; ignorar qualquer bloco numérico posterior.”

#### Item 02 — Formatos aceitos: estrutura única vs `.csv` opcional

- **PRDs envolvidos:** PRD-02 e princípios gerais da V1.
- **Trecho conflitante:** PRD-02 afirma que `.xlsx`, `.xls` e `.csv` opcional são suportados, mas também diz para não permitir múltiplos formatos e não usar inteligência desnecessária.
- **Impacto técnico:** o parser pode precisar de caminhos diferentes para planilhas e CSV, aumentando superfície de erro.
- **Risco operacional:** usuário pode entender que CSV é oficialmente suportado, enquanto a implementação pode tratar apenas Excel.
- **Sugestão mínima:** decidir se CSV está dentro ou fora da V1. Para máxima simplicidade, documentar CSV como “fora da V1” ou “somente se implementado com a mesma validação fixa”.

### 2.2 Status inconsistentes

#### Item 03 — Nomes de status variam entre PRD-04 e PRD-05

- **PRDs envolvidos:** PRD-04 e PRD-05.
- **Trecho conflitante:** PRD-04 usa “NOTA VINCULADA A OUTRO CONTRATO”, “CONTRATO VINCULADO A OUTRA NOTA” e “MÚLTIPLOS REGISTROS (DUPLICIDADE)”; PRD-05 usa “Nota em outro contrato”, “Contrato com outra nota” e “Duplicidade”.
- **Impacto técnico:** enums, labels de UI, filtros, exportação e testes podem divergir.
- **Risco operacional:** usuários podem ver nomes diferentes para o mesmo diagnóstico.
- **Sugestão mínima:** manter códigos internos estáveis e definir labels oficiais únicos para UI/exportação: “Vínculo OK”, “Contrato não encontrado”, “Nota não encontrada”, “Nota vinculada a outro contrato”, “Contrato vinculado a outra nota” e “Duplicidade”.

#### Item 04 — KPI “Divergências” não corresponde a um status único

- **PRD envolvido:** PRD-05.
- **Trecho conflitante:** os KPIs listam “Divergências”, mas a lista de situações não possui uma situação chamada “Divergência”.
- **Impacto técnico:** o cálculo do KPI pode variar entre somar erros de vínculo, alertas de placa, duplicidades ou todos os não OK.
- **Risco operacional:** o número exibido no topo pode ser interpretado incorretamente.
- **Sugestão mínima:** definir “Divergências” como agrupador, não status. Exemplo mínimo: “Divergências = Nota vinculada a outro contrato + Contrato vinculado a outra nota + Duplicidade”, mantendo alertas de placa separados ou explicitamente incluídos.

### 2.3 Regras duplicadas

#### Item 05 — Regra de vínculo aparece em múltiplos PRDs

- **PRDs envolvidos:** PRD-01, PRD-03 e PRD-04.
- **Trecho duplicado:** todos reforçam que o vínculo é `CONTR. CLIENTE + NOTA` contra `Nr Contr Original + Número NF`.
- **Impacto técnico:** baixo; a duplicação reforça a regra principal.
- **Risco operacional:** se um PRD for alterado no futuro e outro não, pode surgir divergência.
- **Sugestão mínima:** manter a duplicação, mas declarar no PRD-04 que ele é a fonte de verdade técnica do matching.

#### Item 06 — Regras de placa e peso aparecem em PRD-01, PRD-03 e PRD-04

- **PRDs envolvidos:** PRD-01, PRD-03 e PRD-04.
- **Trecho duplicado:** placa não participa do vínculo; peso fiscal e físico são informativos e não comparáveis como erro.
- **Impacto técnico:** baixo, desde que a regra permaneça igual.
- **Risco operacional:** alterações futuras podem gerar inconsistência sobre alerta de placa ou tratamento de peso.
- **Sugestão mínima:** manter uma formulação única: “Placa gera apenas alerta visual; peso é apenas exibido e nunca classifica erro.”

### 2.4 Campos com nomenclatura diferente

#### Item 07 — Campos obrigatórios da base divergem entre PRD-02 e PRD-03

- **PRDs envolvidos:** PRD-02 e PRD-03.
- **Trecho conflitante:** PRD-02 lista como obrigatórios `PLACA`, `CONTRATO`, `NOTA`, `CONTR. CLIENTE` e `APOS DESC`; PRD-03 também utiliza `DATA ROMANEIO` e `OBSERVAÇÃO NF`.
- **Impacto técnico:** validação de importação pode bloquear ou aceitar arquivos de forma diferente.
- **Risco operacional:** um arquivo sem `DATA ROMANEIO` ou `OBSERVAÇÃO NF` pode ser aceito por uma regra e rejeitado por outra.
- **Sugestão mínima:** separar “colunas obrigatórias para processamento V1” de “colunas informativas exibíveis se existirem”. Se `DATA ROMANEIO` e `OBSERVAÇÃO NF` não forem usadas na tela V1, deixá-las como não obrigatórias.

#### Item 08 — Peso possui nomes internos diferentes

- **PRDs envolvidos:** PRD-03, PRD-04 e PRD-05.
- **Trecho conflitante:** PRD-03 usa `peso_fiscal` e `peso_fisico`; PRD-04 sugere `peso_base` e `peso_complementar`; PRD-05 exibe “Peso Fiscal” e “Peso Cliente”.
- **Impacto técnico:** modelos, exportação e UI podem usar nomes diferentes para o mesmo dado.
- **Risco operacional:** baixa gravidade, mas aumenta chance de erro em implementação e testes.
- **Sugestão mínima:** padronizar internamente como `pesoFiscal` e `pesoFisico`, exibindo na UI “Peso Fiscal” e “Peso Físico/Cliente”.

### 2.5 Fluxos incompletos

#### Item 09 — Exportação prevista sem definição de escopo

- **PRDs envolvidos:** PRD-01 e PRD-05.
- **Trecho incompleto:** exportação Excel/PDF é prevista, mas não define se exporta todos os registros, registros filtrados, página atual ou detalhes do drawer.
- **Impacto técnico:** comportamento pode ser implementado de formas incompatíveis com a expectativa operacional.
- **Risco operacional:** usuário pode exportar um conjunto diferente do que está vendo na tela.
- **Sugestão mínima:** definir explicitamente uma regra simples. Exemplo: “Exportar sempre o resultado completo da conferência, respeitando filtro ativo apenas se o botão estiver dentro da área filtrada.”

#### Item 10 — Reimportação não define efeito sobre o outro arquivo já carregado

- **PRD envolvido:** PRD-02.
- **Trecho incompleto:** “Nova importação substitui totalmente os dados anteriores”, mas não esclarece se importar nova base limpa também o complementar, ou se substitui apenas o tipo reimportado.
- **Impacto técnico:** estado da aplicação pode combinar uma base nova com complementar antigo.
- **Risco operacional:** conferência pode ser feita com arquivos de contextos diferentes sem o usuário perceber.
- **Sugestão mínima:** definir uma regra única e visível. Para simplicidade: reimportar base ou complementar substitui apenas aquele conjunto, mas o sistema deve recalcular e mostrar claramente os contextos carregados; ou, alternativamente, qualquer reimportação limpa toda a análise.

### 2.6 Regras sem definição

#### Item 11 — Linhas com contrato ou nota ausentes: ignorar, invalidar ou exibir erro?

- **PRDs envolvidos:** PRD-02 e PRD-04.
- **Trecho conflitante/incompleto:** PRD-02 diz para ignorar linha sem contrato ou nota; PRD-04 diz que registro sem número no contrato é inválido para match.
- **Impacto técnico:** registros inválidos podem desaparecer da conferência ou aparecer como erro diagnosticável.
- **Risco operacional:** se linhas forem ignoradas silenciosamente, o usuário pode perder rastreabilidade sobre problemas no arquivo.
- **Sugestão mínima:** não ignorar silenciosamente linhas parcialmente inválidas. Definir se serão bloqueadas na importação ou contabilizadas como “linhas ignoradas” no feedback. Como a lista de status não prevê “inválido”, a decisão precisa ser explícita.

#### Item 12 — Duplicidade não define origem nem abrangência

- **PRD envolvido:** PRD-04.
- **Trecho incompleto:** “Mais de um registro encontrado para mesma chave” não esclarece se a duplicidade é apenas no complementar, apenas na base ou em ambos.
- **Impacto técnico:** índice de matching e classificação podem mudar conforme a origem da duplicidade.
- **Risco operacional:** duplicidades na base podem passar despercebidas se a regra considerar apenas complementar.
- **Sugestão mínima:** declarar que, na V1, a duplicidade de status é calculada sobre o complementar para a chave procurada, já que a saída é “para cada linha do relatório base”. Se duplicidade na base for relevante, precisa virar regra explícita.

### 2.7 Casos extremos não definidos

#### Item 13 — Zeros à esquerda em nota e contrato

- **PRD envolvido:** PRD-04.
- **Trecho incompleto:** a normalização de nota mostra `000123 → 123`, mas a regra textual não afirma “remover zeros à esquerda”. Para contrato, a remoção de zeros à esquerda não é mencionada.
- **Impacto técnico:** `000123` pode comparar igual ou diferente de `123` dependendo da implementação.
- **Risco operacional:** falso não encontrado em arquivos que usam padding numérico.
- **Sugestão mínima:** declarar explicitamente se zeros à esquerda devem ser removidos em nota e contrato.

#### Item 14 — Comparação de placa divergente não define normalização

- **PRDs envolvidos:** PRD-03, PRD-04 e PRD-05.
- **Trecho incompleto:** placa pode gerar alerta, mas não há regra de normalização para diferenças como hífen, espaços e caixa (`ABC-1234` vs `abc1234`).
- **Impacto técnico:** alertas de placa podem variar por detalhe de formatação.
- **Risco operacional:** excesso de alertas falsos, reduzindo confiança na tela.
- **Sugestão mínima:** definir normalização simples para placa antes do alerta: remover espaços/hífen e comparar em maiúsculas.

---

## 3. Ambiguidades que exigem decisão

## Dúvida 01 — Suporte a CSV na V1

### Problema identificado
O PRD-02 lista `.csv` como opcional, mas os princípios da V1 evitam múltiplos formatos e inteligência de importação.

### Possíveis interpretações
1. CSV fica fora da V1; somente `.xlsx` e `.xls` são aceitos.
2. CSV é aceito apenas se tiver cabeçalhos exatamente iguais e separador simples definido.

### Impacto técnico
Aceitar CSV exige regras adicionais de encoding, separador, aspas, quebras de linha e tipos. Excluir CSV reduz complexidade e risco.

### Pergunta para decisão
Na V1, o sistema deve aceitar CSV oficialmente ou o suporte deve ficar restrito a `.xlsx`/`.xls`?

### Recomendação sugerida
Manter a V1 restrita a `.xlsx` e `.xls`. CSV deve ficar fora da V1 até existir decisão explícita, porque aumenta variação operacional sem melhorar o matching determinístico.

## Dúvida 02 — Colunas obrigatórias reais do GRL053

### Problema identificado
PRD-02 lista cinco colunas obrigatórias da base, enquanto PRD-03 inclui também `DATA ROMANEIO` e `OBSERVAÇÃO NF` como colunas utilizadas.

### Possíveis interpretações
1. Apenas `PLACA`, `CONTRATO`, `NOTA`, `CONTR. CLIENTE` e `APOS DESC` são obrigatórias.
2. `DATA ROMANEIO` e `OBSERVAÇÃO NF` também são obrigatórias, mesmo sendo informativas.

### Impacto técnico
A decisão afeta bloqueio de importação e compatibilidade com arquivos reais do GRL053.

### Pergunta para decisão
`DATA ROMANEIO` e `OBSERVAÇÃO NF` devem bloquear a importação quando ausentes, ou devem ser tratadas como opcionais/informativas?

### Recomendação sugerida
Tratar como opcionais/informativas na V1, a menos que sejam exibidas obrigatoriamente na tela. A importação deve bloquear apenas campos necessários para matching e campos informativos já definidos como essenciais.

## Dúvida 03 — Tratamento de linhas inválidas

### Problema identificado
PRD-02 orienta ignorar linhas sem contrato ou nota; PRD-04 afirma que registro sem número no contrato é inválido para match.

### Possíveis interpretações
1. Linhas inválidas são ignoradas na importação e aparecem apenas no resumo de importação.
2. Linhas inválidas bloqueiam a importação inteira.
3. Linhas inválidas aparecem na conferência com status específico, o que exigiria novo status não previsto.

### Impacto técnico
Afeta rastreabilidade, contagem total de registros, KPIs e confiança operacional.

### Pergunta para decisão
Na V1, uma linha parcialmente inválida deve ser ignorada, bloquear a importação ou aparecer no resultado com diagnóstico próprio?

### Recomendação sugerida
Ignorar linhas parcialmente inválidas apenas com feedback explícito de contagem/motivo na importação. Não criar novo status de matching sem decisão de produto, para manter a V1 simples.

## Dúvida 04 — Zeros à esquerda

### Problema identificado
O exemplo de nota fiscal indica remoção de zeros à esquerda, mas a regra textual não define isso claramente para nota nem para contrato.

### Possíveis interpretações
1. Remover zeros à esquerda de nota e contrato.
2. Remover zeros à esquerda somente da nota.
3. Nunca remover zeros à esquerda, tratando-os como parte do valor.

### Impacto técnico
Afeta diretamente a chave de matching e pode alterar vínculos.

### Pergunta para decisão
Zeros à esquerda devem ser removidos em contrato cliente e nota fiscal antes do matching?

### Recomendação sugerida
Remover zeros à esquerda de contrato cliente e nota fiscal, documentando isso como normalização fixa. Essa direção reduz falsos negativos em arquivos exportados como número/texto com padding.

## Dúvida 05 — Prioridade da duplicidade

### Problema identificado
PRD-04 define prioridade “erros de chave → duplicidade → vínculo OK”, mas duplicidade de chave exata também é uma forma de encontrar contrato + nota.

### Possíveis interpretações
1. Se houver múltiplos complementares para a mesma chave, status sempre é “Duplicidade”, antes de “Vínculo OK”.
2. Se houver chave exata, status é “Vínculo OK” e duplicidade vira alerta/detalhe.

### Impacto técnico
Afeta enum de status, KPIs, filtros e exportação.

### Pergunta para decisão
Quando a chave exata existe mais de uma vez no complementar, o status principal deve ser “Duplicidade” ou “Vínculo OK com alerta de duplicidade”?

### Recomendação sugerida
Classificar como “Duplicidade” quando houver mais de um registro complementar para a mesma chave exata. Isso mantém o status principal conservador e evita tratar vínculo ambíguo como OK.

## Dúvida 06 — Escopo da duplicidade

### Problema identificado
Não está definido se duplicidade considera apenas complementar, apenas base ou ambos.

### Possíveis interpretações
1. Duplicidade só é avaliada no relatório complementar para a chave da linha base.
2. Duplicidade também deve detectar múltiplas linhas iguais na base.

### Impacto técnico
Detectar duplicidade na base altera o modelo de resultado, pois a conferência hoje é descrita “para cada linha da base”.

### Pergunta para decisão
A duplicidade da V1 deve considerar somente o complementar ou também duplicidades no relatório base?

### Recomendação sugerida
Na V1, considerar duplicidade de status apenas no complementar para a chave da linha base. Duplicidade na base pode ser documentada como risco operacional, sem criar novo fluxo ou status agora.

## Dúvida 07 — Placa divergente como alerta, status ou filtro

### Problema identificado
A placa não faz parte do vínculo, mas pode gerar alerta visual. O PRD-05 também prevê filtros “Apenas divergentes” e cores amarelas para alerta.

### Possíveis interpretações
1. Placa divergente mantém status “Vínculo OK” e apenas adiciona alerta visual/detalhe.
2. Placa divergente entra no agrupador “Divergências”.
3. Placa divergente tem filtro próprio de alertas.

### Impacto técnico
Afeta KPIs, filtros rápidos, cor da linha e exportação.

### Pergunta para decisão
Placa divergente deve contar dentro de “Divergências” ou deve ser apenas um alerta separado sem mudar o status principal?

### Recomendação sugerida
Manter placa divergente como alerta separado, sem alterar o status principal. Se o vínculo por contrato + nota está correto, a situação deve permanecer “Vínculo OK” e a placa deve aparecer no detalhe/alerta visual.

## Dúvida 08 — Escopo da exportação

### Problema identificado
Exportação Excel/PDF é obrigatória, mas o PRD não define o conjunto exportado.

### Possíveis interpretações
1. Exportar sempre todos os registros processados.
2. Exportar apenas registros filtrados na tela.
3. Exportar apenas a página atual.

### Impacto técnico
Afeta expectativa do usuário e risco de exportar dados incompletos sem perceber.

### Pergunta para decisão
O botão Exportar deve gerar arquivo com todos os registros, somente registros filtrados ou somente a página atual?

### Recomendação sugerida
Exportar todos os registros processados por padrão. Nunca exportar apenas página atual na V1, para evitar arquivo incompleto por causa da paginação.

## Dúvida 09 — Reimportação parcial ou reset total

### Problema identificado
PRD-02 diz que nova importação substitui dados anteriores, mas não define se isso vale para todo o estado ou apenas para o arquivo reimportado.

### Possíveis interpretações
1. Reimportar qualquer arquivo limpa toda a análise e exige importar ambos novamente.
2. Reimportar base substitui apenas base; reimportar complementar substitui apenas complementar; matching é recalculado quando ambos existem.

### Impacto técnico
Afeta UX, estado de carregamento e risco de combinar arquivos incompatíveis.

### Pergunta para decisão
A reimportação deve fazer reset total da análise ou substituir somente o relatório reimportado?

### Recomendação sugerida
Preferir reset total da análise ao reimportar qualquer arquivo. É o comportamento mais simples e reduz risco de misturar base nova com complementar antigo.

## Dúvida 10 — Paginação de 50 registros

### Problema identificado
PRD-05 determina 50 registros por página, mas não define se esse número pode ser configurável.

### Possíveis interpretações
1. Sempre 50 registros fixos por página.
2. 50 é padrão, mas usuário pode escolher outro tamanho.

### Impacto técnico
Um seletor de tamanho adiciona estado e complexidade de UX.

### Pergunta para decisão
Na V1, a paginação deve ser fixa em 50 registros por página, sem seletor?

### Recomendação sugerida
Manter paginação fixa em 50 registros por página, sem seletor na V1. Isso reduz estado de UI e preserva performance previsível.

---

## 4. Sugestões de melhoria (mínimas)

1. Criar uma pequena seção “Glossário oficial” nos PRDs ou no README com os nomes oficiais: Base/GRL053, Complementar/Inpasa, contrato cliente, nota fiscal, peso fiscal, peso físico e placa.
2. Definir explicitamente a lista final de colunas obrigatórias para importação, separando campos obrigatórios de campos opcionais/informativos.
3. Ajustar a frase de normalização de contrato para remover a contradição entre “todos os números” e “primeiro bloco numérico”.
4. Declarar se zeros à esquerda são removidos para nota e contrato.
5. Padronizar os labels oficiais de status em todos os pontos: UI, exportação, testes e documentação.
6. Definir se “Divergências” é agrupador de status ou alerta visual.
7. Definir uma regra única para exportação: todos, filtrados ou página atual.
8. Definir comportamento de reimportação antes de implementar telas finais.
9. Manter a V1 sem CSV se a prioridade absoluta for reduzir variação operacional.
10. Acrescentar feedback de importação com contagem de linhas lidas, linhas válidas e linhas ignoradas, sem criar histórico nem persistência.

---

## 5. Checklist de alinhamento final

| Tema | Status |
| --- | --- |
| Escopo da V1 | OK |
| Arquitetura sem backend/banco/persistência | OK |
| Matching por contrato cliente + nota | OK |
| Placa fora da chave | OK |
| Peso apenas informativo | OK |
| Importação com layout fixo | Parcialmente divergente |
| Campos obrigatórios | Divergente |
| Normalização de contrato | Ambígua |
| Normalização de nota | Ambígua |
| Status de matching | Divergente |
| Duplicidade | Ambígua |
| Alertas de placa | Ambígua |
| UX de conferência | OK com lacunas |
| Exportação | Ambígua |
| Reimportação | Ambígua |
| Performance até 10.000 registros | OK |
| Simplicidade operacional | OK |

---

## 6. Riscos operacionais futuros

Os riscos abaixo devem ser monitorados sem alterar a arquitetura da V1:

- **Múltiplas abas:** o usuário pode importar arquivos diferentes em abas diferentes e comparar resultados manualmente de forma equivocada.
- **Perda de dados por reload:** atualizar a página apaga a análise em memória. Isso é esperado, mas precisa estar claro para o usuário.
- **Perda de dados ao fechar a aba:** fechar o navegador encerra a análise atual, sem recuperação automática.
- **Mistura de arquivos incompatíveis:** se a política de reimportação não for congelada, uma base nova pode ser cruzada com complementar antigo.
- **Arquivos parcialmente válidos:** linhas ignoradas ou inválidas podem gerar diferença entre total do arquivo e total processado.
- **Divergência de nomenclatura futura:** labels diferentes para o mesmo status podem quebrar confiança operacional, filtros e exportação.
- **Duplicação de lógica de normalização:** normalizar contrato/nota em mais de um lugar pode gerar chaves diferentes e resultados inconsistentes.
- **Mudanças silenciosas de layout:** qualquer alteração no relatório de origem deve falhar explicitamente, não ser corrigida automaticamente.
- **Interpretação errada de alertas:** placa divergente pode ser confundida com erro de vínculo se a UI não diferenciar status principal de alerta.

---

## 7. Decisões que devem ser congeladas antes da implementação

Antes de avançar em implementação ou refino de tela, as decisões abaixo precisam ser fechadas e registradas como regra oficial:

- Suporte ou não a CSV na V1.
- Lista final de colunas obrigatórias do GRL053.
- Tratamento de linhas sem contrato, sem nota ou sem número válido para match.
- Tratamento de zeros à esquerda em contrato cliente e nota fiscal.
- Comportamento da duplicidade quando a chave exata aparece mais de uma vez.
- Escopo da duplicidade: somente complementar ou também base.
- Papel da placa divergente em KPI, filtro e cor, sem alterar status principal.
- Escopo da exportação: todos os registros, filtrados ou página atual.
- Política de reimportação: reset total ou substituição parcial.
- Paginação fixa em 50 registros ou tamanho configurável.

A recomendação geral é congelar sempre a alternativa mais simples, fixa, determinística e explicável.

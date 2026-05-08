# Análise 1 — Importação XLS/XLSX e Validação de Cabeçalhos

## 1. Resumo executivo

A causa provável do erro não é ausência visual das colunas nos arquivos reais, nem falha de matching. O erro ocorre **antes da conferência**, durante a validação de colunas obrigatórias na importação.

O código atual lê sempre a **primeira aba** e entrega a planilha ao `XLSX.utils.sheet_to_json` sem informar a linha real de cabeçalho. Com isso, a biblioteca usa a **primeira linha do intervalo usado da planilha** como cabeçalho. Nos dois arquivos reais analisados, a primeira linha **não é** a linha de cabeçalho operacional:

- No GRL053 `.xlsx`, a linha 1 é um título do relatório e a linha 3 contém os cabeçalhos reais.
- No Inpasa `.xls`, a linha 1 contém títulos de grupos de desconto/classificação e a linha 2 contém os cabeçalhos reais.

Assim, a validação compara as colunas obrigatórias dos PRDs contra a linha errada e acusa colunas ausentes mesmo quando elas existem visualmente no Excel.

Conclusão objetiva: o problema está principalmente no **código de leitura/validação**, por assumir implicitamente cabeçalho na primeira linha útil, e não no motor de matching. Há também uma divergência de UX: a V1 deve aceitar `.xls` e `.xlsx`, mas o input da tela está limitado a `.xlsx`.

## 2. Arquivos analisados

### Arquivos Excel reais

- `docs/XLS de Teste Import/BASE GRL053 ANO 2025.xlsx`
  - Tamanho aproximado inspecionado via `du -h`: `1.2M`.
  - Tipo detectado pelos bytes iniciais: ZIP/OpenXML (`PK...`), compatível com `.xlsx`.
- `docs/XLS de Teste Import/Complementar Inpasa - Todas Empresas 2025.xls`
  - Tamanho aproximado inspecionado via `du -h`: `15M`.
  - Tipo detectado pelos bytes iniciais: OLE Compound File (`D0 CF 11 E0 A1 B1 1A E1`), compatível com `.xls` binário BIFF/OLE.

### Arquivos de documentação e código

- `README.md`
- `docs/PRD/PRD-01 — Visão Geral e Escopo da V1.txt`
- `docs/PRD/PRD-02 — Importação de Relatórios (V1).txt`
- `docs/PRD/PRD-03 — Mapeamento Fixo de Colunas (V1).txt`
- `docs/PRD/PRD-04 — Normalização de Dados e Motor de Matching (V1).txt`
- `docs/PRD/PRD-05 — Tela de Conferência (V1).txt`
- `src/components/UploadScreen.tsx`
- `src/pages/Index.tsx`
- `src/lib/parseXlsx.ts`
- `src/lib/match.ts`
- `src/lib/normalize.ts`
- `package.json`

## 3. PRDs consultados

- PRD-01 define a V1 como ferramenta interna, sem backend/persistência/login, com processamento em memória e matching entre GRL053 e relatório complementar.
- PRD-02 define importação determinística, formatos `.xlsx` e `.xls`, colunas fixas, falha explícita e ausência de DE/PARA.
- PRD-03 define o mapeamento fixo dos campos usados em cada relatório.
- PRD-04 define que o matching é exclusivamente por contrato cliente + nota fiscal.
- PRD-05 define que a tela deve explicar claramente erro/diagnóstico.

## 4. Caminhos de código investigados

### Upload e `accept` do input

Arquivo: `src/components/UploadScreen.tsx`.

Evidências:

- O input de arquivo usa `accept=".xlsx"`.
- Os textos da tela também orientam apenas `.xlsx`.
- Drag-and-drop não valida extensão; nesse caminho, um `.xls` pode ser recebido pelo estado do componente, mas o seletor visual do navegador tende a limitar a escolha a `.xlsx`.

Diagnóstico: a tela **não está coerente** com o PRD-02 quanto ao suporte visual/técnico a `.xls`.

### Leitura de workbook e seleção de aba

Arquivo: `src/lib/parseXlsx.ts`.

Evidências:

- A biblioteca usada é `xlsx`, importada como `XLSX`.
- O arquivo é lido via `file.arrayBuffer()` e `XLSX.read(buf, { type: "array" })`.
- A aba selecionada é sempre `wb.SheetNames[0]`.
- Não há lógica explícita para escolher aba por nome.
- Não há lógica explícita para detectar ou fixar a linha real do cabeçalho.
- A conversão usa `XLSX.utils.sheet_to_json(ws, { defval: "", raw: true })` sem `range` nem `header`.

Diagnóstico: o sistema lê a primeira aba e assume implicitamente que a primeira linha do intervalo usado é o cabeçalho.

### Validação de colunas obrigatórias e mensagens

Arquivos: `src/lib/parseXlsx.ts` e `src/pages/Index.tsx`.

Evidências:

- `assertColumns` valida somente as chaves do primeiro objeto retornado por `sheet_to_json`.
- Como `sheet_to_json` usa a primeira linha lida como cabeçalho, se a linha de cabeçalho real estiver abaixo, a validação olha para títulos/linhas superiores, não para o cabeçalho real.
- A mensagem atual lista apenas as colunas ausentes, sem informar aba, linha usada como cabeçalho ou colunas encontradas.
- `Index.tsx` valida as colunas antes de `parseBase`, `parseComp` e `match`.

Diagnóstico: o erro ocorre **na importação**, antes da normalização e do matching.

### Importadores e layouts específicos

Não foram encontrados importadores dedicados como `importador-base-grl053.ts`, `importador-inpasa.ts` ou arquivos `layouts/base-grl053.ts`/`layouts/complementar-inpasa.ts`.

A implementação atual concentra:

- leitura genérica em `src/lib/parseXlsx.ts`;
- validação de colunas no `Index.tsx`;
- mapeamento/normalização em `src/lib/match.ts` e `src/lib/normalize.ts`.

## 5. Abas encontradas em cada Excel

### GRL053 — `BASE GRL053 ANO 2025.xlsx`

Abas encontradas:

1. `Plan1`

A aba que o sistema lê hoje é `Plan1`, porque ela é a primeira aba (`wb.SheetNames[0]`). Como só há uma aba, ela parece ser a aba correta para este arquivo de referência.

### Inpasa — `Complementar Inpasa - Todas Empresas 2025.xls`

Abas encontradas:

1. `Relatório de Entrada`

A aba que o sistema lê hoje é `Relatório de Entrada`, porque ela é a primeira aba. Como só há uma aba, ela parece ser a aba correta para este arquivo de referência.

## 6. Cabeçalhos reais encontrados em cada arquivo

### GRL053 — cabeçalho real provável na linha 3

Cabeçalhos reais lidos do arquivo, preservando acentos, espaços internos e pontuação:

| Coluna Excel | Cabeçalho |
|---:|---|
| A | `ITEM` |
| B | `EMPRESA` |
| C | `CLIFOR` |
| D | `CONTRATO` |
| E | `TRANSP.` |
| F | `PLACA` |
| G | `ROMANEIO` |
| H | `ROMANEIO MB` |
| I | `DATA ROMANEIO` |
| J | `HORA` |
| K | `EMPR` |
| L | `MOD` |
| M | `NOTA` |
| N | `CHAVE DE ACESSO` |
| O | `DATA LANÇAMENTO` |
| P | `DATA EMISSÃO` |
| Q | `BRUTO` |
| R | `ORIGEM` |
| S | `CHAVE DE ACESSO NF EXPORTAÇÃO` |
| T | `NF DE EXPORTAÇÃO` |
| U | `TRANSGENIC` |
| V | `(%)CLASSIFICA` |
| W | `MÉDIA POND. CLASSIFICA` |
| X | `PESO DESC. CLASSIFICA` |
| Y | `VALOR BRUTO` |
| Z | `NOTA` |
| AA | `MERC` |
| AB | `ORIG/DESC` |
| AC | `APOS DESC` |
| AD | `TARIFA EMPRESA` |
| AE | `TARIFA AGENCIADA` |
| AF | `TOTAL FRETE SOBRE TARIFA AGENCIADA` |
| AG | `TIPO VEICULO` |
| AH | `I.E.` |
| AI | `TIPO DE FRETE` |
| AJ | `CONTR. CLIENTE` |
| AK | `OBSERVAÇÃO NF` |
| AL | `CÓDIGO ROTA` |
| AM | `NR. BOLETA/CONTRATO BMF` |
| AN | `CLIFOR TERMINAL` |
| AO | `CIDADE ORIGEM` |
| AP | `CIDADE DESTINO` |
| AQ | `LOCAL ENTREGA` |
| AR | `LOCAL RETIRADA` |
| AS | `CNPJ/CPF EMBARQUE` |
| AT | `TIPO DE CONTRATO` |
| AU | `DESC. TIPO CONTRATO` |
| AV | `PROGRAMA NF` |

Observação importante: há duas colunas chamadas `NOTA` no GRL053, nas colunas M e Z. O código atual busca `NOTA` por nome e tende a pegar a primeira chave equivalente. Isso não é a causa do erro de cabeçalho, mas é um risco de ambiguidade para a próxima correção.

### Inpasa — cabeçalho real provável na linha 2

Cabeçalhos reais lidos do arquivo, preservando acentos, espaços internos e pontuação:

| Coluna Excel | Cabeçalho |
|---:|---|
| A | `Safra` |
| B | `Desc. Tipo Frete` |
| C | `Cód. Entrada` |
| D | `Rateado` |
| E | `Placa` |
| F | `Data Chegada` |
| G | `Hora Chegada` |
| H | `Data Saída` |
| I | `Hora Saída` |
| J | `Id Contrato` |
| K | `Nr Contr Original` |
| L | `I.E Fornecedor` |
| M | `CNPJ/CPF Fornecedor` |
| N | `Nome Fornecedor` |
| O | `CFOP` |
| P | `Número NF` |
| Q | `NF Escriturada` |
| R | `Quantidade NF` |
| S | `Cubagem` |
| T | `Valor NF` |
| U | `Peso Bruto` |
| V | `Tara` |
| W | `Peso Líquido` |
| X | `Total Desconto` |
| Y | `Total Líquido` |
| AC | `Valor` |
| AD | `Perc Desconto` |
| AE | `Valor Desconto` |
| AI | `Valor` |
| AJ | `Perc Desconto` |
| AK | `Valor Desconto` |
| AL | `Valor` |
| AM | `Perc Desconto` |
| AN | `Valor Desconto` |
| AR | `Valor` |
| AS | `Perc Desconto` |
| AT | `Valor Desconto` |
| AU | `Valor` |
| AV | `Perc Desconto` |
| AW | `Valor Desconto` |
| BA | `Valor` |
| BB | `Perc Desconto` |
| BC | `Valor Desconto` |
| BD | `Valor` |
| BE | `Perc Desconto` |
| BF | `Valor Desconto` |
| BJ | `Valor` |
| BK | `Perc Desconto` |
| BL | `Valor Desconto` |
| BP | `Valor` |
| BQ | `Perc Desconto` |
| BR | `Valor Desconto` |
| BV | `Valor` |
| BW | `Perc Desconto` |
| BX | `Valor Desconto` |
| CB | `Valor` |
| CC | `Perc Desconto` |
| CD | `Valor Desconto` |
| CH | `Valor` |
| CI | `Perc Desconto` |
| CJ | `Valor Desconto` |
| CW | `Valor` |

As colunas obrigatórias do PRD/código (`Placa`, `Número NF`, `Nr Contr Original`, `Total Líquido`) existem exatamente na linha 2.

## 7. Linha provável do cabeçalho em cada arquivo

| Arquivo | Aba | Linha provável do cabeçalho | Há linhas acima? | Observação |
|---|---|---:|---|---|
| `BASE GRL053 ANO 2025.xlsx` | `Plan1` | 3 | Sim | Linha 1 tem título/data-hora; linha 2 tem período. |
| `Complementar Inpasa - Todas Empresas 2025.xls` | `Relatório de Entrada` | 2 | Sim | Linha 1 tem títulos de grupos como `3-Umidade (%)`, `560-Umidade (%)`, etc. |

Não foram identificadas células mescladas nas primeiras linhas inspecionadas pelos metadados de mesclagem lidos. O deslocamento é causado por títulos/linhas acima do cabeçalho, não por merges.

## 8. Colunas esperadas pelo código

### Validação rígida em `Index.tsx`

GRL053:

- `PLACA`
- `CONTRATO`
- `NOTA`
- `CONTR. CLIENTE`
- `APOS DESC`

Inpasa:

- `Placa`
- `Número NF`
- `Nr Contr Original`
- `Total Líquido`

### Mapeamento posterior em `match.ts`

Após a validação, o código aceita alguns aliases na etapa de extração, por exemplo:

- `CONTR. CLIENTE`, `CONTR CLIENTE`, `CONTRATO CLIENTE`
- `APOS DESC`, `APÓS DESC`
- `Número NF`, `Numero NF`, `Nº NF`, `Nr NF`
- `Nr Contr Original`, `Nro Contr Original`, `Numero Contr Original`
- `Total Líquido`, `Total Liquido`

Essa aceitação de aliases ocorre **depois** da validação rígida inicial. Portanto, ela não evita o erro atual de importação.

## 9. Colunas esperadas pelos PRDs

### PRD-02

GRL053:

- `PLACA`
- `CONTRATO`
- `NOTA`
- `CONTR. CLIENTE`
- `APOS DESC`

Inpasa:

- `Placa`
- `Número NF`
- `Nr Contr Original`
- `Total Líquido`

### PRD-03 / PRD-04

GRL053 usado no vínculo e informações:

- `PLACA`
- `CONTRATO`
- `DATA ROMANEIO`
- `NOTA`
- `APOS DESC`
- `CONTR. CLIENTE`
- `OBSERVAÇÃO NF`

Inpasa usado no vínculo e informações:

- `Placa`
- `Número NF`
- `Nr Contr Original`
- `Total Líquido`

## 10. Comparação entre PRD x código x arquivo real

| Item | PRD | Código atual | Arquivo real | Diagnóstico |
|---|---|---|---|---|
| Formatos | `.xlsx` e `.xls` | Parser `xlsx` tende a suportar ambos, mas input aceita só `.xlsx` | Base `.xlsx`; Inpasa `.xls` | Divergência na tela. |
| Aba | Não estava totalmente explícito antes desta análise | Sempre primeira aba | Ambos têm uma aba | Não causa o erro atual, mas precisa ficar explícito. |
| Linha de cabeçalho GRL053 | Colunas fixas, sem detalhar linha | Primeira linha do intervalo usado | Linha 3 | Causa direta para GRL053. |
| Linha de cabeçalho Inpasa | Colunas fixas, sem detalhar linha | Primeira linha do intervalo usado | Linha 2 | Causa direta para Inpasa. |
| Colunas obrigatórias GRL053 | Batem com layout | Batem com PRD na validação | Existem na linha 3 | Código valida a linha errada. |
| Colunas obrigatórias Inpasa | Batem com layout | Batem com PRD na validação | Existem na linha 2 | Código valida a linha errada. |
| Matching | Contrato cliente + nota | Contrato cliente + nota | Não analisado em massa | Não é o ponto de falha deste erro. |

## 11. Causa provável do erro

A causa provável é a combinação de três fatores:

1. `sheet_to_json` está sendo chamado sem `range`/linha de cabeçalho explícita.
2. Os arquivos reais têm linhas/títulos acima do cabeçalho operacional.
3. `assertColumns` valida as chaves derivadas da primeira linha lida, não da linha real de cabeçalho.

Em termos práticos:

- No GRL053, a validação compara `PLACA`, `CONTRATO`, `NOTA`, `CONTR. CLIENTE`, `APOS DESC` contra cabeçalhos derivados de `GRL053 - MOVIMENTACAO...` e `DATA / Hora..: 08/05/2026 09:08`.
- No Inpasa, a validação compara `Placa`, `Número NF`, `Nr Contr Original`, `Total Líquido` contra cabeçalhos derivados de `3-Umidade (%)`, `560-Umidade (%)`, etc.

Portanto, o sistema diz que a coluna não existe porque está olhando para a linha errada.

## 12. Riscos identificados

1. **Input limitado a `.xlsx`:** o usuário pode não conseguir selecionar o `.xls` pelo seletor de arquivos, apesar de o PRD exigir `.xls`.
2. **Ausência de validação explícita de extensão:** o código não bloqueia nem comunica claramente arquivos fora de `.xlsx`/`.xls`.
3. **Cabeçalho implícito:** qualquer título acima do cabeçalho quebra a importação.
4. **Mensagem de erro incompleta:** não informa aba, linha usada como cabeçalho nem colunas encontradas.
5. **Ambiguidade de coluna duplicada `NOTA` no GRL053:** há duas colunas com o mesmo nome na linha real do cabeçalho. A próxima correção precisa confirmar se a coluna M é a nota fiscal esperada pelo matching ou se a coluna Z tem outro significado.
6. **Aliases no código vs PRD:** o PRD fala em nomes fixos/exatos, mas `parseBase`/`parseComp` aceitam variações técnicas. Isso não causou o erro atual, mas deve ser tratado com cuidado para não virar DE/PARA dinâmico.
7. **Dependência `xlsx`:** a dependência está declarada no `package.json` e é uma biblioteca compatível com `.xls`/`.xlsx`, mas o ambiente local estava sem `node_modules`; portanto, a análise do `.xls` foi feita com script temporário próprio de leitura BIFF/OLE para metadados/cabeçalhos, sem executar o app completo.

## 13. Recomendação objetiva

Próximo passo seguro antes de implementar correção definitiva:

1. Manter layout fixo e determinístico, sem DE/PARA e sem fuzzy match.
2. Ajustar o importador para usar linha de cabeçalho fixa por tipo de relatório:
   - GRL053: primeira aba, cabeçalho na linha 3, validando que os nomes esperados existem nessa linha.
   - Inpasa: primeira aba, cabeçalho na linha 2, validando que os nomes esperados existem nessa linha.
3. Ajustar o input/UX para aceitar e comunicar `.xlsx` e `.xls`.
4. Melhorar a mensagem de erro de importação para incluir:
   - tipo do relatório;
   - aba lida;
   - linha usada como cabeçalho;
   - colunas obrigatórias ausentes;
   - colunas encontradas naquela linha.
5. Não alterar a regra de matching nesta correção.
6. Antes de usar a coluna `NOTA` do GRL053 no matching, confirmar a ambiguidade das duas colunas `NOTA` no arquivo real.

## 14. Precisa alterar código agora ou apenas PRD/README?

Nesta tarefa, a recomendação foi **não implementar a correção definitiva do importador ainda**, conforme solicitado. Foram aplicados apenas ajustes documentais mínimos para deixar explícitas as decisões determinísticas da V1.

O `README.md` existia e estava coerente com a visão geral da V1, mas não deixava explícitos os formatos `.xlsx`/`.xls`, a localização dos arquivos de teste e a relação operacional com os PRDs. Por isso, foi recomendado e aplicado um complemento curto no README, sem alterar arquitetura ou fluxo da aplicação.

Para resolver o bug em produção, será necessário alterar código em uma próxima etapa, principalmente em:

- `src/lib/parseXlsx.ts` para permitir leitura com linha fixa de cabeçalho e diagnóstico de aba/linha/colunas encontradas;
- `src/pages/Index.tsx` para chamar o parser conforme o tipo de relatório;
- `src/components/UploadScreen.tsx` para aceitar/comunicar `.xlsx` e `.xls`.

## 15. Respostas às perguntas obrigatórias

1. **O sistema atual aceita de fato `.xls` e `.xlsx`?** Parcialmente. A biblioteca declarada (`xlsx`) é adequada para ambos, mas a tela limita o seletor a `.xlsx` e não há validação explícita de extensão.
2. **O input da tela permite selecionar `.xls`?** Pelo seletor, não: `accept=".xlsx"`. Por drag-and-drop, pode entrar, porque não há validação no `onDrop`.
3. **A biblioteca/parser consegue ler `.xls`?** A dependência `xlsx` é uma biblioteca usada justamente para formatos Excel, incluindo `.xls` BIFF/OLE e `.xlsx` OpenXML. A análise local confirmou que o `.xls` real é BIFF/OLE válido, mas não executou o app por ausência de dependências instaladas.
4. **O `.xls` complementar está sendo lido com a mesma lógica do `.xlsx`?** Sim: ambos passam por `readXlsx` e `sheet_to_json` na primeira aba.
5. **Quais abas existem?** GRL053: `Plan1`; Inpasa: `Relatório de Entrada`.
6. **Qual aba o sistema lê hoje?** Sempre a primeira aba.
7. **A aba correta é a primeira?** Nos arquivos reais analisados, sim, pois só há uma aba em cada arquivo.
8. **Em qual linha estão os cabeçalhos reais?** GRL053: linha 3; Inpasa: linha 2.
9. **Os cabeçalhos estão na primeira linha?** Não em nenhum dos dois arquivos.
10. **Existem células mescladas, linhas vazias, títulos acima ou filtros?** Foram encontrados títulos/linhas acima; não foram identificadas células mescladas nas primeiras linhas inspecionadas.
11. **Quais nomes o parser lê?** O parser atual usa a primeira linha como cabeçalho: no GRL053, títulos como `GRL053 - MOVIMENTACAO...`; no Inpasa, grupos como `3-Umidade (%)`. Os cabeçalhos reais estão listados nas seções 6 e 7.
12. **Quais colunas o código espera para GRL053?** `PLACA`, `CONTRATO`, `NOTA`, `CONTR. CLIENTE`, `APOS DESC`.
13. **Quais colunas o código espera para Inpasa?** `Placa`, `Número NF`, `Nr Contr Original`, `Total Líquido`.
14. **Há divergência entre PRD, código e arquivo real?** As colunas existem e batem; a divergência está na linha de cabeçalho e no input `.xls`.
15. **O erro está no arquivo, PRD, código ou parser?** Principalmente no código de validação/leitura. O PRD estava ambíguo sobre linha/aba e foi ajustado. O parser segue seu comportamento padrão.
16. **É espaço, caixa, acento, quebra de linha ou invisível?** Não foi identificada essa causa nas colunas obrigatórias. O problema é a linha errada. Há valores de dados com `NBSP` no GRL053, mas não nos cabeçalhos obrigatórios reais.
17. **O sistema valida nome exibido ou transformado?** Valida chaves geradas por `sheet_to_json`, normalizadas apenas por trim, compactação de espaços e lowercase.
18. **A validação está rígida demais para o PRD?** Não no nome em si; ela está aplicada na linha errada. A mensagem também é pouco diagnóstica.
19. **Há diferença entre visual e retorno da biblioteca?** Sim: visualmente o usuário enxerga a linha de cabeçalho, mas a biblioteca retorna como cabeçalho a primeira linha do intervalo usado se `range` não for definido.
20. **O erro ocorre antes da conferência ou durante normalização/matching?** Antes da conferência, em `assertColumns`.

## 16. Questionário para validação com o usuário

Estas perguntas precisam ser validadas antes da correção de código definitiva:

1. Para o GRL053, a aba oficial será sempre a primeira aba (`Plan1`) ou pode haver outro nome/ordem em arquivos futuros?
2. Para o Inpasa, a aba oficial será sempre a primeira aba (`Relatório de Entrada`) ou pode haver outro nome/ordem em arquivos futuros?
3. A linha do cabeçalho do GRL053 é sempre a linha 3 nos arquivos reais oficiais?
4. A linha do cabeçalho do Inpasa é sempre a linha 2 nos arquivos reais oficiais?
5. O GRL053 real sempre terá os mesmos cabeçalhos da linha 3 listada nesta análise?
6. O Inpasa real sempre terá os mesmos cabeçalhos da linha 2 listada nesta análise?
7. No GRL053 há duas colunas chamadas `NOTA` (M e Z). A nota fiscal usada no matching deve ser a primeira `NOTA` da linha 3, na coluna M?
8. O sistema pode aceitar pequenas diferenças técnicas de cabeçalho, como espaços extras e diferença de caixa, como já faz hoje, ou deve exigir igualdade literal absoluta?
9. O `.xls` da Inpasa deve ser suportado obrigatoriamente na V1 sem conversão prévia para `.xlsx`?

## 17. Script temporário de diagnóstico

Para evitar processamento completo/matching, foi usado um script temporário em `/tmp/inspect_excel.py` que:

- listou abas;
- leu metadados básicos;
- inspecionou apenas as primeiras 50 linhas;
- extraiu cabeçalhos prováveis;
- leu `.xlsx` via XML/ZIP;
- leu `.xls` via OLE/BIFF mínimo apenas para metadados/células iniciais.

Esse script não foi adicionado ao repositório e não altera o comportamento da aplicação.

# Análise 8 — Cliente select e empresa automática

## Diagnóstico

A tela inicial de importação ainda tratava o cliente como texto livre, embora a V1 aceite somente o layout complementar Inpasa. Isso permitia digitação inconsistente do cliente sem alterar o layout real usado pelo processamento.

O campo Empresa também dependia de digitação manual, apesar de o GRL053 conter a coluna informativa `EMPRESA` no cabeçalho fixo do relatório.

## Decisão adotada para cliente/layout

Foi criada uma lista fixa no código para layouts suportados, sem cadastro dinâmico e sem configuração pelo usuário.

Na V1, a lista contém somente:

- `Inpasa`

O cliente padrão é `Inpasa`, pré-selecionado no select da tela de upload. O layout complementar continua determinístico, com cabeçalho na linha 2 e as colunas obrigatórias atuais:

- `Placa`
- `Número NF`
- `Nr Contr Original`
- `Total Líquido`

A estrutura permite adicionar FS, Cargill ou Bunge futuramente apenas mediante novo layout fixo homologado no código.

## Como a empresa foi detectada no GRL053

Ao selecionar o arquivo base GRL053, a tela tenta ler o arquivo com o layout fixo do GRL053 e localizar a coluna `EMPRESA`.

A regra aplicada foi:

1. Considerar preferencialmente linhas válidas para análise (`MOD = EXP`).
2. Buscar o primeiro valor não vazio de `EMPRESA`.
3. Normalizar apenas para exibição, convertendo para texto, removendo espaços extras e removendo prefixo numérico simples como `1 - `.
4. Preencher o campo Empresa automaticamente quando houver valor detectado.
5. Manter o campo editável para correção manual.

Se houver múltiplas empresas diferentes, a V1 preenche a primeira empresa detectada e mostra aviso discreto para o usuário conferir o valor antes de continuar.

A coluna `EMPRESA` permanece informativa e não participa da chave de matching.

## Arquivos alterados

- `src/components/UploadScreen.tsx`
- `src/pages/Index.tsx`
- `src/lib/layouts.ts`
- `src/lib/match.ts`
- `src/test/match.test.ts`
- `README.md`
- `docs/PRD/PRD-02 — Importação de Relatórios (V1).txt`
- `docs/PRD/PRD-03 — Mapeamento Fixo de Colunas (V1).txt`
- `docs/Analises/analise-8-cliente-select-e-empresa-automatica.md`

## Critérios de validação

- Cliente deixa de ser input manual e passa a ser select.
- `Inpasa` vem pré-selecionado.
- Layout Inpasa continua com as mesmas colunas obrigatórias e cabeçalho fixo na linha 2.
- A empresa é capturada da coluna `EMPRESA` do GRL053 quando possível.
- Prefixo numérico simples é removido apenas para exibição.
- Sem empresa detectável, o campo continua manual.
- Com múltiplas empresas, o usuário recebe aviso discreto.
- Matching continua usando somente `CONTR. CLIENTE + NOTA` contra `Nr Contr Original + Número NF`.
- `MOD = EXP` continua sendo aplicado antes do matching.
- `EMPRESA` não entra na chave de matching.

## Riscos ou dúvidas encontradas

- A leitura antecipada do GRL053 na tela de upload é usada apenas para preenchimento assistido da empresa. A validação final continua acontecendo ao clicar em Conferir.
- A remoção de prefixo numérico simples (`1 - `) é uma normalização visual; se o arquivo trouxer outro padrão de identificação, o usuário pode editar manualmente.
- A V1 não resolve conflitos de múltiplas empresas com uma tela específica; apenas avisa e mantém edição manual.

# Análise 7 — Chave de acesso do GRL053 no drawer

## 1. Resumo da alteração aplicada

Foi adicionada a leitura da chave de acesso da NF-e (`chNFe`) do relatório base GRL053 e sua exibição no drawer de detalhe da tela de conferência. A informação é apenas informativa para conferência manual, busca no Excel original e investigação de inconsistências.

## 2. Arquivos alterados

- `src/lib/match.ts`
- `src/components/ResultsScreen.tsx`
- `src/test/match.test.ts`
- `docs/PRD/PRD-03 — Mapeamento Fixo de Colunas (V1).txt`
- `docs/Analises/analise-7-chave-acesso-grl053-drawer.md`

## 3. Como a chave de acesso foi lida do GRL053

O campo interno `chaveAcesso: string` foi adicionado à estrutura `BaseRow`.

A leitura reutiliza o padrão já existente do projeto, baseado em `getCol`, procurando o cabeçalho `CHAVE DE ACESSO` no objeto gerado pelo SheetJS. Conforme análise anterior do layout real do GRL053, esse cabeçalho corresponde à coluna N.

A chave é convertida para texto e recebe apenas `trim()` para remover espaços nas extremidades, sem normalizações de matching.

## 4. Onde ela aparece no drawer

A chave aparece no corpo do drawer, na seção `Base — GRL053`, com o label:

```text
Chave de acesso (GRL053)
```

Quando o valor está vazio, a UI exibe:

```text
—
```

## 5. Botão de copiar

Foi adicionado um botão discreto com ícone de copiar ao lado da chave quando existe valor disponível.

O botão usa o padrão visual existente de `Button` com variante `ghost` e ícone `Copy` da biblioteca já utilizada (`lucide-react`). Ao copiar com sucesso, é exibido feedback simples usando o toast já existente no projeto.

Tooltip/label acessível usado:

```text
Copiar chave de acesso
```

## 6. Confirmação de que a chave de acesso não participa do matching

A chave de acesso não foi incluída em nenhuma chave operacional de vínculo.

O matching continua baseado exclusivamente em:

```text
GRL053: CONTR. CLIENTE + NOTA
Complementar: Nr Contr Original + Número NF
```

A função `match` não passou a consultar `base.chaveAcesso` para localizar registros, status, divergências, duplicidades ou vínculo OK.

## 7. Confirmação de que KPIs e status não foram alterados

A lógica de status e KPI não foi alterada.

A função `computeKpis` permaneceu baseada apenas nos status já existentes e no alerta de placa divergente. A chave de acesso é apenas um dado adicional carregado na linha base e apresentado no detalhe.

## 8. PRDs alterados

Foram feitas atualizações mínimas:

- `PRD-03`: documenta que `CHAVE DE ACESSO` é o campo informativo `chave_acesso`, referente ao `chNFe`, na coluna N do GRL053, sem participação no matching da V1.

O `PRD-05` não foi alterado para manter a documentação mínima e evitar reformatar um arquivo inteiro com final de linha diferente; o comportamento do drawer ficou registrado neste Markdown obrigatório.

## 9. Testes/checks realizados

- `npm test`: não executou porque as dependências não estavam instaladas no ambiente (`vitest: not found`).
- `npm ci`: não conseguiu instalar dependências porque o registry retornou `403 Forbidden` ao baixar `@testing-library/jest-dom`.
- `npm run lint`: não executou porque as dependências não estavam instaladas (`@eslint/js` ausente).
- `npm run build`: não executou porque as dependências não estavam instaladas (`vite: not found`).

Foi adicionado teste unitário cobrindo a leitura de `CHAVE DE ACESSO` pelo `parseBase`, mas a execução ficou bloqueada pela limitação de dependências do ambiente.

## 10. Riscos restantes

- Se a chave de acesso vier do Excel como número em vez de texto, o SheetJS pode entregar o valor já convertido pelo JavaScript antes do `trim()`. O layout esperado normalmente trata chaves longas como texto, mas vale validar com um arquivo real.
- A exportação Excel/PDF não foi alterada nesta etapa, conforme escopo. Pode fazer sentido avaliar futuramente a inclusão da chave também nos arquivos exportados.
- A coluna foi lida por cabeçalho (`CHAVE DE ACESSO`) seguindo o padrão existente. Se o cabeçalho variar em arquivos futuros, o campo pode aparecer vazio no drawer sem quebrar a importação.

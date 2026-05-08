# Contract Matcher

## 1. Visão Geral

Contract Matcher é uma ferramenta interna para conferência operacional de contratos entre a cooperativa e seus clientes.

O objetivo é validar se aquilo que a cooperativa faturou no relatório base **GRL053** está refletido corretamente no relatório complementar do cliente, começando pela Inpasa na V1.

A pergunta que o sistema responde é:

```text
O cliente está embarcando a mercadoria no mesmo contrato cliente e na mesma nota fiscal que a cooperativa faturou?
```

A aplicação funciona como uma “planilha avançada”: simples, local, determinística e explicável.

---

## 2. Fluxo da Aplicação

```text
Importar Base
→ Importar Complementar
→ Processar Matching
→ Exibir Conferência
→ Exportar
```

1. O usuário importa o relatório base GRL053; a empresa/cooperativa pode ser identificada automaticamente pela coluna informativa `EMPRESA` e continua editável.
2. O importador do GRL053 considera somente linhas com `MOD = EXP`; demais modalidades são ignoradas antes do matching.
3. O usuário importa o relatório complementar e seleciona o cliente em uma lista fixa de layouts suportados; na V1, apenas `Inpasa` está disponível e pré-selecionado.
4. O sistema normaliza os campos necessários e cruza os registros analisados em memória.
5. A tela de conferência exibe status, detalhe, filtros, KPIs e dados informativos.
6. O usuário exporta o resultado para Excel/PDF.

---

## 3. Relatórios suportados na V1

A V1 suporta apenas os layouts fixos documentados nos PRDs:

- Relatório Base — GRL053, em `.xlsx` ou `.xls`, com coluna obrigatória `MOD` para filtrar apenas expedições (`EXP`).
- Relatório Complementar — Inpasa, em `.xlsx` ou `.xls`, selecionado por lista fixa de clientes/layouts suportados.

A importação é determinística: não existe DE/PARA, configuração de colunas, cadastro de clientes, fuzzy match ou tentativa inteligente de localizar layouts alternativos. Se a estrutura não bater com o layout esperado, o sistema deve bloquear a importação e informar quais colunas não foram encontradas, incluindo a aba e a linha de cabeçalho validadas quando possível.

Arquivos reais de teste ficam em `docs/XLS de Teste Import/`. A fonte de verdade funcional fica em `docs/PRD/`.

## 4. Regras Críticas

A chave única de vínculo da V1 é:

```text
Base GRL053:
CONTR. CLIENTE + NOTA

Complementar Inpasa:
Nr Contr Original + Número NF
```

Regras obrigatórias:

- **Somente `MOD = EXP` no GRL053 entra na análise.** Outras modalidades são ignoradas antes do matching e não geram “Base inválida”.
- **Placa não faz parte do vínculo.** Ela pode gerar alerta visual, mas nunca define match.
- **Peso não gera erro.** Peso fiscal e peso físico são apenas informativos e não devem ser comparados como divergência operacional.
- **O sistema é determinístico.** O mesmo arquivo de entrada deve produzir o mesmo resultado sempre.
- **Não há heurísticas.** O sistema não tenta “achar parecido”.
- **Não há fuzzy match.** Contrato e nota precisam bater após a normalização definida nos PRDs.
- **Não há IA.** Nenhuma decisão de matching depende de modelo, probabilidade ou inferência.
- **Não há correção automática.** Se o arquivo estiver errado, o usuário deve corrigir na origem.

Status esperados na conferência:

- Vínculo OK
- Contrato não encontrado
- Nota não encontrada
- Nota vinculada a outro contrato
- Contrato vinculado a outra nota
- Duplicidade

---

## 5. Arquitetura da V1

A V1 prioriza simplicidade operacional:

- Tudo é processado **em memória** no frontend.
- Não existe backend de aplicação.
- Não existe banco de dados.
- Não existe persistência.
- Não existe login, senha ou controle de acesso.
- Ao atualizar a página, os dados carregados são perdidos.
- A reimportação não cria histórico nem persistência; o comportamento operacional detalhado deve seguir a decisão registrada nos PRDs/análises.

A implementação atual usa React + Vite + TypeScript, com componentes de UI no padrão shadcn/Radix e Tailwind CSS.

---

## 6. Estrutura de Pastas

A estrutura oficial de documentação usa sempre `docs` em minúsculo.

```text
/docs
  /PRD
  /Analises
/src
  /components
  /lib
  /pages
  /test
/public
```

Pastas principais:

- `docs/PRD`: PRDs da V1, fonte de verdade do produto.
- `docs/Analises`: análises críticas e questionários de decisão.
- `src/components`: telas e componentes da aplicação.
- `src/lib`: funções de parsing, normalização, matching e exportação.
- `src/pages`: páginas roteadas pelo React Router.
- `src/test`: configuração e testes automatizados.

---

## 7. Estrutura Técnica Simplificada

Responsabilidades esperadas para futuras evoluções:

```text
/src/lib/importadores
→ parsing e validação dos arquivos

/src/lib/normalizacao
→ normalização de contrato e nota

/src/lib/matching
→ motor determinístico de conferência

/src/lib/exportadores
→ Excel/PDF

/src/components
→ UI reutilizável

/src/pages
→ telas principais
```

Essa divisão é uma referência de responsabilidade, não uma autorização para criar abstrações desnecessárias. A implementação deve continuar simples, direta e alinhada ao padrão existente do projeto.

---

## 8. Decisões Consolidadas da V1

Estas decisões devem ser preservadas para evitar regressões futuras:

- Matching usa **somente** contrato cliente + nota fiscal.
- Placa nunca altera o status principal.
- Peso nunca gera erro.
- Sem fuzzy match.
- Sem IA.
- Sem heurística.
- Sem DE/PARA.
- Sem múltiplos layouts.
- Sem persistência.
- Sem backend.
- Sem banco de dados.
- Sem histórico.
- Sem auto correção de dados.
- Layout fixo e determinístico.
- GRL053 filtrado por `MOD = EXP` antes do matching.
- Cliente complementar escolhido por lista fixa de layouts; na V1, apenas Inpasa.
- `EMPRESA` do GRL053 é usada apenas para contexto visual da análise, não para matching.

---

## 9. Limitações Conhecidas da V1

As limitações abaixo são comportamento esperado da V1, não bug:

- Atualizar a página perde toda a análise.
- Fechar a aba perde toda a análise.
- Não existe recuperação automática.
- Não existe salvamento local.
- Não existe sincronização.

---

## 10. Filosofia de Implementação

O projeto prioriza:

- previsibilidade
- explicabilidade
- simplicidade
- rastreabilidade
- confiança operacional

A V1 **não tenta ser inteligente**. Ela tenta ser confiável.

Toda alteração deve favorecer comportamento fixo, determinístico e explicável. Se uma regra permitir múltiplas interpretações, a decisão deve ser documentada antes da implementação.

A V1 deve permanecer:

```text
Simples
Determinística
Explicável
Confiável
```

---

## Como rodar localmente

Pré-requisito: Node.js compatível com o projeto.

```bash
npm install
npm run dev
```

Comandos úteis:

```bash
npm run build
npm run lint
npm run test
```

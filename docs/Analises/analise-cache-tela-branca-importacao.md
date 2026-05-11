# Análise — Cache/tela branca após importação do relatório complementar

## 1. Resumo do problema

Usuários relatam que, no navegador comum, o sistema abre normalmente, permite importar o relatório base e fica com tela branca ao tentar importar o relatório complementar. O mesmo fluxo funciona em guia anônima.

Esse contraste entre janela comum e anônima sugere, operacionalmente, algum fator persistido no navegador comum. Porém, a análise do código atual não encontrou Service Worker/PWA, `localStorage`, `sessionStorage`, Zustand persist ou Redux persist no projeto. Assim, a causa mais provável não é um estado de domínio persistido pelo próprio app, mas sim um erro JavaScript não tratado durante renderização/transição após o processamento do complementar, potencialmente agravado por cache HTTP/CDN do deploy ou por uma versão antiga do bundle ainda carregada no navegador.

A evidência mais relevante é que o fluxo de importação captura erros assíncronos de leitura/parsing/matching, mas o app não possui ErrorBoundary global para capturar exceções de renderização. Em React, uma exceção fora do `try/catch` do submit pode desmontar a árvore e resultar em tela branca.

## 2. Hipóteses investigadas

### 2.1 Cache antigo de PWA/Service Worker

**Resultado:** não confirmado pelo código do repositório.

Foram procurados registros de Service Worker, PWA, Workbox, manifest e plugins PWA. Não há configuração PWA no `vite.config.ts`, não há dependência `vite-plugin-pwa`/`workbox` no `package.json`, não há chamada `navigator.serviceWorker.register`, e `index.html` não referencia manifest.

### 2.2 Arquivos JS/CSS servidos de cache antigo após deploy

**Resultado:** possível apenas fora do código-fonte, dependente do ambiente de hospedagem.

O projeto usa Vite/React. Em build de produção, Vite normalmente gera assets versionados por hash, o que reduz risco de JS/CSS antigo quando `index.html` não fica cacheado indevidamente. Porém, o repositório não contém configuração de headers/cache do provedor de hospedagem. Portanto, não é possível comprovar pelo código se `index.html` ou assets estão sendo servidos com política incorreta de cache.

### 2.3 `localStorage`/`sessionStorage` incompatível

**Resultado:** não confirmado pelo código atual.

Não foram encontradas chamadas a `localStorage` ou `sessionStorage` em `src`, `public`, `index.html`, `package.json` ou `vite.config.ts`. O estado de importação é mantido em `useState` dentro da sessão React, sem persistência explícita no navegador.

### 2.4 Zustand persist, Redux persist ou estado persistido

**Resultado:** não confirmado pelo código atual.

Não há dependências Zustand, Redux ou Redux Persist no `package.json`, e não há uso de `persist`, `createJSONStorage` ou padrões equivalentes nos arquivos analisados.

### 2.5 Erro JavaScript não tratado

**Resultado:** hipótese forte.

O `handleSubmit` envolve leitura, parsing, matching e `setResults` em `try/catch`, então erros dessas etapas tendem a aparecer no bloco de erro da tela de upload. Porém, depois que `results` é preenchido, `Index` troca para `ResultsScreen`. Erros de renderização dentro de `ResultsScreen` não são capturados por esse `try/catch` e não há ErrorBoundary global no app.

### 2.6 Ausência de ErrorBoundary

**Resultado:** confirmado.

O app monta providers, router e rotas diretamente, sem ErrorBoundary envolvendo a árvore. Também não foram encontrados `componentDidCatch` ou `getDerivedStateFromError`.

### 2.7 Nome do relatório base GRL053 x GRL583

**Resultado:** o sistema está padronizado como GRL053.

O código, README e PRDs tratam o relatório base como GRL053. Não foi encontrado suporte explícito a GRL583 no código-fonte. Se GRL583 for o nome operacional atual do mesmo layout, a UI/mensagens estão despadronizadas com o relato; se for um layout diferente, o sistema continuará validando como GRL053 e poderá rejeitar por colunas/cabeçalho.

## 3. Evidências encontradas no código

### 3.1 Não há PWA/Service Worker/Workbox/manifest no app

- `vite.config.ts` usa apenas `@vitejs/plugin-react-swc` e `lovable-tagger` em desenvolvimento. Não há `vite-plugin-pwa`, Workbox ou configuração de cache.
- `index.html` contém apenas o root React e o script `/src/main.tsx`; não há `<link rel="manifest">` nem registro PWA.
- `package.json` não lista dependências PWA/Workbox.
- Busca por arquivos típicos de Service Worker/manifest retornou apenas `src/components/ui/switch.tsx`, que não é relacionado a Service Worker.

### 3.2 Não há storage persistido pelo app

- Não há `localStorage`/`sessionStorage` nos arquivos de aplicação analisados.
- Não há Zustand/Redux persist no `package.json`.
- `Index` mantém `results`, `loading` e `error` em `useState` local; `UploadScreen` mantém arquivos, empresa, cliente e status também em `useState` local.
- Não existem chaves de storage definidas pelo sistema no código atual.

### 3.3 Fluxo de importação do relatório base

O fluxo começa em `UploadScreen`:

1. O usuário escolhe o arquivo base no `FilePicker`, que aceita `.xlsx` e `.xls`.
2. `handleBaseFileChange` salva o `File`, limpa status/empresa anterior e tenta ler o Excel com layout fixo `GRL053_LAYOUT`.
3. A leitura usa cabeçalho fixo e colunas obrigatórias de `GRL053_LAYOUT`.
4. `detectEmpresaFromGrl053` busca a coluna `EMPRESA`, priorizando linhas com `MOD = EXP`, e preenche a empresa quando possível.
5. Falhas nessa pré-leitura são ignoradas nessa etapa para não bloquear preenchimento manual; a validação completa ocorre no submit.

### 3.4 Identificação da empresa

A identificação automática considera linhas cujo `MOD` normalizado é `EXP`. Se houver linhas EXP, usa somente elas; caso contrário, analisa todas as linhas. O valor vem de `EMPRESA`, normalizado para remover excesso de espaços e prefixo numérico no formato `123 - Empresa`.

### 3.5 Seleção/importação do relatório complementar

- O cliente complementar vem de lista fixa (`Inpasa` e `FS`), com `Inpasa` como default.
- O arquivo complementar é guardado apenas em estado React (`compFile`) via `setCompFile`.
- No submit, o layout complementar é recuperado por `clienteId`, e `readXlsx` valida cabeçalho/colunas conforme o cliente selecionado.

### 3.6 Parsing do Excel

`readXlsx`:

1. valida extensão `.xlsx`/`.xls`;
2. lê `arrayBuffer`;
3. usa `XLSX.read` com `type: "array"`;
4. lê sempre a primeira aba;
5. valida cabeçalho na linha fixa do layout;
6. valida colunas obrigatórias;
7. converte a planilha em `RawRow[]` usando `sheet_to_json`.

Erros nessa função lançam `Error` com mensagem de cabeçalho, aba e colunas encontradas quando aplicável.

### 3.7 Parsing e matching

- `parseBaseWithStats` filtra o GRL053 para manter apenas `MOD = EXP`; linhas de outras modalidades são contadas como ignoradas.
- `parseComp` tem mapeamento separado para `FS`; caso contrário, usa layout Inpasa.
- `match` indexa complementar por contrato+nota, contrato e nota; registros complementares sem contrato/nota válidos não entram nos índices.
- Linhas inválidas da base permanecem no resultado com status `REGISTRO_BASE_INVALIDO`, em vez de quebrar a importação.

### 3.8 Transição para a tela de resultados

`Index` executa leitura dos dois arquivos em paralelo, chama parsers e matching, e então faz `setResults`. Quando `results` passa a existir, o componente deixa de renderizar `UploadScreen` e renderiza `ResultsScreen`.

Essa transição é o ponto sensível do relato: se o processamento assíncrono não lançar erro, mas a tela de resultados quebrar durante renderização, o `catch` do submit não captura o problema.

### 3.9 Ausência de ErrorBoundary global

`App` monta `QueryClientProvider`, `TooltipProvider`, toasters, `BrowserRouter` e rotas sem boundary de erro. Se `ResultsScreen` ou algum componente filho lançar exceção durante renderização, não há fallback amigável no app.

### 3.10 Pontos onde erro pode virar tela branca

Pontos mais sensíveis:

- renderização de `ResultsScreen` após `setResults`, porque fica fora do `try/catch` assíncrono do submit;
- operações em listas grandes na renderização (`filterRowsByResultsSearch`, `sortMatchedRows`, `computeKpis`) que podem expor dados inesperados ou problemas de performance;
- dependência de formatos de dados vindos do Excel em campos exibidos/formatados na tela de resultados;
- ausência de ErrorBoundary para transformar exceção de render em mensagem recuperável.

## 4. Arquivos analisados

- `package.json` — dependências e scripts; sem PWA/Workbox/Zustand/Redux persist.
- `vite.config.ts` — plugins Vite; sem PWA/cache.
- `index.html` — entrada HTML; sem manifest/service worker.
- `public/` — arquivos públicos; sem manifest/service worker.
- `src/main.tsx` — montagem do React.
- `src/App.tsx` — providers/rotas; sem ErrorBoundary.
- `src/pages/Index.tsx` — estado principal, submit, transição upload/resultados.
- `src/components/UploadScreen.tsx` — upload base/complementar, empresa e cliente.
- `src/components/ResultsScreen.tsx` — renderização de resultados, filtros, ordenação, detalhes e exportação.
- `src/lib/layouts.ts` — layouts fixos GRL053, Inpasa e FS.
- `src/lib/parseXlsx.ts` — leitura e validação de Excel.
- `src/lib/match.ts` — detecção de empresa, parsing base/complementar e matching.
- `README.md` e `docs/PRD/*` — regra funcional documentada como GRL053.

Comandos usados na investigação:

```bash
find .. -name AGENTS.md -print
find . -maxdepth 3 -type f | sed 's#^./##' | sort | head -200
rg -n "serviceWorker|service worker|navigator\.serviceWorker|workbox|manifest|PWA|vite-plugin-pwa|localStorage|sessionStorage|zustand|persist|redux-persist|create\(|ErrorBoundary|componentDidCatch|getDerivedStateFromError|GRL053|GRL583|Import|importa|xlsx|Excel|read\(" -S . --glob '!node_modules' --glob '!dist' --glob '!build'
rg -n "localStorage|sessionStorage|persist|redux-persist|zustand|createJSONStorage|serviceWorker|manifest|workbox|registerSW|vite-plugin-pwa|ErrorBoundary|componentDidCatch|getDerivedStateFromError" src public index.html package.json vite.config.ts --glob '!node_modules'
find . -path './node_modules' -prune -o -path './dist' -prune -o -type f \( -iname '*sw*' -o -iname 'manifest.*' -o -iname '*workbox*' \) -print
nl -ba package.json | sed -n '1,140p'
nl -ba vite.config.ts | sed -n '1,120p'
nl -ba index.html | sed -n '1,80p'
nl -ba src/main.tsx | sed -n '1,80p'
nl -ba src/App.tsx | sed -n '1,120p'
nl -ba src/pages/Index.tsx | sed -n '1,180p'
nl -ba src/components/UploadScreen.tsx | sed -n '1,280p'
nl -ba src/lib/layouts.ts | sed -n '1,220p'
nl -ba src/lib/parseXlsx.ts | sed -n '1,220p'
nl -ba src/lib/match.ts | sed -n '1,360p'
nl -ba src/components/ResultsScreen.tsx | sed -n '1,760p'
```

## 5. Causa mais provável

A causa mais provável, com base apenas no código, é:

> erro JavaScript de renderização ou transição para `ResultsScreen` após o processamento do relatório complementar, sem ErrorBoundary global para exibir fallback.

Por que essa hipótese é mais forte:

1. O fluxo assíncrono de leitura/parsing/matching já tem `try/catch` e deve mostrar mensagem de erro na tela de upload.
2. A tela branca relatada ocorre depois de importar o complementar, justamente quando `setResults` troca a tela para resultados.
3. Não há ErrorBoundary global.
4. Não há evidência de storage persistido pelo app.
5. Não há Service Worker/PWA no código atual.

A diferença entre navegador comum e guia anônima ainda pode ser explicada por cache HTTP/CDN ou por uma versão antiga do bundle mantida no navegador comum. Essa parte precisa ser confirmada no DevTools/Network/Application do navegador afetado, porque não há configuração de cache no repositório que permita concluir isso somente pelo código.

## 6. Risco técnico

- **Risco atual ao usuário:** alto para confiança operacional, porque uma exceção de renderização pode derrubar a tela inteira sem mensagem.
- **Risco de dados:** baixo no código atual, pois não há persistência/histórico no navegador ou backend para esse fluxo; os arquivos ficam somente em memória enquanto a página está aberta.
- **Risco de correção precipitada:** médio/alto se for feita limpeza ampla de storage ou alteração de regras de importação sem evidência. Como o app não usa storage próprio, limpar `localStorage` automaticamente pode apagar dados de terceiros no mesmo domínio/origem ou mascarar a causa real.
- **Risco de cache de deploy:** indeterminado no repositório. Deve ser validado na hospedagem: headers de `index.html`, assets em `/assets`, CDN e eventual Service Worker antigo registrado por versões anteriores.

## 7. Correção mínima recomendada

### 7.1 Primeiro passo obrigatório: confirmar o erro real no navegador comum

Antes de alterar regra de negócio, abrir o navegador comum afetado e coletar:

- Console: erro exato e stack trace no momento da tela branca;
- Network: status e origem dos arquivos `.js`/`.css`, se vêm de disk cache/memory cache/CDN e se os nomes batem com o HTML atual;
- Application > Service Workers: confirmar se existe Service Worker antigo registrado para a origem, mesmo que o código atual não registre;
- Application > Local Storage/Session Storage: confirmar se há chaves antigas da origem, mesmo que o código atual não use.

### 7.2 Menor ajuste seguro se o console confirmar erro de renderização

Adicionar um ErrorBoundary global mínimo envolvendo a aplicação/rotas, com uma tela amigável e botão para recarregar/voltar ao início. Isso não muda importação, matching, layout principal nem regras de negócio; apenas evita tela branca e expõe mensagem recuperável.

### 7.3 Menor ajuste seguro se for confirmado Service Worker antigo de versão anterior

Não alterar regra de importação. Implementar rotina controlada de desregistro/atualização somente se o navegador afetado mostrar Service Worker registrado para a origem. A correção deve ser versionada, comentada e reversível, preferencialmente limitada a remover SW legado se o app atual não é PWA.

### 7.4 Menor ajuste seguro se for confirmado storage antigo incompatível

Como o código atual não define chaves de storage, não se recomenda limpeza automática ampla. Se o DevTools mostrar chaves antigas claramente relacionadas à análise/importação, criar limpeza cirúrgica somente dessas chaves, com prefixo/lista explícita e justificativa em comentário. Não usar `localStorage.clear()` nem `sessionStorage.clear()`.

### 7.5 Menor ajuste seguro se for confirmado cache HTTP/CDN incorreto

Ajustar headers no provedor de hospedagem:

- `index.html`: `no-cache`/revalidação obrigatória;
- assets versionados por hash: cache longo e imutável;
- evitar cache agressivo de HTML por CDN sem revalidação.

Essa correção provavelmente fica fora do código deste repositório, a menos que exista arquivo de configuração da plataforma de deploy em outro local.

## 8. O que não deve ser feito

- Não limpar todo `localStorage` ou `sessionStorage` automaticamente.
- Não alterar regras do GRL053, Inpasa, FS ou matching para tentar mascarar tela branca.
- Não substituir cabeçalho fixo por detecção automática sem decisão de produto.
- Não assumir que é cache PWA sem verificar Service Worker real no navegador afetado.
- Não remover filtros, KPIs, exportação ou campos de resultado.
- Não criar nova arquitetura de estado/persistência.
- Não desativar validações de colunas obrigatórias.
- Não tratar GRL583 como equivalente a GRL053 sem confirmação funcional de que o layout é exatamente o mesmo.

## 9. Checklist para reproduzir o erro no navegador normal

1. Abrir o navegador comum usado pelo usuário afetado.
2. Abrir DevTools antes do teste.
3. Na aba Console, habilitar preservação de logs.
4. Na aba Network, habilitar preservação de logs e desabilitar temporariamente “Disable cache” para reproduzir o cenário real.
5. Acessar a URL de produção normalmente.
6. Registrar versão/horário e verificar quais arquivos `.js` e `.css` foram carregados.
7. Importar o relatório base GRL053/arquivo relatado como GRL583.
8. Conferir se a empresa foi preenchida ou se houve mensagem silenciosa/console error.
9. Selecionar o cliente complementar correto (`Inpasa` ou `FS`).
10. Importar o relatório complementar.
11. Clicar em “Conferir”.
12. Se ficar branco, copiar erro completo do Console e stack trace.
13. Na aba Network, verificar se algum chunk JS/CSS retornou 404, MIME errado, conteúdo antigo ou cache inesperado.
14. Na aba Application, verificar se há Service Worker registrado para a origem.
15. Na aba Application, listar chaves de Local Storage e Session Storage da origem.
16. Repetir em guia anônima e comparar Console, Network, Service Worker e storage.

## 10. Checklist para validar se a correção resolveu

1. Reproduzir primeiro o erro no navegador comum antes da correção ou registrar evidência de que ocorria.
2. Aplicar apenas a correção mínima confirmada pelo diagnóstico.
3. Fazer novo deploy.
4. Abrir navegador comum sem limpar todos os dados manualmente.
5. Recarregar a página e confirmar se o HTML carrega os assets esperados da nova versão.
6. Importar o mesmo relatório base usado na reprodução.
7. Confirmar que a empresa é identificada ou permanece editável sem erro.
8. Importar o mesmo relatório complementar usado na reprodução.
9. Clicar em “Conferir”.
10. Confirmar que a tela de resultados abre ou, se houver erro de renderização, aparece fallback amigável em vez de tela branca.
11. Confirmar que os KPIs, tabela, drawer de detalhes e exportações continuam funcionando com dados válidos.
12. Confirmar que erros de layout/colunas continuam aparecendo como mensagens de validação, sem mudar regras de importação.
13. Confirmar no Console que não há exceções não tratadas.
14. Confirmar em guia anônima que o fluxo continua funcionando.
15. Se a correção envolveu cache/SW, confirmar em Application > Service Workers que não restou SW legado controlando a página.
16. Se a correção envolveu storage, confirmar que apenas chaves explicitamente relacionadas ao fluxo foram removidas/migradas.

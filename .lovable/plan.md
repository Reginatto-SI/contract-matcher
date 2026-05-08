## Plano — Refinamento visual da tela de Conferência

Apenas ajustes de UI/UX no `src/components/ResultsScreen.tsx` (e pequenos tokens em `src/index.css` se necessário). Sem tocar em `match.ts`, `parseXlsx.ts`, `exporters.ts`, `normalize.ts`, `layouts.ts` ou `Index.tsx`.

### 1. Cabeçalho (header sticky)
- Manter botão "Nova conferência" à esquerda, com separador vertical mais sutil.
- Substituir os textos soltos de Empresa / Cliente / Registros analisados por **chips/pílulas informativas** (`rounded-full` + `bg-muted` + label uppercase pequena + valor em destaque).
- Botão "Exportar" à direita com ícone, leve sombra e hover refinado.
- Aumentar levemente padding vertical, melhorar alinhamento e hierarquia tipográfica.

### 2. Resumo da importação
- Trocar o Card cinza por um **bloco de status informativo** com ícone `Info` discreto à esquerda, fundo `bg-info-soft/50`, borda lateral colorida (`border-l-4 border-info`) e texto com hierarquia (número em destaque, contexto em muted).
- Quando houver linhas ignoradas, destacar o número de ignoradas.

### 3. KPIs
- Redesenhar `KpiCard`:
  - Ícone à esquerda em círculo colorido suave (tom por categoria).
  - Label pequena uppercase em `text-muted-foreground`.
  - Valor grande, `text-3xl font-semibold`, com cor da categoria.
  - Subtítulo curto opcional (ex: "registros conferidos").
  - Estado `active` com `ring-2 ring-{tone}` + leve elevação.
  - Hover com `shadow-md` e `-translate-y-0.5` sutil.
- Tons refinados:
  - Vínculo OK → success (verde)
  - Base inválida / Contrato não encontrado → destructive (vermelho)
  - Nota não encontrada / Alertas (placa) → warning (laranja)
  - Divergências de vínculo → info (azul)
- Ícones: `CheckCircle2`, `FileX`, `FileSearch`, `FileQuestion`, `GitCompare`, `AlertTriangle`.
- Grid responsivo: 2 → 3 → 6 colunas (mantém atual).

### 4. Barra de busca / filtros
- Transformar em **toolbar da tabela**: integrar visualmente ao topo da Card da tabela (sem Card separado), borda inferior sutil.
- Input de busca limpo, ícone à esquerda, altura compacta.
- Contador "X de Y" alinhado à direita, em badge discreto.
- Botão "Limpar filtros" como `ghost` compacto, só aparece com filtro ativo (já é o comportamento).
- Reduzir altura vertical total.

### 5. Tabela
- Header com `bg-muted/60`, `text-[11px] uppercase tracking-wide font-semibold text-muted-foreground`, padding vertical reduzido.
- Linhas com `hover:bg-accent/40`, transição suave; cursor pointer.
- Zebra opcional muito sutil (`even:bg-muted/20`) — manter compacto.
- Badges de situação refinados (já existem por tom) com `rounded-full`, padding equilibrado, peso medium.
- Colunas numéricas e de data com `tabular-nums` (já tem) e alinhamento à direita para pesos.
- Coluna "Detalhe" com `text-sm text-muted-foreground`, `line-clamp-1` e tooltip nativo via `title`.
- Paginação com visual mais clean: total de páginas + range de registros, botões `outline` compactos.

### 6. Diagnóstico visual
- Linhas com situação ≠ OK ganham um leve indicador na primeira coluna (border-left de 2px na cor do tom) para chamar atenção sem poluir.
- Badges OK em verde mais discreto; erros e divergências com contraste maior.

### 7. Responsividade
- Header colapsa chips abaixo do botão em telas <md.
- KPIs já quebram (2/3/6); ajustar gaps para mobile.
- Tabela mantém scroll horizontal dentro da Card (`overflow-x-auto`).

### 8. Drawer de detalhes
- Header do Sheet com badge de situação maior e ícone correspondente ao tom.
- Três seções em **cards internos** com título uppercase pequeno:
  - "Dados da Base (GRL053)"
  - "Dados do Complementar"
  - "Resultado da Conferência" (com diagnóstico em destaque)
- Cada campo em par label/valor em grid 2 colunas, label `text-xs uppercase muted`, valor `font-medium`.
- Alerta de placa divergente como banner amarelo dentro do card correspondente.
- Botão de copiar chave de acesso já existe — manter, apenas estilizar.

### Arquivos alterados
- `src/components/ResultsScreen.tsx` — única alteração principal (componente `KpiCard` interno + JSX da tela e drawer).
- Possíveis ajustes mínimos em `src/index.css` se faltar algum token de sombra/ring (provavelmente desnecessário, tokens existentes cobrem).

### Garantias
- Zero alteração em: regras de matching, KPIs (cálculo), filtros (lógica), ordenação, paginação (tamanho 25), normalização, importação, exportação, nomes/labels de status.
- Sem novas dependências.

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpDown,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  FileSearch,
  FileText,
  FileX,
  GitCompare,
  Info,
  ReceiptText,
  Search,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { computeKpis, MatchedRow, Situacao, situacaoLabel } from "@/lib/match";
import { exportExcel, exportPDF } from "@/lib/exporters";
import { cn } from "@/lib/utils";
import { dataEmissaoToTime, formatDataEmissao } from "@/lib/normalize";
import { toast } from "@/hooks/use-toast";
import { Grl053FiltersDialog } from "@/components/Grl053FiltersDialog";

interface Props {
  empresa: string;
  cliente: string;
  rows: MatchedRow[];
  baseTotalArquivo: number;
  baseIgnoradasModalidade: number;
  onReset: () => void;
}

type FilterKind = "ALL" | "OK" | "BASE_INVALIDA" | "CONTRATO" | "NOTA" | "DIVERGENCIAS" | "ALERTAS";
type Tone = "success" | "destructive" | "warning" | "info";

const PAGE_SIZE = 25;

export type SortKey =
  | "situacao"
  | "data_emissao"
  | "contratoInterno"
  | "contratoCliente"
  | "nota"
  | "placaBase"
  | "placaCliente"
  | "pesoFiscal"
  | "pesoFisico";
export type SortDirection = "asc" | "desc";
export interface SortState {
  key: SortKey;
  direction: SortDirection;
}

const fmtNum = (n: number | null) =>
  n === null ? "—" : n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const parseSortableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const normalized = String(value).trim().replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const compareWithNullLast = (a: number | string | null, b: number | string | null, direction: SortDirection) => {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;

  const base =
    typeof a === "number" && typeof b === "number"
      ? a - b
      : String(a).localeCompare(String(b), "pt-BR", { numeric: true, sensitivity: "base" });

  return direction === "asc" ? base : -base;
};

export const filterRowsByResultsSearch = (rows: MatchedRow[], search: string): MatchedRow[] => {
  const q = search.trim().toLowerCase();
  if (!q) return rows;

  return rows.filter((r) => {
    // Contrato MX é informativo na conferência, mas deve participar da busca textual global.
    const hay =
      `${situacaoLabel[r.situacao]} ${formatDataEmissao(r.base.data_emissao)} ${r.detalhe} ${r.base.contrato_interno} ${r.base.contratoCliente} ${r.base.nota} ${r.base.placa} ${r.comp?.placa ?? ""} ${r.comp?.numeroNF ?? ""} ${r.comp?.nrContrOriginal ?? ""}`.toLowerCase();
    return hay.includes(q);
  });
};

export const sortMatchedRows = (rows: MatchedRow[], sort: SortState | null): MatchedRow[] => {
  if (!sort) return rows;

  return [...rows].sort((a, b) => {
    let result = 0;

    switch (sort.key) {
      case "situacao":
        result = compareWithNullLast(situacaoLabel[a.situacao], situacaoLabel[b.situacao], sort.direction);
        break;
      case "data_emissao":
        result = compareWithNullLast(dataEmissaoToTime(a.base.data_emissao), dataEmissaoToTime(b.base.data_emissao), sort.direction);
        break;
      case "contratoInterno":
        result = compareWithNullLast(a.base.contrato_interno || null, b.base.contrato_interno || null, sort.direction);
        break;
      case "contratoCliente":
        result = compareWithNullLast(parseSortableNumber(a.base.contratoCliente), parseSortableNumber(b.base.contratoCliente), sort.direction);
        break;
      case "nota":
        result = compareWithNullLast(parseSortableNumber(a.base.nota), parseSortableNumber(b.base.nota), sort.direction);
        break;
      case "placaBase":
        result = compareWithNullLast(a.base.placa || null, b.base.placa || null, sort.direction);
        break;
      case "placaCliente":
        result = compareWithNullLast(a.comp?.placa || null, b.comp?.placa || null, sort.direction);
        break;
      case "pesoFiscal":
        result = compareWithNullLast(a.base.aposDesc, b.base.aposDesc, sort.direction);
        break;
      case "pesoFisico":
        result = compareWithNullLast(a.comp?.totalLiquido ?? null, b.comp?.totalLiquido ?? null, sort.direction);
        break;
    }

    return result || a.id - b.id;
  });
};

const situacaoTone: Record<Situacao, Tone> = {
  OK: "success",
  REGISTRO_BASE_INVALIDO: "destructive",
  CONTRATO_NAO_ENCONTRADO: "destructive",
  NOTA_NAO_ENCONTRADA: "warning",
  NOTA_OUTRO_CONTRATO: "info",
  CONTRATO_OUTRA_NOTA: "info",
  DUPLICIDADE: "info",
};

const toneBadgeClass: Record<Tone, string> = {
  success: "bg-success-soft text-success border-success/30",
  destructive: "bg-destructive-soft text-destructive border-destructive/30",
  warning: "bg-warning-soft text-warning border-warning/30",
  info: "bg-info-soft text-info border-info/30",
};

const toneBorderLeft: Record<Tone, string> = {
  success: "before:bg-success/40",
  destructive: "before:bg-destructive",
  warning: "before:bg-warning",
  info: "before:bg-info",
};

const situacaoBadge = (s: Situacao) => toneBadgeClass[situacaoTone[s]];

export const ResultsScreen = ({ empresa, cliente, rows, baseTotalArquivo, baseIgnoradasModalidade, onReset }: Props) => {
  const [filter, setFilter] = useState<FilterKind>("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<MatchedRow | null>(null);
  const [sort, setSort] = useState<SortState | null>(null);

  // Total bruto/analisado: `rows` é o resultado completo do matching e continua alimentando cabeçalho e contador geral.
  const totalAnalisado = rows.length;

  const searchedRows = useMemo(() => {
    // Lista filtrada pela busca textual: esta é a base operacional dos KPIs para refletir contrato, nota ou placa pesquisados.
    return filterRowsByResultsSearch(rows, search);
  }, [rows, search]);

  // KPIs filtrados: recalculados sobre a mesma busca textual da grid, sem alterar o total bruto/importado.
  const kpis = useMemo(() => computeKpis(searchedRows), [searchedRows]);

  const filtered = useMemo(() => {
    // Lista final da grid: aplica o filtro clicável de KPI sobre os registros já reduzidos pela busca textual.
    return searchedRows.filter((r) => {
      if (filter === "OK" && r.situacao !== "OK") return false;
      if (filter === "BASE_INVALIDA" && r.situacao !== "REGISTRO_BASE_INVALIDO") return false;
      if (filter === "CONTRATO" && r.situacao !== "CONTRATO_NAO_ENCONTRADO") return false;
      if (filter === "NOTA" && r.situacao !== "NOTA_NAO_ENCONTRADA") return false;
      if (
        filter === "DIVERGENCIAS" &&
        !["NOTA_OUTRO_CONTRATO", "CONTRATO_OUTRA_NOTA", "DUPLICIDADE"].includes(r.situacao)
      )
        return false;
      if (filter === "ALERTAS" && !r.placaDivergente) return false;
      return true;
    });
  }, [searchedRows, filter]);

  const sorted = useMemo(() => sortMatchedRows(filtered, sort), [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const rangeStart = sorted.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, sorted.length);

  const toggleSort = (key: SortKey) => {
    setSort((current) =>
      current?.key === key ? { key, direction: current.direction === "asc" ? "desc" : "asc" } : { key, direction: "asc" },
    );
    setPage(1);
  };

  const sortIcon = (key: SortKey) => {
    if (sort?.key !== key) return <ArrowUpDown className="h-3 w-3 opacity-45" />;
    return sort.direction === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  };

  const renderSortableHead = (label: string, key: SortKey, className?: string, title?: string) => (
    <TableHead className={cn("h-10 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground", className)} title={title}>
      <button
        type="button"
        className={cn(
          "inline-flex w-full items-center gap-1 transition-colors hover:text-foreground",
          className?.includes("text-right") && "justify-end",
        )}
        onClick={() => toggleSort(key)}
      >
        <span>{label}</span>
        {sortIcon(key)}
      </button>
    </TableHead>
  );

  const setFilterAndReset = (f: FilterKind) => {
    setFilter(f);
    setPage(1);
  };

  const copyChaveAcesso = (value: string) => {
    if (!value) return;
    if (!navigator.clipboard) {
      toast({ title: "Não foi possível copiar a chave de acesso." });
      return;
    }

    void navigator.clipboard
      .writeText(value)
      .then(() => toast({ title: "Chave de acesso copiada." }))
      .catch(() => toast({ title: "Não foi possível copiar a chave de acesso.", variant: "destructive" }));
  };

  const selectedTone: Tone | null = selected ? situacaoTone[selected.situacao] : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-20 shadow-sm">
        <div className="mx-auto max-w-[1400px] px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="ghost" size="sm" onClick={onReset} className="gap-1.5">
              <ArrowLeft className="h-4 w-4" />
              Nova conferência
            </Button>
            <div className="hidden md:flex items-center gap-2">
              <ContextChip label="Empresa" value={empresa} />
              <ContextChip label="Cliente" value={cliente} />
              <ContextChip label="Registros" value={totalAnalisado.toLocaleString("pt-BR")} accent />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Tutorial visual para orientar o usuário na geração do relatório GRL053 com os filtros aceitos. */}
            <Grl053FiltersDialog />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="gap-1.5 shadow-sm">
                  <Download className="h-4 w-4" />
                  Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => exportExcel({ empresa, cliente, rows: sorted })}>
                  <FileText className="h-4 w-4" /> Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportPDF({ empresa, cliente, rows: sorted })}>
                  <FileText className="h-4 w-4" /> PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="md:hidden mx-auto max-w-[1400px] px-6 pb-3 flex items-center gap-2 flex-wrap">
          <ContextChip label="Empresa" value={empresa} />
          <ContextChip label="Cliente" value={cliente} />
          <ContextChip label="Registros" value={totalAnalisado.toLocaleString("pt-BR")} accent />
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-5 space-y-4">
        {/* Resumo da importação */}
        <div className="flex items-start gap-3 rounded-lg border border-info/20 border-l-4 border-l-info bg-info-soft/40 p-3">
          <Info className="h-4 w-4 text-info mt-0.5 shrink-0" />
          <div className="text-sm leading-relaxed">
            <span className="text-foreground">
              Arquivo GRL053 importado com{" "}
              <span className="font-semibold tabular-nums">{baseTotalArquivo.toLocaleString("pt-BR")}</span> registros.
            </span>{" "}
            <span className="text-muted-foreground">
              Analisados:{" "}
              <span className="font-semibold tabular-nums text-foreground">
                {totalAnalisado.toLocaleString("pt-BR")}
              </span>
              .
            </span>
            {baseIgnoradasModalidade > 0 && (
              <span className="text-muted-foreground">
                {" "}
                Ignoradas{" "}
                <span className="font-semibold tabular-nums text-warning">
                  {baseIgnoradasModalidade.toLocaleString("pt-BR")}
                </span>{" "}
                linhas por modalidade diferente de EXP.
              </span>
            )}
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard
            label="Vínculo OK"
            value={kpis.ok}
            icon={CheckCircle2}
            active={filter === "OK"}
            tone="success"
            onClick={() => setFilterAndReset(filter === "OK" ? "ALL" : "OK")}
          />
          <KpiCard
            label="Base inválida"
            value={kpis.baseInvalida}
            icon={FileX}
            active={filter === "BASE_INVALIDA"}
            tone="destructive"
            onClick={() => setFilterAndReset(filter === "BASE_INVALIDA" ? "ALL" : "BASE_INVALIDA")}
          />
          <KpiCard
            label="Contrato não encontrado"
            value={kpis.contratoNaoEncontrado}
            icon={FileSearch}
            active={filter === "CONTRATO"}
            tone="destructive"
            onClick={() => setFilterAndReset(filter === "CONTRATO" ? "ALL" : "CONTRATO")}
          />
          <KpiCard
            label="Nota não encontrada"
            value={kpis.notaNaoEncontrada}
            icon={ReceiptText}
            active={filter === "NOTA"}
            tone="warning"
            onClick={() => setFilterAndReset(filter === "NOTA" ? "ALL" : "NOTA")}
          />
          <KpiCard
            label="Divergências de vínculo"
            value={kpis.divergencias}
            icon={GitCompare}
            active={filter === "DIVERGENCIAS"}
            tone="info"
            onClick={() => setFilterAndReset(filter === "DIVERGENCIAS" ? "ALL" : "DIVERGENCIAS")}
          />
          <KpiCard
            label="Alertas (placa)"
            value={kpis.alertas}
            icon={AlertTriangle}
            active={filter === "ALERTAS"}
            tone="warning"
            onClick={() => setFilterAndReset(filter === "ALERTAS" ? "ALL" : "ALERTAS")}
          />
        </div>

        {/* Tabela com toolbar integrada */}
        <Card className="overflow-hidden">
          <div className="flex items-center gap-3 flex-wrap px-4 py-2.5 border-b bg-muted/30">
            <div className="relative flex-1 min-w-[240px] max-w-xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Buscar por Contrato MX, contrato cliente, nota ou placa..."
                className="pl-9 h-9 bg-card"
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
              {(filter !== "ALL" || search) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  onClick={() => {
                    setFilter("ALL");
                    setSearch("");
                    setPage(1);
                  }}
                >
                  Limpar filtros
                </Button>
              )}
              <span className="text-xs font-medium text-muted-foreground tabular-nums px-2.5 py-1 rounded-md bg-card border">
                {filtered.length.toLocaleString("pt-BR")} de {rows.length.toLocaleString("pt-BR")}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40 border-b">
                  {renderSortableHead("Situação", "situacao", "w-[180px]")}
                  {renderSortableHead("Data emissão", "data_emissao", undefined, "Data emissão vinda da DATA ROMANEIO do GRL053")}
                  {/* Contrato MX é campo informativo do GRL053 (CONTRATO) e não participa do matching. */}
                  {renderSortableHead("Contrato MX", "contratoInterno", "whitespace-nowrap")}
                  {renderSortableHead("Contr. Cliente", "contratoCliente")}
                  {renderSortableHead("Nota", "nota")}
                  {renderSortableHead("Placa Base", "placaBase")}
                  {renderSortableHead("Placa Cliente", "placaCliente")}
                  {renderSortableHead("Peso Fiscal", "pesoFiscal", "text-right")}
                  {renderSortableHead("Peso Físico", "pesoFisico", "text-right")}
                  <TableHead className="h-10 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
                    Detalhe
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                      Nenhum registro com os filtros atuais.
                    </TableCell>
                  </TableRow>
                ) : (
                  pageRows.map((r) => {
                    const tone = situacaoTone[r.situacao];
                    const indicator: Record<Tone, string> = {
                      success: "border-l-transparent",
                      destructive: "border-l-destructive",
                      warning: "border-l-warning",
                      info: "border-l-info",
                    };
                    return (
                      <TableRow
                        key={r.id}
                        className="cursor-pointer transition-colors hover:bg-accent/40"
                        onClick={() => setSelected(r)}
                      >
                        <TableCell className={cn("border-l-[3px]", indicator[tone])}>
                          <Badge variant="outline" className={cn("font-medium rounded-full px-2.5", situacaoBadge(r.situacao))}>
                            {situacaoLabel[r.situacao]}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                          {formatDataEmissao(r.base.data_emissao)}
                        </TableCell>
                        {/* Campo informativo do GRL053 (CONTRATO/Contrato MX); não altera vínculo, status ou KPIs. */}
                        <TableCell className="font-mono text-xs whitespace-nowrap">{r.base.contrato_interno || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{r.base.contratoCliente || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{r.base.nota || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{r.base.placa || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">
                          <span className="inline-flex items-center gap-1">
                            {r.comp?.placa || "—"}
                            {r.placaDivergente && (
                              <AlertTriangle className="h-3.5 w-3.5 text-warning" aria-label="Placa divergente" />
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">{fmtNum(r.base.aposDesc)}</TableCell>
                        <TableCell className="text-right tabular-nums text-sm">{fmtNum(r.comp?.totalLiquido ?? null)}</TableCell>
                        <TableCell
                          className="text-xs text-muted-foreground max-w-[300px] truncate"
                          title={r.detalhe}
                        >
                          {r.detalhe}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {sorted.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t text-sm bg-muted/20">
              <div className="text-muted-foreground tabular-nums">
                Mostrando <span className="font-medium text-foreground">{rangeStart}</span>–
                <span className="font-medium text-foreground">{rangeEnd}</span> de{" "}
                <span className="font-medium text-foreground">{sorted.length.toLocaleString("pt-BR")}</span>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    Página {safePage} de {totalPages}
                  </span>
                  <Button variant="outline" size="sm" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={safePage === totalPages}
                    onClick={() => setPage(safePage + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>
      </main>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="sm:max-w-lg w-full overflow-y-auto">
          {selected && selectedTone && (
            <>
              <SheetHeader>
                <SheetTitle>Detalhe do registro</SheetTitle>
                <SheetDescription asChild>
                  <div className="mt-2">
                    <Badge variant="outline" className={cn("rounded-full px-3 py-1 font-medium", situacaoBadge(selected.situacao))}>
                      {situacaoLabel[selected.situacao]}
                    </Badge>
                  </div>
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-4 text-sm">
                <SectionCard title="Diagnóstico" tone={selectedTone}>
                  <p className="text-sm leading-relaxed">{selected.detalhe}</p>
                </SectionCard>

                <SectionCard title="Comparação principal">
                  <div className="space-y-2">
                    <ComparisonRow
                      label="Contrato"
                      baseLabel="Base GRL053 · Contr. Cliente"
                      baseValue={selected.base.contratoCliente}
                      compLabel={`Complementar ${cliente} · Contrato cliente`}
                      compValue={selected.comp?.nrContrOriginal}
                      severity="key"
                    />
                    <ComparisonRow
                      label="Nota Fiscal"
                      baseLabel="Base GRL053 · Nota"
                      baseValue={selected.base.nota}
                      compLabel={`Complementar ${cliente} · Nota fiscal`}
                      compValue={selected.comp?.numeroNF}
                      severity="key"
                    />
                    <ComparisonRow
                      label="Placa"
                      baseLabel="Base GRL053 · Placa"
                      baseValue={selected.base.placa}
                      compLabel={`Complementar ${cliente} · Placa`}
                      compValue={selected.comp?.placa}
                      severity="info"
                      note="Apenas alerta informativo; placa não afeta a classificação."
                    />
                  </div>
                </SectionCard>

                <SectionCard title="Informações complementares">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <Field label="Contrato (base)" value={selected.base.contrato} />
                    <Field label="Data emissão" value={formatDataEmissao(selected.base.data_emissao)} />
                    <Field label="Após Desc (peso fiscal)" value={fmtNum(selected.base.aposDesc)} />
                    <Field label="Total Líquido (peso físico)" value={fmtNum(selected.comp?.totalLiquido ?? null)} />
                    <div className="col-span-2">
                      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Observação da NF</dt>
                      {/* Campo informativo do GRL053/GRL019; não participa do matching. */}
                      <dd className="mt-1 rounded-md border border-border/60 bg-card p-2 text-xs leading-relaxed whitespace-pre-wrap break-words">
                        {selected.base.observacaoNF || "Não informado"}
                      </dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Chave de acesso (GRL053)</dt>
                      <dd className="font-mono text-xs mt-1 flex items-center gap-2 break-all">
                        <span>{selected.base.chaveAcesso || "—"}</span>
                        {selected.base.chaveAcesso && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            title="Copiar chave de acesso"
                            aria-label="Copiar chave de acesso"
                            onClick={() => copyChaveAcesso(selected.base.chaveAcesso)}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </dd>
                    </div>
                  </dl>
                </SectionCard>

                {!selected.comp && (
                  <p className="text-xs text-muted-foreground italic">
                    Nenhum registro correspondente no complementar para exibir nos pares comparativos.
                  </p>
                )}

                {selected.placaDivergente && (
                  <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning-soft text-warning p-3">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span className="text-xs">
                      Placas diferentes entre base e complementar — apenas alerta informativo, não afeta a classificação.
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

const ContextChip = ({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) => (
  <div
    className={cn(
      "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs",
      accent ? "bg-primary-soft border-primary/20" : "bg-muted/60 border-border",
    )}
  >
    <span className="uppercase tracking-wide text-[10px] font-semibold text-muted-foreground">{label}</span>
    <span className={cn("font-semibold", accent ? "text-primary" : "text-foreground")}>{value}</span>
  </div>
);

const SectionCard = ({
  title,
  tone,
  children,
}: {
  title: string;
  tone?: Tone;
  children: React.ReactNode;
}) => {
  const toneRing: Record<Tone, string> = {
    success: "border-success/30 bg-success-soft/30",
    destructive: "border-destructive/30 bg-destructive-soft/30",
    warning: "border-warning/30 bg-warning-soft/30",
    info: "border-info/30 bg-info-soft/30",
  };
  return (
    <section className={cn("rounded-lg border p-3", tone ? toneRing[tone] : "bg-muted/30 border-border")}>
      <h4 className="font-semibold text-[11px] uppercase tracking-wide text-muted-foreground mb-2">{title}</h4>
      {children}
    </section>
  );
};

type ComparisonSeverity = "key" | "info";

interface ComparisonRowProps {
  label: string;
  baseLabel: string;
  baseValue: string;
  compLabel: string;
  compValue?: string;
  severity: ComparisonSeverity;
  note?: string;
}

const ComparisonRow = ({ label, baseLabel, baseValue, compLabel, compValue, severity, note }: ComparisonRowProps) => {
  const hasCompValue = !!compValue;
  const isSame = hasCompValue && baseValue === compValue;
  const tone = getComparisonTone(hasCompValue, isSame, severity);

  return (
    <div className={cn("rounded-lg border p-3", tone.card)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium text-sm">{label}</div>
          {note && <p className="text-[11px] text-muted-foreground mt-0.5">{note}</p>}
        </div>
        <Badge variant="outline" className={cn("shrink-0 rounded-full", tone.badge)}>
          {tone.label}
        </Badge>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <ComparisonValue label={baseLabel} value={baseValue} />
        <ComparisonValue label={compLabel} value={compValue} />
      </div>
    </div>
  );
};

const ComparisonValue = ({ label, value }: { label: string; value?: string }) => (
  <div className="rounded-md bg-card border border-border/60 p-2 min-w-0">
    <div className="text-[10px] uppercase tracking-wide text-muted-foreground leading-tight font-medium">{label}</div>
    <div className="font-mono text-xs mt-1 truncate" title={value || "—"}>
      {value || "—"}
    </div>
  </div>
);

const getComparisonTone = (hasCompValue: boolean, isSame: boolean, severity: ComparisonSeverity) => {
  if (!hasCompValue) {
    return {
      label: "Sem complementar",
      card: "bg-muted/30",
      badge: "bg-muted text-muted-foreground border-border",
    };
  }

  if (isSame) {
    return {
      label: "Iguais",
      card: "bg-success-soft/40 border-success/30",
      badge: "bg-success-soft text-success border-success/30",
    };
  }

  if (severity === "info") {
    return {
      label: "Alerta",
      card: "bg-warning-soft/50 border-warning/30",
      badge: "bg-warning-soft text-warning border-warning/30",
    };
  }

  return {
    label: "Diferentes",
    card: "bg-destructive-soft/40 border-destructive/30",
    badge: "bg-destructive-soft text-destructive border-destructive/30",
  };
};

const Field = ({ label, value }: { label: string; value: string }) => (
  <div>
    <dt className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{label}</dt>
    <dd className="font-mono text-xs mt-1">{value || "—"}</dd>
  </div>
);

interface KpiProps {
  label: string;
  value: number;
  active: boolean;
  tone: Tone;
  icon: LucideIcon;
  onClick: () => void;
}

const KpiCard = ({ label, value, active, tone, icon: Icon, onClick }: KpiProps) => {
  const ring: Record<Tone, string> = {
    success: "data-[active=true]:ring-success/50 data-[active=true]:border-success/40",
    destructive: "data-[active=true]:ring-destructive/50 data-[active=true]:border-destructive/40",
    warning: "data-[active=true]:ring-warning/50 data-[active=true]:border-warning/40",
    info: "data-[active=true]:ring-info/50 data-[active=true]:border-info/40",
  };
  const iconBg: Record<Tone, string> = {
    success: "bg-success-soft text-success",
    destructive: "bg-destructive-soft text-destructive",
    warning: "bg-warning-soft text-warning",
    info: "bg-info-soft text-info",
  };
  const valueColor: Record<Tone, string> = {
    success: "text-success",
    destructive: "text-destructive",
    warning: "text-warning",
    info: "text-info",
  };

  return (
    <button
      data-active={active}
      onClick={onClick}
      className={cn(
        "group rounded-xl border bg-card p-3.5 text-left transition-all hover:shadow-md hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "data-[active=true]:ring-2 data-[active=true]:shadow-md",
        ring[tone],
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", iconBg[tone])}>
          <Icon className="h-4.5 w-4.5" strokeWidth={2.25} />
        </div>
        <div className={cn("text-2xl font-semibold tabular-nums leading-none", valueColor[tone])}>
          {value.toLocaleString("pt-BR")}
        </div>
      </div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold mt-3 leading-tight">
        {label}
      </div>
    </button>
  );
};

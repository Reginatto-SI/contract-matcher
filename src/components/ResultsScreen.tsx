import { useMemo, useState } from "react";
import { ArrowLeft, Download, FileText, Search, AlertTriangle, Copy } from "lucide-react";
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
import { toast } from "@/hooks/use-toast";

interface Props {
  empresa: string;
  cliente: string;
  rows: MatchedRow[];
  onReset: () => void;
}

type FilterKind = "ALL" | "OK" | "BASE_INVALIDA" | "CONTRATO" | "NOTA" | "DIVERGENCIAS" | "ALERTAS";

const PAGE_SIZE = 25;

const fmtNum = (n: number | null) =>
  n === null ? "—" : n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const situacaoBadge = (s: Situacao) => {
  const map: Record<Situacao, string> = {
    OK: "bg-success-soft text-success border-success/30",
    REGISTRO_BASE_INVALIDO: "bg-destructive-soft text-destructive border-destructive/30",
    CONTRATO_NAO_ENCONTRADO: "bg-destructive-soft text-destructive border-destructive/30",
    NOTA_NAO_ENCONTRADA: "bg-warning-soft text-warning border-warning/30",
    NOTA_OUTRO_CONTRATO: "bg-warning-soft text-warning border-warning/30",
    CONTRATO_OUTRA_NOTA: "bg-warning-soft text-warning border-warning/30",
    DUPLICIDADE: "bg-info-soft text-info border-info/30",
  };
  return map[s];
};

export const ResultsScreen = ({ empresa, cliente, rows, onReset }: Props) => {
  const [filter, setFilter] = useState<FilterKind>("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<MatchedRow | null>(null);

  const kpis = useMemo(() => computeKpis(rows), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
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
      if (q) {
        const hay =
          `${situacaoLabel[r.situacao]} ${r.detalhe} ${r.base.contratoCliente} ${r.base.nota} ${r.base.placa} ${r.comp?.placa ?? ""} ${r.comp?.numeroNF ?? ""} ${r.comp?.nrContrOriginal ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, filter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-20">
        <div className="mx-auto max-w-[1400px] px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={onReset}>
              <ArrowLeft className="h-4 w-4" />
              Nova conferência
            </Button>
            <div className="hidden md:flex items-center gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Empresa: </span>
                <span className="font-medium">{empresa}</span>
              </div>
              <div className="h-4 w-px bg-border" />
              <div>
                <span className="text-muted-foreground">Cliente: </span>
                <span className="font-medium">{cliente}</span>
              </div>
              <div className="h-4 w-px bg-border" />
              <div>
                <span className="text-muted-foreground">Registros: </span>
                <span className="font-medium">{kpis.total}</span>
              </div>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm">
                <Download className="h-4 w-4" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => exportExcel({ empresa, cliente, rows: filtered })}>
                <FileText className="h-4 w-4" /> Excel (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportPDF({ empresa, cliente, rows: filtered })}>
                <FileText className="h-4 w-4" /> PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-6 py-5 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard label="Vínculo OK" value={kpis.ok} active={filter === "OK"} tone="success" onClick={() => setFilterAndReset(filter === "OK" ? "ALL" : "OK")} />
          <KpiCard
            label="Base inválida"
            value={kpis.baseInvalida}
            active={filter === "BASE_INVALIDA"}
            tone="destructive"
            onClick={() => setFilterAndReset(filter === "BASE_INVALIDA" ? "ALL" : "BASE_INVALIDA")}
          />
          <KpiCard
            label="Contrato não encontrado"
            value={kpis.contratoNaoEncontrado}
            active={filter === "CONTRATO"}
            tone="destructive"
            onClick={() => setFilterAndReset(filter === "CONTRATO" ? "ALL" : "CONTRATO")}
          />
          <KpiCard
            label="Nota não encontrada"
            value={kpis.notaNaoEncontrada}
            active={filter === "NOTA"}
            tone="warning"
            onClick={() => setFilterAndReset(filter === "NOTA" ? "ALL" : "NOTA")}
          />
          <KpiCard
            label="Divergências de vínculo"
            value={kpis.divergencias}
            active={filter === "DIVERGENCIAS"}
            tone="info"
            onClick={() => setFilterAndReset(filter === "DIVERGENCIAS" ? "ALL" : "DIVERGENCIAS")}
          />
          <KpiCard
            label="Alertas (placa)"
            value={kpis.alertas}
            active={filter === "ALERTAS"}
            tone="warning"
            onClick={() => setFilterAndReset(filter === "ALERTAS" ? "ALL" : "ALERTAS")}
          />
        </div>

        <Card className="p-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Buscar por contrato, nota ou placa..."
                className="pl-9"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              {filtered.length} de {rows.length}
            </div>
            {(filter !== "ALL" || search) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilter("ALL");
                  setSearch("");
                  setPage(1);
                }}
              >
                Limpar filtros
              </Button>
            )}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-[200px]">Situação</TableHead>
                <TableHead>Contr. Cliente</TableHead>
                <TableHead>Nota</TableHead>
                <TableHead>Placa Base</TableHead>
                <TableHead>Placa Cliente</TableHead>
                <TableHead className="text-right">Peso Fiscal</TableHead>
                <TableHead className="text-right">Peso Físico</TableHead>
                <TableHead>Detalhe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    Nenhum registro com os filtros atuais.
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((r) => (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer"
                    onClick={() => setSelected(r)}
                  >
                    <TableCell>
                      <Badge variant="outline" className={cn("font-medium", situacaoBadge(r.situacao))}>
                        {situacaoLabel[r.situacao]}
                      </Badge>
                    </TableCell>
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
                    <TableCell className="text-right tabular-nums">{fmtNum(r.base.aposDesc)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtNum(r.comp?.totalLiquido ?? null)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">
                      {r.detalhe}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between px-4 py-3 border-t text-sm">
              <div className="text-muted-foreground">
                Página {safePage} de {totalPages}
              </div>
              <div className="flex gap-2">
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
            </div>
          )}
        </Card>
      </main>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="sm:max-w-md w-full overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>Detalhe do registro</SheetTitle>
                <SheetDescription>
                  <Badge variant="outline" className={cn("mt-2", situacaoBadge(selected.situacao))}>
                    {situacaoLabel[selected.situacao]}
                  </Badge>
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-5 text-sm">
                <section>
                  <h4 className="font-semibold text-xs uppercase text-muted-foreground mb-2">Diagnóstico</h4>
                  <p className="bg-muted/50 rounded-md p-3">{selected.detalhe}</p>
                </section>

                <section>
                  <h4 className="font-semibold text-xs uppercase text-muted-foreground mb-2">Comparação principal</h4>
                  <div className="space-y-2">
                    {/* Comparação visual: estes cards apenas explicam os pares usados na conferência, sem alterar o matching. */}
                    <ComparisonRow
                      label="Contrato"
                      baseLabel="Base GRL053 · Contr. Cliente"
                      baseValue={selected.base.contratoCliente}
                      compLabel="Complementar Inpasa · Nr Contr Original"
                      compValue={selected.comp?.nrContrOriginal}
                      severity="key"
                    />
                    <ComparisonRow
                      label="Nota Fiscal"
                      baseLabel="Base GRL053 · Nota"
                      baseValue={selected.base.nota}
                      compLabel="Complementar Inpasa · Número NF"
                      compValue={selected.comp?.numeroNF}
                      severity="key"
                    />
                    <ComparisonRow
                      label="Placa"
                      baseLabel="Base GRL053 · Placa"
                      baseValue={selected.base.placa}
                      compLabel="Complementar Inpasa · Placa"
                      compValue={selected.comp?.placa}
                      severity="info"
                      note="Apenas alerta informativo; placa não afeta a classificação."
                    />
                  </div>
                </section>

                <section>
                  <h4 className="font-semibold text-xs uppercase text-muted-foreground mb-2">Informações complementares</h4>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <Field label="Contrato (base)" value={selected.base.contrato} />
                    <Field label="Após Desc (peso fiscal)" value={fmtNum(selected.base.aposDesc)} />
                    <Field label="Total Líquido (peso físico)" value={fmtNum(selected.comp?.totalLiquido ?? null)} />
                    <div className="col-span-2">
                      <dt className="text-xs text-muted-foreground">Chave de acesso (GRL053)</dt>
                      <dd className="font-mono text-xs mt-0.5 flex items-center gap-2 break-all">
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
                </section>

                {!selected.comp && (
                  <p className="text-xs text-muted-foreground italic">
                    Nenhum registro correspondente no complementar para exibir nos pares comparativos.
                  </p>
                )}

                {selected.placaDivergente && (
                  <div className="flex items-start gap-2 rounded-md bg-warning-soft text-warning p-3">
                    <AlertTriangle className="h-4 w-4 mt-0.5" />
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
  // Comparação estritamente visual entre os valores já normalizados pelo fluxo existente; não participa do matching.
  const isSame = hasCompValue && baseValue === compValue;
  const tone = getComparisonTone(hasCompValue, isSame, severity);

  return (
    <div className={cn("rounded-lg border p-3", tone.card)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium text-sm">{label}</div>
          {note && <p className="text-[11px] text-muted-foreground mt-0.5">{note}</p>}
        </div>
        <Badge variant="outline" className={cn("shrink-0", tone.badge)}>
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
  <div className="rounded-md bg-background/70 border border-border/60 p-2 min-w-0">
    <div className="text-[11px] text-muted-foreground leading-tight">{label}</div>
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
      card: "bg-success-soft/50 border-success/30",
      badge: "bg-success-soft text-success border-success/30",
    };
  }

  // Divergência de placa tem tom de alerta porque é informativa; divergências de contrato/nota são chave visual.
  if (severity === "info") {
    return {
      label: "Alerta",
      card: "bg-warning-soft/60 border-warning/30",
      badge: "bg-warning-soft text-warning border-warning/30",
    };
  }

  return {
    label: "Diferentes",
    card: "bg-destructive-soft/50 border-destructive/30",
    badge: "bg-destructive-soft text-destructive border-destructive/30",
  };
};

const Field = ({ label, value }: { label: string; value: string }) => (
  <div>
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className="font-mono text-xs mt-0.5">{value || "—"}</dd>
  </div>
);

interface KpiProps {
  label: string;
  value: number;
  active: boolean;
  tone: "success" | "destructive" | "warning" | "info";
  onClick: () => void;
}

const KpiCard = ({ label, value, active, tone, onClick }: KpiProps) => {
  const toneMap = {
    success: "border-success/30 [&[data-active=true]]:bg-success-soft [&[data-active=true]]:border-success",
    destructive:
      "border-destructive/30 [&[data-active=true]]:bg-destructive-soft [&[data-active=true]]:border-destructive",
    warning: "border-warning/30 [&[data-active=true]]:bg-warning-soft [&[data-active=true]]:border-warning",
    info: "border-info/30 [&[data-active=true]]:bg-info-soft [&[data-active=true]]:border-info",
  };
  const valueColor = {
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
        "rounded-lg border bg-card p-4 text-left transition-all hover:shadow-md",
        toneMap[tone],
        active && "shadow-md",
      )}
    >
      <div className="text-xs text-muted-foreground font-medium">{label}</div>
      <div className={cn("text-2xl font-semibold mt-1 tabular-nums", valueColor[tone])}>{value}</div>
    </button>
  );
};

import { useMemo, useState } from "react";
import { ArrowLeft, Download, FileText, Search, AlertTriangle } from "lucide-react";
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

interface Props {
  empresa: string;
  cliente: string;
  rows: MatchedRow[];
  onReset: () => void;
}

type FilterKind = "ALL" | "OK" | "CONTRATO" | "NOTA" | "DIVERGENCIAS" | "ALERTAS";

const PAGE_SIZE = 25;

const fmtNum = (n: number | null) =>
  n === null ? "—" : n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const situacaoBadge = (s: Situacao) => {
  const map: Record<Situacao, string> = {
    OK: "bg-success-soft text-success border-success/30",
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
          `${r.base.contratoCliente} ${r.base.nota} ${r.base.placa} ${r.comp?.placa ?? ""} ${r.comp?.numeroNF ?? ""} ${r.comp?.nrContrOriginal ?? ""}`.toLowerCase();
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard label="Vínculo OK" value={kpis.ok} active={filter === "OK"} tone="success" onClick={() => setFilterAndReset(filter === "OK" ? "ALL" : "OK")} />
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
            value={kpis.divergencias - kpis.notaNaoEncontrada - kpis.contratoNaoEncontrado < 0 ? 0 : 0 /* placeholder */}
            active={filter === "DIVERGENCIAS"}
            tone="info"
            onClick={() => setFilterAndReset(filter === "DIVERGENCIAS" ? "ALL" : "DIVERGENCIAS")}
            displayValue={
              rows.filter((r) =>
                ["NOTA_OUTRO_CONTRATO", "CONTRATO_OUTRA_NOTA", "DUPLICIDADE"].includes(r.situacao),
              ).length
            }
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
                  <h4 className="font-semibold text-xs uppercase text-muted-foreground mb-2">Base — GRL053</h4>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <Field label="Placa" value={selected.base.placa} />
                    <Field label="Contrato" value={selected.base.contrato} />
                    <Field label="Contr. Cliente" value={selected.base.contratoCliente} />
                    <Field label="Nota" value={selected.base.nota} />
                    <Field label="Após Desc (peso fiscal)" value={fmtNum(selected.base.aposDesc)} />
                  </dl>
                </section>

                <section>
                  <h4 className="font-semibold text-xs uppercase text-muted-foreground mb-2">Complementar — Inpasa</h4>
                  {selected.comp ? (
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                      <Field label="Placa" value={selected.comp.placa} />
                      <Field label="Nr Contr Original" value={selected.comp.nrContrOriginal} />
                      <Field label="Número NF" value={selected.comp.numeroNF} />
                      <Field label="Total Líquido (peso físico)" value={fmtNum(selected.comp.totalLiquido)} />
                    </dl>
                  ) : (
                    <p className="text-muted-foreground italic">Nenhum registro correspondente no complementar.</p>
                  )}
                </section>

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

const Field = ({ label, value }: { label: string; value: string }) => (
  <div>
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className="font-mono text-xs mt-0.5">{value || "—"}</dd>
  </div>
);

interface KpiProps {
  label: string;
  value: number;
  displayValue?: number;
  active: boolean;
  tone: "success" | "destructive" | "warning" | "info";
  onClick: () => void;
}

const KpiCard = ({ label, value, displayValue, active, tone, onClick }: KpiProps) => {
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
      <div className={cn("text-2xl font-semibold mt-1 tabular-nums", valueColor[tone])}>
        {displayValue ?? value}
      </div>
    </button>
  );
};

import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { MatchedRow, situacaoLabel } from "./match";

interface ExportContext {
  empresa: string;
  cliente: string;
  rows: MatchedRow[];
}

const fmtNum = (n: number | null) =>
  n === null ? "" : n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function exportExcel({ empresa, cliente, rows }: ExportContext) {
  const data = rows.map((r) => ({
    Situação: situacaoLabel[r.situacao],
    Detalhe: r.detalhe,
    "Contrato Cliente (Base)": r.base.contratoCliente,
    "Contrato Original (Comp.)": r.comp?.nrContrOriginal ?? "",
    "Nota (Base)": r.base.nota,
    "NF (Comp.)": r.comp?.numeroNF ?? "",
    "Placa Base": r.base.placa,
    "Placa Cliente": r.comp?.placa ?? "",
    "Alerta Placa": r.placaDivergente ? "Sim" : "",
    "Peso Fiscal (Após Desc)": fmtNum(r.base.aposDesc),
    "Peso Físico (Total Líquido)": fmtNum(r.comp?.totalLiquido ?? null),
    Empresa: empresa,
    Cliente: cliente,
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!autofilter"] = { ref: ws["!ref"]! };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Conferência");
  XLSX.writeFile(wb, `conferencia-${Date.now()}.xlsx`);
}

export function exportPDF({ empresa, cliente, rows }: ExportContext) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFontSize(14);
  doc.text("Conferência de Contratos", 40, 40);
  doc.setFontSize(10);
  doc.text(`Empresa: ${empresa}`, 40, 58);
  doc.text(`Cliente: ${cliente}`, 300, 58);
  doc.text(`Total: ${rows.length}`, 560, 58);
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 40, 74);

  autoTable(doc, {
    startY: 90,
    head: [
      [
        "Situação",
        "Contr. Cliente",
        "Nota",
        "Placa Base",
        "Placa Cli.",
        "Peso Fiscal",
        "Peso Físico",
        "Detalhe",
      ],
    ],
    body: rows.map((r) => [
      situacaoLabel[r.situacao],
      r.base.contratoCliente,
      r.base.nota,
      r.base.placa + (r.placaDivergente ? " ⚠" : ""),
      r.comp?.placa ?? "",
      fmtNum(r.base.aposDesc),
      fmtNum(r.comp?.totalLiquido ?? null),
      r.detalhe,
    ]),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [27, 78, 168] },
    columnStyles: { 7: { cellWidth: 220 } },
  });

  doc.save(`conferencia-${Date.now()}.pdf`);
}

import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { MatchedRow, situacaoLabel } from "./match";
import { formatDataEmissao } from "./normalize";

interface ExportContext {
  empresa: string;
  cliente: string;
  rows: MatchedRow[];
}

const fmtNum = (n: number | null) =>
  n === null ? "" : n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const getExactMatchComp = (row: MatchedRow) =>
  // Exportações seguem a grid: placa cliente só representa vínculo correspondente quando a situação é OK.
  row.situacao === "OK" ? row.comp : null;

export function exportExcel({ empresa, cliente, rows }: ExportContext) {
  const data = rows.map((r) => {
    const exactComp = getExactMatchComp(r);

    return {
      Situação: situacaoLabel[r.situacao],
      "Data emissão": formatDataEmissao(r.base.data_emissao),
      "Contrato Cliente (Base)": r.base.contratoCliente,
      "Nota (Base)": r.base.nota,
      "Placa Base": r.base.placa,
      "Placa Cliente": exactComp?.placa ?? "",
      "Peso Fiscal (Após Desc)": fmtNum(r.base.aposDesc),
      "Peso Físico (Total Líquido)": fmtNum(exactComp?.totalLiquido ?? null),
      Detalhe: r.detalhe,
      "Contrato Original (Comp.)": exactComp?.nrContrOriginal ?? "",
      "NF (Comp.)": exactComp?.numeroNF ?? "",
      "Alerta Placa": r.placaDivergente ? "Sim" : "",
      Empresa: empresa,
      Cliente: cliente,
    };
  });
  const ws = XLSX.utils.json_to_sheet(data);
  ws["!autofilter"] = { ref: ws["!ref"]! };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Conferência");
  XLSX.writeFile(wb, `conferencia-${Date.now()}.xlsx`);
}

export function exportPDF({ empresa, cliente, rows }: ExportContext) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 40;
  const contentWidth = pageWidth - marginX * 2;
  const footerText = "Gerado por JM Assessoria e Contabilidade | www.jmassessoriamt.com.br";

  doc.setFontSize(14);
  doc.text("Conferência de Contratos", marginX, 40);

  doc.setFontSize(10);
  let headerY = 58;
  const lineHeight = 12;
  const empresaLines = doc.splitTextToSize(`Empresa: ${empresa}`, contentWidth);
  // Cabeçalho e rodapé organizados para evitar sobreposição e caracteres especiais com renderização inconsistente no PDF.
  doc.text(empresaLines, marginX, headerY);
  headerY += empresaLines.length * lineHeight + 6;

  const headerDetails = [`Cliente: ${cliente}`, `Total: ${rows.length}`, `Gerado em: ${new Date().toLocaleString("pt-BR")}`];
  const detailsGap = 18;
  const detailsWidth = headerDetails.reduce((total, text) => total + doc.getTextWidth(text), 0);

  if (detailsWidth + detailsGap * (headerDetails.length - 1) <= contentWidth) {
    let detailX = marginX;
    headerDetails.forEach((text) => {
      doc.text(text, detailX, headerY);
      detailX += doc.getTextWidth(text) + detailsGap;
    });
    headerY += lineHeight;
  } else {
    headerDetails.forEach((text) => {
      const detailLines = doc.splitTextToSize(text, contentWidth);
      doc.text(detailLines, marginX, headerY);
      headerY += detailLines.length * lineHeight;
    });
  }

  const tableStartY = Math.max(headerY + 18, 90);
  const drawFooter = (pageNumber: number) => {
    doc.setFontSize(8);
    doc.setTextColor(110);
    doc.text(`${footerText} | Página ${pageNumber}`, pageWidth / 2, pageHeight - 18, { align: "center" });
    doc.setTextColor(0);
  };

  autoTable(doc, {
    startY: tableStartY,
    margin: { bottom: 36 },
    head: [
      [
        "Situação",
        "Data emissão",
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
      formatDataEmissao(r.base.data_emissao),
      r.base.contratoCliente,
      r.base.nota,
      r.base.placa + (r.placaDivergente ? " (alerta)" : ""),
      getExactMatchComp(r)?.placa ?? "",
      fmtNum(r.base.aposDesc),
      fmtNum(getExactMatchComp(r)?.totalLiquido ?? null),
      r.detalhe,
    ]),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [27, 78, 168] },
    columnStyles: { 8: { cellWidth: 200 } },
    didDrawPage: (data) => drawFooter(data.pageNumber),
  });

  doc.save(`conferencia-${Date.now()}.pdf`);
}

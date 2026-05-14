import { useState } from "react";
import { UploadScreen } from "@/components/UploadScreen";
import { ResultsScreen } from "@/components/ResultsScreen";
import { readXlsx } from "@/lib/parseXlsx";
import { GRL053_LAYOUT, getClienteSuportado } from "@/lib/layouts";
import { match, MatchedRow, parseBaseWithStats, parseCompWithStats } from "@/lib/match";

interface ResultsState {
  empresa: string;
  cliente: string;
  rows: MatchedRow[];
  baseTotalArquivo: number;
  baseIgnoradasModalidade: number;
  baseIgnoradasCargaRecusada: number;
  compIgnoradasFsCargaRecusada: number;
}

const Index = () => {
  const [results, setResults] = useState<ResultsState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async ({
    baseFile,
    compFile,
    empresa,
    cliente,
    clienteId,
  }: {
    baseFile: File;
    compFile: File;
    empresa: string;
    cliente: string;
    clienteId: string;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const clienteLayout = getClienteSuportado(clienteId);
      const [baseRaw, compRaw] = await Promise.all([
        readXlsx(baseFile, {
          // Regra fixa da V1 (PRD-02/03): GRL053 usa primeira aba e cabeçalho na linha 3.
          // Não substituir por detecção automática sem nova decisão de produto.
          headerRow: GRL053_LAYOUT.headerRow,
          requiredColumns: GRL053_LAYOUT.requiredColumns,
          fileLabel: "Relatório Base (GRL053)",
        }),
        readXlsx(compFile, {
          // Regra fixa da V1 (PRD-02/03): complementar usa layout fixo do cliente selecionado.
          // Não substituir por detecção automática sem nova decisão de produto.
          headerRow: clienteLayout.headerRow,
          requiredColumns: clienteLayout.requiredColumns,
          fileLabel: `Relatório Complementar (${clienteLayout.label})`,
        }),
      ]);
      const baseImport = parseBaseWithStats(baseRaw);
      const compImport = parseCompWithStats(compRaw, clienteLayout.id);
      const rows = match(baseImport.base, compImport.comp);
      setResults({
        empresa: empresa.trim(),
        cliente: cliente.trim(),
        rows,
        baseTotalArquivo: baseImport.totalArquivo,
        baseIgnoradasModalidade: baseImport.ignoradasModalidade,
        baseIgnoradasCargaRecusada: baseImport.ignoradasCargaRecusada,
        compIgnoradasFsCargaRecusada: compImport.ignoradasFsCargaRecusada,
      });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Erro ao processar os arquivos.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (results) {
    return (
      <ResultsScreen
        empresa={results.empresa}
        cliente={results.cliente}
        rows={results.rows}
        baseTotalArquivo={results.baseTotalArquivo}
        baseIgnoradasModalidade={results.baseIgnoradasModalidade}
        baseIgnoradasCargaRecusada={results.baseIgnoradasCargaRecusada}
        compIgnoradasFsCargaRecusada={results.compIgnoradasFsCargaRecusada}
        onReset={() => setResults(null)}
      />
    );
  }

  return (
    <UploadScreen onSubmit={handleSubmit} loading={loading} error={error} />
  );
};

export default Index;

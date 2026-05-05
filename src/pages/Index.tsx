import { useState } from "react";
import { UploadScreen } from "@/components/UploadScreen";
import { ResultsScreen } from "@/components/ResultsScreen";
import { readXlsx, assertColumns } from "@/lib/parseXlsx";
import { match, MatchedRow, parseBase, parseComp } from "@/lib/match";

interface ResultsState {
  empresa: string;
  cliente: string;
  rows: MatchedRow[];
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
  }: {
    baseFile: File;
    compFile: File;
    empresa: string;
    cliente: string;
  }) => {
    setLoading(true);
    setError(null);
    try {
      const [baseRaw, compRaw] = await Promise.all([readXlsx(baseFile), readXlsx(compFile)]);
      assertColumns(baseRaw, ["PLACA", "CONTRATO", "NOTA", "CONTR. CLIENTE", "APOS DESC"], "Relatório Base (GRL053)");
      assertColumns(
        compRaw,
        ["Placa", "Número NF", "Nr Contr Original", "Total Líquido"],
        "Relatório Complementar (Inpasa)",
      );
      const base = parseBase(baseRaw);
      const comp = parseComp(compRaw);
      const rows = match(base, comp);
      setResults({ empresa: empresa.trim(), cliente: cliente.trim(), rows });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao processar os arquivos.");
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
        onReset={() => setResults(null)}
      />
    );
  }

  return <UploadScreen onSubmit={handleSubmit} loading={loading} error={error} />;
};

export default Index;

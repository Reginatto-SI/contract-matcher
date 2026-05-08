import { useRef, useState } from "react";
import { Upload, FileSpreadsheet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CLIENTES_SUPORTADOS,
  DEFAULT_CLIENTE_ID,
  GRL053_LAYOUT,
  getClienteSuportado,
} from "@/lib/layouts";
import { detectEmpresaFromGrl053 } from "@/lib/match";
import { readXlsx } from "@/lib/parseXlsx";
import { cn } from "@/lib/utils";

interface Props {
  onSubmit: (data: {
    baseFile: File;
    compFile: File;
    empresa: string;
    cliente: string;
    clienteId: string;
  }) => void;
  loading?: boolean;
  error?: string | null;
}

interface FilePickerProps {
  label: string;
  hint: string;
  file: File | null;
  onChange: (f: File | null) => void;
}

const FilePicker = ({ label, hint, file, onChange }: FilePickerProps) => {
  const ref = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onChange(f);
      }}
      className={cn(
        "border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer bg-muted/30",
        drag
          ? "border-primary bg-primary-soft"
          : "border-border hover:border-primary/60",
      )}
      onClick={() => ref.current?.click()}
    >
      <input
        ref={ref}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {file ? (
        <div className="flex items-center justify-center gap-3">
          <FileSpreadsheet className="h-6 w-6 text-success" />
          <div className="text-left">
            <div className="font-medium text-sm">{file.name}</div>
            <div className="text-xs text-muted-foreground">
              {(file.size / 1024).toFixed(1)} KB
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-2">
          <Upload className="h-8 w-8 text-muted-foreground" />
          <div className="font-medium text-sm">{label}</div>
          <div className="text-xs text-muted-foreground">{hint}</div>
        </div>
      )}
    </div>
  );
};

export const UploadScreen = ({ onSubmit, loading, error }: Props) => {
  const [baseFile, setBaseFile] = useState<File | null>(null);
  const [compFile, setCompFile] = useState<File | null>(null);
  const [empresa, setEmpresa] = useState("");
  const [clienteId, setClienteId] = useState(DEFAULT_CLIENTE_ID);
  const [empresaStatus, setEmpresaStatus] = useState<
    "auto" | "multiplas" | null
  >(null);
  const selectedCliente = getClienteSuportado(clienteId);

  const handleBaseFileChange = async (file: File | null) => {
    setBaseFile(file);
    setEmpresaStatus(null);
    // Ao remover ou trocar o GRL053, evita manter empresa identificada de um arquivo anterior.
    setEmpresa("");

    if (!file) return;

    try {
      const rows = await readXlsx(file, {
        headerRow: GRL053_LAYOUT.headerRow,
        requiredColumns: GRL053_LAYOUT.requiredColumns,
        fileLabel: "Relatório Base (GRL053)",
      });
      const detected = detectEmpresaFromGrl053(rows);

      if (!detected.empresa) return;

      // Preenchimento assistido: o usuário continua livre para ajustar manualmente antes de conferir.
      setEmpresa(detected.empresa);
      setEmpresaStatus(detected.multiplas ? "multiplas" : "auto");
    } catch {
      // A validação completa do arquivo permanece no submit para não bloquear a digitação manual da empresa.
      setEmpresaStatus(null);
    }
  };

  const ready = !!(
    baseFile &&
    compFile &&
    empresa.trim() &&
    selectedCliente?.label
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <h1 className="text-xl font-semibold">Conferência de Contratos</h1>
          <p className="text-sm text-muted-foreground">
            Cruzamento entre GRL053 (cooperativa) e relatório do cliente
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <Card className="p-8">
          <h2 className="text-lg font-semibold mb-1">
            Iniciar nova conferência
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Importe os dois relatórios em{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">.xlsx</code>{" "}
            ou{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">.xls</code>;
            o cliente vem de uma lista fixa e a empresa pode ser identificada
            pelo GRL053.
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div>
                <h3 className="font-medium text-sm">Relatório Base — GRL053</h3>
                <p className="text-xs text-muted-foreground">
                  Colunas: PLACA, CONTRATO, MOD, NOTA, CONTR. CLIENTE, APOS DESC
                </p>
              </div>
              <FilePicker
                label="Selecione o GRL053"
                hint="Clique ou arraste o arquivo .xlsx ou .xls"
                file={baseFile}
                onChange={handleBaseFileChange}
              />
              <div>
                <Label htmlFor="empresa">Empresa</Label>
                <Input
                  id="empresa"
                  value={empresa}
                  onChange={(e) => setEmpresa(e.target.value)}
                  placeholder="Ex.: Cooperativa Central"
                />
                {empresaStatus === "auto" && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Empresa identificada automaticamente pelo GRL053.
                  </p>
                )}
                {empresaStatus === "multiplas" && (
                  <p className="mt-1 text-xs text-amber-700">
                    Mais de uma empresa encontrada no GRL053. Confira o valor
                    preenchido antes de continuar.
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <h3 className="font-medium text-sm">
                  Relatório Complementar — {selectedCliente.label}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Colunas: {selectedCliente.requiredColumns.join(", ")}
                </p>
              </div>
              <FilePicker
                label={`Selecione o ${selectedCliente.label}`}
                hint="Clique ou arraste o arquivo .xlsx ou .xls"
                file={compFile}
                onChange={setCompFile}
              />
              <div>
                <Label htmlFor="cliente">Cliente</Label>
                <Select value={clienteId} onValueChange={setClienteId}>
                  <SelectTrigger id="cliente">
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {CLIENTES_SUPORTADOS.map((cliente) => (
                      <SelectItem key={cliente.id} value={cliente.id}>
                        {cliente.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-6 rounded-md bg-destructive-soft text-destructive text-sm p-3 border border-destructive/20">
              {error}
            </div>
          )}

          <div className="mt-8 flex justify-end">
            <Button
              size="lg"
              disabled={!ready || loading}
              onClick={() =>
                onSubmit({
                  baseFile: baseFile!,
                  compFile: compFile!,
                  empresa,
                  cliente: selectedCliente.label,
                  clienteId: selectedCliente.id,
                })
              }
            >
              {loading ? "Processando..." : "Conferir"}
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
};

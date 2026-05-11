import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Mantém o erro técnico visível para diagnóstico sem substituir as validações de importação/parsing existentes.
    console.error("Erro inesperado de renderização capturado pelo ErrorBoundary:", error, errorInfo);
  }

  private reloadSystem = () => {
    window.location.reload();
  };

  private backToStart = () => {
    window.location.assign("/");
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center px-6 py-10">
          <main className="w-full max-w-lg rounded-xl border bg-card p-6 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive-soft text-destructive">
              !
            </div>
            <h1 className="text-xl font-semibold text-foreground">Não foi possível exibir esta tela</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              O sistema encontrou um erro inesperado ao carregar os dados. Recarregue a página e tente importar os
              arquivos novamente. Se o problema continuar, envie um print desta tela para o suporte.
            </p>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={this.backToStart}
                className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Voltar ao início
              </button>
              <button
                type="button"
                onClick={this.reloadSystem}
                className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Recarregar sistema
              </button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">Erro registrado no console do navegador.</p>
          </main>
        </div>
      );
    }

    // Protege a aplicação contra tela branca em erros inesperados de renderização.
    return this.props.children;
  }
}

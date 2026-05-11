import { Component, ErrorInfo, ReactNode } from "react";
import { AppVersionLabel } from "@/components/AppVersionLabel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Erro inesperado capturado pelo ErrorBoundary:", error, errorInfo);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-muted px-6 py-10">
        <Card className="w-full max-w-lg p-8 text-center">
          <h1 className="mb-3 text-2xl font-semibold">Algo deu errado</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            O sistema encontrou um erro inesperado. Tente voltar ao início ou recarregar a aplicação.
          </p>

          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => (window.location.href = "/")}>
              Voltar ao início
            </Button>
            <Button type="button" onClick={() => window.location.reload()}>
              Recarregar sistema
            </Button>
          </div>

          {/* Versão discreta para suporte identificar build/cache mesmo na tela amigável de erro. */}
          <AppVersionLabel className="mt-6 text-center" />
        </Card>
      </div>
    );
  }
}

import { APP_VERSION } from "@/config/appVersion";
import { GENERATED_VERSION } from "@/config/generatedVersion";
import { cn } from "@/lib/utils";

interface AppVersionLabelProps {
  className?: string;
}

export const AppVersionLabel = ({ className }: AppVersionLabelProps) => {
  // Exibição discreta para suporte diagnosticar cache/deploy sem alterar o fluxo principal do usuário.
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      {APP_VERSION.appName} • {APP_VERSION.label} • Build {GENERATED_VERSION.build} • Atualizado em{" "}
      {GENERATED_VERSION.updatedAt}
    </p>
  );
};

import { ExternalLink, FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Grl053FiltersDialogProps {
  size?: "default" | "sm" | "lg" | "icon";
}

// Modal compartilhado para manter o mesmo tutorial de filtros GRL053 nas telas de importação e resultados.
export const Grl053FiltersDialog = ({
  size = "sm",
}: Grl053FiltersDialogProps) => (
  <Dialog>
    <DialogTrigger asChild>
      <Button variant="outline" size={size} className="gap-1.5">
        <FileSearch className="h-4 w-4" />
        Filtros GRL053
      </Button>
    </DialogTrigger>
    <DialogContent className="grid max-h-[90vh] max-w-6xl grid-rows-[auto,minmax(0,1fr),auto] overflow-hidden">
      <DialogHeader className="pr-6">
        <DialogTitle>Tutorial GRL053 — filtros do relatório base</DialogTitle>
        <DialogDescription>
          Use esta imagem como referência para gerar o relatório GRL053 com os
          filtros aceitos pelo sistema.
        </DialogDescription>
      </DialogHeader>
      <div className="min-h-0 overflow-auto rounded-lg border bg-muted/20 p-2">
        <img
          src="/tutorials/tutorial-grl053.jpeg"
          alt="Tutorial visual dos filtros do relatório base GRL053"
          className="mx-auto h-auto max-h-[72vh] w-auto max-w-full object-contain"
        />
      </div>
      <DialogFooter>
        <Button variant="outline" asChild>
          <a
            href="/tutorials/tutorial-grl053.jpeg"
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink className="h-4 w-4" />
            Abrir em tamanho original
          </a>
        </Button>
        <DialogClose asChild>
          <Button>Fechar</Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

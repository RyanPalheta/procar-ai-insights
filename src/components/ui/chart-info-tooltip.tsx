import type { ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ChartInfoTooltipProps {
  /** O que o gráfico mostra e quais números são confrontados/analisados. */
  description: ReactNode;
  /** De onde vem o dado: Kommo/Supabase/API e quais leads entram (ex.: com campo X preenchido). */
  source?: ReactNode;
  /** Breve explicação de COMO o indicador é calculado. */
  calculation?: ReactNode;
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
}

/**
 * Bolinha com "?" que, ao passar o mouse, explica o gráfico:
 * o que mostra, quais números são confrontados/analisados e como é calculado.
 * Usar ao lado do título de TODO gráfico do dashboard.
 */
export function ChartInfoTooltip({
  description,
  source,
  calculation,
  className,
  side = "top",
}: ChartInfoTooltipProps) {
  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Como ler este gráfico"
            className={cn(
              "inline-flex shrink-0 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              className,
            )}
          >
            <CircleHelp className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side={side}
          className="max-w-xs space-y-1.5 p-3 text-xs font-normal leading-relaxed"
        >
          <p className="text-popover-foreground">{description}</p>
          {source && (
            <p className="text-muted-foreground">
              <span className="font-semibold text-popover-foreground">Fonte: </span>
              {source}
            </p>
          )}
          {calculation && (
            <p className="text-muted-foreground">
              <span className="font-semibold text-popover-foreground">Como é calculado: </span>
              {calculation}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

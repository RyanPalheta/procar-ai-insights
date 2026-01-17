import { Sparkles } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface AIFieldLabelProps {
  children: React.ReactNode;
  className?: string;
  iconOnly?: boolean;
}

export function AIFieldLabel({ children, className, iconOnly = false }: AIFieldLabelProps) {
  if (iconOnly) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Sparkles className="h-3 w-3 text-primary inline-block" />
        </TooltipTrigger>
        <TooltipContent>
          <p>Gerado pela IA</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      {children}
      <Tooltip>
        <TooltipTrigger asChild>
          <Sparkles className="h-3 w-3 text-primary" />
        </TooltipTrigger>
        <TooltipContent>
          <p>Gerado pela IA</p>
        </TooltipContent>
      </Tooltip>
    </span>
  );
}

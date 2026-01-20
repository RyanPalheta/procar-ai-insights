import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Paleta semântica baseada no funil de vendas
const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  // Etapas iniciais - tons de slate
  "Aguardando atendimento": { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300", border: "border-slate-300 dark:border-slate-600" },
  "Contato inicial": { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300", border: "border-slate-300 dark:border-slate-600" },
  
  // Em progresso - tons de azul
  "Em atendimento (qualificação)": { bg: "bg-blue-100 dark:bg-blue-900/50", text: "text-blue-700 dark:text-blue-300", border: "border-blue-300 dark:border-blue-700" },
  "Em qualificação": { bg: "bg-blue-100 dark:bg-blue-900/50", text: "text-blue-700 dark:text-blue-300", border: "border-blue-300 dark:border-blue-700" },
  "Qualificação": { bg: "bg-blue-100 dark:bg-blue-900/50", text: "text-blue-700 dark:text-blue-300", border: "border-blue-300 dark:border-blue-700" },
  
  // Agendamento - tons de cyan/teal
  "Agendamento confirmado": { bg: "bg-cyan-100 dark:bg-cyan-900/50", text: "text-cyan-700 dark:text-cyan-300", border: "border-cyan-300 dark:border-cyan-700" },
  "Faltou agendamento": { bg: "bg-red-100 dark:bg-red-900/50", text: "text-red-700 dark:text-red-300", border: "border-red-300 dark:border-red-700" },
  
  // Negociação - tons de âmbar
  "Em Negociação": { bg: "bg-amber-100 dark:bg-amber-900/50", text: "text-amber-700 dark:text-amber-300", border: "border-amber-300 dark:border-amber-700" },
  "Proposta/Negociação": { bg: "bg-amber-100 dark:bg-amber-900/50", text: "text-amber-700 dark:text-amber-300", border: "border-amber-300 dark:border-amber-700" },
  "Tomada de decisão": { bg: "bg-amber-100 dark:bg-amber-900/50", text: "text-amber-700 dark:text-amber-300", border: "border-amber-300 dark:border-amber-700" },
  
  // Follow-up - laranja
  "Follow-up": { bg: "bg-orange-100 dark:bg-orange-900/50", text: "text-orange-700 dark:text-orange-300", border: "border-orange-300 dark:border-orange-700" },
  "Recuperação de clientes": { bg: "bg-orange-100 dark:bg-orange-900/50", text: "text-orange-700 dark:text-orange-300", border: "border-orange-300 dark:border-orange-700" },
  
  // Finais positivos - verde
  "Venda ganha": { bg: "bg-green-100 dark:bg-green-900/50", text: "text-green-700 dark:text-green-300", border: "border-green-300 dark:border-green-700" },
  "Venda Ganha": { bg: "bg-green-100 dark:bg-green-900/50", text: "text-green-700 dark:text-green-300", border: "border-green-300 dark:border-green-700" },
  
  // Finais negativos - vermelho
  "Venda perdida": { bg: "bg-red-100 dark:bg-red-900/50", text: "text-red-700 dark:text-red-300", border: "border-red-300 dark:border-red-700" },
  "Venda Perdida": { bg: "bg-red-100 dark:bg-red-900/50", text: "text-red-700 dark:text-red-300", border: "border-red-300 dark:border-red-700" },
  "Cancelamento": { bg: "bg-red-100 dark:bg-red-900/50", text: "text-red-700 dark:text-red-300", border: "border-red-300 dark:border-red-700" },
};

const getStatusColors = (statusName: string): { bg: string; text: string; border: string } => {
  // Match exato
  if (STATUS_COLORS[statusName]) {
    return STATUS_COLORS[statusName];
  }
  
  // Match por palavra-chave (case-insensitive)
  const lowerName = statusName.toLowerCase();
  
  if (lowerName.includes('ganha') || lowerName.includes('fechad') || lowerName.includes('won')) {
    return { bg: "bg-green-100 dark:bg-green-900/50", text: "text-green-700 dark:text-green-300", border: "border-green-300 dark:border-green-700" };
  }
  if (lowerName.includes('perdida') || lowerName.includes('cancel') || lowerName.includes('lost')) {
    return { bg: "bg-red-100 dark:bg-red-900/50", text: "text-red-700 dark:text-red-300", border: "border-red-300 dark:border-red-700" };
  }
  if (lowerName.includes('atendimento') || lowerName.includes('qualificação')) {
    return { bg: "bg-blue-100 dark:bg-blue-900/50", text: "text-blue-700 dark:text-blue-300", border: "border-blue-300 dark:border-blue-700" };
  }
  if (lowerName.includes('negociação') || lowerName.includes('proposta') || lowerName.includes('decisão')) {
    return { bg: "bg-amber-100 dark:bg-amber-900/50", text: "text-amber-700 dark:text-amber-300", border: "border-amber-300 dark:border-amber-700" };
  }
  if (lowerName.includes('agendamento') || lowerName.includes('confirmad')) {
    return { bg: "bg-cyan-100 dark:bg-cyan-900/50", text: "text-cyan-700 dark:text-cyan-300", border: "border-cyan-300 dark:border-cyan-700" };
  }
  if (lowerName.includes('faltou')) {
    return { bg: "bg-red-100 dark:bg-red-900/50", text: "text-red-700 dark:text-red-300", border: "border-red-300 dark:border-red-700" };
  }
  if (lowerName.includes('follow') || lowerName.includes('recuperação')) {
    return { bg: "bg-orange-100 dark:bg-orange-900/50", text: "text-orange-700 dark:text-orange-300", border: "border-orange-300 dark:border-orange-700" };
  }
  if (lowerName.includes('aguardando') || lowerName.includes('inicial') || lowerName.includes('contato')) {
    return { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300", border: "border-slate-300 dark:border-slate-600" };
  }
  
  // Fallback - cor neutra
  return { bg: "bg-muted", text: "text-muted-foreground", border: "border-border" };
};

interface StatusBadgeProps {
  status: string | null | undefined;
  className?: string;
  size?: "sm" | "default" | "lg";
}

export function StatusBadge({ status, className, size = "default" }: StatusBadgeProps) {
  if (!status) {
    return (
      <Badge 
        variant="outline" 
        className={cn(
          "bg-muted text-muted-foreground border-border",
          size === "sm" && "text-xs px-1.5 py-0",
          size === "lg" && "text-sm px-3 py-1",
          className
        )}
      >
        Sem status
      </Badge>
    );
  }

  const colors = getStatusColors(status);

  return (
    <Badge 
      variant="outline"
      className={cn(
        colors.bg,
        colors.text,
        colors.border,
        "font-medium border",
        size === "sm" && "text-xs px-1.5 py-0",
        size === "lg" && "text-sm px-3 py-1",
        className
      )}
    >
      {status}
    </Badge>
  );
}

// Export the color getter for use in charts
export { getStatusColors };

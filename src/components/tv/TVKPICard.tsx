import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChartInfoTooltip } from "@/components/ui/chart-info-tooltip";

interface TVKPICardProps {
  title: string;
  value: string | number;
  /** Mantido por compatibilidade com os chamadores; o ícone não é mais exibido. */
  icon?: LucideIcon;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  /** Mantido por compatibilidade; o chip de ícone que usava o alerta foi removido. */
  isAlert?: boolean;
  subtitle?: string;
  info?: {
    description: string;
    source?: string;
    calculation?: string;
  };
}

export function TVKPICard({
  title,
  value,
  trend,
  subtitle,
  info
}: TVKPICardProps) {
  return (
    <div className="app-card relative bg-card rounded-2xl shadow-md p-6 border border-border h-full flex flex-col">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-muted-foreground text-lg font-medium">{title}</span>
        {info && (
          <ChartInfoTooltip
            className="ml-auto"
            description={info.description}
            source={info.source}
            calculation={info.calculation}
          />
        )}
      </div>
      
      <div className="flex-1 flex flex-col justify-center">
        <div className="text-5xl xl:text-6xl font-bold text-foreground mb-2 tabular-nums">
          {value}
        </div>

        {subtitle && (
          <p className="text-muted-foreground text-sm mb-2">{subtitle}</p>
        )}

        {trend && (
          <div className={cn(
            "inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-semibold w-fit",
            trend.isPositive
              ? "bg-success/15 text-success"
              : "bg-warning/15 text-warning"
          )}>
            {trend.isPositive ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            {trend.value}
          </div>
        )}
      </div>
    </div>
  );
}

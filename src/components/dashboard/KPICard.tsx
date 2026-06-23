import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { ChartInfoTooltip } from "@/components/ui/chart-info-tooltip";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string | number;
  /** Mantido por compatibilidade com os chamadores; o ícone não é mais exibido. */
  icon?: LucideIcon;
  description?: string;
  trend?: {
    value: number;
    isPositive: boolean;
    isNegativeChange?: boolean;
  };
  /** Mantido por compatibilidade; o chip de ícone que usava o variant foi removido. */
  variant?: "default" | "success" | "warning" | "destructive";
  /** Explicação no hover (bolinha "?"): o que mostra, Fonte do dado e como é calculado. */
  info?: {
    description: string;
    source?: string;
    calculation?: string;
  };
}

export function KPICard({
  title,
  value,
  description,
  trend,
  info,
}: KPICardProps) {
  // Trend badge styles
  const trendBadgeStyles = trend?.isPositive
    ? "bg-success/15 text-success border-success/25"
    : "bg-warning/15 text-warning border-warning/25";

  return (
    <MagicBentoCard
      enableStars={true}
      enableBorderGlow={true}
      enableTilt={false}
      enableMagnetism={false}
      clickEffect={true}
      glowColor="228, 0, 43"
      className="rounded-lg"
    >
      <Card className="bg-card border border-border/60 shadow-sm hover:shadow-md transition-shadow duration-200 h-full">
        <CardContent className="p-2.5 sm:p-3">
          {/* Título ocupa a largura toda (não corta). O badge de tendência desce
              para a linha do valor — ao lado do número, padrão p/ % de variação. */}
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-0.5 leading-tight line-clamp-2 min-h-[2.5em]">{title}</p>
          <div className="flex items-end gap-2">
            <p className="text-2xl font-extrabold tracking-tight leading-tight tabular-nums">{value}</p>
            {(info || trend) && (
              <div className="flex items-center gap-1 flex-shrink-0 pb-1">
                {trend && (
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] font-semibold px-1 py-0 h-5 flex items-center gap-0.5",
                      trendBadgeStyles
                    )}
                  >
                    {trend.isNegativeChange ? (
                      <TrendingDown className="h-2.5 w-2.5" />
                    ) : (
                      <TrendingUp className="h-2.5 w-2.5" />
                    )}
                    {trend.isNegativeChange ? "-" : "+"}{trend.value}%
                  </Badge>
                )}
                {info && (
                  <ChartInfoTooltip
                    description={info.description}
                    source={info.source}
                    calculation={info.calculation}
                  />
                )}
              </div>
            )}
          </div>

          {description && (
            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{description}</p>
          )}
        </CardContent>
      </Card>
    </MagicBentoCard>
  );
}

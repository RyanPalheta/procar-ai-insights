import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: {
    value: number;
    isPositive: boolean;
    isNegativeChange?: boolean;
  };
  variant?: "default" | "success" | "warning" | "destructive";
}

export function KPICard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  variant = "default",
}: KPICardProps) {
  // Icon background colors based on variant
  const iconBgStyles = {
    default: "bg-primary/10 text-primary",
    success: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
    warning: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
    destructive: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  };

  // Trend badge styles
  const trendBadgeStyles = trend?.isPositive 
    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
    : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800";

  return (
    <MagicBentoCard
      enableStars={true}
      enableBorderGlow={true}
      enableTilt={false}
      enableMagnetism={false}
      clickEffect={true}
      glowColor="59, 130, 246"
      className="rounded-lg"
    >
      <Card className="bg-card border border-border/60 shadow-sm hover:shadow-md transition-shadow duration-200 h-full">
        <CardContent className="p-2.5 sm:p-3">
          {/* Top row: Icon + Badge */}
          <div className="flex items-start justify-between mb-1.5">
            <div className={cn(
              "flex items-center justify-center w-7 h-7 rounded-md",
              iconBgStyles[variant]
            )}>
              <Icon className="h-3.5 w-3.5" />
            </div>

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
          </div>

          <p className="text-[11px] text-muted-foreground mb-0.5 leading-tight truncate">{title}</p>
          <p className="text-lg font-bold tracking-tight leading-tight">{value}</p>

          {description && (
            <p className="text-[10px] text-muted-foreground/60 mt-0.5 truncate">{description}</p>
          )}
        </CardContent>
      </Card>
    </MagicBentoCard>
  );
}

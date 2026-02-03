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
      <Card className="bg-card border-border h-full">
        <CardContent className="p-4">
          {/* Top row: Icon + Badge */}
          <div className="flex items-start justify-between mb-3">
            {/* Large Icon with colored background */}
            <div className={cn(
              "flex items-center justify-center w-11 h-11 rounded-xl",
              iconBgStyles[variant]
            )}>
              <Icon className="h-5 w-5" />
            </div>
            
            {/* Trend Badge in top right */}
            {trend && (
              <Badge 
                variant="outline" 
                className={cn(
                  "text-xs font-semibold px-2 py-0.5 flex items-center gap-1",
                  trendBadgeStyles
                )}
              >
                {trend.isNegativeChange ? (
                  <TrendingDown className="h-3 w-3" />
                ) : (
                  <TrendingUp className="h-3 w-3" />
                )}
                {trend.isNegativeChange ? "-" : "+"}{trend.value}%
              </Badge>
            )}
          </div>
          
          {/* Title */}
          <p className="text-sm text-muted-foreground mb-1">{title}</p>
          
          {/* Value */}
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          
          {/* Description */}
          {description && (
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          )}
        </CardContent>
      </Card>
    </MagicBentoCard>
  );
}

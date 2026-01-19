import { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    isNegativeChange?: boolean; // True when the actual change was negative (e.g., -77%)
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
  const variantStyles = {
    default: "text-primary",
    success: "text-emerald-500",
    warning: "text-amber-500",
    destructive: "text-red-500",
  };

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
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Icon className={cn("h-4 w-4", variantStyles[variant])} />
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-2xl font-bold">{value}</span>
            {trend && (
              <span
                className={cn(
                  "text-sm font-medium",
                  trend.isPositive ? "text-emerald-500" : "text-amber-500"
                )}
              >
                {trend.isNegativeChange ? "↓" : "↑"} {trend.isNegativeChange ? "-" : "+"}{trend.value}% vs. período ant.
              </span>
            )}
          </div>
          {description && (
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          )}
        </CardContent>
      </Card>
    </MagicBentoCard>
  );
}

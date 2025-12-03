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
    default: "text-purple-400",
    success: "text-emerald-400",
    warning: "text-amber-400",
    destructive: "text-red-400",
  };

  return (
    <MagicBentoCard
      enableStars={true}
      enableBorderGlow={true}
      enableTilt={true}
      enableMagnetism={true}
      clickEffect={true}
      glowColor="132, 0, 255"
      className="rounded-lg"
    >
      <Card className="bg-[#060010] border-[#392e4e] text-white h-full">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-white/90">{title}</CardTitle>
          <Icon className={cn("h-4 w-4", variantStyles[variant])} />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">{value}</div>
          {description && (
            <p className="text-xs text-white/60 mt-1">{description}</p>
          )}
          {trend && (
            <p
              className={cn(
                "text-xs mt-1",
                trend.isPositive ? "text-emerald-400" : "text-red-400"
              )}
            >
              {trend.isPositive ? "+" : ""}
              {trend.value}% em relação ao período anterior
            </p>
          )}
        </CardContent>
      </Card>
    </MagicBentoCard>
  );
}

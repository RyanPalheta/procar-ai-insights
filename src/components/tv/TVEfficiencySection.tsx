import { DollarSign, Tag, MessageSquare, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChartInfoTooltip } from "@/components/ui/chart-info-tooltip";

interface EfficiencyMetric {
  label: string;
  icon: "financial" | "promo" | "objection";
  value: number;
  isActive?: boolean;
}

interface TVSectionInfo {
  description: string;
  source?: string;
  calculation?: string;
}

interface TVEfficiencySectionProps {
  metrics: EfficiencyMetric[];
  info?: TVSectionInfo;
}

const iconMap = {
  financial: DollarSign,
  promo: Tag,
  objection: MessageSquare,
};

export function TVEfficiencySection({ metrics, info }: TVEfficiencySectionProps) {
  return (
    <div className="app-card relative bg-card rounded-2xl shadow-md p-6 border border-border h-full">
      <h3 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
        Eficiência Comercial
        {info && (
          <ChartInfoTooltip
            description={info.description}
            source={info.source}
            calculation={info.calculation}
          />
        )}
      </h3>
      
      <div className="grid grid-cols-3 gap-4 h-[calc(100%-3.5rem)]">
        {metrics.map((metric, index) => {
          const Icon = iconMap[metric.icon];
          const isGood = metric.value >= 50;
          
          return (
            <div
              key={index}
              className="flex flex-col items-center justify-center p-4 rounded-xl transition-all bg-muted/40"
            >
              <div className={cn(
                "p-4 rounded-full mb-3 bg-muted",
                isGood ? "text-success" : "text-warning"
              )}>
                <Icon className="h-8 w-8" />
              </div>

              <span className="text-foreground font-medium text-center text-sm mb-2">
                {metric.label}
              </span>

              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-2xl font-bold tabular-nums",
                  isGood ? "text-success" : "text-warning"
                )}>
                  {metric.value}%
                </span>
                {isGood ? (
                  <Check className="h-5 w-5 text-success" />
                ) : (
                  <X className="h-5 w-5 text-warning" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

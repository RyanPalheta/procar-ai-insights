import { AlertTriangle, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChartInfoTooltip } from "@/components/ui/chart-info-tooltip";

interface QualityMetric {
  label: string;
  value: number;
  showAlert?: boolean;
}

interface TVSectionInfo {
  description: string;
  source?: string;
  calculation?: string;
}

interface TVQualitySectionProps {
  metrics: QualityMetric[];
  insight?: string;
  info?: TVSectionInfo;
}

function TVProgressBar({ 
  label, 
  value, 
  showAlert = true 
}: QualityMetric) {
  const isLow = value < 70;
  
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-foreground font-medium text-lg flex items-center gap-2">
          {label}
          {showAlert && isLow && (
            <AlertTriangle className="h-5 w-5 text-warning" />
          )}
        </span>
        <span className={cn(
          "text-2xl font-bold tabular-nums",
          isLow ? "text-warning" : "text-success"
        )}>
          {value}%
        </span>
      </div>
      <div className="h-4 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            isLow ? "bg-warning" : "bg-success"
          )}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  );
}

export function TVQualitySection({ metrics, insight, info }: TVQualitySectionProps) {
  return (
    <div className="app-card relative bg-card rounded-2xl shadow-md p-6 border border-border h-full">
      <h3 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
        Qualidade de Atendimento
        {info && (
          <ChartInfoTooltip
            description={info.description}
            source={info.source}
            calculation={info.calculation}
          />
        )}
      </h3>
      
      <div className="space-y-5">
        {metrics.map((metric, index) => (
          <TVProgressBar 
            key={index} 
            label={metric.label} 
            value={metric.value}
            showAlert={metric.showAlert}
          />
        ))}
      </div>
      
      {insight && (
        <div className="mt-6 flex items-start gap-3 p-4 bg-primary/5 border border-primary/15 rounded-xl">
          <Lightbulb className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-foreground text-sm font-medium">{insight}</p>
        </div>
      )}
    </div>
  );
}

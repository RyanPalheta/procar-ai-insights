import { AlertTriangle, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

interface QualityMetric {
  label: string;
  value: number;
  showAlert?: boolean;
}

interface TVQualitySectionProps {
  metrics: QualityMetric[];
  insight?: string;
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
        <span className="text-slate-700 font-medium text-lg flex items-center gap-2">
          {label}
          {showAlert && isLow && (
            <AlertTriangle className="h-5 w-5 text-orange-500" />
          )}
        </span>
        <span className={cn(
          "text-2xl font-bold",
          isLow ? "text-orange-600" : "text-green-600"
        )}>
          {value}%
        </span>
      </div>
      <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
        <div 
          className={cn(
            "h-full rounded-full transition-all duration-500",
            isLow ? "bg-orange-500" : "bg-green-500"
          )}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  );
}

export function TVQualitySection({ metrics, insight }: TVQualitySectionProps) {
  return (
    <div className="bg-white rounded-2xl shadow-md p-6 border border-slate-100 h-full">
      <h3 className="text-xl font-semibold text-slate-800 mb-6">
        Qualidade de Atendimento
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
        <div className="mt-6 flex items-start gap-3 p-4 bg-blue-50 rounded-xl">
          <Lightbulb className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-blue-800 text-sm font-medium">{insight}</p>
        </div>
      )}
    </div>
  );
}

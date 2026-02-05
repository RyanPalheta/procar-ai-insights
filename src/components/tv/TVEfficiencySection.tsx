import { DollarSign, Tag, MessageSquare, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface EfficiencyMetric {
  label: string;
  icon: "financial" | "promo" | "objection";
  value: number;
  isActive?: boolean;
}

interface TVEfficiencySectionProps {
  metrics: EfficiencyMetric[];
}

const iconMap = {
  financial: DollarSign,
  promo: Tag,
  objection: MessageSquare,
};

export function TVEfficiencySection({ metrics }: TVEfficiencySectionProps) {
  return (
    <div className="bg-white rounded-2xl shadow-md p-6 border border-slate-100 h-full">
      <h3 className="text-xl font-semibold text-slate-800 mb-6">
        Eficiência Comercial
      </h3>
      
      <div className="grid grid-cols-3 gap-4 h-[calc(100%-3.5rem)]">
        {metrics.map((metric, index) => {
          const Icon = iconMap[metric.icon];
          const isGood = metric.value >= 50;
          
          return (
            <div 
              key={index}
              className={cn(
                "flex flex-col items-center justify-center p-4 rounded-xl transition-all",
                isGood ? "bg-green-50" : "bg-orange-50"
              )}
            >
              <div className={cn(
                "p-4 rounded-full mb-3",
                isGood ? "bg-green-100" : "bg-orange-100"
              )}>
                <Icon className={cn(
                  "h-8 w-8",
                  isGood ? "text-green-600" : "text-orange-600"
                )} />
              </div>
              
              <span className="text-slate-700 font-medium text-center text-sm mb-2">
                {metric.label}
              </span>
              
              <div className="flex items-center gap-2">
                <span className={cn(
                  "text-2xl font-bold",
                  isGood ? "text-green-600" : "text-orange-600"
                )}>
                  {metric.value}%
                </span>
                {isGood ? (
                  <Check className="h-5 w-5 text-green-600" />
                ) : (
                  <X className="h-5 w-5 text-orange-600" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

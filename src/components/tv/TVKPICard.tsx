import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface TVKPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  isAlert?: boolean;
  subtitle?: string;
}

export function TVKPICard({ 
  title, 
  value, 
  icon: Icon, 
  trend,
  isAlert = false,
  subtitle
}: TVKPICardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-md p-6 border border-slate-100 h-full flex flex-col">
      <div className="flex items-center gap-3 mb-3">
        <div className={cn(
          "p-3 rounded-xl",
          isAlert ? "bg-orange-100" : "bg-green-100"
        )}>
          <Icon className={cn(
            "h-6 w-6",
            isAlert ? "text-orange-600" : "text-green-600"
          )} />
        </div>
        <span className="text-slate-500 text-lg font-medium">{title}</span>
      </div>
      
      <div className="flex-1 flex flex-col justify-center">
        <div className="text-5xl xl:text-6xl font-bold text-slate-800 mb-2">
          {value}
        </div>
        
        {subtitle && (
          <p className="text-slate-400 text-sm mb-2">{subtitle}</p>
        )}
        
        {trend && (
          <div className={cn(
            "inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-semibold w-fit",
            trend.isPositive 
              ? "bg-green-100 text-green-700" 
              : "bg-orange-100 text-orange-700"
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

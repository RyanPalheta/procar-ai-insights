import { AlertTriangle, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

interface ObjectionItem {
  rank: number;
  label: string;
  overcomeRate: number;
  count?: number;
}

interface TVObjectionRankingProps {
  objections: ObjectionItem[];
  overallRate: number;
  alertMessage?: string;
}

export function TVObjectionRanking({ 
  objections, 
  overallRate,
  alertMessage 
}: TVObjectionRankingProps) {
  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1: return "text-amber-500";
      case 2: return "text-slate-400";
      case 3: return "text-amber-700";
      default: return "text-slate-500";
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-md p-6 border border-slate-100">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-slate-800">
          Foco de Melhoria - Objeções
        </h3>
        
        <div className={cn(
          "px-4 py-2 rounded-full font-semibold text-lg",
          overallRate >= 60 ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
        )}>
          Contorno Geral: {overallRate}%
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {objections.slice(0, 3).map((objection) => {
          const isLow = objection.overcomeRate < 60;
          
          return (
            <div 
              key={objection.rank}
              className={cn(
                "p-4 rounded-xl border-2",
                isLow ? "border-orange-200 bg-orange-50" : "border-green-200 bg-green-50"
              )}
            >
              <div className="flex items-center gap-2 mb-3">
                <Trophy className={cn("h-5 w-5", getRankColor(objection.rank))} />
                <span className="text-slate-500 text-sm font-medium">
                  {objection.rank}º Mais Frequente
                </span>
              </div>
              
              <h4 className="text-lg font-bold text-slate-800 mb-3">
                {objection.label}
              </h4>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 text-sm">Taxa de Contorno</span>
                  <span className={cn(
                    "text-xl font-bold",
                    isLow ? "text-orange-600" : "text-green-600"
                  )}>
                    {objection.overcomeRate}%
                  </span>
                </div>
                
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      isLow ? "bg-orange-500" : "bg-green-500"
                    )}
                    style={{ width: `${Math.min(objection.overcomeRate, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {alertMessage && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
          <p className="text-amber-800 font-medium">{alertMessage}</p>
        </div>
      )}
    </div>
  );
}

import { AlertTriangle, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChartInfoTooltip } from "@/components/ui/chart-info-tooltip";

interface ObjectionItem {
  rank: number;
  label: string;
  overcomeRate: number;
  count?: number;
}

interface TVSectionInfo {
  description: string;
  source?: string;
  calculation?: string;
}

interface TVObjectionRankingProps {
  objections: ObjectionItem[];
  overallRate: number;
  alertMessage?: string;
  info?: TVSectionInfo;
}

export function TVObjectionRanking({
  objections,
  overallRate,
  alertMessage,
  info
}: TVObjectionRankingProps) {
  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1: return "text-amber-500";
      case 2: return "text-slate-400";
      case 3: return "text-amber-700";
      default: return "text-muted-foreground";
    }
  };

  return (
    <div className="app-card relative bg-card rounded-2xl shadow-md p-6 border border-border">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-foreground flex items-center gap-2">
          Foco de Melhoria - Objeções
          {info && (
            <ChartInfoTooltip
              description={info.description}
              source={info.source}
              calculation={info.calculation}
            />
          )}
        </h3>
        
        <div className={cn(
          "px-4 py-2 rounded-full font-semibold text-lg tabular-nums",
          overallRate >= 60 ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
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
                isLow ? "border-warning/25 bg-warning/10" : "border-success/25 bg-success/10"
              )}
            >
              <div className="flex items-center gap-2 mb-3">
                <Trophy className={cn("h-5 w-5", getRankColor(objection.rank))} />
                <span className="text-muted-foreground text-sm font-medium">
                  {objection.rank}º Mais Frequente
                </span>
              </div>

              <h4 className="text-lg font-bold text-foreground mb-3">
                {objection.label}
              </h4>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Taxa de Contorno</span>
                  <span className={cn(
                    "text-xl font-bold tabular-nums",
                    isLow ? "text-warning" : "text-success"
                  )}>
                    {objection.overcomeRate}%
                  </span>
                </div>

                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      isLow ? "bg-warning" : "bg-success"
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
        <div className="flex items-center gap-3 p-4 bg-warning/10 rounded-xl border border-warning/25">
          <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0" />
          <p className="text-foreground font-medium">{alertMessage}</p>
        </div>
      )}
    </div>
  );
}

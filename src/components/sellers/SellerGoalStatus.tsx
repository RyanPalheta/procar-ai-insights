import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export interface GoalData {
  metric: string;
  metricLabel: string;
  target: number;
  direction: string; // '>=' or '<='
  currentValue: number;
}

export type GoalStatusType = "on_track" | "attention" | "behind";

const ATTENTION_THRESHOLD = 0.10; // 10%

export function calculateGoalStatus(goal: GoalData): GoalStatusType {
  const { target, direction, currentValue } = goal;
  if (target === 0) return "on_track";

  if (direction === ">=") {
    if (currentValue >= target) return "on_track";
    const distance = (target - currentValue) / target;
    return distance <= ATTENTION_THRESHOLD ? "attention" : "behind";
  } else {
    // '<=' — lower is better (e.g., response time)
    if (currentValue <= target) return "on_track";
    const distance = (currentValue - target) / target;
    return distance <= ATTENTION_THRESHOLD ? "attention" : "behind";
  }
}

export function getGoalProgress(goal: GoalData): number {
  const { target, direction, currentValue } = goal;
  if (target === 0) return 100;
  if (direction === ">=") {
    return Math.min(100, (currentValue / target) * 100);
  } else {
    if (currentValue <= 0) return 100;
    // Invert: lower is better
    return Math.min(100, (target / currentValue) * 100);
  }
}

const statusConfig: Record<GoalStatusType, { label: string; variant: "success" | "warning" | "destructive"; color: string }> = {
  on_track: { label: "Em dia", variant: "success", color: "bg-emerald-500" },
  attention: { label: "Atenção", variant: "warning", color: "bg-amber-500" },
  behind: { label: "Abaixo", variant: "destructive", color: "bg-red-500" },
};

interface SellerGoalStatusProps {
  goal: GoalData;
  compact?: boolean;
}

export function SellerGoalStatus({ goal, compact = false }: SellerGoalStatusProps) {
  const status = calculateGoalStatus(goal);
  const progress = getGoalProgress(goal);
  const config = statusConfig[status];

  if (compact) {
    return (
      <Badge variant={config.variant} className="text-xs">
        {config.label}
      </Badge>
    );
  }

  const formatValue = (val: number, metric: string) => {
    if (metric.includes("rate") || metric === "conversion_rate" || metric === "objections_overcome_rate") {
      return `${val.toFixed(1)}%`;
    }
    if (metric === "avg_quoted_price") return `R$ ${val.toFixed(0)}`;
    if (metric === "median_first_response_time") return `${val.toFixed(0)} min`;
    return val.toFixed(0);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{goal.metricLabel}</span>
        <div className="flex items-center gap-2">
          <span className="font-medium">
            {formatValue(goal.currentValue, goal.metric)} / {formatValue(goal.target, goal.metric)}
          </span>
          <Badge variant={config.variant} className="text-xs">
            {config.label}
          </Badge>
        </div>
      </div>
      <Progress
        value={progress}
        className={cn("h-2", status === "on_track" && "[&>div]:bg-emerald-500", status === "attention" && "[&>div]:bg-amber-500", status === "behind" && "[&>div]:bg-red-500")}
      />
    </div>
  );
}

interface GoalsSummaryProps {
  goals: GoalData[];
}

export function GoalsSummary({ goals }: GoalsSummaryProps) {
  const counts = { on_track: 0, attention: 0, behind: 0 };
  goals.forEach(g => {
    counts[calculateGoalStatus(g)]++;
  });

  return (
    <div className="flex items-center gap-2 text-xs">
      {counts.on_track > 0 && (
        <Badge variant="success" className="text-xs">{counts.on_track} em dia</Badge>
      )}
      {counts.attention > 0 && (
        <Badge variant="warning" className="text-xs">{counts.attention} atenção</Badge>
      )}
      {counts.behind > 0 && (
        <Badge variant="destructive" className="text-xs">{counts.behind} abaixo</Badge>
      )}
    </div>
  );
}

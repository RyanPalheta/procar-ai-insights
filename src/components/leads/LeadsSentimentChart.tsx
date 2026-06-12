import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { ChartInfoTooltip } from "@/components/ui/chart-info-tooltip";
import { motion, useReducedMotion } from "framer-motion";
import { Smile, Meh, Frown, LucideIcon } from "lucide-react";

interface LeadsSentimentChartProps {
  data: { name: string; value: number }[];
}

const SENTIMENT_CONFIG: Record<string, { icon: LucideIcon; color: string; chipClass: string; label: string }> = {
  "Positivo": { icon: Smile, color: "hsl(var(--success))", chipClass: "bg-success/15 text-success", label: "Positivo" },
  "Neutro": { icon: Meh, color: "hsl(var(--warning))", chipClass: "bg-warning/15 text-warning", label: "Neutro" },
  "Negativo": { icon: Frown, color: "hsl(var(--destructive-foreground))", chipClass: "bg-destructive text-destructive-foreground", label: "Negativo" },
};

export function LeadsSentimentChart({ data }: LeadsSentimentChartProps) {
  const prefersReducedMotion = useReducedMotion();
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const sortedData = [...data].sort((a, b) => b.value - a.value);

  return (
    <MagicBentoCard className="rounded-lg" glowColor="228, 0, 43">
      <Card className="bg-card border-border h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smile className="h-4 w-4 text-primary" />
            Distribuição de Sentimento
            <ChartInfoTooltip
              description="Separa os clientes pelo clima da conversa que a IA percebeu (Positivo, Neutro, Negativo). Cada barra mostra quantos clientes e qual a porcentagem de cada clima."
              source="conta os clientes que a IA já analisou e para os quais conseguiu identificar o clima da conversa (quem ficou sem clima identificado não entra na conta)."
              calculation="conta quantos clientes ficaram em cada clima (Positivo, Neutro ou Negativo). A porcentagem é os clientes daquele clima divididos pelo total de clientes com clima identificado, vezes 100."
            />
          </CardTitle>
          {total > 0 && (
            <p className="text-xs text-muted-foreground">
              {total.toLocaleString("pt-BR")} conversas analisadas pela IA
            </p>
          )}
        </CardHeader>
        <CardContent>
          {total > 0 ? (
            <div className="space-y-4 py-2">
              {sortedData.map((item, index) => {
                const config = SENTIMENT_CONFIG[item.name];
                if (!config) return null;

                const Icon = config.icon;
                const percentage = total > 0 ? (item.value / total) * 100 : 0;

                return (
                  <div key={item.name} className="flex items-center gap-3">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0 ${config.chipClass}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium w-20 flex-shrink-0">{config.label}</span>
                    <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: config.color }}
                        initial={{ width: prefersReducedMotion ? `${percentage}%` : 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ delay: index * 0.08, duration: 0.6, ease: "easeOut" }}
                      />
                    </div>
                    <span className="text-sm tabular-nums text-right w-24 flex-shrink-0">
                      <span className="font-bold">{percentage.toFixed(0)}%</span>
                      <span className="text-muted-foreground text-xs"> · {item.value}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-[140px] flex items-center justify-center text-muted-foreground">
              Sem dados disponíveis
            </div>
          )}
        </CardContent>
      </Card>
    </MagicBentoCard>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { ChartInfoTooltip } from "@/components/ui/chart-info-tooltip";
import { motion, useReducedMotion } from "framer-motion";
import { Globe } from "lucide-react";

interface LeadsLanguageChartProps {
  data: { name: string; value: number }[];
}

const LANGUAGE_CONFIG: Record<string, { code: string; label: string }> = {
  "PT-BR": { code: "PT-BR", label: "Português (BR)" },
  "EN-USA": { code: "EN-US", label: "English (USA)" },
  "ES-ES": { code: "ES", label: "Español" },
  "EN-ES": { code: "ES", label: "Español" },
  "ES": { code: "ES", label: "Español" },
  "EN": { code: "EN", label: "English" },
  "PT": { code: "PT", label: "Português" },
  // tem conversa no painel, mas o backfill/IA ainda não preencheu o idioma
  "SEM-IDIOMA": { code: "N/D", label: "Sem idioma (ainda)" },
  // sem conversa no painel: telefone (não há chat) ou espelho da Kommo cujas
  // mensagens não foram ingeridas (ex.: queda da VPS) — não há o que detectar
  "NAO-PROCESSAVEL": { code: "—", label: "Não pode ser processado" },
};

const DEFAULT_CONFIG = { code: "?", label: "Outro" };

// idiomas reais ciclam a paleta da marca; categorias "sem idioma" ficam neutras
const SERIES_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-5))",
];
const NEUTRAL_COLOR = "hsl(var(--chart-4))";
const NEUTRAL_KEYS = new Set(["SEM-IDIOMA", "NAO-PROCESSAVEL"]);

export function LeadsLanguageChart({ data }: LeadsLanguageChartProps) {
  const prefersReducedMotion = useReducedMotion();
  const total = data.reduce((acc, item) => acc + item.value, 0);
  const sortedData = [...data].sort((a, b) => b.value - a.value);

  let colorIndex = 0;
  const rows = sortedData.map((item) => {
    const config = LANGUAGE_CONFIG[item.name] || DEFAULT_CONFIG;
    const color = NEUTRAL_KEYS.has(item.name)
      ? NEUTRAL_COLOR
      : SERIES_COLORS[colorIndex++ % SERIES_COLORS.length];
    return { ...item, config, color };
  });

  return (
    <MagicBentoCard className="rounded-lg" glowColor="228, 0, 43">
      <Card className="bg-card border-border h-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            Leads por Língua
            <ChartInfoTooltip
              description="Separa os clientes pelo idioma identificado na conversa (ex.: PT-BR, EN-USA, ES). Cada barra mostra a quantidade e o percentual de cada idioma."
              source="o idioma é identificado na conversa de chat (varredura diária + IA). 'Sem idioma (ainda)' = lead com conversa que a varredura ainda não preencheu (ex.: recém-chegado ou só mídia). 'Não pode ser processado' = lead sem conversa no painel: telefone (não há chat) e leads espelhados do Kommo cujas mensagens não foram processadas — assim o gráfico soma igual aos cards."
              calculation="conta quantos clientes têm cada idioma e calcula o percentual: clientes daquele idioma dividido pelo total de clientes do período, vezes 100."
            />
          </CardTitle>
          {total > 0 && (
            <p className="text-xs text-muted-foreground">
              {total.toLocaleString("pt-BR")} leads no período
            </p>
          )}
        </CardHeader>
        <CardContent>
          {total > 0 ? (
            <div className="space-y-4 py-2">
              {rows.map((item, index) => {
                const percentage = total > 0 ? (item.value / total) * 100 : 0;

                return (
                  <div key={item.name} className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-14 py-1 rounded-md bg-muted font-mono text-[10px] font-bold flex-shrink-0">
                      {item.config.code}
                    </span>
                    <span className="text-xs text-muted-foreground w-28 truncate flex-shrink-0" title={item.config.label}>
                      {item.config.label}
                    </span>
                    <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: item.color }}
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

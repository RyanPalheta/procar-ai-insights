import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { motion } from "framer-motion";

interface LeadsLanguageMapChartProps {
  data: { name: string; value: number }[];
}

const LANGUAGE_CONFIG: Record<string, { flag: string; color: string; label: string }> = {
  "EN-USA": { flag: "🇺🇸", color: "hsl(var(--chart-1))", label: "United States" },
  "PT-BR": { flag: "🇧🇷", color: "hsl(var(--chart-2))", label: "Brazil" },
  "ES-ES": { flag: "🇪🇸", color: "hsl(var(--chart-3))", label: "Spain" },
  "EN-UK": { flag: "🇬🇧", color: "hsl(var(--chart-4))", label: "United Kingdom" },
  "FR-FR": { flag: "🇫🇷", color: "hsl(var(--chart-5))", label: "France" },
};

const DEFAULT_CONFIG = { flag: "🌐", color: "hsl(var(--muted-foreground))", label: "Other" };

export function LeadsLanguageMapChart({ data }: LeadsLanguageMapChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const sortedData = [...data].sort((a, b) => b.value - a.value);
  const maxValue = sortedData[0]?.value || 1;

  const getConfig = (code: string) => LANGUAGE_CONFIG[code] || { ...DEFAULT_CONFIG, label: code };

  // Size based on percentage
  const getSize = (value: number) => {
    const percentage = (value / total) * 100;
    if (percentage >= 50) return "text-6xl";
    if (percentage >= 25) return "text-5xl";
    if (percentage >= 10) return "text-4xl";
    return "text-3xl";
  };

  const getOpacity = (value: number) => {
    const percentage = (value / total) * 100;
    if (percentage >= 50) return 1;
    if (percentage >= 25) return 0.85;
    if (percentage >= 10) return 0.7;
    return 0.55;
  };

  return (
    <MagicBentoCard className="rounded-lg" glowColor="59, 130, 246">
      <Card className="bg-card border-border h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Leads por Idioma</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row gap-6 min-h-[300px]">
            {/* Flags Section */}
            <div className="flex-1 flex items-center justify-center">
              <div className="relative w-full h-[200px] flex items-center justify-center">
                {/* Background map silhouette */}
                <div className="absolute inset-0 opacity-10">
                  <svg viewBox="0 0 1000 500" className="w-full h-full">
                    <path
                      d="M150,120 Q200,100 250,120 T350,110 Q400,100 450,120 L500,150 Q550,130 600,150 L650,120 Q700,110 750,130 L800,150 Q850,140 900,160 L920,200 Q900,250 850,280 L800,300 Q750,320 700,310 L650,290 Q600,300 550,280 L500,300 Q450,320 400,300 L350,280 Q300,290 250,270 L200,250 Q150,270 100,250 L80,200 Q100,150 150,120 Z"
                      fill="currentColor"
                      className="text-muted-foreground"
                    />
                  </svg>
                </div>
                
                {/* Flags display */}
                <div className="relative z-10 flex flex-wrap items-center justify-center gap-4">
                  {sortedData.slice(0, 4).map((item, index) => {
                    const config = getConfig(item.name);
                    const percentage = ((item.value / total) * 100).toFixed(1);
                    
                    return (
                      <motion.div
                        key={item.name}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: getOpacity(item.value) }}
                        transition={{ delay: index * 0.1, type: "spring", stiffness: 200 }}
                        className="flex flex-col items-center"
                      >
                        <span className={`${getSize(item.value)} drop-shadow-lg`}>
                          {config.flag}
                        </span>
                        <span className="text-xs text-muted-foreground mt-1">
                          {item.value} ({percentage}%)
                        </span>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Progress bars section */}
            <div className="flex-1 flex flex-col justify-center space-y-3">
              {sortedData.map((item, index) => {
                const config = getConfig(item.name);
                const percentage = (item.value / total) * 100;
                const barWidth = (item.value / maxValue) * 100;

                return (
                  <motion.div
                    key={item.name}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.08 }}
                    className="flex items-center gap-3"
                  >
                    <span className="text-2xl w-8">{config.flag}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-foreground">
                          {config.label}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {percentage.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${barWidth}%` }}
                          transition={{ delay: index * 0.08 + 0.2, duration: 0.5, ease: "easeOut" }}
                          className="h-full rounded-full"
                          style={{ backgroundColor: config.color }}
                        />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </MagicBentoCard>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { motion } from "framer-motion";

interface LeadsLanguageChartProps {
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

export function LeadsLanguageMapChart({ data }: LeadsLanguageChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const sortedData = [...data].sort((a, b) => b.value - a.value);
  const maxValue = sortedData[0]?.value || 1;

  const getConfig = (code: string) => LANGUAGE_CONFIG[code] || { ...DEFAULT_CONFIG, label: code };

  const getSize = (value: number) => {
    const percentage = (value / total) * 100;
    if (percentage >= 50) return "text-5xl";
    if (percentage >= 25) return "text-4xl";
    if (percentage >= 10) return "text-3xl";
    return "text-2xl";
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
          <div className="flex flex-col lg:flex-row gap-4 min-h-[300px]">
            {/* Map Section */}
            <div className="flex-1 flex items-center justify-center relative">
              {/* World Map SVG */}
              <svg
                viewBox="0 0 1000 500"
                className="w-full h-auto max-h-[280px]"
                style={{ opacity: 0.15 }}
              >
                {/* North America */}
                <path
                  d="M150,100 L180,80 L220,75 L260,80 L280,100 L300,90 L340,95 L360,110 L340,130 L320,150 L280,160 L250,180 L220,200 L180,210 L150,200 L130,170 L120,140 L130,110 Z"
                  fill="currentColor"
                  className="text-muted-foreground"
                />
                {/* Central America */}
                <path
                  d="M220,200 L240,220 L230,250 L210,270 L190,260 L200,240 L210,220 Z"
                  fill="currentColor"
                  className="text-muted-foreground"
                />
                {/* South America */}
                <path
                  d="M230,270 L260,280 L290,300 L310,340 L300,380 L280,420 L250,440 L220,430 L200,400 L210,360 L220,320 L210,290 Z"
                  fill="currentColor"
                  className="text-muted-foreground"
                />
                {/* Europe */}
                <path
                  d="M450,80 L480,70 L520,75 L550,90 L570,110 L560,130 L540,140 L510,150 L480,145 L460,130 L450,110 Z"
                  fill="currentColor"
                  className="text-muted-foreground"
                />
                {/* UK/Ireland */}
                <path
                  d="M430,90 L445,85 L450,100 L445,115 L430,110 Z"
                  fill="currentColor"
                  className="text-muted-foreground"
                />
                {/* Africa */}
                <path
                  d="M480,160 L520,150 L560,160 L590,180 L600,220 L590,270 L570,320 L540,360 L500,370 L470,350 L460,310 L470,260 L460,210 L470,180 Z"
                  fill="currentColor"
                  className="text-muted-foreground"
                />
                {/* Middle East */}
                <path
                  d="M570,130 L610,120 L640,140 L650,170 L630,190 L600,180 L580,160 Z"
                  fill="currentColor"
                  className="text-muted-foreground"
                />
                {/* Russia/Asia */}
                <path
                  d="M560,70 L620,60 L700,55 L780,60 L850,70 L880,90 L870,110 L840,120 L780,115 L720,120 L660,115 L610,110 L580,100 Z"
                  fill="currentColor"
                  className="text-muted-foreground"
                />
                {/* India */}
                <path
                  d="M660,150 L700,140 L730,160 L720,200 L690,230 L660,220 L650,190 L660,170 Z"
                  fill="currentColor"
                  className="text-muted-foreground"
                />
                {/* China/East Asia */}
                <path
                  d="M720,100 L770,90 L820,100 L850,120 L840,150 L810,170 L770,180 L730,170 L710,150 L720,120 Z"
                  fill="currentColor"
                  className="text-muted-foreground"
                />
                {/* Southeast Asia */}
                <path
                  d="M760,190 L790,180 L820,190 L830,220 L810,250 L780,260 L760,240 L750,210 Z"
                  fill="currentColor"
                  className="text-muted-foreground"
                />
                {/* Japan */}
                <path
                  d="M860,120 L875,110 L885,130 L880,150 L865,155 L855,140 Z"
                  fill="currentColor"
                  className="text-muted-foreground"
                />
                {/* Australia */}
                <path
                  d="M780,320 L830,310 L880,320 L900,350 L890,390 L850,410 L800,400 L770,370 L780,340 Z"
                  fill="currentColor"
                  className="text-muted-foreground"
                />
                {/* New Zealand */}
                <path
                  d="M920,400 L935,395 L940,420 L930,430 L920,420 Z"
                  fill="currentColor"
                  className="text-muted-foreground"
                />
              </svg>

              {/* Flags overlay on map */}
              <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-3 p-4">
                {sortedData.slice(0, 4).map((item, index) => {
                  const config = getConfig(item.name);
                  const percentage = ((item.value / total) * 100).toFixed(1);

                  return (
                    <motion.div
                      key={item.name}
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: getOpacity(item.value) }}
                      transition={{ delay: index * 0.1, type: "spring", stiffness: 200 }}
                      className="flex flex-col items-center bg-card/80 backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg border border-border/50"
                    >
                      <span className={`${getSize(item.value)} drop-shadow-lg`}>
                        {config.flag}
                      </span>
                      <span className="text-xs font-medium text-foreground mt-1">
                        {item.value}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {percentage}%
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Progress bars section */}
            <div className="flex-1 flex flex-col justify-center space-y-3 lg:pl-4">
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

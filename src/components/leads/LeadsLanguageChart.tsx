import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { motion } from "framer-motion";

interface LeadsLanguageChartProps {
  data: { name: string; value: number }[];
}

const LANGUAGE_CONFIG: Record<string, { flag: string; color: string; label: string }> = {
  "PT-BR": { flag: "🇧🇷", color: "#3b82f6", label: "Português (BR)" },
  "EN-USA": { flag: "🇺🇸", color: "#8b5cf6", label: "English (USA)" },
  "ES-ES": { flag: "🇪🇸", color: "#f97316", label: "Español" },
  "EN-ES": { flag: "🇪🇸", color: "#f97316", label: "Español" },
  "ES": { flag: "🇪🇸", color: "#f97316", label: "Español" },
  "EN": { flag: "🇬🇧", color: "#22c55e", label: "English" },
  "PT": { flag: "🇵🇹", color: "#ef4444", label: "Português" },
};

const DEFAULT_CONFIG = { flag: "🌐", color: "#9ca3af", label: "Outro" };

export function LeadsLanguageChart({ data }: LeadsLanguageChartProps) {
  const total = data.reduce((acc, item) => acc + item.value, 0);
  const sortedData = [...data].sort((a, b) => b.value - a.value);
  const maxValue = sortedData[0]?.value || 1;

  const getSize = (value: number) => {
    const minSize = 48;
    const maxSize = 96;
    const ratio = value / maxValue;
    return minSize + (maxSize - minSize) * ratio;
  };

  const getOpacity = (value: number) => {
    const minOpacity = 0.4;
    const maxOpacity = 1;
    const ratio = value / maxValue;
    return minOpacity + (maxOpacity - minOpacity) * ratio;
  };

  return (
    <MagicBentoCard className="rounded-lg" glowColor="59, 130, 246">
      <Card className="bg-[#060010] border-[#392e4e] text-white h-full">
        <CardHeader>
          <CardTitle className="text-white">Leads por Língua</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-6">
            {/* Flags Section */}
            <div className="flex items-end justify-center gap-6 min-h-[120px]">
              {sortedData.map((item, index) => {
                const config = LANGUAGE_CONFIG[item.name] || DEFAULT_CONFIG;
                const size = getSize(item.value);
                const opacity = getOpacity(item.value);
                const percentage = total > 0 ? ((item.value / total) * 100).toFixed(0) : 0;

                return (
                  <motion.div
                    key={item.name}
                    className="flex flex-col items-center gap-2"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1, type: "spring", stiffness: 200 }}
                  >
                    <motion.div
                      className="flex items-center justify-center cursor-pointer"
                      style={{
                        fontSize: size,
                        opacity: opacity,
                        filter: `drop-shadow(0 4px 8px ${config.color}40)`
                      }}
                      whileHover={{ scale: 1.1 }}
                    >
                      {config.flag}
                    </motion.div>
                    <div className="text-center">
                      <p className="text-xs font-medium text-white/60">{config.label}</p>
                      <p className="text-lg font-bold text-white">{item.value}</p>
                      <p className="text-xs text-white/60">{percentage}%</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Progress Bars Section */}
            <div className="w-full space-y-3 pt-4 border-t border-[#392e4e]">
              {sortedData.map((item, index) => {
                const config = LANGUAGE_CONFIG[item.name] || DEFAULT_CONFIG;
                const percentage = total > 0 ? (item.value / total) * 100 : 0;

                return (
                  <div key={item.name} className="flex items-center gap-3">
                    <span className="text-lg w-8">{config.flag}</span>
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-white/60">{config.label}</span>
                        <span className="font-medium text-white">{percentage.toFixed(0)}%</span>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ backgroundColor: config.color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ delay: 0.3 + index * 0.1, duration: 0.6, ease: "easeOut" }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </MagicBentoCard>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { motion } from "framer-motion";

interface LeadsSentimentChartProps {
  data: { name: string; value: number }[];
}

const SENTIMENT_CONFIG: Record<string, { emoji: string; color: string; label: string }> = {
  "Positivo": { emoji: "😊", color: "#22c55e", label: "Positivo" },
  "Neutro": { emoji: "😐", color: "#eab308", label: "Neutro" },
  "Negativo": { emoji: "😞", color: "#ef4444", label: "Negativo" }
};

export function LeadsSentimentChart({ data }: LeadsSentimentChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  
  const sortedData = [...data].sort((a, b) => b.value - a.value);
  const maxValue = sortedData[0]?.value || 1;

  const getSize = (value: number) => {
    const percentage = value / maxValue;
    const minSize = 48;
    const maxSize = 96;
    return minSize + (percentage * (maxSize - minSize));
  };

  const getOpacity = (value: number) => {
    const percentage = value / maxValue;
    const minOpacity = 0.4;
    return minOpacity + (percentage * (1 - minOpacity));
  };

  return (
    <MagicBentoCard className="rounded-lg" glowColor="59, 130, 246">
      <Card className="bg-[#060010] border-[#392e4e] text-white h-full">
        <CardHeader>
          <CardTitle className="text-white">Distribuição de Sentimento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-6 py-8">
            {sortedData.map((item, index) => {
              const config = SENTIMENT_CONFIG[item.name];
              if (!config) return null;
              
              const size = getSize(item.value);
              const opacity = getOpacity(item.value);
              const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : "0";

              return (
                <motion.div
                  key={item.name}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: index * 0.1, type: "spring", stiffness: 200 }}
                  className="flex flex-col items-center gap-2"
                >
                  <motion.div
                    className="flex items-center justify-center transition-all duration-300"
                    style={{ 
                      fontSize: size,
                      opacity: opacity,
                      filter: `drop-shadow(0 4px 8px ${config.color}40)`
                    }}
                    animate={index === 0 ? {
                      scale: [1, 1.1, 1],
                      filter: [
                        `drop-shadow(0 4px 8px ${config.color}40)`,
                        `drop-shadow(0 8px 16px ${config.color}60)`,
                        `drop-shadow(0 4px 8px ${config.color}40)`
                      ]
                    } : {}}
                    transition={index === 0 ? {
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    } : {}}
                    whileHover={{ scale: 1.15 }}
                  >
                    {config.emoji}
                  </motion.div>
                  <div className="text-center">
                    <p 
                      className="font-semibold text-sm"
                      style={{ color: config.color }}
                    >
                      {config.label}
                    </p>
                    <p className="text-xs text-white/60">
                      {item.value} ({percentage}%)
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
          
          {/* Bar indicator */}
          <div className="mt-4 space-y-2">
            {sortedData.map((item) => {
              const config = SENTIMENT_CONFIG[item.name];
              if (!config) return null;
              
              const percentage = total > 0 ? (item.value / total) * 100 : 0;

              return (
                <div key={item.name} className="flex items-center gap-2">
                  <span className="text-sm w-20 text-white/80">{config.label}</span>
                  <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: config.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  </div>
                  <span className="text-xs text-white/60 w-12 text-right">
                    {percentage.toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </MagicBentoCard>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { Thermometer } from "lucide-react";
import { useMemo } from "react";

interface LeadsTemperatureChartProps {
  data: { name: string; value: number }[];
}

export function LeadsTemperatureChart({ data }: LeadsTemperatureChartProps) {
  const { temperatureLabel, temperatureColor, fillPercentage } = useMemo(() => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    
    if (total === 0) {
      return { 
        temperatureLabel: "N/A", 
        temperatureColor: "hsl(var(--muted))",
        fillPercentage: 0 
      };
    }

    const temperatureValues: Record<string, number> = {
      "Quente": 3,
      "Morno": 2,
      "Frio": 1
    };

    let weightedSum = 0;
    data.forEach(item => {
      const weight = temperatureValues[item.name] || 0;
      weightedSum += weight * item.value;
    });

    const avgScore = weightedSum / total;
    const fillPct = ((avgScore - 1) / 2) * 100;

    let label = "Frio";
    let color = "#3b82f6";
    
    if (avgScore >= 2.5) {
      label = "Quente";
      color = "#f97316";
    } else if (avgScore >= 1.5) {
      label = "Morno";
      color = "#eab308";
    }

    return {
      temperatureLabel: label,
      temperatureColor: color,
      fillPercentage: fillPct
    };
  }, [data]);

  const total = data.reduce((sum, item) => sum + item.value, 0);
  const quente = data.find(d => d.name === "Quente")?.value || 0;
  const morno = data.find(d => d.name === "Morno")?.value || 0;
  const frio = data.find(d => d.name === "Frio")?.value || 0;

  return (
    <MagicBentoCard className="rounded-lg" glowColor="132, 0, 255">
      <Card className="bg-[#060010] border-[#392e4e] text-white h-full">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg text-white">
            <Thermometer className="h-5 w-5" />
            Temperatura dos Leads
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-12 h-[280px]">
            {/* Thermometer */}
            <div className="flex flex-col items-center">
              <div 
                className="text-xl font-semibold mb-3"
                style={{ color: temperatureColor }}
              >
                {temperatureLabel}
              </div>
              
              <div className="relative flex flex-col items-center">
                {/* Tube */}
                <div className="w-6 h-36 bg-white/10 rounded-t-full relative">
                  <div 
                    className="absolute bottom-0 left-0 right-0 transition-all duration-700"
                    style={{ 
                      height: `${Math.max(fillPercentage, 10)}%`,
                      backgroundColor: temperatureColor,
                      borderTopLeftRadius: '9999px',
                      borderTopRightRadius: '9999px'
                    }}
                  />
                </div>
                {/* Bulb */}
                <div 
                  className="w-10 h-10 rounded-full -mt-3 relative z-10 transition-colors duration-700"
                  style={{ backgroundColor: temperatureColor }}
                />
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-col gap-4 text-sm">
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-[#f97316]" />
                <span className="text-white/60 w-14">Quente</span>
                <span className="font-medium text-white">{quente}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-[#eab308]" />
                <span className="text-white/60 w-14">Morno</span>
                <span className="font-medium text-white">{morno}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]" />
                <span className="text-white/60 w-14">Frio</span>
                <span className="font-medium text-white">{frio}</span>
              </div>
              <div className="border-t border-[#392e4e] pt-3 mt-1 text-white/60">
                Total: <span className="font-medium text-white">{total}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </MagicBentoCard>
  );
}

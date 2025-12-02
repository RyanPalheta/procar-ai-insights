import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Thermometer } from "lucide-react";
import { useMemo } from "react";

interface LeadsTemperatureChartProps {
  data: { name: string; value: number }[];
}

export function LeadsTemperatureChart({ data }: LeadsTemperatureChartProps) {
  const { averageScore, temperatureLabel, temperatureColor, fillPercentage } = useMemo(() => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    
    if (total === 0) {
      return { 
        averageScore: 0, 
        temperatureLabel: "N/A", 
        temperatureColor: "hsl(var(--muted))",
        fillPercentage: 0 
      };
    }

    // Calculate weighted average: Quente=3, Morno=2, Frio=1
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
    const fillPct = ((avgScore - 1) / 2) * 100; // Normalize 1-3 to 0-100%

    let label = "Frio";
    let color = "#3b82f6"; // blue
    
    if (avgScore >= 2.5) {
      label = "Quente";
      color = "#f97316"; // orange
    } else if (avgScore >= 1.5) {
      label = "Morno";
      color = "#eab308"; // yellow
    }

    return {
      averageScore: avgScore,
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
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Thermometer className="h-5 w-5" />
          Temperatura dos Leads
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center gap-8 h-[280px]">
          {/* Thermometer */}
          <div className="relative flex flex-col items-center">
            {/* Temperature display */}
            <div 
              className="text-2xl font-bold mb-2"
              style={{ color: temperatureColor }}
            >
              {temperatureLabel}
            </div>
            
            {/* Thermometer body */}
            <div className="relative">
              {/* Tube */}
              <div className="relative w-8 h-40 bg-muted rounded-t-full border-4 border-border overflow-hidden">
                {/* Fill */}
                <div 
                  className="absolute bottom-0 left-0 right-0 transition-all duration-700 ease-out rounded-t-sm"
                  style={{ 
                    height: `${fillPercentage}%`,
                    background: `linear-gradient(to top, ${temperatureColor}, ${temperatureColor}dd)`
                  }}
                />
                {/* Scale marks */}
                <div className="absolute inset-0 flex flex-col justify-between py-2 pointer-events-none">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex justify-end pr-1">
                      <div className="w-2 h-0.5 bg-border/50" />
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Bulb */}
              <div 
                className="w-12 h-12 rounded-full border-4 border-border -mt-2 mx-auto flex items-center justify-center transition-colors duration-700"
                style={{ backgroundColor: temperatureColor }}
              >
                <div 
                  className="w-6 h-6 rounded-full opacity-50"
                  style={{ backgroundColor: temperatureColor, filter: "brightness(1.3)" }}
                />
              </div>
            </div>

            {/* Scale labels */}
            <div className="absolute right-[-45px] top-[38px] flex flex-col justify-between h-40 text-xs text-muted-foreground">
              <span>Quente</span>
              <span>Morno</span>
              <span>Frio</span>
            </div>
          </div>

          {/* Stats */}
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#f97316" }} />
              <span className="text-muted-foreground">Quente:</span>
              <span className="font-semibold">{quente}</span>
              {total > 0 && (
                <span className="text-muted-foreground text-xs">
                  ({((quente / total) * 100).toFixed(0)}%)
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#eab308" }} />
              <span className="text-muted-foreground">Morno:</span>
              <span className="font-semibold">{morno}</span>
              {total > 0 && (
                <span className="text-muted-foreground text-xs">
                  ({((morno / total) * 100).toFixed(0)}%)
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "#3b82f6" }} />
              <span className="text-muted-foreground">Frio:</span>
              <span className="font-semibold">{frio}</span>
              {total > 0 && (
                <span className="text-muted-foreground text-xs">
                  ({((frio / total) * 100).toFixed(0)}%)
                </span>
              )}
            </div>
            <div className="border-t pt-2 mt-1">
              <span className="text-muted-foreground">Total:</span>
              <span className="font-semibold ml-2">{total} leads</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

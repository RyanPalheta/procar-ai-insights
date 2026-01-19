import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Timer, Bell, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const RESPONSE_TIME_THRESHOLD_KEY = "leads_response_time_threshold";
const DEFAULT_THRESHOLD = 60;

// Formata minutos para exibição legível
const formatResponseTime = (minutes: number): string => {
  if (minutes === 0) return "N/A";
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  if (minutes < 1440) {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  const days = Math.floor(minutes / 1440);
  const hours = Math.round((minutes % 1440) / 60);
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
};

export function AlertsManager() {
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [tempThreshold, setTempThreshold] = useState(DEFAULT_THRESHOLD.toString());
  const [saved, setSaved] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const saved = localStorage.getItem(RESPONSE_TIME_THRESHOLD_KEY);
    if (saved) {
      const value = parseInt(saved, 10);
      if (!isNaN(value) && value > 0) {
        setThreshold(value);
        setTempThreshold(value.toString());
      }
    }
  }, []);

  const saveThreshold = () => {
    const value = parseInt(tempThreshold, 10);
    if (!isNaN(value) && value > 0) {
      setThreshold(value);
      localStorage.setItem(RESPONSE_TIME_THRESHOLD_KEY, value.toString());
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast({
        title: "Configuração salva",
        description: `Limite de tempo de resposta definido para ${formatResponseTime(value)}`,
      });
    } else {
      toast({
        title: "Valor inválido",
        description: "Insira um número maior que zero",
        variant: "destructive",
      });
    }
  };

  const presetValues = [15, 30, 60, 120];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Configuração de Alertas
        </CardTitle>
        <CardDescription>
          Defina os limites para disparo automático de alertas no dashboard
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Response Time Alert */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Timer className="h-4 w-4 text-muted-foreground" />
            <h4 className="font-medium">Tempo de Primeira Resposta</h4>
          </div>
          
          <p className="text-sm text-muted-foreground">
            Um alerta será exibido no dashboard de Leads quando o tempo mediano de primeira resposta 
            (entre a 1ª e 3ª interação) ultrapassar o limite configurado.
          </p>

          <div className="space-y-3">
            <Label htmlFor="threshold">Limite máximo (em minutos)</Label>
            <div className="flex gap-2">
              <Input
                id="threshold"
                type="number"
                min="1"
                value={tempThreshold}
                onChange={(e) => setTempThreshold(e.target.value)}
                className="w-32"
                placeholder="60"
              />
              <Button onClick={saveThreshold} disabled={saved}>
                {saved ? (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Salvo
                  </>
                ) : (
                  "Salvar"
                )}
              </Button>
            </div>
          </div>

          {/* Preset buttons */}
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-muted-foreground mr-2 self-center">Valores sugeridos:</span>
            {presetValues.map((value) => (
              <Button
                key={value}
                variant={parseInt(tempThreshold) === value ? "default" : "outline"}
                size="sm"
                onClick={() => setTempThreshold(value.toString())}
              >
                {formatResponseTime(value)}
              </Button>
            ))}
          </div>

          <Separator />

          {/* Current status */}
          <div className="flex items-center justify-between bg-muted/50 rounded-lg p-4">
            <div>
              <p className="text-sm font-medium">Limite atual configurado</p>
              <p className="text-xs text-muted-foreground">
                Alertas serão exibidos quando o tempo mediano exceder este valor
              </p>
            </div>
            <Badge variant="secondary" className="text-lg px-3 py-1">
              {formatResponseTime(threshold)}
            </Badge>
          </div>

          {/* Color guide */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Indicadores de cor no KPI:</p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span>≤ {formatResponseTime(threshold * 0.5)}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span>≤ {formatResponseTime(threshold)}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span>&gt; {formatResponseTime(threshold)}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

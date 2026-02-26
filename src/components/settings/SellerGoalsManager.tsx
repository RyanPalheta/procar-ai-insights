import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const METRICS = [
  { value: "conversion_rate", label: "Taxa de Conversão (%)", direction: ">=" },
  { value: "leads_with_quote", label: "Leads c/ Cotação", direction: ">=" },
  { value: "avg_quoted_price", label: "Valor Médio Cotado (R$)", direction: ">=" },
  { value: "objections_overcome_rate", label: "Objeções Superadas (%)", direction: ">=" },
  { value: "median_first_response_time", label: "Tempo 1ª Resposta (min)", direction: "<=" },
  { value: "walking_leads", label: "Leads Presenciais", direction: ">=" },
  { value: "avg_score", label: "Score Médio", direction: ">=" },
];

export function SellerGoalsManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [newSellerId, setNewSellerId] = useState("__global__");
  const [newMetric, setNewMetric] = useState("");
  const [newTarget, setNewTarget] = useState("");

  // Fetch goals
  const { data: goals, isLoading } = useQuery({
    queryKey: ["seller-goals-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seller_goals")
        .select("*")
        .order("seller_id", { ascending: true, nullsFirst: true });
      if (error) throw error;
      return data;
    },
  });

  // Fetch distinct sellers
  const { data: sellers } = useQuery({
    queryKey: ["distinct-sellers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_db")
        .select("sales_person_id")
        .not("sales_person_id", "is", null)
        .not("sales_person_id", "eq", "");
      if (error) throw error;
      const unique = [...new Set(data.map(d => d.sales_person_id).filter(Boolean))];
      return unique.sort();
    },
  });

  // Add goal
  const addMutation = useMutation({
    mutationFn: async () => {
      const metricConfig = METRICS.find(m => m.value === newMetric);
      if (!metricConfig) throw new Error("Métrica inválida");
      const target = parseFloat(newTarget);
      if (isNaN(target)) throw new Error("Valor alvo inválido");

      const { error } = await supabase.from("seller_goals").insert({
        seller_id: newSellerId === "__global__" ? null : newSellerId,
        metric: newMetric,
        target,
        direction: metricConfig.direction,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-goals-all"] });
      queryClient.invalidateQueries({ queryKey: ["seller-goals"] });
      setNewMetric("");
      setNewTarget("");
      toast({ title: "Meta adicionada" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  // Toggle active
  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("seller_goals").update({ active, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-goals-all"] });
      queryClient.invalidateQueries({ queryKey: ["seller-goals"] });
    },
  });

  // Delete
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("seller_goals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-goals-all"] });
      queryClient.invalidateQueries({ queryKey: ["seller-goals"] });
      toast({ title: "Meta removida" });
    },
  });

  const getMetricLabel = (metric: string) => METRICS.find(m => m.value === metric)?.label || metric;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Metas de Vendedores
        </CardTitle>
        <CardDescription>
          Configure metas individuais ou globais (aplicadas como fallback) para vendedores
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add Form */}
        <div className="flex flex-wrap items-end gap-3 p-4 rounded-lg bg-muted/50">
          <div className="space-y-1">
            <Label className="text-xs">Vendedor</Label>
            <Select value={newSellerId} onValueChange={setNewSellerId}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__global__">🌐 Global (Padrão)</SelectItem>
                {sellers?.map(s => (
                  <SelectItem key={s} value={s!}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Métrica</Label>
            <Select value={newMetric} onValueChange={setNewMetric}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {METRICS.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Valor Alvo</Label>
            <Input type="number" value={newTarget} onChange={e => setNewTarget(e.target.value)} className="w-28" placeholder="Ex: 30" />
          </div>
          <Button onClick={() => addMutation.mutate()} disabled={!newMetric || !newTarget || addMutation.isPending} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
        </div>

        {/* Goals Table */}
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendedor</TableHead>
                <TableHead>Métrica</TableHead>
                <TableHead className="text-right">Alvo</TableHead>
                <TableHead className="text-center">Direção</TableHead>
                <TableHead className="text-center">Ativo</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Carregando...</TableCell>
                </TableRow>
              )}
              {goals?.map(goal => (
                <TableRow key={goal.id}>
                  <TableCell>
                    {goal.seller_id ? (
                      <span className="font-medium">{goal.seller_id}</span>
                    ) : (
                      <Badge variant="secondary">🌐 Global</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{getMetricLabel(goal.metric)}</TableCell>
                  <TableCell className="text-right font-mono">{Number(goal.target)}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{goal.direction}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={goal.active}
                      onCheckedChange={(checked) => toggleMutation.mutate({ id: goal.id, active: checked })}
                    />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(goal.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && (!goals || goals.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Nenhuma meta configurada</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

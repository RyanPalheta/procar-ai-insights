import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KPICard } from "@/components/dashboard/KPICard";
import { Users, TrendingUp, Phone, MessageSquare, Target, Award } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];

export default function Dashboard() {
  const { data: leads } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lead_db").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: calls } = useQuery({
    queryKey: ["calls"],
    queryFn: async () => {
      const { data, error } = await supabase.from("call_db").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: interactions } = useQuery({
    queryKey: ["interactions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("interaction_db").select("*");
      if (error) throw error;
      return data;
    },
  });

  // Calculate KPIs
  const totalLeads = leads?.length || 0;
  const avgScore = leads?.length
    ? (leads.reduce((acc, lead) => acc + (lead.lead_score || 0), 0) / leads.length).toFixed(1)
    : "0.0";
  const totalCalls = calls?.length || 0;
  const totalInteractions = interactions?.length || 0;

  // Channel distribution
  const channelData = leads?.reduce((acc: any, lead) => {
    const channel = lead.channel || "Desconhecido";
    acc[channel] = (acc[channel] || 0) + 1;
    return acc;
  }, {});

  const chartData = channelData
    ? Object.entries(channelData).map(([name, value]) => ({ name, value }))
    : [];

  // Sales status distribution
  const statusData = leads?.reduce((acc: any, lead) => {
    const status = lead.sales_status || "Sem status";
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});

  const statusChartData = statusData
    ? Object.entries(statusData).map(([name, value]) => ({ name, value }))
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Visão Geral</h2>
        <p className="text-muted-foreground">
          Panorama completo das suas operações comerciais
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total de Leads"
          value={totalLeads}
          icon={Users}
          variant="default"
        />
        <KPICard
          title="Score Médio"
          value={avgScore}
          icon={Target}
          variant="success"
        />
        <KPICard
          title="Chamadas"
          value={totalCalls}
          icon={Phone}
          variant="default"
        />
        <KPICard
          title="Interações"
          value={totalInteractions}
          icon={MessageSquare}
          variant="default"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Leads por Canal</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status de Vendas</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => entry.name}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KPICard } from "@/components/dashboard/KPICard";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { MagicBentoGrid } from "@/components/ui/magic-bento-grid";
import { LeadsSentimentChart } from "@/components/leads/LeadsSentimentChart";
import { Users, TrendingUp, Phone, MessageSquare, Target, CheckCircle, AlertCircle, PackageSearch, LineChart as LineChartIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

export default function Dashboard() {
  const { data: leads } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lead_db").select("*");
      if (error) throw error;
      return data;
    }
  });

  const { data: calls } = useQuery({
    queryKey: ["calls"],
    queryFn: async () => {
      const { data, error } = await supabase.from("call_db").select("*");
      if (error) throw error;
      return data;
    }
  });

  const { data: interactions } = useQuery({
    queryKey: ["interactions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("interaction_db").select("*");
      if (error) throw error;
      return data;
    }
  });

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*");
      if (error) throw error;
      return data;
    }
  });

  const { data: playbooks } = useQuery({
    queryKey: ["playbooks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("playbooks").select("*");
      if (error) throw error;
      return data;
    }
  });

  // Calculate KPIs
  const totalLeads = leads?.length || 0;
  const processedLeads = leads?.filter(lead => lead.processed === true).length || 0;
  const unprocessedLeads = totalLeads - processedLeads;
  const avgScore = leads?.length ? (leads.reduce((acc, lead) => acc + (lead.lead_score || 0), 0) / leads.length).toFixed(1) : "0.0";
  const totalCalls = calls?.length || 0;
  const totalInteractions = interactions?.length || 0;

  // Channel normalization function
  const normalizeChannel = (channel: string | null): string => {
    if (!channel) return "Desconhecido";
    const lower = channel.toLowerCase();
    if (lower === 'whatsapp') return 'WhatsApp';
    if (lower === 'facebook') return 'Facebook';
    if (lower.includes('instagram')) return 'Instagram';
    return channel;
  };

  // Channel colors
  const CHANNEL_COLORS: Record<string, string> = {
    "WhatsApp": "#25D366",
    "Facebook": "#1877F2", 
    "Instagram": "#E4405F",
    "Desconhecido": "hsl(var(--muted))"
  };

  // Channel distribution
  const channelData = leads?.reduce((acc: any, lead) => {
    const channel = normalizeChannel(lead.channel);
    acc[channel] = (acc[channel] || 0) + 1;
    return acc;
  }, {});
  const chartData = channelData ? Object.entries(channelData).map(([name, value]) => ({
    name,
    value
  })) : [];

  // Helper function to map service_desired to playbook title
  const mapServiceToPlaybookTitle = (serviceDesired: string): string => {
    if (!products || !playbooks) return "Produto Não Identificado";

    const exactProduct = products.find(p => p.product_name.toLowerCase() === serviceDesired.toLowerCase());
    const partialProduct = exactProduct || products.find(p => serviceDesired.toLowerCase().includes(p.product_name.toLowerCase()) || p.product_name.toLowerCase().includes(serviceDesired.toLowerCase()));
    
    if (partialProduct) {
      const playbook = playbooks.find(pb => pb.product_type === partialProduct.product_type);
      return playbook?.title || "Produto Não Identificado";
    }
    return "Produto Não Identificado";
  };

  // Top 5 desired products (mapped to playbook titles)
  const productData = leads?.reduce((acc: any, lead) => {
    if (lead.service_desired) {
      const playbookTitle = mapServiceToPlaybookTitle(lead.service_desired);
      if (playbookTitle !== "Produto Não Identificado") {
        acc[playbookTitle] = (acc[playbookTitle] || 0) + 1;
      }
    }
    return acc;
  }, {});
  const topProductsData = productData ? Object.entries(productData).map(([name, value]) => ({
    name,
    value
  })).sort((a: any, b: any) => b.value - a.value).slice(0, 5) : [];

  // Sentiment distribution
  const sentimentData = leads?.reduce((acc: any, lead) => {
    if (lead.sentiment) {
      acc[lead.sentiment] = (acc[lead.sentiment] || 0) + 1;
    }
    return acc;
  }, {});
  const sentimentChartData = sentimentData ? Object.entries(sentimentData).map(([name, value]) => ({
    name,
    value: value as number
  })) : [];

  // Timeline of analyses (last 30 days, group by date)
  const timelineData = leads?.filter(lead => lead.last_ai_update).reduce((acc: any, lead) => {
    const date = format(parseISO(lead.last_ai_update!), "dd/MM", { locale: ptBR });
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {});
  const timelineChartData = timelineData ? Object.entries(timelineData).map(([date, count]) => ({
    date,
    count
  })).slice(-14) : [];

  // Temperature distribution
  const temperatureData = leads?.reduce((acc: any, lead) => {
    const temp = (lead as any).lead_temperature;
    if (temp) {
      const normalizedTemp = temp.charAt(0).toUpperCase() + temp.slice(1).toLowerCase();
      acc[normalizedTemp] = (acc[normalizedTemp] || 0) + 1;
    }
    return acc;
  }, {});
  const temperatureChartData = temperatureData ? Object.entries(temperatureData).map(([name, value]) => ({
    name,
    value: value as number
  })).sort((a, b) => {
    const order = ["Quente", "Morno", "Frio"];
    return order.indexOf(a.name) - order.indexOf(b.name);
  }) : [];

  const TEMPERATURE_COLORS: Record<string, string> = {
    "Quente": "#F97316",
    "Morno": "#EAB308",
    "Frio": "#3B82F6"
  };

  return (
    <div className="space-y-8 pb-8">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Visão Geral</h2>
        <p className="text-muted-foreground">
          Panorama completo das suas operações comerciais
        </p>
      </div>

      {/* KPIs Principais */}
      <MagicBentoGrid enableSpotlight={true} spotlightRadius={300} glowColor="59, 130, 246">
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard title="Total de Leads" value={totalLeads} icon={Users} description={`${processedLeads} processados • ${unprocessedLeads} pendentes`} variant="default" />
          <KPICard title="Leads Processados" value={processedLeads} icon={CheckCircle} description={`${(processedLeads / totalLeads * 100 || 0).toFixed(1)}% do total`} variant="success" />
          <KPICard title="Score Médio" value={avgScore} icon={Target} description="Potencial de conversão dos leads" variant="default" />
          <KPICard title="Análises Pendentes" value={unprocessedLeads} icon={AlertCircle} description="Leads aguardando análise IA" variant="warning" />
        </div>
      </MagicBentoGrid>

      {/* KPIs Secundários */}
      <MagicBentoGrid enableSpotlight={true} spotlightRadius={300} glowColor="59, 130, 246">
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <KPICard title="Total de Chamadas" value={totalCalls} icon={Phone} description="Ligações registradas" variant="default" />
          <KPICard title="Total de Interações" value={totalInteractions} icon={MessageSquare} description="Mensagens trocadas" variant="default" />
          <KPICard title="Produtos Cadastrados" value={products?.length || 0} icon={PackageSearch} description="Disponíveis para análise" variant="default" />
        </div>
      </MagicBentoGrid>

      {/* Charts Row 1 */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {/* Leads por Canal - Donut Chart */}
        <MagicBentoCard className="rounded-lg" glowColor="59, 130, 246">
          <Card className="bg-card border-border h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Leads por Canal</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center gap-6 mb-4">
                {chartData.map((entry, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: CHANNEL_COLORS[entry.name] || "hsl(var(--primary))" }}
                    />
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">{entry.name}</span>
                      <span className="text-sm font-semibold">{entry.value as number}</span>
                    </div>
                  </div>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="100%"
                    startAngle={180}
                    endAngle={0}
                    innerRadius={80}
                    outerRadius={120}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHANNEL_COLORS[entry.name] || "hsl(var(--primary))"} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px"
                  }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </MagicBentoCard>

        {/* Top 5 Products */}
        <MagicBentoCard className="rounded-lg" glowColor="59, 130, 246">
          <Card className="bg-card border-border h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Top 5 Produtos Desejados</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topProductsData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis type="category" dataKey="name" width={150} axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <Tooltip contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px"
                  }} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </MagicBentoCard>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {/* Sentiment Distribution */}
        <LeadsSentimentChart data={sentimentChartData} />

        {/* Temperature Distribution */}
        <MagicBentoCard className="rounded-lg" glowColor="59, 130, 246">
          <Card className="bg-card border-border h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Distribuição de Temperatura</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center gap-6 mb-4">
                {temperatureChartData.map((entry, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: TEMPERATURE_COLORS[entry.name] || "hsl(var(--primary))" }}
                    />
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground">{entry.name}</span>
                      <span className="text-sm font-semibold">{entry.value}</span>
                    </div>
                  </div>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={temperatureChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {temperatureChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={TEMPERATURE_COLORS[entry.name] || COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px"
                  }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </MagicBentoCard>
      </div>

      {/* Timeline Chart */}
      <MagicBentoCard className="rounded-lg" glowColor="59, 130, 246">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <LineChartIcon className="h-5 w-5" />
              Timeline de Análises (Últimos 14 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timelineChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px"
                }} />
                <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))" }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </MagicBentoCard>
    </div>
  );
}

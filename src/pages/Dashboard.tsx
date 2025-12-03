import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KPICard } from "@/components/dashboard/KPICard";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { MagicBentoGrid } from "@/components/ui/magic-bento-grid";
import { Users, TrendingUp, Phone, MessageSquare, Target, Award, CheckCircle, AlertCircle, PackageSearch, LineChart as LineChartIcon, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];
export default function Dashboard() {
  const {
    data: leads
  } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("lead_db").select("*");
      if (error) throw error;
      return data;
    }
  });
  const {
    data: calls
  } = useQuery({
    queryKey: ["calls"],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("call_db").select("*");
      if (error) throw error;
      return data;
    }
  });
  const {
    data: interactions
  } = useQuery({
    queryKey: ["interactions"],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("interaction_db").select("*");
      if (error) throw error;
      return data;
    }
  });
  const {
    data: products
  } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("products").select("*");
      if (error) throw error;
      return data;
    }
  });
  const {
    data: playbooks
  } = useQuery({
    queryKey: ["playbooks"],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from("playbooks").select("*");
      if (error) throw error;
      return data;
    }
  });

  // Calculate KPIs
  const totalLeads = leads?.length || 0;
  const processedLeads = leads?.filter(lead => lead.processed === true).length || 0;
  const unprocessedLeads = totalLeads - processedLeads;
  const avgScore = leads?.length ? (leads.reduce((acc, lead) => acc + (lead.lead_score || 0), 0) / leads.length).toFixed(1) : "0.0";
  const avgCompliance = leads?.filter(lead => lead.playbook_compliance_score !== null).length ? (leads.filter(lead => lead.playbook_compliance_score !== null).reduce((acc, lead) => acc + (lead.playbook_compliance_score || 0), 0) / leads.filter(lead => lead.playbook_compliance_score !== null).length).toFixed(1) : "0.0";
  const totalCalls = calls?.length || 0;
  const totalInteractions = interactions?.length || 0;

  // Average service rating (convert 1-10 to 0-5 stars)
  const leadsWithRating = leads?.filter(lead => (lead as any).service_rating !== null) || [];
  const avgServiceRating = leadsWithRating.length > 0 ? leadsWithRating.reduce((acc, lead) => acc + ((lead as any).service_rating || 0), 0) / leadsWithRating.length : 0;
  const avgStars = avgServiceRating / 2; // Convert 1-10 to 0-5 stars

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

    // Try exact match first
    const exactProduct = products.find(p => p.product_name.toLowerCase() === serviceDesired.toLowerCase());

    // Try partial match if exact fails
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
      // Filtrar produtos não identificados
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
    value
  })) : [];

  // Playbook compliance by playbook title
  const complianceByPlaybook = leads?.filter(lead => lead.service_desired && lead.playbook_compliance_score !== null).reduce((acc: any, lead) => {
    const playbookTitle = mapServiceToPlaybookTitle(lead.service_desired!);
    // Filtrar produtos não identificados
    if (playbookTitle !== "Produto Não Identificado") {
      if (!acc[playbookTitle]) {
        acc[playbookTitle] = {
          total: 0,
          count: 0
        };
      }
      acc[playbookTitle].total += lead.playbook_compliance_score!;
      acc[playbookTitle].count += 1;
    }
    return acc;
  }, {});
  const complianceRankingData = complianceByPlaybook ? Object.entries(complianceByPlaybook).map(([name, data]: [string, any]) => ({
    name,
    compliance: Number((data.total / data.count).toFixed(1))
  })).sort((a, b) => b.compliance - a.compliance).slice(0, 5) : [];

  // Timeline of analyses (last 30 days, group by date)
  const timelineData = leads?.filter(lead => lead.last_ai_update).reduce((acc: any, lead) => {
    const date = format(parseISO(lead.last_ai_update!), "dd/MM", {
      locale: ptBR
    });
    acc[date] = (acc[date] || 0) + 1;
    return acc;
  }, {});
  const timelineChartData = timelineData ? Object.entries(timelineData).map(([date, count]) => ({
    date,
    count
  })).slice(-14) // Last 14 days
  : [];

  // Salesperson ranking by average service rating
  const salespersonRatings = leads?.filter(lead => lead.sales_person_id && (lead as any).service_rating !== null).reduce((acc: any, lead) => {
    const salesPerson = lead.sales_person_id!;
    if (!acc[salesPerson]) {
      acc[salesPerson] = {
        total: 0,
        count: 0
      };
    }
    acc[salesPerson].total += (lead as any).service_rating;
    acc[salesPerson].count += 1;
    return acc;
  }, {});
  const salespersonRankingData = salespersonRatings ? Object.entries(salespersonRatings).map(([name, data]: [string, any]) => ({
    name,
    rating: Number((data.total / data.count).toFixed(1)),
    leads: data.count,
    stars: Number((data.total / data.count / 2).toFixed(1)) // Convert to 5-star scale
  })).sort((a, b) => b.rating - a.rating).slice(0, 10) : [];
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
          <KPICard title="Compliance Médio" value={`${avgCompliance}%`} icon={Award} description="Score de aderência aos playbooks" variant="success" />
          <KPICard title="Score Médio" value={avgScore} icon={Target} description="Qualidade geral dos leads" variant="default" />
        </div>
      </MagicBentoGrid>

      {/* KPIs Secundários */}
      <MagicBentoGrid enableSpotlight={true} spotlightRadius={300} glowColor="59, 130, 246">
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
          {/* Card especial de estrelas */}
          <MagicBentoCard className="rounded-lg" glowColor="59, 130, 246">
            <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 h-full">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-yellow-500" />
                  <CardTitle className="text-sm font-medium">Avaliação Média</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold">{avgStars.toFixed(1)}</span>
                  <span className="text-sm text-muted-foreground">/ 5 estrelas</span>
                </div>
                <div className="flex gap-1 mt-2">
                  {[1, 2, 3, 4, 5].map(star => (
                    <Star key={star} className={`h-5 w-5 ${star <= Math.round(avgStars) ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground/30"}`} />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {leadsWithRating.length} avaliações
                </p>
              </CardContent>
            </Card>
          </MagicBentoCard>
          
          <KPICard title="Análises Pendentes" value={unprocessedLeads} icon={AlertCircle} description="Leads aguardando análise IA" variant="warning" />
          <KPICard title="Total de Chamadas" value={totalCalls} icon={Phone} description="Ligações registradas" variant="default" />
          <KPICard title="Total de Interações" value={totalInteractions} icon={MessageSquare} description="Mensagens trocadas" variant="default" />
          <KPICard title="Produtos Cadastrados" value={products?.length || 0} icon={PackageSearch} description="Em análise de playbooks" variant="default" />
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
        <MagicBentoCard className="rounded-lg" glowColor="59, 130, 246">
          <Card className="bg-card border-border h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Distribuição de Sentimento</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={sentimentChartData} cx="50%" cy="50%" labelLine={false} outerRadius={100} fill="hsl(var(--primary))" dataKey="value" label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                    {sentimentChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px"
                  }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </MagicBentoCard>

        {/* Compliance Ranking */}
        <MagicBentoCard className="rounded-lg" glowColor="59, 130, 246">
          <Card className="bg-card border-border h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Ranking de Playbooks por Compliance</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={complianceRankingData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis type="category" dataKey="name" width={150} axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <Tooltip contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px"
                  }} formatter={(value: number) => [`${value}%`, "Compliance"]} />
                  <Bar dataKey="compliance" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                </BarChart>
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

      {/* Salesperson Ranking */}
      <MagicBentoCard className="rounded-lg" glowColor="59, 130, 246">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Ranking de Vendedores por Avaliação</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={salespersonRankingData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="hsl(var(--border))" />
                <XAxis type="number" domain={[0, 10]} axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))" }} />
                <YAxis type="category" dataKey="name" width={120} axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <Tooltip contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px"
                }} formatter={(value: number) => [value.toFixed(1), "Avaliação"]} />
                <Bar dataKey="rating" fill="hsl(var(--chart-4))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </MagicBentoCard>
    </div>
  );
}
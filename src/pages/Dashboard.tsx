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
  return <div className="space-y-8 pb-8">
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
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">Nota Média de Atendimento</p>
                  <Star className="h-4 w-4 text-yellow-500" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(star => {
                    const filled = star <= Math.floor(avgStars);
                    const partial = star === Math.ceil(avgStars) && avgStars % 1 !== 0;
                    const fillPercent = partial ? avgStars % 1 * 100 : 0;
                    return <div key={star} className="relative">
                          <Star className={`h-6 w-6 ${filled ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
                          {partial && <div className="absolute inset-0 overflow-hidden" style={{
                        width: `${fillPercent}%`
                      }}>
                              <Star className="h-6 w-6 fill-yellow-400 text-yellow-400" />
                            </div>}
                        </div>;
                  })}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">{avgStars.toFixed(1)}</span>
                    <span className="text-sm text-muted-foreground">/ 5.0</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {leadsWithRating.length} leads avaliados
                  </p>
                </div>
              </CardContent>
            </Card>
          </MagicBentoCard>

          <KPICard title="Chamadas" value={totalCalls} icon={Phone} variant="default" />
          <KPICard title="Interações" value={totalInteractions} icon={MessageSquare} variant="default" />
          <KPICard title="Leads Pendentes" value={unprocessedLeads} icon={AlertCircle} description="Aguardando análise de IA" variant="warning" />
          <KPICard title="Produtos Identificados" value={Object.keys(productData || {}).length} icon={PackageSearch} description="Produtos desejados únicos" variant="default" />
        </div>
      </MagicBentoGrid>

      {/* Análise de Produtos e Sentimento */}
      <div className="grid gap-6 grid-cols-1 xl:grid-cols-2">
        <MagicBentoCard className="rounded-lg" glowColor="59, 130, 246">
          <Card className="animate-fade-in h-full">
            <CardHeader>
              <CardTitle>Top 5 Produtos Mais Desejados</CardTitle>
            </CardHeader>
            <CardContent className="h-[350px] pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topProductsData} layout="vertical" margin={{
                left: 10,
                right: 10,
                top: 5,
                bottom: 5
              }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={150} tick={{
                  fontSize: 12
                }} tickFormatter={value => value.length > 20 ? value.substring(0, 20) + '...' : value} />
                  <Tooltip contentStyle={{
                  fontSize: '12px'
                }} wrapperStyle={{
                  zIndex: 1000
                }} />
                  <Bar dataKey="value" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </MagicBentoCard>

        <MagicBentoCard className="rounded-lg" glowColor="59, 130, 246">
          <Card className="animate-fade-in h-full">
            <CardHeader>
              <CardTitle>Distribuição de Sentimento</CardTitle>
            </CardHeader>
            <CardContent className="h-[350px] pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={sentimentChartData} cx="50%" cy="50%" labelLine={false} label={entry => `${entry.name}: ${entry.value}`} outerRadius={100} fill="#8884d8" dataKey="value">
                    {sentimentChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip wrapperStyle={{
                  zIndex: 1000
                }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </MagicBentoCard>
      </div>

      {/* Análise de Compliance e Timeline */}
      <div className="grid gap-6 grid-cols-1 xl:grid-cols-2">
        <MagicBentoCard className="rounded-lg" glowColor="59, 130, 246">
          <Card className="animate-fade-in h-full">
            <CardHeader>
              <CardTitle>Ranking de Playbooks por Compliance</CardTitle>
            </CardHeader>
            <CardContent className="h-[350px] pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={complianceRankingData} layout="vertical" margin={{
                left: 10,
                right: 10,
                top: 5,
                bottom: 5
              }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis dataKey="name" type="category" width={150} tick={{
                  fontSize: 12
                }} tickFormatter={value => value.length > 20 ? value.substring(0, 20) + '...' : value} />
                  <Tooltip contentStyle={{
                  fontSize: '12px'
                }} wrapperStyle={{
                  zIndex: 1000
                }} formatter={value => [`${value}%`, 'Compliance']} />
                  <Bar dataKey="compliance" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </MagicBentoCard>

        <MagicBentoCard className="rounded-lg" glowColor="59, 130, 246">
          <Card className="animate-fade-in h-full">
            <CardHeader>
              <CardTitle>Timeline de Análises (Últimos 14 dias)</CardTitle>
            </CardHeader>
            <CardContent className="h-[350px] pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timelineChartData} margin={{
                left: 10,
                right: 10,
                top: 5,
                bottom: 5
              }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{
                  fontSize: 12
                }} />
                  <YAxis tick={{
                  fontSize: 12
                }} />
                  <Tooltip contentStyle={{
                  fontSize: '12px'
                }} wrapperStyle={{
                  zIndex: 1000
                }} />
                  <Legend wrapperStyle={{
                  fontSize: '12px'
                }} />
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--chart-3))" strokeWidth={3} name="Análises" dot={{
                  r: 4
                }} activeDot={{
                  r: 6
                }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </MagicBentoCard>
      </div>

      {/* Ranking de Vendedores por Nota */}
      <MagicBentoCard className="rounded-lg" glowColor="59, 130, 246">
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              Ranking de Vendedores por Nota de Atendimento
            </CardTitle>
          </CardHeader>
          <CardContent>
            {salespersonRankingData.length > 0 ? <div className="space-y-4">
                {salespersonRankingData.map((seller, index) => <div key={seller.name} className="flex items-center gap-4">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                      {index + 1}º
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium truncate">{seller.name}</span>
                        <span className="text-sm text-muted-foreground ml-2">
                          {seller.leads} lead{seller.leads > 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map(star => {
                      const filled = star <= Math.floor(seller.stars);
                      const partial = star === Math.ceil(seller.stars) && seller.stars % 1 !== 0;
                      const fillPercent = partial ? seller.stars % 1 * 100 : 0;
                      return <div key={star} className="relative">
                                <Star className={`h-4 w-4 ${filled ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
                                {partial && <div className="absolute inset-0 overflow-hidden" style={{
                          width: `${fillPercent}%`
                        }}>
                                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                  </div>}
                              </div>;
                    })}
                        </div>
                        <span className="text-sm font-semibold">{seller.stars.toFixed(1)}</span>
                      <span className="text-xs text-muted-foreground">({seller.rating.toFixed(1)}/10)</span>
                    </div>
                  </div>
                </div>)}
            </div> : <div className="text-center py-8 text-muted-foreground">
              Nenhum vendedor com leads avaliados ainda
            </div>}
        </CardContent>
      </Card>
    </MagicBentoCard>

      {/* Leads por Canal */}
      <MagicBentoCard className="rounded-lg" glowColor="59, 130, 246">
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle>Leads por Canal</CardTitle>
          </CardHeader>
          <CardContent className="h-[350px] pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{
              left: 10,
              right: 10,
              top: 5,
              bottom: 5
            }}>
                <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{
              fontSize: 12
            }} />
              <YAxis tick={{
              fontSize: 12
            }} />
              <Tooltip contentStyle={{
              fontSize: '12px'
            }} wrapperStyle={{
              zIndex: 1000
            }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={CHANNEL_COLORS[entry.name] || "hsl(var(--primary))"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </MagicBentoCard>
    </div>;
}
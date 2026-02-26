import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KPICard } from "@/components/dashboard/KPICard";
import { SellerGoalStatus, GoalData } from "./SellerGoalStatus";
import { SellerKPI } from "./SellersRankingTable";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, CartesianGrid } from "recharts";
import { TrendingUp, Users, Target, DollarSign, Clock, Footprints, Shield, Percent } from "lucide-react";
import { format, parseISO, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

const CHART_COLORS = [
  "hsl(215, 58%, 39%)",
  "hsl(245, 76%, 61%)",
  "hsl(275, 37%, 24%)",
  "hsl(305, 74%, 66%)",
  "hsl(335, 87%, 67%)",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
];

interface SellerDetailViewProps {
  seller: SellerKPI & { conversion_rate: number; objections_rate: number };
  goals: GoalData[];
  periodDays: number | null;
}

export function SellerDetailView({ seller, goals, periodDays }: SellerDetailViewProps) {
  // Fetch leads for this seller for charts
  const { data: sellerLeads } = useQuery({
    queryKey: ["seller-leads", seller.seller_id, periodDays],
    queryFn: async () => {
      let query = supabase
        .from("lead_db")
        .select("created_at, sales_status, objection_categories, has_objection, objection_overcome, channel, sentiment, lead_temperature")
        .eq("sales_person_id", seller.seller_id)
        .not("last_ai_update", "is", null);

      if (periodDays) {
        const start = new Date();
        start.setDate(start.getDate() - periodDays);
        query = query.gte("created_at", start.toISOString());
      }

      const { data, error } = await query.order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Timeline data
  const timelineData = useMemo(() => {
    if (!sellerLeads) return [];
    const counts = new Map<string, number>();
    sellerLeads.forEach(l => {
      const day = format(parseISO(l.created_at), "dd/MM", { locale: ptBR });
      counts.set(day, (counts.get(day) || 0) + 1);
    });
    return Array.from(counts.entries()).map(([date, count]) => ({ date, count }));
  }, [sellerLeads]);

  // Status distribution
  const statusData = useMemo(() => {
    if (!sellerLeads) return [];
    const counts = new Map<string, number>();
    sellerLeads.forEach(l => {
      if (l.sales_status) counts.set(l.sales_status, (counts.get(l.sales_status) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [sellerLeads]);

  // Objection categories
  const objectionData = useMemo(() => {
    if (!sellerLeads) return [];
    const counts = new Map<string, number>();
    sellerLeads.forEach(l => {
      if (l.objection_categories) {
        (l.objection_categories as string[]).forEach(cat => {
          counts.set(cat, (counts.get(cat) || 0) + 1);
        });
      }
    });
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [sellerLeads]);

  const objectionOvercomeRate = seller.total_with_objection > 0
    ? (seller.objections_overcome / seller.total_with_objection) * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPICard title="Taxa de Conversão" value={`${seller.conversion_rate.toFixed(1)}%`} icon={TrendingUp} description={`${seller.won_leads}/${seller.total_audited} leads`} />
        <KPICard title="Leads Auditados" value={seller.total_audited} icon={Users} />
        <KPICard title="C/ Cotação" value={seller.leads_with_quote} icon={Target} />
        <KPICard title="Valor Médio" value={`R$ ${seller.avg_quoted_price.toFixed(0)}`} icon={DollarSign} />
        <KPICard title="Score Médio" value={seller.avg_score.toFixed(1)} icon={TrendingUp} />
        <KPICard title="Presenciais" value={seller.walking_leads} icon={Footprints} />
        <KPICard title="Objeções Superadas" value={`${objectionOvercomeRate.toFixed(1)}%`} icon={Shield} description={`${seller.objections_overcome}/${seller.total_with_objection}`} />
        <KPICard title="Novos (24h)" value={seller.new_audited_24h} icon={Percent} />
      </div>

      {/* Goals Section */}
      {goals.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Metas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {goals.map(g => (
              <SellerGoalStatus key={g.metric} goal={g} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Timeline */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Timeline de Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="hsl(215, 58%, 39%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Status de Venda</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {statusData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Objection Categories */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Top Objeções</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={objectionData} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={80} />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(245, 76%, 61%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

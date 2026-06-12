import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartInfoTooltip } from "@/components/ui/chart-info-tooltip";
import { KPICard } from "@/components/dashboard/KPICard";
import { formatUSD } from "@/lib/utils";
import { SellerGoalStatus, GoalData } from "./SellerGoalStatus";
import { SellerKPI } from "./SellersRankingTable";
import { canonSalesStatus } from "@/lib/leadStatus";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, CartesianGrid } from "recharts";
import { TrendingUp, Users, Target, DollarSign, Clock, Footprints, Shield, Percent } from "lucide-react";
import { format, parseISO, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

const truncateLabel = (s: string, n = 18) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

// Tick do eixo de categorias que TRUNCA rótulos longos (sales_status da Kommo são
// frases) — evita o corte/sobreposição que deixava o gráfico ilegível. Nome
// completo continua no tooltip.
function StatusTick({ x = 0, y = 0, payload }: { x?: number; y?: number; payload?: { value?: string } }) {
  return (
    <text x={x} y={y} dy={3} textAnchor="end" fontSize={11} fill="hsl(var(--muted-foreground))">
      {truncateLabel(String(payload?.value ?? ""))}
    </text>
  );
}

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
];

interface SellerDetailViewProps {
  seller: SellerKPI & { conversion_rate: number; objections_rate: number };
  goals: GoalData[];
  dateFrom: string | null;
  dateTo: string | null;
}

export function SellerDetailView({ seller, goals, dateFrom, dateTo }: SellerDetailViewProps) {
  // Fetch leads for this seller for charts
  const { data: sellerLeads } = useQuery({
    queryKey: ["seller-leads", seller.seller_id, dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase
        .from("lead_db")
        .select("created_at, sales_status, objection_categories, has_objection, objection_overcome, channel, sentiment, lead_temperature")
        .eq("sales_person_id", seller.seller_id)
        .not("last_ai_update", "is", null);

      if (dateFrom) query = query.gte("created_at", dateFrom);
      if (dateTo) query = query.lte("created_at", dateTo);

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

  // Status distribution — normaliza sales_status (texto livre da Kommo) em etapas
  // canônicas, então variações da MESMA etapa somam na mesma barra (proporções
  // reais) e a fatia "Ganha / Agendada" bate com won_leads do card (mesma regra).
  const statusData = useMemo(() => {
    if (!sellerLeads) return [];
    const counts = new Map<string, number>();
    sellerLeads.forEach(l => {
      if (l.sales_status) {
        const key = canonSalesStatus(l.sales_status);
        counts.set(key, (counts.get(key) || 0) + 1);
      }
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
        <KPICard
          title="Taxa de Conversão"
          value={`${seller.conversion_rate.toFixed(1)}%`}
          icon={TrendingUp}
          description={`${seller.won_leads}/${seller.total_audited} · só clientes de chat que a IA analisou`}
          info={{
            description: "De cada 100 clientes deste vendedor, quantos viraram venda fechada.",
            source: "conta só os clientes que chegaram por conversa de WhatsApp/chat. Por isso o número é menor que o total no Kommo. Aqui: os clientes deste vendedor que a IA já analisou; venda fechada = marcados como venda fechada (ganha) ou agendamento confirmado.",
            calculation: "clientes marcados como venda fechada divididos pelo total de clientes deste vendedor que a IA analisou no período, vezes 100.",
          }}
        />
        <KPICard
          title="Clientes Analisados pela IA"
          value={seller.total_audited}
          icon={Users}
          description="Só clientes de chat que a IA analisou · menor que o Kommo"
          info={{
            description: "Quantos clientes deste vendedor a IA já analisou no período.",
            source: "conta só os clientes que chegaram por conversa de WhatsApp/chat. Por isso o número é menor que o total no Kommo. Aqui: os clientes deste vendedor que a IA já analisou.",
            calculation: "conta quantos clientes deste vendedor a IA já analisou e que chegaram no período selecionado.",
          }}
        />
        <KPICard
          title="C/ Cotação"
          value={seller.leads_with_quote}
          icon={Target}
          description="Só clientes de chat que a IA analisou · menor que o Kommo"
          info={{
            description: "Clientes deste vendedor que já receberam um valor de orçamento (cotação).",
            source: "conta só os clientes que chegaram por conversa de WhatsApp/chat. Por isso o número é menor que o total no Kommo. Aqui: os clientes deste vendedor que a IA já analisou e que já receberam um valor de orçamento (cotação).",
            calculation: "conta os clientes deste vendedor que a IA analisou e que já receberam um valor de orçamento no período.",
          }}
        />
        <KPICard
          title="Valor Médio"
          value={formatUSD(seller.avg_quoted_price, 0)}
          icon={DollarSign}
          description="Só clientes de chat que a IA analisou · menor que o Kommo"
          info={{
            description: "Valor médio dos orçamentos dos clientes deste vendedor que já receberam uma cotação.",
            source: "conta só os clientes que chegaram por conversa de WhatsApp/chat. Por isso o número é menor que o total no Kommo. Aqui: os clientes deste vendedor que a IA já analisou e que já receberam um valor de orçamento (cotação).",
            calculation: "a média do valor de orçamento entre os clientes deste vendedor que já receberam uma cotação no período.",
          }}
        />
        <KPICard
          title="Score Médio"
          value={seller.avg_score.toFixed(1)}
          icon={TrendingUp}
          description="Só clientes de chat que a IA analisou · menor que o Kommo"
          info={{
            description: "A nota de qualidade média que a IA dá aos clientes deste vendedor.",
            source: "conta só os clientes que chegaram por conversa de WhatsApp/chat. Por isso o número é menor que o total no Kommo. Aqui: os clientes deste vendedor que a IA já analisou e que já receberam uma nota de qualidade.",
            calculation: "a média das notas de qualidade entre os clientes deste vendedor que já receberam uma nota no período.",
          }}
        />
        <KPICard
          title="Presenciais"
          value={seller.walking_leads}
          icon={Footprints}
          description="Só clientes de chat que a IA analisou · menor que o Kommo"
          info={{
            description: "Clientes deste vendedor marcados como visita presencial à loja.",
            source: "conta só os clientes que chegaram por conversa de WhatsApp/chat. Por isso o número é menor que o total no Kommo. Aqui: os clientes deste vendedor que a IA já analisou e que foram marcados como visita presencial à loja.",
            calculation: "conta os clientes deste vendedor que a IA analisou e foram marcados como visita presencial à loja no período.",
          }}
        />
        <KPICard
          title="Objeções Superadas"
          value={`${objectionOvercomeRate.toFixed(1)}%`}
          icon={Shield}
          description={`${seller.objections_overcome}/${seller.total_with_objection} · só clientes de chat que a IA analisou`}
          info={{
            description: "De cada 100 clientes que levantaram alguma objeção, em quantos o vendedor conseguiu contornar.",
            source: "conta só os clientes que chegaram por conversa de WhatsApp/chat. Por isso o número é menor que o total no Kommo. Aqui: os clientes deste vendedor que a IA já analisou e que levantaram alguma objeção.",
            calculation: "clientes deste vendedor com objeção contornada divididos pelos clientes deste vendedor que levantaram objeção, vezes 100.",
          }}
        />
        <KPICard
          title="Novos (24h)"
          value={seller.new_audited_24h}
          icon={Percent}
          description="Janela móvel 24h · ignora o filtro de período"
          info={{
            description: "Clientes deste vendedor que a IA analisou e que chegaram nas últimas 24 horas.",
            source: "conta só os clientes que chegaram por conversa de WhatsApp/chat. Por isso o número é menor que o total no Kommo. Aqui: os clientes deste vendedor que a IA já analisou.",
            calculation: "conta os clientes deste vendedor que a IA analisou e que chegaram nas últimas 24 horas. É sempre 24h e não muda com o filtro de período.",
          }}
        />
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
            <CardTitle className="text-sm flex items-center gap-2">
              Timeline de Leads
              <span className="text-xs font-normal text-muted-foreground">({seller.total_audited} no período)</span>
              <ChartInfoTooltip description="A linha mostra quantos clientes deste vendedor chegaram em cada dia do período selecionado. A soma de todos os dias é o total de clientes que a IA analisou no período (mostrado ao lado do título)." source="conta só os clientes que chegaram por conversa de WhatsApp/chat. Por isso o número é menor que o total no Kommo. Aqui: os clientes deste vendedor que a IA já analisou no período." calculation="agrupa os clientes por dia de chegada e conta quantos há em cada dia; a soma bate com 'Clientes Analisados pela IA'." /></CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">Status de Venda <ChartInfoTooltip description="Mostra em que etapa da venda estão os clientes deste vendedor, juntando etapas parecidas (ex.: variações de 'ganha' viram uma única etapa 'Ganha / Agendada')." source="conta só os clientes que chegaram por conversa de WhatsApp/chat. Por isso o número é menor que o total no Kommo. Aqui: os clientes deste vendedor que a IA já analisou e que já têm uma etapa de venda definida." calculation="junta as etapas parecidas (mesma regra de venda fechada do cartão de Conversão), conta os clientes em cada etapa, ordena da maior para a menor e mostra as 6 principais. Passe o mouse na barra para ver o nome completo." /></CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={statusData} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                <XAxis type="number" allowDecimals={false} hide />
                <YAxis type="category" dataKey="name" width={150} interval={0} tick={<StatusTick />} />
                <Tooltip formatter={(v: number) => [v, "Leads"]} labelFormatter={(label: string) => label} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {statusData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Objection Categories */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">Top Objeções <ChartInfoTooltip description="As barras comparam quantas vezes cada tipo de objeção apareceu nas conversas dos clientes deste vendedor." source="conta só os clientes que chegaram por conversa de WhatsApp/chat. Por isso o número é menor que o total no Kommo. Aqui: os clientes deste vendedor que a IA já analisou e que levantaram alguma objeção." calculation="soma quantas vezes cada tipo de objeção aparece nas conversas, ordena do maior para o menor e mostra os 6 principais." /></CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={objectionData} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={80} />
                <Tooltip />
                <Bar dataKey="value" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

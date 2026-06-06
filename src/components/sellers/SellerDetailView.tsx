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
          description={`${seller.won_leads}/${seller.total_audited} · só chat auditado`}
          info={{
            description: "Percentual dos leads deste vendedor que foram ganhos.",
            source: "lead_db (Supabase self-hosted) é alimentado SÓ por conversas de WhatsApp/chat; não inclui agendamentos Shopmonkey, pagamentos, telefone nem entrada manual, então é um SUBCONJUNTO da Kommo. Aqui filtra leads deste vendedor (sales_person_id) auditados pela IA (last_ai_update preenchido); ganhos = sales_status com 'ganha'/'won'/'agendamento confirmado'.",
            calculation: "won_leads ÷ total_audited × 100 (leads ganhos sobre leads auditados deste vendedor no período).",
          }}
        />
        <KPICard
          title="Leads Auditados"
          value={seller.total_audited}
          icon={Users}
          description="Só chat auditado · ≠ total Kommo"
          info={{
            description: "Quantidade de leads deste vendedor já analisados pela IA no período.",
            source: "lead_db (Supabase self-hosted) é alimentado SÓ por conversas de WhatsApp/chat; não inclui agendamentos Shopmonkey, pagamentos, telefone nem entrada manual, então é um SUBCONJUNTO da Kommo. Aqui filtra leads deste vendedor (sales_person_id) auditados pela IA (last_ai_update preenchido).",
            calculation: "Conta os leads deste vendedor com last_ai_update preenchido criados no intervalo selecionado.",
          }}
        />
        <KPICard
          title="C/ Cotação"
          value={seller.leads_with_quote}
          icon={Target}
          description="Só chat auditado · ≠ total Kommo"
          info={{
            description: "Leads deste vendedor que receberam uma cotação de preço.",
            source: "lead_db (Supabase self-hosted) é alimentado SÓ por conversas de WhatsApp/chat; não inclui agendamentos Shopmonkey, pagamentos, telefone nem entrada manual, então é um SUBCONJUNTO da Kommo. Aqui filtra leads deste vendedor (sales_person_id) auditados pela IA (last_ai_update preenchido) e com cotação (lead_price preenchido).",
            calculation: "Conta os leads deste vendedor (auditados) que têm lead_price preenchido no intervalo.",
          }}
        />
        <KPICard
          title="Valor Médio"
          value={formatUSD(seller.avg_quoted_price, 0)}
          icon={DollarSign}
          description="Só chat auditado · ≠ total Kommo"
          info={{
            description: "Valor médio cotado nos leads deste vendedor que têm cotação.",
            source: "lead_db (Supabase self-hosted) é alimentado SÓ por conversas de WhatsApp/chat; não inclui agendamentos Shopmonkey, pagamentos, telefone nem entrada manual, então é um SUBCONJUNTO da Kommo. Aqui filtra leads deste vendedor (sales_person_id) auditados pela IA (last_ai_update preenchido) e com cotação (lead_price preenchido).",
            calculation: "Média de lead_price entre os leads deste vendedor que têm lead_price preenchido no intervalo.",
          }}
        />
        <KPICard
          title="Score Médio"
          value={seller.avg_score.toFixed(1)}
          icon={TrendingUp}
          description="Só chat auditado · ≠ total Kommo"
          info={{
            description: "Score de qualidade médio atribuído pela IA aos leads deste vendedor.",
            source: "lead_db (Supabase self-hosted) é alimentado SÓ por conversas de WhatsApp/chat; não inclui agendamentos Shopmonkey, pagamentos, telefone nem entrada manual, então é um SUBCONJUNTO da Kommo. Aqui filtra leads deste vendedor (sales_person_id) auditados pela IA (last_ai_update preenchido) e com lead_score preenchido.",
            calculation: "Média de lead_score entre os leads deste vendedor com score preenchido no intervalo.",
          }}
        />
        <KPICard
          title="Presenciais"
          value={seller.walking_leads}
          icon={Footprints}
          description="Só chat auditado · ≠ total Kommo"
          info={{
            description: "Leads deste vendedor identificados como atendimento presencial (walk-in).",
            source: "lead_db (Supabase self-hosted) é alimentado SÓ por conversas de WhatsApp/chat; não inclui agendamentos Shopmonkey, pagamentos, telefone nem entrada manual, então é um SUBCONJUNTO da Kommo. Aqui filtra leads deste vendedor (sales_person_id) auditados pela IA (last_ai_update preenchido); presenciais = is_walking verdadeiro.",
            calculation: "Conta os leads deste vendedor (auditados) com is_walking = verdadeiro no intervalo.",
          }}
        />
        <KPICard
          title="Objeções Superadas"
          value={`${objectionOvercomeRate.toFixed(1)}%`}
          icon={Shield}
          description={`${seller.objections_overcome}/${seller.total_with_objection} · só chat auditado`}
          info={{
            description: "Percentual de leads com objeção em que o vendedor conseguiu superá-la.",
            source: "lead_db (Supabase self-hosted) é alimentado SÓ por conversas de WhatsApp/chat; não inclui agendamentos Shopmonkey, pagamentos, telefone nem entrada manual, então é um SUBCONJUNTO da Kommo. Aqui filtra leads deste vendedor (sales_person_id) auditados pela IA (last_ai_update preenchido) com objeção detectada (has_objection verdadeiro).",
            calculation: "objections_overcome ÷ total_with_objection × 100 (leads com objeção superada sobre leads com objeção deste vendedor).",
          }}
        />
        <KPICard
          title="Novos (24h)"
          value={seller.new_audited_24h}
          icon={Percent}
          description="Janela móvel 24h · ignora o filtro de período"
          info={{
            description: "Leads auditados deste vendedor criados nas últimas 24 horas.",
            source: "lead_db (Supabase self-hosted) é alimentado SÓ por conversas de WhatsApp/chat; não inclui agendamentos Shopmonkey, pagamentos, telefone nem entrada manual, então é um SUBCONJUNTO da Kommo. Aqui filtra leads deste vendedor (sales_person_id) auditados pela IA (last_ai_update preenchido).",
            calculation: "Conta os leads deste vendedor (auditados) com created_at nas últimas 24h — janela móvel, independente do intervalo selecionado.",
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
            <CardTitle className="text-sm flex items-center gap-2">Timeline de Leads <ChartInfoTooltip description="Eixo X = dias (dd/MM); a linha mostra quantos leads deste vendedor foram criados em cada dia do período selecionado." source="Leads do banco do dashboard (Supabase), vinculados à Kommo pelo lead_id; a análise de IA é enviada de volta à Kommo (não é leitura ao vivo da Kommo). Considera apenas leads deste vendedor (sales_person_id) já auditados pela IA (last_ai_update preenchido), dentro do intervalo de datas." calculation="Agrupa os leads por dia de created_at e conta quantos há em cada dia." /></CardTitle>
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
            <CardTitle className="text-sm flex items-center gap-2">Status de Venda <ChartInfoTooltip description="Distribui os leads deste vendedor pelas etapas do funil de venda, agrupando status equivalentes (ex.: variações de 'ganha' viram uma única etapa 'Ganha / Agendada')." source="Leads do banco do dashboard (Supabase), vinculados à Kommo pelo lead_id; a análise de IA é enviada de volta à Kommo (não é leitura ao vivo da Kommo). Considera apenas leads deste vendedor (sales_person_id) já auditados pela IA (last_ai_update preenchido) e com sales_status preenchido, dentro do intervalo de datas." calculation="Normaliza o sales_status (mesma regra de 'ganho' do card de Conversão), conta os leads em cada etapa, ordena do maior para o menor e exibe as 6 principais como barras. Passe o mouse na barra para o nome completo." /></CardTitle>
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
            <CardTitle className="text-sm flex items-center gap-2">Top Objeções <ChartInfoTooltip description="Eixo Y = categorias de objeção; as barras comparam quantas vezes cada objeção apareceu nos leads deste vendedor." source="Leads do banco do dashboard (Supabase), vinculados à Kommo pelo lead_id; a análise de IA é enviada de volta à Kommo (não é leitura ao vivo da Kommo). Considera apenas leads deste vendedor (sales_person_id) já auditados pela IA (last_ai_update preenchido) e com objection_categories preenchido, dentro do intervalo de datas." calculation="Soma quantas vezes cada categoria aparece nas listas objection_categories dos leads, ordena do maior para o menor e exibe as 6 principais." /></CardTitle>
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

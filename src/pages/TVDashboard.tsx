import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, Percent, Clock, Star, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import logo from "@/assets/logo.png";

import { TVKPICard } from "@/components/tv/TVKPICard";
import { TVQualitySection } from "@/components/tv/TVQualitySection";
import { TVEfficiencySection } from "@/components/tv/TVEfficiencySection";
import { TVObjectionRanking } from "@/components/tv/TVObjectionRanking";

// Objection category labels
const objectionLabels: Record<string, string> = {
  preco: "Preço/Orçamento",
  tempo: "Tempo/Urgência",
  distancia: "Distância/Localização",
  financiamento: "Financiamento",
  confianca: "Confiança/Credibilidade",
  concorrencia: "Concorrência",
  tecnica: "Técnica/Produto",
  indecisao: "Indecisão",
};

export default function TVDashboard() {
  // Force light mode for TV display
  useEffect(() => {
    const previousTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
    
    return () => {
      // Restore previous theme when leaving
      document.documentElement.classList.remove('light');
      if (previousTheme === 'dark') {
        document.documentElement.classList.add('dark');
      }
    };
  }, []);

  // Fetch leads data with auto-refresh every 30 seconds
  const { data: leads, dataUpdatedAt } = useQuery({
    queryKey: ["tv-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_db")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });

  // Fetch KPIs from RPC
  const { data: kpisData } = useQuery({
    queryKey: ["tv-kpis"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_leads_kpis", { period_days: 7 });
      if (error) throw error;
      return data as {
        total_leads: number;
        audited_leads: number;
        won_leads: number;
        lost_leads: number;
        conversion_rate: number;
        avg_score: number;
        median_first_response_time_minutes: number;
        previous_period: {
          total_leads: number;
          conversion_rate: number;
          avg_score: number;
          median_first_response_time_minutes: number;
        };
      };
    },
    refetchInterval: 30000,
  });

  // Calculate metrics
  const metrics = useMemo(() => {
    if (!leads) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const leadsToday = leads.filter(l => new Date(l.created_at) >= today).length;
    const auditedLeads = leads.filter(l => l.last_ai_update);
    
    // Average service rating
    const ratingsCount = auditedLeads.filter(l => l.service_rating !== null);
    const avgRating = ratingsCount.length > 0 
      ? ratingsCount.reduce((sum, l) => sum + (l.service_rating || 0), 0) / ratingsCount.length
      : 0;

    // Playbook compliance
    const complianceScores = auditedLeads.filter(l => l.playbook_compliance_score !== null);
    const avgCompliance = complianceScores.length > 0
      ? complianceScores.reduce((sum, l) => sum + (l.playbook_compliance_score || 0), 0) / complianceScores.length
      : 0;

    // Steps completion rates
    const stepsAnalysis = auditedLeads.reduce((acc, lead) => {
      const completed = lead.playbook_steps_completed || [];
      if (completed.includes("saudacao")) acc.saudacao++;
      if (completed.includes("qualificacao")) acc.qualificacao++;
      acc.total++;
      return acc;
    }, { saudacao: 0, qualificacao: 0, total: 0 });

    const saudacaoRate = stepsAnalysis.total > 0 
      ? Math.round((stepsAnalysis.saudacao / stepsAnalysis.total) * 100)
      : 0;
    const qualificacaoRate = stepsAnalysis.total > 0 
      ? Math.round((stepsAnalysis.qualificacao / stepsAnalysis.total) * 100)
      : 0;

    // Sales strategies usage
    const strategiesAnalysis = auditedLeads.reduce((acc, lead) => {
      if (lead.used_offer) acc.offer++;
      if (lead.used_anchoring) acc.anchoring++;
      if (lead.objection_overcome) acc.objectionOvercome++;
      if (lead.has_objection) acc.hasObjection++;
      acc.total++;
      return acc;
    }, { offer: 0, anchoring: 0, objectionOvercome: 0, hasObjection: 0, total: 0 });

    const offerRate = strategiesAnalysis.total > 0
      ? Math.round((strategiesAnalysis.offer / strategiesAnalysis.total) * 100)
      : 0;
    const anchoringRate = strategiesAnalysis.total > 0
      ? Math.round((strategiesAnalysis.anchoring / strategiesAnalysis.total) * 100)
      : 0;
    const objectionOvercomeRate = strategiesAnalysis.hasObjection > 0
      ? Math.round((strategiesAnalysis.objectionOvercome / strategiesAnalysis.hasObjection) * 100)
      : 0;

    // Objection categories ranking
    const objectionCounts: Record<string, { total: number; overcome: number }> = {};
    auditedLeads.forEach(lead => {
      const categories = lead.objection_categories || [];
      categories.forEach(cat => {
        if (!objectionCounts[cat]) {
          objectionCounts[cat] = { total: 0, overcome: 0 };
        }
        objectionCounts[cat].total++;
        if (lead.objection_overcome) {
          objectionCounts[cat].overcome++;
        }
      });
    });

    const objectionRanking = Object.entries(objectionCounts)
      .map(([key, value]) => ({
        key,
        label: objectionLabels[key] || key,
        count: value.total,
        overcomeRate: value.total > 0 ? Math.round((value.overcome / value.total) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map((item, index) => ({
        rank: index + 1,
        label: item.label,
        overcomeRate: item.overcomeRate,
        count: item.count,
      }));

    // Find lowest overcome rate objection for alert
    const lowestObjection = objectionRanking.reduce((lowest, current) => 
      current.overcomeRate < lowest.overcomeRate ? current : lowest
    , objectionRanking[0] || { label: "", overcomeRate: 100 });

    return {
      leadsToday,
      avgRating: avgRating.toFixed(1),
      avgCompliance: Math.round(avgCompliance),
      saudacaoRate,
      qualificacaoRate,
      offerRate,
      anchoringRate,
      objectionOvercomeRate,
      objectionRanking,
      lowestObjection,
    };
  }, [leads]);

  // Calculate trend comparisons
  const trends = useMemo(() => {
    if (!kpisData?.previous_period) return null;

    const conversionDiff = kpisData.conversion_rate - kpisData.previous_period.conversion_rate;
    const responseDiff = (kpisData.median_first_response_time_minutes || 0) - 
                         (kpisData.previous_period.median_first_response_time_minutes || 0);
    const leadsDiff = kpisData.total_leads - kpisData.previous_period.total_leads;
    const leadsDiffPercent = kpisData.previous_period.total_leads > 0
      ? Math.round((leadsDiff / kpisData.previous_period.total_leads) * 100)
      : 0;

    return {
      conversion: {
        value: `${conversionDiff >= 0 ? '+' : ''}${conversionDiff.toFixed(1)}%`,
        isPositive: conversionDiff >= 0,
      },
      response: {
        value: `${responseDiff >= 0 ? '+' : ''}${Math.round(responseDiff)}m`,
        isPositive: responseDiff <= 0, // Lower is better for response time
      },
      leads: {
        value: `${leadsDiffPercent >= 0 ? '+' : ''}${leadsDiffPercent}%`,
        isPositive: leadsDiffPercent >= 0,
      },
    };
  }, [kpisData]);

  const lastUpdate = dataUpdatedAt ? format(new Date(dataUpdatedAt), "HH:mm:ss", { locale: ptBR }) : "";

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-8">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <img src={logo} alt="PROCAR Logo" className="h-12 w-12 object-contain" />
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">
              Dashboard de Performance
            </h1>
            <p className="text-slate-500">Atualização em tempo real</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 text-slate-500">
          <RefreshCw className="h-5 w-5 animate-spin-slow" />
          <span className="text-sm">
            Auto-refresh: 30s • Última: {lastUpdate}
          </span>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6 lg:mb-8">
        <TVKPICard
          title="Leads Hoje"
          value={metrics?.leadsToday ?? 0}
          icon={Users}
          trend={trends?.leads}
        />
        <TVKPICard
          title="Conversão"
          value={`${Math.round(kpisData?.conversion_rate ?? 0)}%`}
          icon={Percent}
          trend={trends?.conversion}
        />
        <TVKPICard
          title="1ª Resposta"
          value={`${Math.round(kpisData?.median_first_response_time_minutes ?? 0)}m`}
          icon={Clock}
          trend={trends?.response}
          isAlert={(kpisData?.median_first_response_time_minutes ?? 0) > 15}
        />
        <TVKPICard
          title="Nota Média"
          value={metrics?.avgRating ?? "0.0"}
          icon={Star}
          subtitle="Avaliação de atendimento"
        />
      </div>

      {/* Middle Section - Quality & Efficiency */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-6 lg:mb-8">
        <TVQualitySection
          metrics={[
            { label: "Compliance de Script", value: metrics?.avgCompliance ?? 0, showAlert: true },
            { label: "Saudação Inicial", value: metrics?.saudacaoRate ?? 0, showAlert: true },
            { label: "Qualificação de Lead", value: metrics?.qualificacaoRate ?? 0, showAlert: true },
          ]}
          insight="Atendimentos com compliance alto convertem 28% mais"
        />
        <TVEfficiencySection
          metrics={[
            { label: "Financeira Apresentada", icon: "financial", value: metrics?.offerRate ?? 0 },
            { label: "Promoções/Âncora", icon: "promo", value: metrics?.anchoringRate ?? 0 },
            { label: "Contorno de Objeções", icon: "objection", value: metrics?.objectionOvercomeRate ?? 0 },
          ]}
        />
      </div>

      {/* Bottom Section - Objection Ranking */}
      <TVObjectionRanking
        objections={metrics?.objectionRanking ?? []}
        overallRate={metrics?.objectionOvercomeRate ?? 0}
        alertMessage={
          metrics?.lowestObjection && metrics.lowestObjection.overcomeRate < 60
            ? `Objeção "${metrics.lowestObjection.label}" está com baixo contorno hoje`
            : undefined
        }
      />
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Users, Percent, Clock, Star, RefreshCw, Home, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { format, subDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { motion } from "framer-motion";
import logo from "@/assets/logo.png";
import { cn } from "@/lib/utils";

import { TVKPICard } from "@/components/tv/TVKPICard";
import { TVQualitySection } from "@/components/tv/TVQualitySection";
import { TVEfficiencySection } from "@/components/tv/TVEfficiencySection";
import { TVObjectionRanking } from "@/components/tv/TVObjectionRanking";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

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

// Period options
const periodOptions = [
  { value: "1", label: "Hoje", days: 1 },
  { value: "7", label: "7 dias", days: 7 },
  { value: "30", label: "30 dias", days: 30 },
];

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 15,
    },
  },
};

const headerVariants = {
  hidden: { opacity: 0, y: -20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 20,
    },
  },
};

const sectionVariants = {
  hidden: { opacity: 0, x: -30 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      type: "spring" as const,
      stiffness: 80,
      damping: 20,
    },
  },
};

export default function TVDashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState("7");
  const periodDays = parseInt(selectedPeriod);
  const { role, signOut } = useAuth();
  const navigate = useNavigate();
  const isAdmin = role === "admin";

  // Force light mode for TV display
  useEffect(() => {
    const previousTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
    
    return () => {
      document.documentElement.classList.remove('light');
      if (previousTheme === 'dark') {
        document.documentElement.classList.add('dark');
      }
    };
  }, []);

  // Fetch leads data with auto-refresh every 30 seconds
  // Use pagination to get all leads (default limit is 1000)
  const { data: leads, dataUpdatedAt } = useQuery({
    queryKey: ["tv-leads"],
    queryFn: async () => {
      const allLeads: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        const { data, error } = await supabase
          .from("lead_db")
          .select("*")
          .order("created_at", { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (data && data.length > 0) {
          allLeads.push(...data);
          from += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }
      return allLeads;
    },
    refetchInterval: 30000,
  });

  // Fetch KPIs from RPC with dynamic period
  const { data: kpisData } = useQuery({
    queryKey: ["tv-kpis", periodDays],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_leads_kpis", { period_days: periodDays });
      if (error) throw error;
      // Map flat RPC response to structured format
      const raw = data as any;
      const totalAudited = raw.total_audited ?? 0;
      const wonLeads = raw.won_leads ?? 0;
      const totalAuditedPrev = raw.total_audited_previous ?? 0;
      const wonLeadsPrev = raw.won_leads_previous ?? 0;
      return {
        total_audited: totalAudited,
        won_leads: wonLeads,
        conversion_rate: totalAudited > 0 ? Math.round((wonLeads / totalAudited) * 1000) / 10 : 0,
        avg_score: raw.avg_score ?? 0,
        median_first_response_time_minutes: raw.median_first_response_time_minutes ?? 0,
        previous_period: {
          total_audited: totalAuditedPrev,
          won_leads: wonLeadsPrev,
          conversion_rate: totalAuditedPrev > 0 ? Math.round((wonLeadsPrev / totalAuditedPrev) * 1000) / 10 : 0,
          avg_score: raw.avg_score_previous ?? 0,
          median_first_response_time_minutes: raw.median_first_response_time_minutes_previous ?? 0,
        },
      };
    },
    refetchInterval: 30000,
  });

  // Filter leads by selected period
  const filteredLeads = useMemo(() => {
    if (!leads) return [];
    const startDate = startOfDay(subDays(new Date(), periodDays));
    return leads.filter(l => new Date(l.created_at) >= startDate);
  }, [leads, periodDays]);

  // Previous period leads for comparison
  const previousPeriodLeads = useMemo(() => {
    if (!leads) return [];
    const currentStart = startOfDay(subDays(new Date(), periodDays));
    const previousStart = startOfDay(subDays(new Date(), periodDays * 2));
    return leads.filter(l => {
      const date = new Date(l.created_at);
      return date >= previousStart && date < currentStart;
    });
  }, [leads, periodDays]);

  // Calculate metrics for current period
  const metrics = useMemo(() => {
    if (!filteredLeads.length) return null;

    const auditedLeads = filteredLeads.filter(l => l.last_ai_update);
    
    const ratingsCount = auditedLeads.filter(l => l.service_rating !== null);
    const avgRating = ratingsCount.length > 0 
      ? ratingsCount.reduce((sum, l) => sum + (l.service_rating || 0), 0) / ratingsCount.length
      : 0;

    const complianceScores = auditedLeads.filter(l => l.playbook_compliance_score !== null);
    const avgCompliance = complianceScores.length > 0
      ? complianceScores.reduce((sum, l) => sum + (l.playbook_compliance_score || 0), 0) / complianceScores.length
      : 0;

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

    const lowestObjection = objectionRanking.reduce((lowest, current) => 
      current.overcomeRate < lowest.overcomeRate ? current : lowest
    , objectionRanking[0] || { label: "", overcomeRate: 100 });

    return {
      leadsCount: filteredLeads.length,
      avgRating,
      avgCompliance: Math.round(avgCompliance),
      saudacaoRate,
      qualificacaoRate,
      offerRate,
      anchoringRate,
      objectionOvercomeRate,
      objectionRanking,
      lowestObjection,
    };
  }, [filteredLeads]);

  // Calculate metrics for previous period
  const previousMetrics = useMemo(() => {
    if (!previousPeriodLeads.length) return null;

    const auditedLeads = previousPeriodLeads.filter(l => l.last_ai_update);
    
    const ratingsCount = auditedLeads.filter(l => l.service_rating !== null);
    const avgRating = ratingsCount.length > 0 
      ? ratingsCount.reduce((sum, l) => sum + (l.service_rating || 0), 0) / ratingsCount.length
      : 0;

    const complianceScores = auditedLeads.filter(l => l.playbook_compliance_score !== null);
    const avgCompliance = complianceScores.length > 0
      ? complianceScores.reduce((sum, l) => sum + (l.playbook_compliance_score || 0), 0) / complianceScores.length
      : 0;

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

    return {
      leadsCount: previousPeriodLeads.length,
      avgRating,
      avgCompliance: Math.round(avgCompliance),
      saudacaoRate,
      qualificacaoRate,
      offerRate,
      anchoringRate,
      objectionOvercomeRate,
    };
  }, [previousPeriodLeads]);

  // Calculate all trend comparisons
  const trends = useMemo(() => {
    if (!kpisData?.previous_period || !metrics || !previousMetrics) return null;

    const leadsDiff = metrics.leadsCount - previousMetrics.leadsCount;
    const leadsDiffPercent = previousMetrics.leadsCount > 0
      ? Math.round((leadsDiff / previousMetrics.leadsCount) * 100)
      : 0;

    const conversionDiff = kpisData.conversion_rate - kpisData.previous_period.conversion_rate;

    const responseDiff = (kpisData.median_first_response_time_minutes || 0) - 
                         (kpisData.previous_period.median_first_response_time_minutes || 0);

    const ratingDiff = metrics.avgRating - previousMetrics.avgRating;
    const complianceDiff = metrics.avgCompliance - previousMetrics.avgCompliance;
    const saudacaoDiff = metrics.saudacaoRate - previousMetrics.saudacaoRate;
    const qualificacaoDiff = metrics.qualificacaoRate - previousMetrics.qualificacaoRate;
    const objectionDiff = metrics.objectionOvercomeRate - previousMetrics.objectionOvercomeRate;

    return {
      leads: {
        value: `${leadsDiffPercent >= 0 ? '+' : ''}${leadsDiffPercent}%`,
        isPositive: leadsDiffPercent >= 0,
      },
      conversion: {
        value: `${conversionDiff >= 0 ? '+' : ''}${conversionDiff.toFixed(1)}%`,
        isPositive: conversionDiff >= 0,
      },
      response: {
        value: `${responseDiff >= 0 ? '+' : ''}${Math.round(responseDiff)}m`,
        isPositive: responseDiff <= 0,
      },
      rating: {
        value: `${ratingDiff >= 0 ? '+' : ''}${ratingDiff.toFixed(1)}`,
        isPositive: ratingDiff >= 0,
      },
      compliance: {
        value: `${complianceDiff >= 0 ? '+' : ''}${complianceDiff}%`,
        isPositive: complianceDiff >= 0,
      },
      saudacao: {
        value: `${saudacaoDiff >= 0 ? '+' : ''}${saudacaoDiff}%`,
        isPositive: saudacaoDiff >= 0,
      },
      qualificacao: {
        value: `${qualificacaoDiff >= 0 ? '+' : ''}${qualificacaoDiff}%`,
        isPositive: qualificacaoDiff >= 0,
      },
      objection: {
        value: `${objectionDiff >= 0 ? '+' : ''}${objectionDiff}%`,
        isPositive: objectionDiff >= 0,
      },
    };
  }, [kpisData, metrics, previousMetrics]);

  const lastUpdate = dataUpdatedAt ? format(new Date(dataUpdatedAt), "HH:mm:ss", { locale: ptBR }) : "";
  const periodLabel = periodOptions.find(p => p.value === selectedPeriod)?.label || "7 dias";

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-8 overflow-hidden">
      {/* Header */}
      <motion.header 
        variants={headerVariants}
        initial="hidden"
        animate="visible"
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8"
      >
        <div className="flex items-center gap-4">
          {/* Back to Home Button - admin only */}
          {isAdmin && (
            <Link 
              to="/"
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300 hover:shadow-sm transition-all"
              title="Voltar ao Dashboard"
            >
              <Home className="h-5 w-5" />
            </Link>
          )}
          
          {/* Logout Button - for regular users */}
          {!isAdmin && (
            <button
              onClick={async () => { await signOut(); navigate("/login"); }}
              className="p-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-300 hover:shadow-sm transition-all"
              title="Sair"
            >
              <LogOut className="h-5 w-5" />
            </button>
          )}
          
          <motion.img 
            src={logo} 
            alt="PROCAR Logo" 
            className="h-12 w-12 object-contain"
            initial={{ rotate: -180, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
          />
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">
              Painel 360°
            </h1>
            <p className="text-slate-500">Atualização em tempo real</p>
          </div>
        </div>

        <motion.div 
          className="flex items-center gap-6"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          {/* Period Toggle */}
          <div className="flex items-center gap-3">
            <span className="text-slate-500 text-sm font-medium">Período:</span>
            <ToggleGroup 
              type="single" 
              value={selectedPeriod} 
              onValueChange={(value) => value && setSelectedPeriod(value)}
              className="bg-white rounded-xl p-1 shadow-sm border border-slate-200"
            >
              {periodOptions.map((option) => (
                <ToggleGroupItem
                  key={option.value}
                  value={option.value}
                  className={cn(
                    "px-4 py-2 text-sm font-medium rounded-lg transition-all",
                    selectedPeriod === option.value
                      ? "bg-slate-800 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100"
                  )}
                >
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          {/* Auto-refresh indicator */}
          <div className="flex items-center gap-3 text-slate-500">
            <RefreshCw className="h-5 w-5 animate-spin-slow" />
            <span className="text-sm">
              Auto-refresh: 30s • Última: {lastUpdate}
            </span>
          </div>
        </motion.div>
      </motion.header>

      {/* KPI Cards */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6 lg:mb-8"
      >
        <motion.div variants={itemVariants}>
          <TVKPICard
            title={`Leads (${periodLabel})`}
            value={metrics?.leadsCount ?? 0}
            icon={Users}
            trend={trends?.leads}
            subtitle="vs. período anterior"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <TVKPICard
            title="Conversão"
            value={`${Math.round(kpisData?.conversion_rate ?? 0)}%`}
            icon={Percent}
            trend={trends?.conversion}
            subtitle="vs. período anterior"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <TVKPICard
            title="1ª Resposta"
            value={`${Math.round(kpisData?.median_first_response_time_minutes ?? 0)}m`}
            icon={Clock}
            trend={trends?.response}
            isAlert={(kpisData?.median_first_response_time_minutes ?? 0) > 15}
            subtitle="tempo mediano"
          />
        </motion.div>
        <motion.div variants={itemVariants}>
          <TVKPICard
            title="Nota Média"
            value={(metrics?.avgRating ?? 0).toFixed(1)}
            icon={Star}
            trend={trends?.rating}
            subtitle="avaliação de atendimento"
          />
        </motion.div>
      </motion.div>

      {/* Secondary KPI Cards */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6 lg:mb-8"
      >
        {[
          { label: "Compliance Script", value: metrics?.avgCompliance ?? 0, trend: trends?.compliance, unit: "%" },
          { label: "Saudação Inicial", value: metrics?.saudacaoRate ?? 0, trend: trends?.saudacao, unit: "%" },
          { label: "Qualificação", value: metrics?.qualificacaoRate ?? 0, trend: trends?.qualificacao, unit: "%" },
          { label: "Objeções Contornadas", value: metrics?.objectionOvercomeRate ?? 0, trend: trends?.objection, unit: "%" },
        ].map((item, index) => (
          <motion.div 
            key={item.label}
            variants={itemVariants}
            whileHover={{ scale: 1.02, y: -2 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
            className="bg-white rounded-2xl shadow-md p-5 border border-slate-100 cursor-default"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-500 text-sm font-medium">{item.label}</span>
              {item.trend && (
                <motion.span 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.5 + index * 0.1, type: "spring" }}
                  className={cn(
                    "text-xs font-semibold px-2 py-1 rounded-full",
                    item.trend.isPositive ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                  )}
                >
                  {item.trend.value}
                </motion.span>
              )}
            </div>
            <motion.div 
              className="text-3xl font-bold text-slate-800"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 + index * 0.1, type: "spring", stiffness: 100 }}
            >
              {item.value}{item.unit}
            </motion.div>
          </motion.div>
        ))}
      </motion.div>

      {/* Middle Section - Quality & Efficiency */}
      <motion.div 
        className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-6 lg:mb-8"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: { staggerChildren: 0.2, delayChildren: 0.4 }
          }
        }}
      >
        <motion.div 
          variants={sectionVariants}
          whileHover={{ scale: 1.01 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <TVQualitySection
            metrics={[
              { label: "Compliance de Script", value: metrics?.avgCompliance ?? 0, showAlert: true },
              { label: "Saudação Inicial", value: metrics?.saudacaoRate ?? 0, showAlert: true },
              { label: "Qualificação de Lead", value: metrics?.qualificacaoRate ?? 0, showAlert: true },
            ]}
            insight="Atendimentos com compliance alto convertem 28% mais"
          />
        </motion.div>
        <motion.div 
          variants={sectionVariants}
          whileHover={{ scale: 1.01 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <TVEfficiencySection
            metrics={[
              { label: "Financeira Apresentada", icon: "financial", value: metrics?.offerRate ?? 0 },
              { label: "Promoções/Âncora", icon: "promo", value: metrics?.anchoringRate ?? 0 },
              { label: "Contorno de Objeções", icon: "objection", value: metrics?.objectionOvercomeRate ?? 0 },
            ]}
          />
        </motion.div>
      </motion.div>

      {/* Bottom Section - Objection Ranking */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, type: "spring", stiffness: 80, damping: 20 }}
        whileHover={{ scale: 1.005 }}
      >
        <TVObjectionRanking
          objections={metrics?.objectionRanking ?? []}
          overallRate={metrics?.objectionOvercomeRate ?? 0}
          alertMessage={
            metrics?.lowestObjection && metrics.lowestObjection.overcomeRate < 60
              ? `Objeção "${metrics.lowestObjection.label}" está com baixo contorno neste período`
              : undefined
          }
        />
      </motion.div>
    </div>
  );
}

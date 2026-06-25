import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KPICard } from "@/components/dashboard/KPICard";
import { MagicBentoGrid } from "@/components/ui/magic-bento-grid";

interface PipelineLossCardsProps {
  dateFrom: string | null;
  dateTo: string | null;
}

interface PipelineLossKpis {
  lost_total: number;
  lost_total_previous: number | null;
  lost_distancia: number;
  lost_distancia_previous: number | null;
  financeiras: number;
  financeiras_previous: number | null;
  fin_shopmonkey: number;
  fin_shopmonkey_previous: number | null;
}

/**
 * Seção "Pipeline / Perdas" (checklist N — itens 49/50/52). Cards AMARELOS
 * (tone="warning") porque o MOTIVO da perda vem da análise de IA sobre o chat
 * (subconjunto da base), não de um campo loss_reason do Kommo (que não existe).
 * Fonte: RPC get_pipeline_loss_kpis sobre lead_db_painel.
 */
export function PipelineLossCards({ dateFrom, dateTo }: PipelineLossCardsProps) {
  const { data } = useQuery({
    queryKey: ["pipeline-loss-kpis", dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_pipeline_loss_kpis", {
        date_from: dateFrom,
        date_to: dateTo,
      });
      if (error) throw error;
      return data as PipelineLossKpis;
    },
  });

  // invert=true: queda do indicador é POSITIVA (verde) — caso de "leads perdidos".
  const trend = (cur: number, prev: number | null | undefined, invert = false) => {
    if (!prev || prev <= 0) return undefined;
    const v = ((cur - prev) / prev) * 100;
    return {
      value: Math.abs(parseFloat(v.toFixed(1))),
      isPositive: invert ? v < 0 : v >= 0,
      isNegativeChange: v < 0,
    };
  };

  const lost = data?.lost_total ?? 0;
  const dist = data?.lost_distancia ?? 0;
  const fin = data?.financeiras ?? 0;
  const finSm = data?.fin_shopmonkey ?? 0;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">Pipeline / Perdas</h3>
      <MagicBentoGrid enableSpotlight={true} spotlightRadius={300} glowColor="234, 179, 8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <KPICard
            title="Leads Perdidos"
            value={lost}
            tone="warning"
            trend={trend(lost, data?.lost_total_previous, true)}
            info={{
              description: "Leads marcados como PERDIDOS (venda perdida) no período.",
              source: "base do painel (Kommo, sem duplicatas/ausentes), pela data de criação do lead.",
              calculation: "conta leads cujo status contém 'perdida'. A seta verde indica QUEDA de perdidos (melhor).",
            }}
          />
          <KPICard
            title="Perdidos · Local Distante"
            value={dist}
            tone="warning"
            trend={trend(dist, data?.lost_distancia_previous, true)}
            info={{
              description: "Leads perdidos cujo motivo foi DISTÂNCIA / local distante.",
              source: "vem do MOTIVO DE PERDA marcado no Kommo (ex.: 'Local Muito Distante') ao mover o lead para 'Venda perdida' — sincronizado pelo sync-kommo — e também da objeção 'distância' detectada pela IA no chat.",
              calculation: "leads perdidos cujo motivo de perda no Kommo contém 'distante' OU cuja objeção de IA é 'distância'. O status/motivo do Kommo atualiza no sync (horário).",
            }}
          />
          <KPICard
            title="Financeiras"
            value={fin}
            tone="warning"
            trend={trend(fin, data?.financeiras_previous)}
            info={{
              description: "Leads/casos em que apareceu FINANCIAMENTO (financeira) na conversa.",
              source: "objeção/tema 'financiamento' da análise de IA sobre o chat (subconjunto da base).",
              calculation: "conta leads com tema de financiamento no período. Estimativa: cobre só os leads analisados pela IA.",
            }}
          />
          <KPICard
            title="Financiamento (ShopMonkey)"
            value={finSm}
            tone="warning"
            trend={trend(finSm, data?.fin_shopmonkey_previous)}
            info={{
              description: "Citações de financeira no note do agendamento: SNAP, ACIMA, AMERICAN FIRST.",
              source: "texto (note) do agendamento no ShopMonkey, lido por código — cada token separado por vírgula conta 1 unidade.",
              calculation: "soma as ocorrências de SNAP / ACIMA / AMERICAN FIRST nos agendamentos do período (pela data do agendamento). Contagem PARCIAL (depende de a equipe escrever o nome da financeira no note).",
            }}
          />
        </div>
      </MagicBentoGrid>
    </div>
  );
}

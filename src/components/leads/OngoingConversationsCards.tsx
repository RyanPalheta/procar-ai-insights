import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KPICard } from "@/components/dashboard/KPICard";
import { MagicBentoGrid } from "@/components/ui/magic-bento-grid";

interface Props {
  dateFrom: string | null;
  dateTo: string | null;
}

interface OngoingKpis {
  ongoing_total: number;
  ongoing_whatsapp: number;
  ongoing_facebook: number;
  ongoing_instagram: number;
}

/**
 * Seção "Conversas de dias anteriores (em andamento)" — checklist B (7-12).
 * Conversas cuja interação no período aconteceu em DIA DIFERENTE do dia de criação
 * do lead, com o lead ainda ABERTO. Cards AMARELOS (recorte especial + limitação FB/IG).
 */
export function OngoingConversationsCards({ dateFrom, dateTo }: Props) {
  const { data } = useQuery({
    queryKey: ["ongoing-conversations-kpis", dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_ongoing_conversations_kpis", {
        date_from: dateFrom,
        date_to: dateTo,
      });
      if (error) throw error;
      return data as OngoingKpis;
    },
  });

  const total = data?.ongoing_total ?? 0;
  const wa = data?.ongoing_whatsapp ?? 0;
  const fb = data?.ongoing_facebook ?? 0;
  const ig = data?.ongoing_instagram ?? 0;

  const fonteFbIg =
    "Facebook e Instagram quase não têm mensagens de agente registradas (saída não rastreada), então o número desses canais é um piso.";

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">Conversas de Dias Anteriores (em andamento)</h3>
      <MagicBentoGrid enableSpotlight={true} spotlightRadius={300} glowColor="234, 179, 8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <KPICard
            title="Conversas em Andamento"
            value={total}
            tone="warning"
            info={{
              description: "Conversas que aconteceram em um dia DIFERENTE do dia em que o lead entrou — atendimentos vindos de dias anteriores e ainda em andamento.",
              source: "conta conversas de WhatsApp/chat ligadas a leads ainda em aberto (não ganhos/perdidos). " + fonteFbIg,
              calculation: "sessões com interação no período cuja data é posterior à data de criação do lead. Agendamentos não são cruzados (sem chave estruturada conversa→agendamento).",
            }}
          />
          <KPICard title="WhatsApp" value={wa} tone="warning"
            info={{ description: "Conversas em andamento (dias anteriores) no WhatsApp.", source: "interaction_db, canal WhatsApp.", calculation: "sessões WhatsApp com interação no período em data posterior à criação do lead." }} />
          <KPICard title="Facebook" value={fb} tone="warning"
            info={{ description: "Conversas em andamento (dias anteriores) no Facebook.", source: fonteFbIg, calculation: "sessões Facebook com interação no período em data posterior à criação do lead — piso (outbound não rastreado)." }} />
          <KPICard title="Instagram" value={ig} tone="warning"
            info={{ description: "Conversas em andamento (dias anteriores) no Instagram.", source: fonteFbIg, calculation: "sessões Instagram com interação no período em data posterior à criação do lead — piso (outbound não rastreado)." }} />
        </div>
      </MagicBentoGrid>
    </div>
  );
}

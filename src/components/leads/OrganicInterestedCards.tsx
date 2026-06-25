import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KPICard } from "@/components/dashboard/KPICard";
import { MagicBentoGrid } from "@/components/ui/magic-bento-grid";

interface Props {
  dateFrom: string | null;
  dateTo: string | null;
}

interface OrganicKpis {
  mensagens: number;
  agendamento: number;
  conversao: number;
}

/**
 * Seção "Orgânico" — checklist D (16-18). Tráfego de ANÚNCIO (fora do WhatsApp
 * orgânico) identificado pela regra: a PRIMEIRA mensagem do cliente contém
 * "I'm interested" — o template pré-preenchido dos anúncios Meta (FB/IG
 * click-to-message e click-to-WhatsApp). ~1953 sessões na base. Cards AMARELOS.
 */
export function OrganicInterestedCards({ dateFrom, dateTo }: Props) {
  const { data } = useQuery({
    queryKey: ["organic-interested-kpis", dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_organic_interested_kpis", {
        date_from: dateFrom,
        date_to: dateTo,
      });
      if (error) throw error;
      return data as OrganicKpis;
    },
  });

  const msgs = data?.mensagens ?? 0;
  const agend = data?.agendamento ?? 0;
  const conv = data?.conversao ?? 0;
  const taxa = msgs > 0 ? ((agend / msgs) * 100).toFixed(1) + "%" : "—";

  const regra =
    "Conta o lead cuja PRIMEIRA mensagem contém \"I'm interested\" — o texto pré-preenchido dos anúncios Meta (FB/IG e click-to-WhatsApp). É o tráfego de ANÚNCIO que entra fora do WhatsApp orgânico. Reconhece variações do apóstrofo (I'm / Im / I am).";

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">Orgânico (tráfego "I'm interested")</h3>
      <MagicBentoGrid enableSpotlight={true} spotlightRadius={300} glowColor="234, 179, 8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <KPICard title="Mensagens Orgânico" value={msgs} tone="warning"
            info={{ description: "Leads de tráfego orgânico (fora do WhatsApp).", source: "interaction_db (1ª mensagem do cliente).", calculation: regra }} />
          <KPICard title="Agendamento Orgânico" value={agend} tone="warning"
            info={{ description: "Agendamentos vindos de leads orgânicos.", source: "leads orgânicos cujo status virou agendamento/venda.", calculation: regra }} />
          <KPICard title="Conversão Orgânico" value={taxa} tone="warning"
            info={{ description: "Taxa de conversão do tráfego orgânico.", source: "agendamentos ÷ mensagens orgânicas.", calculation: regra }} />
          <KPICard title="Vendas Orgânico" value={conv} tone="warning"
            info={{ description: "Vendas ganhas a partir de leads orgânicos.", source: "leads orgânicos com status 'venda ganha'.", calculation: regra }} />
        </div>
      </MagicBentoGrid>
    </div>
  );
}

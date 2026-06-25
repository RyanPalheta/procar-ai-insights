import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KPICard } from "@/components/dashboard/KPICard";
import { MagicBentoGrid } from "@/components/ui/magic-bento-grid";

interface Props {
  dateFrom: string | null;
  dateTo: string | null;
}

interface GroupKpis {
  mensagens: number;
  agendamento: number;
  vendas: number;
}

interface OrganicVsTraffic {
  organico: GroupKpis;
  trafego: GroupKpis;
}

/**
 * Seção "Orgânico × Tráfego" (checklist D — 16-18). Classifica cada lead que
 * iniciou um chat pela PRIMEIRA mensagem do cliente:
 *   • ORGÂNICO — a 1ª mensagem NÃO é o template de anúncio. Entrou pelo WhatsApp
 *     de forma espontânea.
 *   • TRÁFEGO  — a 1ª mensagem é "I'm interested in <produto>", o texto pré-
 *     preenchido dos anúncios Meta (FB/IG e click-to-WhatsApp) → tráfego PAGO.
 * Reconhece variações do apóstrofo (I'm / Im / I am).
 */
export function OrganicInterestedCards({ dateFrom, dateTo }: Props) {
  const { data } = useQuery({
    queryKey: ["organic-vs-traffic-kpis", dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_organic_vs_traffic_kpis", {
        date_from: dateFrom,
        date_to: dateTo,
      });
      if (error) throw error;
      return data as OrganicVsTraffic;
    },
  });

  const empty: GroupKpis = { mensagens: 0, agendamento: 0, vendas: 0 };
  const organico = data?.organico ?? empty;
  const trafego = data?.trafego ?? empty;

  return (
    <div className="space-y-6">
      <Group
        title="Orgânico (entrada espontânea pelo WhatsApp)"
        kpis={organico}
        tone="default"
        glowColor="16, 185, 129"
        prefix="Orgânico"
        regra={
          'Conta o lead cuja PRIMEIRA mensagem NÃO é o template de anúncio "I\'m interested". ' +
          "Ou seja, o cliente chegou pelo WhatsApp de forma espontânea (orgânica), e não por clique em anúncio."
        }
        sourceMsg="interaction_db (1ª mensagem do cliente que NÃO casa o template do anúncio)."
      />

      <Group
        title={'Tráfego (anúncios Meta — "I\'m interested")'}
        kpis={trafego}
        tone="warning"
        glowColor="234, 179, 8"
        prefix="Tráfego"
        regra={
          'Conta o lead cuja PRIMEIRA mensagem contém "I\'m interested" — o texto pré-preenchido dos ' +
          "anúncios Meta (FB/IG e click-to-WhatsApp). É o tráfego PAGO que entra fora do WhatsApp orgânico. " +
          "Reconhece variações do apóstrofo (I'm / Im / I am)."
        }
        sourceMsg="interaction_db (1ª mensagem do cliente que casa o template do anúncio)."
      />
    </div>
  );
}

function Group({
  title,
  kpis,
  tone,
  glowColor,
  prefix,
  regra,
  sourceMsg,
}: {
  title: string;
  kpis: GroupKpis;
  tone: "default" | "warning";
  glowColor: string;
  prefix: string;
  regra: string;
  sourceMsg: string;
}) {
  const msgs = kpis.mensagens ?? 0;
  const agend = kpis.agendamento ?? 0;
  const vendas = kpis.vendas ?? 0;
  const taxa = msgs > 0 ? ((agend / msgs) * 100).toFixed(1) + "%" : "—";

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <MagicBentoGrid enableSpotlight={true} spotlightRadius={300} glowColor={glowColor}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <KPICard title={`Mensagens ${prefix}`} value={msgs} tone={tone}
            info={{ description: "Leads que iniciaram chat neste grupo.", source: sourceMsg, calculation: regra }} />
          <KPICard title={`Agendamento ${prefix}`} value={agend} tone={tone}
            info={{ description: `Agendamentos vindos de leads ${prefix.toLowerCase()}.`, source: "leads do grupo cujo status virou agendamento/venda.", calculation: regra }} />
          <KPICard title={`Conversão ${prefix}`} value={taxa} tone={tone}
            info={{ description: `Taxa de conversão do tráfego ${prefix.toLowerCase()}.`, source: "agendamentos ÷ mensagens do grupo.", calculation: regra }} />
          <KPICard title={`Vendas ${prefix}`} value={vendas} tone={tone}
            info={{ description: `Vendas ganhas a partir de leads ${prefix.toLowerCase()}.`, source: "leads do grupo com status 'venda ganha'.", calculation: regra }} />
        </div>
      </MagicBentoGrid>
    </div>
  );
}

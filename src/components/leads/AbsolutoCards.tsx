import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KPICard } from "@/components/dashboard/KPICard";
import { MagicBentoGrid } from "@/components/ui/magic-bento-grid";

interface Props {
  dateFrom: string | null;
  dateTo: string | null;
}

interface AbsolutoKpis {
  absoluto_total: number;
  absoluto_agendamentos: number;
}

/**
 * Seção "Absoluto" — checklist G (25-27). Cards AMARELOS PREPARADOS.
 * "Absoluto" é capturado por uma TAG aplicada ao lead na Kommo (via webhook de
 * mensagem) e lida pelo sync-kommo em lead_db.is_absoluto. Enquanto o webhook não
 * estiver ativo, os números ficam em 0 — o disclaimer "?" explica a dependência.
 */
export function AbsolutoCards({ dateFrom, dateTo }: Props) {
  const { data } = useQuery({
    queryKey: ["absoluto-kpis", dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_absoluto_kpis", {
        date_from: dateFrom,
        date_to: dateTo,
      });
      if (error) throw error;
      return data as AbsolutoKpis;
    },
  });

  const total = data?.absoluto_total ?? 0;
  const agend = data?.absoluto_agendamentos ?? 0;
  const taxa = total > 0 ? ((agend / total) * 100).toFixed(1) + "%" : "—";

  const regra =
    "Card PREPARADO. 'Absoluto' é capturado por uma TAG aplicada na Kommo (webhook de mensagem) e lida pelo sync-kommo. Enquanto o webhook/tag não estiver ativo, fica em 0. Não vem da nota do ShopMonkey.";

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-muted-foreground">Absoluto</h3>
      <MagicBentoGrid enableSpotlight={true} spotlightRadius={300} glowColor="234, 179, 8">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <KPICard title="Absoluto" value={total} tone="warning"
            info={{ description: "Leads marcados como 'absoluto' (tag da Kommo).", source: "lead_db.is_absoluto, alimentado pelo sync-kommo a partir da tag.", calculation: regra }} />
          <KPICard title="Agendamentos (Absoluto)" value={agend} tone="warning"
            info={{ description: "Agendamentos/vendas vindos de leads 'absoluto'.", source: "lead_db.is_absoluto + status de agendamento/venda.", calculation: regra }} />
          <KPICard title="Taxa (Absoluto)" value={taxa} tone="warning"
            info={{ description: "Conversão do 'absoluto' em agendamento.", source: "agendamentos ÷ total de absoluto.", calculation: regra }} />
        </div>
      </MagicBentoGrid>
    </div>
  );
}

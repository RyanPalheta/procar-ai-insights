import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { ChartInfoTooltip } from "@/components/ui/chart-info-tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { formatUSD } from "@/lib/utils";
import { CalendarCheck, Footprints, ShoppingBag, DollarSign, Store, FileText } from "lucide-react";

export interface SellerShopmonkeyKPI {
  seller: string;
  agendamentos: number;
  walk_ins: number;
  orcamentos: number;
  vendas: number;
  receita_usd: number;
}

interface Props {
  dateFrom: string | null;
  dateTo: string | null;
}

/**
 * Vendas, agendamentos e walk-ins por VENDEDOR vindos do ShopMonkey (fonte real da
 * loja). O vendedor é extraído do texto do agendamento por código puro (parseNote,
 * ~93% de cobertura) — não existe campo estruturado de vendedor na Kommo/ShopMonkey.
 * Complementa a tabela de performance (chat/IA), que cobre só os leads auditados.
 */
export function SellersShopmonkeyKPIs({ dateFrom, dateTo }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["sellers-shopmonkey-kpis", dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_sellers_shopmonkey_kpis", {
        date_from: dateFrom,
        date_to: dateTo,
      });
      if (error) throw error;
      return (data as SellerShopmonkeyKPI[]) || [];
    },
  });

  const rows = data || [];
  const totals = rows.reduce(
    (a, r) => ({
      agendamentos: a.agendamentos + Number(r.agendamentos),
      walk_ins: a.walk_ins + Number(r.walk_ins),
      orcamentos: a.orcamentos + Number(r.orcamentos),
      vendas: a.vendas + Number(r.vendas),
      receita_usd: a.receita_usd + Number(r.receita_usd),
    }),
    { agendamentos: 0, walk_ins: 0, orcamentos: 0, vendas: 0, receita_usd: 0 },
  );

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-primary" />
            <div>
              <h3 className="font-semibold leading-tight flex items-center gap-1.5">
                Vendas &amp; agendamentos por vendedor (ShopMonkey)
                <ChartInfoTooltip
                  description="Orçamentos, agendamentos, presenciais (walk-in), vendas pagas e receita de CADA vendedor, vindos do ShopMonkey — a fonte real da loja, não do chat."
                  source="ShopMonkey: orçamento = order criado (toda cotação vira um order); agendamento = appointment confirmado (verde); venda = order pago (receita em USD). O VENDEDOR é extraído do texto do agendamento por código puro (parseNote), com ~93% de cobertura; orçamento/venda são atribuídos ao vendedor pelo cliente (customer_id) do agendamento (~91%)."
                  calculation="Orçamentos: nº de orders criados no período (por data de criação). Agendamentos/walk-ins: nº de appointments do vendedor no período. Vendas/receita: orders pagos no período (por data de pagamento); receita = soma do valor pago. Tudo atribuído ao vendedor do agendamento do mesmo cliente."
                />
              </h3>
              <p className="text-xs text-muted-foreground">
                Fonte real da loja · vendedor recuperado dos notes (~93% de cobertura)
              </p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Sem agendamentos/vendas do ShopMonkey no período.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {rows.map((r) => (
                <div key={r.seller} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
                      {r.seller.substring(0, 2).toUpperCase()}
                    </div>
                    <p className="font-semibold">{r.seller}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Metric icon={<FileText className="h-3.5 w-3.5" />} label="Orçamentos" value={r.orcamentos} />
                    <Metric icon={<CalendarCheck className="h-3.5 w-3.5" />} label="Agendamentos" value={r.agendamentos} />
                    <Metric icon={<Footprints className="h-3.5 w-3.5" />} label="Presenciais" value={r.walk_ins} />
                    <Metric icon={<ShoppingBag className="h-3.5 w-3.5" />} label="Vendas" value={r.vendas} />
                    <Metric
                      icon={<DollarSign className="h-3.5 w-3.5" />}
                      label="Receita"
                      value={formatUSD(Number(r.receita_usd), 0)}
                      highlight
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t pt-3 text-sm text-muted-foreground">
              <span>Total: <b className="text-foreground">{totals.orcamentos}</b> orçamentos</span>
              <span><b className="text-foreground">{totals.agendamentos}</b> agendamentos</span>
              <span><b className="text-foreground">{totals.walk_ins}</b> presenciais</span>
              <span><b className="text-foreground">{totals.vendas}</b> vendas</span>
              <span>Receita <b className="text-foreground">{formatUSD(totals.receita_usd, 0)}</b></span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({
  icon,
  label,
  value,
  highlight,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1 text-muted-foreground">
        {icon}
        <span className="text-[11px]">{label}</span>
      </div>
      <p className={highlight ? "text-sm font-semibold text-emerald-600 dark:text-emerald-400" : "text-sm font-semibold"}>
        {value}
      </p>
    </div>
  );
}

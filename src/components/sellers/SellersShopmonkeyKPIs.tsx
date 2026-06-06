import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { ChartInfoTooltip } from "@/components/ui/chart-info-tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { formatUSD } from "@/lib/utils";
import { CalendarCheck, Footprints, ShoppingBag, DollarSign, Store, FileText, Receipt, Users, CalendarClock } from "lucide-react";

export interface SellerShopmonkeyKPI {
  seller: string;
  leads: number;
  agendamentos: number;
  walk_ins: number;
  orcamentos: number;
  vendas: number;
  receita_usd: number;
  conv_pct: number | null;
  taxa_agend_pct: number | null;
}

interface Props {
  dateFrom: string | null;
  dateTo: string | null;
}

/**
 * Vendas, agendamentos e walk-ins por VENDEDOR vindos do ShopMonkey (fonte real da
 * loja). O vendedor é extraído do texto do agendamento por código puro (parseNote,
 * ~93% de cobertura) — não existe campo estruturado de vendedor na Kommo/ShopMonkey.
 * O TOTAL de leads por vendedor vem da Kommo (lead_db completo), o que dá taxas de
 * conversão reais (venda ÷ leads ~43-58%), e não o número inflado de só comparar
 * etapas pós-loja (que dava ~95%).
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
      leads: a.leads + Number(r.leads),
      agendamentos: a.agendamentos + Number(r.agendamentos),
      walk_ins: a.walk_ins + Number(r.walk_ins),
      orcamentos: a.orcamentos + Number(r.orcamentos),
      vendas: a.vendas + Number(r.vendas),
      receita_usd: a.receita_usd + Number(r.receita_usd),
    }),
    { leads: 0, agendamentos: 0, walk_ins: 0, orcamentos: 0, vendas: 0, receita_usd: 0 },
  );
  const convTotal = totals.leads > 0 ? Math.round((totals.vendas / totals.leads) * 1000) / 10 : 0;

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-primary" />
            <div>
              <h3 className="font-semibold leading-tight flex items-center gap-1.5">
                Conversão &amp; funil por vendedor (loja + Kommo)
                <ChartInfoTooltip
                  description="Total de leads, orçamentos, agendamentos, vendas, receita e as TAXAS DE CONVERSÃO reais de cada vendedor. O total de leads vem da Kommo (todas as oportunidades do vendedor); orçamentos, agendamentos e vendas vêm do sistema da loja (Shopmonkey)."
                  source="Leads: total de oportunidades do vendedor na Kommo (campo Vendedor, preenchido pelo cruzamento telefone Shopmonkey↔Kommo). Orçamentos, agendamentos e vendas: sistema da loja (Shopmonkey); o vendedor é lido do texto do agendamento (~93%) e ligado ao orçamento/venda pelo mesmo cliente (~91%)."
                  calculation="Conversão = vendas ÷ total de leads. Taxa de agendamento = agendamentos ÷ total de leads. Orçamentos/agendamentos/vendas são contagens do período; receita = soma dos pagamentos concluídos; ticket médio = receita ÷ vendas."
                />
              </h3>
              <p className="text-xs text-muted-foreground">
                Total de leads pela Kommo · orçamento/agendamento/venda pela loja (Shopmonkey)
              </p>
            </div>
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Sem agendamentos ou vendas no sistema da loja (Shopmonkey) neste período.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {rows.map((r) => (
                <div key={r.seller} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
                        {r.seller.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold leading-tight truncate">{r.seller}</p>
                        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Users className="h-3 w-3 flex-shrink-0" />
                          {Number(r.leads).toLocaleString("pt-BR")} leads no total
                        </p>
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-xl font-bold leading-none text-emerald-600 dark:text-emerald-400">
                        {r.conv_pct != null ? `${r.conv_pct}%` : "—"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">conversão</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Metric icon={<FileText className="h-3.5 w-3.5" />} label="Orçamentos" value={r.orcamentos} />
                    <Metric icon={<CalendarCheck className="h-3.5 w-3.5" />} label="Agendamentos" value={r.agendamentos} />
                    <Metric icon={<CalendarClock className="h-3.5 w-3.5" />} label="Taxa agendamento" value={r.taxa_agend_pct != null ? `${r.taxa_agend_pct}%` : "—"} />
                    <Metric icon={<Footprints className="h-3.5 w-3.5" />} label="Presenciais" value={r.walk_ins} />
                    <Metric icon={<ShoppingBag className="h-3.5 w-3.5" />} label="Vendas" value={r.vendas} />
                    <Metric
                      icon={<DollarSign className="h-3.5 w-3.5" />}
                      label="Receita"
                      value={formatUSD(Number(r.receita_usd), 0)}
                      highlight
                    />
                    <Metric
                      icon={<Receipt className="h-3.5 w-3.5" />}
                      label="Ticket médio"
                      value={Number(r.vendas) > 0 ? formatUSD(Number(r.receita_usd) / Number(r.vendas), 0) : "—"}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t pt-3 text-sm text-muted-foreground">
              <span>Total: <b className="text-foreground">{totals.leads.toLocaleString("pt-BR")}</b> leads</span>
              <span><b className="text-foreground">{totals.orcamentos}</b> orçamentos</span>
              <span><b className="text-foreground">{totals.agendamentos}</b> agendamentos</span>
              <span><b className="text-foreground">{totals.vendas}</b> vendas</span>
              <span>Conversão <b className="text-emerald-600 dark:text-emerald-400">{convTotal}%</b></span>
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

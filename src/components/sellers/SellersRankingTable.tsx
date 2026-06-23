import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Search, Shield, ArrowUpDown, Trophy, Medal, Award, Star, Sparkles,
  Users, FileText, CalendarCheck, CalendarClock, Footprints, ShoppingBag, DollarSign, Receipt,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { GoalsSummary, GoalData } from "./SellerGoalStatus";
import { SellerDetailView } from "./SellerDetailView";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn, formatUSD } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface SellerKPI {
  seller_id: string;
  total_audited: number;
  total_leads: number;
  won_leads: number;
  avg_score: number;
  new_audited_24h: number;
  leads_with_quote: number;
  avg_quoted_price: number;
  walking_leads: number;
  total_with_objection: number;
  objections_overcome: number;
}

/** Funil real da loja por vendedor (RPC get_sellers_shopmonkey_kpis). */
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
  /** agendamentos por canal de atendimento (marcador do note: kommo/telefone/presencial/...) */
  agendamentos_por_canal: Record<string, number> | null;
}

const CHANNEL_CHIP_LABEL: Record<string, string> = {
  kommo: "Kommo/chat",
  telefone: "Ligação",
  presencial: "Presencial",
  instagram: "Instagram",
  facebook: "Facebook",
  google: "Google",
  "sem marcador": "Sem marcador",
};

interface SellersRankingTableProps {
  sellers: SellerKPI[];
  shopmonkey: SellerShopmonkeyKPI[];
  goals: GoalData[][];
  sellerGoalsMap: Map<string, GoalData[]>;
  dateFrom: string | null;
  dateTo: string | null;
}

type SortKey = "receita" | "vendas" | "conv_loja" | "agendamentos" | "orcamentos" | "avg_score" | "seller_id";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "receita", label: "Maior Receita" },
  { value: "vendas", label: "Mais Vendas" },
  { value: "conv_loja", label: "Maior Conversão" },
  { value: "agendamentos", label: "Mais Agendamentos" },
  // Ordenação "Mais Orçamentos" ocultada da UX a pedido (23/06/2026) — SortKey/case mantidos no código.
  { value: "avg_score", label: "Maior Score IA" },
  { value: "seller_id", label: "Nome (A-Z)" },
];

const EMPTY_CHAT: Omit<SellerKPI, "seller_id"> = {
  total_audited: 0,
  total_leads: 0,
  won_leads: 0,
  avg_score: 0,
  new_audited_24h: 0,
  leads_with_quote: 0,
  avg_quoted_price: 0,
  walking_leads: 0,
  total_with_objection: 0,
  objections_overcome: 0,
};

export function SellersRankingTable({ sellers, shopmonkey, sellerGoalsMap, dateFrom, dateTo }: SellersRankingTableProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("receita");
  const [selectedSeller, setSelectedSeller] = useState<string | null>(null);

  // União chat (qualidade IA) × loja (funil ShopMonkey), por nome canônico —
  // os dois RPCs agrupam por canonical_seller, então o nome é a chave.
  const unifiedSellers = useMemo(() => {
    const smByName = new Map(shopmonkey.map(s => [s.seller, s]));
    const chatNames = new Set(sellers.map(s => s.seller_id));

    const fromChat = sellers.map(s => ({
      ...s,
      conversion_rate: s.total_audited > 0 ? (s.won_leads / s.total_audited) * 100 : 0,
      objections_rate: s.total_with_objection > 0 ? (s.objections_overcome / s.total_with_objection) * 100 : 0,
      sm: smByName.get(s.seller_id) ?? null,
    }));

    const onlyStore = shopmonkey
      .filter(s => !chatNames.has(s.seller))
      .map(s => ({
        seller_id: s.seller,
        ...EMPTY_CHAT,
        conversion_rate: 0,
        objections_rate: 0,
        sm: s,
      }));

    return [...fromChat, ...onlyStore];
  }, [sellers, shopmonkey]);

  const filtered = useMemo(() => {
    let list = unifiedSellers;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s => s.seller_id.toLowerCase().includes(q));
    }
    const sortValue = (s: (typeof unifiedSellers)[number]): number => {
      switch (sortKey) {
        case "receita": return Number(s.sm?.receita_usd ?? 0);
        case "vendas": return Number(s.sm?.vendas ?? 0);
        case "conv_loja": return Number(s.sm?.conv_pct ?? 0);
        case "agendamentos": return Number(s.sm?.agendamentos ?? 0);
        case "orcamentos": return Number(s.sm?.orcamentos ?? 0);
        case "avg_score": return Number(s.avg_score ?? 0);
        default: return 0;
      }
    };
    return [...list].sort((a, b) =>
      sortKey === "seller_id" ? a.seller_id.localeCompare(b.seller_id) : sortValue(b) - sortValue(a)
    );
  }, [unifiedSellers, search, sortKey]);

  const selectedSellerData = useMemo(() => {
    if (!selectedSeller) return null;
    return unifiedSellers.find(s => s.seller_id === selectedSeller) || null;
  }, [selectedSeller, unifiedSellers]);

  return (
    <div className="space-y-4">
      {/* Search + Sort */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar vendedor..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={sortKey} onValueChange={v => setSortKey(v as SortKey)}>
          <SelectTrigger className="w-52">
            <ArrowUpDown className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Gallery Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((seller, index) => {
          const sellerGoals = sellerGoalsMap.get(seller.seller_id) || [];
          const sm = seller.sm;

          const isGold = index === 0;
          const isSilver = index === 1;
          const isBronze = index === 2;
          const isTop3 = index < 3;

          const cardAccent = isGold
            ? "border-amber-400/60 dark:border-amber-500/40 shadow-md shadow-amber-500/10"
            : isSilver
              ? "border-slate-400/50 dark:border-slate-400/30 shadow-md shadow-slate-400/10"
              : isBronze
                ? "border-orange-400/40 dark:border-orange-500/30 shadow-sm shadow-orange-400/10"
                : "hover:border-primary/30";

          const accentBar = isGold
            ? "bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400"
            : isSilver
              ? "bg-gradient-to-r from-slate-300 via-slate-200 to-slate-300 dark:from-slate-500 dark:via-slate-400 dark:to-slate-500"
              : isBronze
                ? "bg-gradient-to-r from-orange-400 via-amber-300 to-orange-400"
                : null;

          const avatarStyle = isGold
            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
            : isSilver
              ? "bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300"
              : isBronze
                ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                : "bg-primary/10 text-primary";

          return (
            <motion.div
              key={seller.seller_id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                duration: 0.4,
                delay: index * 0.06,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
            >
              <Card
                className={cn(
                  "cursor-pointer transition-all group relative overflow-hidden h-full",
                  "hover:shadow-lg hover:-translate-y-0.5",
                  selectedSeller === seller.seller_id && "ring-2 ring-primary",
                  cardAccent
                )}
                onClick={() => setSelectedSeller(seller.seller_id)}
              >
                {accentBar && <div className={cn("absolute top-0 left-0 right-0 h-1", accentBar)} />}

                {/* Rank badge */}
                <div className="absolute top-3 right-3">
                  {isGold ? (
                    <div className="flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2 py-0.5">
                      <Trophy className="h-3.5 w-3.5" />
                      <span className="text-xs font-bold">1º</span>
                    </div>
                  ) : isSilver ? (
                    <div className="flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 px-2 py-0.5">
                      <Medal className="h-3.5 w-3.5" />
                      <span className="text-xs font-bold">2º</span>
                    </div>
                  ) : isBronze ? (
                    <div className="flex items-center gap-1 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-2 py-0.5">
                      <Award className="h-3.5 w-3.5" />
                      <span className="text-xs font-bold">3º</span>
                    </div>
                  ) : (
                    <Badge variant="outline" className="text-xs font-mono">
                      #{index + 1}
                    </Badge>
                  )}
                </div>

                <CardContent className="p-5 space-y-4">
                  {/* Header: Avatar + Name + conversão da loja */}
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "flex items-center justify-center w-10 h-10 rounded-full font-bold text-sm flex-shrink-0",
                      avatarStyle
                    )}>
                      {isTop3 ? <Star className="h-5 w-5" /> : seller.seller_id.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold truncate">{seller.seller_id}</p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="h-3 w-3 flex-shrink-0" />
                        {sm ? `${Number(sm.leads).toLocaleString("pt-BR")} leads no total` : "sem produção na loja no período"}
                      </p>
                    </div>
                    {sm && (
                      <div className="flex-shrink-0 text-right pr-10">
                        <p
                          className="text-xl font-bold leading-none text-emerald-600 dark:text-emerald-400"
                          title={Number(sm.conv_pct) > 100 ? "Vendas pagas no período > leads atribuídos no período (datas/atribuição não casam em janelas curtas) — redesenho por coorte em discussão" : undefined}
                        >
                          {sm.conv_pct != null && Number(sm.conv_pct) <= 100 ? `${sm.conv_pct}%` : "—"}
                        </p>
                        <p className="text-[10px] text-muted-foreground">conversão</p>
                      </div>
                    )}
                  </div>

                  {/* Funil da loja (ShopMonkey + Kommo) */}
                  {sm ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        {/* Métrica "Orçamentos" ocultada da UX a pedido (23/06/2026) — dado sm.orcamentos mantido. */}
                        <Metric icon={<CalendarCheck className="h-3.5 w-3.5" />} label="Agendamentos" value={sm.agendamentos} />
                        <Metric icon={<CalendarClock className="h-3.5 w-3.5" />} label="Taxa agendamento" value={sm.taxa_agend_pct != null ? `${sm.taxa_agend_pct}%` : "—"} />
                        <Metric icon={<Footprints className="h-3.5 w-3.5" />} label="Presenciais" value={sm.walk_ins} />
                        <Metric icon={<ShoppingBag className="h-3.5 w-3.5" />} label="Vendas" value={sm.vendas} />
                        <Metric icon={<DollarSign className="h-3.5 w-3.5" />} label="Receita" value={formatUSD(Number(sm.receita_usd), 0)} highlight />
                        <Metric
                          icon={<Receipt className="h-3.5 w-3.5" />}
                          label="Ticket médio"
                          value={Number(sm.vendas) > 0 ? formatUSD(Number(sm.receita_usd) / Number(sm.vendas), 0) : "—"}
                        />
                      </div>
                      {/* Agendamentos por canal de atendimento (marcador do note da loja) */}
                      {sm.agendamentos_por_canal && Object.keys(sm.agendamentos_por_canal).length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(sm.agendamentos_por_canal)
                            .sort((a, b) => b[1] - a[1])
                            .map(([canal, n]) => (
                              <span
                                key={canal}
                                className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                                title="Canal do atendimento que gerou o agendamento (marcador escrito no note da loja)"
                              >
                                {CHANNEL_CHIP_LABEL[canal] ?? canal} <b className="text-foreground">{n}</b>
                              </span>
                            ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="rounded-md bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
                      Sem agendamento, orçamento ou venda atribuída no ShopMonkey neste período.
                    </p>
                  )}

                  {/* Qualidade do atendimento no chat (amostra auditada pela IA) */}
                  <div className="pt-3 border-t border-border space-y-2">
                    <p className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                      <Sparkles className="h-3 w-3" />
                      Qualidade no chat (amostra auditada pela IA)
                    </p>
                    {seller.total_audited > 0 ? (
                      <div className="grid grid-cols-2 gap-2">
                        <Metric
                          icon={<Star className="h-3.5 w-3.5" />}
                          label="Score médio IA"
                          value={`${Number(seller.avg_score).toFixed(1)}/10`}
                        />
                        <Metric
                          icon={<Shield className="h-3.5 w-3.5" />}
                          label="Objeções superadas"
                          value={
                            <>
                              {seller.objections_rate.toFixed(0)}%
                              <span className="text-muted-foreground text-[10px] ml-1">({seller.objections_overcome}/{seller.total_with_objection})</span>
                            </>
                          }
                        />
                        <Metric
                          icon={<Users className="h-3.5 w-3.5" />}
                          label="Conversas auditadas"
                          value={`${seller.total_audited} de ${seller.total_leads}`}
                        />
                      </div>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">
                        Sem conversa de chat auditada no período — clientes de telefone/presenciais não passam pelo chat.
                      </p>
                    )}
                  </div>

                  {/* Goals Summary */}
                  {sellerGoals.length > 0 && (
                    <div className="pt-2 border-t border-border">
                      <GoalsSummary goals={sellerGoals} />
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          Nenhum vendedor encontrado
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedSeller} onOpenChange={open => !open && setSelectedSeller(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-primary/10 text-primary font-bold text-sm">
                {selectedSeller?.substring(0, 2).toUpperCase()}
              </div>
              {selectedSeller}
            </DialogTitle>
          </DialogHeader>
          {selectedSellerData && (
            <SellerDetailView
              seller={selectedSellerData}
              goals={sellerGoalsMap.get(selectedSeller!) || []}
              dateFrom={dateFrom}
              dateTo={dateTo}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
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

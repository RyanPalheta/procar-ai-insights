import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search, TrendingUp, Target, Shield, Footprints, ArrowUpDown, Trophy, Medal, Award, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GoalsSummary, GoalData } from "./SellerGoalStatus";
import { SellerDetailView } from "./SellerDetailView";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface SellerKPI {
  seller_id: string;
  total_audited: number;
  won_leads: number;
  avg_score: number;
  new_audited_24h: number;
  leads_with_quote: number;
  avg_quoted_price: number;
  walking_leads: number;
  total_with_objection: number;
  objections_overcome: number;
}

interface SellersRankingTableProps {
  sellers: SellerKPI[];
  goals: GoalData[][];
  sellerGoalsMap: Map<string, GoalData[]>;
  periodDays: number | null;
}

type SortKey = "seller_id" | "conversion_rate" | "leads_with_quote" | "objections_rate" | "total_audited" | "walking_leads";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "total_audited", label: "Mais Leads" },
  { value: "conversion_rate", label: "Maior Conversão" },
  { value: "leads_with_quote", label: "Mais Cotações" },
  { value: "objections_rate", label: "Mais Objeções Sup." },
  { value: "walking_leads", label: "Mais Presenciais" },
  { value: "seller_id", label: "Nome (A-Z)" },
];

export function SellersRankingTable({ sellers, sellerGoalsMap, periodDays }: SellersRankingTableProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("total_audited");
  const [selectedSeller, setSelectedSeller] = useState<string | null>(null);

  const enrichedSellers = useMemo(() => {
    return sellers.map(s => ({
      ...s,
      conversion_rate: s.total_audited > 0 ? (s.won_leads / s.total_audited) * 100 : 0,
      objections_rate: s.total_with_objection > 0 ? (s.objections_overcome / s.total_with_objection) * 100 : 0,
    }));
  }, [sellers]);

  const filtered = useMemo(() => {
    let list = enrichedSellers;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s => s.seller_id.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      if (sortKey === "seller_id") {
        return a.seller_id.localeCompare(b.seller_id);
      }
      const va = (a as any)[sortKey] ?? 0;
      const vb = (b as any)[sortKey] ?? 0;
      return vb - va;
    });
    return list;
  }, [enrichedSellers, search, sortKey]);

  const selectedSellerData = useMemo(() => {
    if (!selectedSeller) return null;
    return enrichedSellers.find(s => s.seller_id === selectedSeller) || null;
  }, [selectedSeller, enrichedSellers]);

  return (
    <div className="space-y-4">
      {/* Search + Sort */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar vendedor..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={sortKey} onValueChange={v => setSortKey(v as SortKey)}>
          <SelectTrigger className="w-48">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((seller, index) => {
          const sellerGoals = sellerGoalsMap.get(seller.seller_id) || [];
          const objectionRate = seller.objections_rate;

          // Performance tier based on rank
          const isGold = index === 0;
          const isSilver = index === 1;
          const isBronze = index === 2;
          const isTop3 = index < 3;

          // Conversion rate color coding
          const convRate = seller.conversion_rate;
          const convColor = convRate >= 30
            ? "text-emerald-600 dark:text-emerald-400"
            : convRate >= 15
              ? "text-amber-600 dark:text-amber-400"
              : "text-red-500 dark:text-red-400";

          // Performance gradient bar (based on conversion)
          const perfWidth = Math.min(100, convRate * 2.5); // Scale: 40% conv = 100% bar

          return (
            <Card
              key={seller.seller_id}
              className={cn(
                "cursor-pointer transition-all group relative overflow-hidden",
                "hover:shadow-lg hover:-translate-y-0.5",
                selectedSeller === seller.seller_id && "ring-2 ring-primary",
                isGold && "border-amber-400/60 dark:border-amber-500/40 shadow-md shadow-amber-500/10",
                isSilver && "border-slate-400/50 dark:border-slate-400/30 shadow-md shadow-slate-400/10",
                isBronze && "border-orange-400/40 dark:border-orange-500/30 shadow-sm shadow-orange-400/10",
                !isTop3 && "hover:border-primary/30"
              )}
              onClick={() => setSelectedSeller(seller.seller_id)}
            >
              {/* Top gradient accent for podium */}
              {isGold && <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400" />}
              {isSilver && <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-slate-300 via-slate-200 to-slate-300 dark:from-slate-500 dark:via-slate-400 dark:to-slate-500" />}
              {isBronze && <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-400 via-amber-300 to-orange-400" />}

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
                {/* Header: Avatar + Name */}
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-full font-bold text-sm flex-shrink-0",
                    isGold ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" :
                    isSilver ? "bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300" :
                    isBronze ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" :
                    "bg-primary/10 text-primary"
                  )}>
                    {isTop3 ? <Star className="h-5 w-5" /> : seller.seller_id.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{seller.seller_id}</p>
                    <p className="text-xs text-muted-foreground">{seller.total_audited} leads</p>
                  </div>
                </div>

                {/* Performance bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Performance</span>
                    <span className={cn("font-semibold", convColor)}>{convRate.toFixed(1)}% conv.</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        convRate >= 30 ? "bg-emerald-500" : convRate >= 15 ? "bg-amber-500" : "bg-red-400"
                      )}
                      style={{ width: `${perfWidth}%` }}
                    />
                  </div>
                </div>

                {/* KPI Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <TrendingUp className="h-3 w-3" />
                      <span className="text-[11px]">Conversão</span>
                    </div>
                    <p className={cn("text-sm font-semibold", convColor)}>{seller.conversion_rate.toFixed(1)}%</p>
                  </div>

                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Target className="h-3 w-3" />
                      <span className="text-[11px]">Cotações</span>
                    </div>
                    <p className="text-sm font-semibold">{seller.leads_with_quote}</p>
                  </div>

                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Shield className="h-3 w-3" />
                      <span className="text-[11px]">Objeções Sup.</span>
                    </div>
                    <p className="text-sm font-semibold">
                      {objectionRate.toFixed(0)}%
                      <span className="text-muted-foreground text-[10px] ml-1">({seller.objections_overcome}/{seller.total_with_objection})</span>
                    </p>
                  </div>

                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Footprints className="h-3 w-3" />
                      <span className="text-[11px]">Presenciais</span>
                    </div>
                    <p className="text-sm font-semibold">{seller.walking_leads}</p>
                  </div>
                </div>

                {/* Goals Summary */}
                {sellerGoals.length > 0 && (
                  <div className="pt-2 border-t border-border">
                    <GoalsSummary goals={sellerGoals} />
                  </div>
                )}
              </CardContent>
            </Card>
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
              periodDays={periodDays}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

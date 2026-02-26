import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, ArrowUpDown, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GoalsSummary, GoalData, calculateGoalStatus } from "./SellerGoalStatus";
import { SellerDetailView } from "./SellerDetailView";
import { cn } from "@/lib/utils";

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

export function SellersRankingTable({ sellers, goals, sellerGoalsMap, periodDays }: SellersRankingTableProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("total_audited");
  const [sortAsc, setSortAsc] = useState(false);
  const [expandedSeller, setExpandedSeller] = useState<string | null>(null);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

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
      const va = a[sortKey] ?? 0;
      const vb = b[sortKey] ?? 0;
      return sortAsc ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
    return list;
  }, [enrichedSellers, search, sortKey, sortAsc]);

  const SortHeader = ({ label, sortKeyName }: { label: string; sortKeyName: SortKey }) => (
    <Button variant="ghost" size="sm" className="h-8 -ml-3 text-xs font-semibold" onClick={() => handleSort(sortKeyName)}>
      {label}
      <ArrowUpDown className="ml-1 h-3 w-3" />
    </Button>
  );

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar vendedor..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead><SortHeader label="Vendedor" sortKeyName="seller_id" /></TableHead>
              <TableHead className="text-right"><SortHeader label="Leads" sortKeyName="total_audited" /></TableHead>
              <TableHead className="text-right"><SortHeader label="Conversão" sortKeyName="conversion_rate" /></TableHead>
              <TableHead className="text-right"><SortHeader label="C/ Cotação" sortKeyName="leads_with_quote" /></TableHead>
              <TableHead className="text-right"><SortHeader label="Objeções Sup." sortKeyName="objections_rate" /></TableHead>
              <TableHead className="text-right"><SortHeader label="Presenciais" sortKeyName="walking_leads" /></TableHead>
              <TableHead>Metas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(seller => {
              const isExpanded = expandedSeller === seller.seller_id;
              const sellerGoals = sellerGoalsMap.get(seller.seller_id) || [];
              return (
                <TableRow key={seller.seller_id} className="group">
                  <TableCell colSpan={8} className="p-0">
                    <div
                      className={cn("flex items-center cursor-pointer hover:bg-muted/50 transition-colors px-4 py-3", isExpanded && "bg-muted/30")}
                      onClick={() => setExpandedSeller(isExpanded ? null : seller.seller_id)}
                    >
                      <div className="w-8 flex-shrink-0">
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 font-medium">{seller.seller_id}</div>
                      <div className="w-24 text-right text-sm">{seller.total_audited}</div>
                      <div className="w-24 text-right text-sm">{seller.conversion_rate.toFixed(1)}%</div>
                      <div className="w-24 text-right text-sm">{seller.leads_with_quote}</div>
                      <div className="w-28 text-right text-sm">
                        {seller.objections_rate.toFixed(1)}%
                        <span className="text-muted-foreground text-xs ml-1">({seller.objections_overcome}/{seller.total_with_objection})</span>
                      </div>
                      <div className="w-24 text-right text-sm">{seller.walking_leads}</div>
                      <div className="w-40 pl-4">
                        {sellerGoals.length > 0 ? <GoalsSummary goals={sellerGoals} /> : <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="border-t bg-muted/10 p-6">
                        <SellerDetailView seller={seller} goals={sellerGoals} periodDays={periodDays} />
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Nenhum vendedor encontrado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

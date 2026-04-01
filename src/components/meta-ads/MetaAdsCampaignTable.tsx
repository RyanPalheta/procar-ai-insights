import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Megaphone, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MetaCampaignRow } from "@/types/meta-ads";

interface MetaAdsCampaignTableProps {
  campaigns: MetaCampaignRow[];
}

type SortField = "spend" | "impressions" | "clicks" | "ctr" | "cpc" | "purchases" | "costPerPurchase" | "leads" | "cpl" | "roas";

function formatUSD(value: number): string {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function MetaAdsCampaignTable({ campaigns }: MetaAdsCampaignTableProps) {
  const [sortField, setSortField] = useState<SortField>("spend");
  const [sortAsc, setSortAsc] = useState(false);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const sorted = [...campaigns].sort((a, b) => {
    const diff = a[sortField] - b[sortField];
    return sortAsc ? diff : -diff;
  });

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-auto p-0 font-medium text-xs hover:bg-transparent"
      onClick={() => toggleSort(field)}
    >
      {children}
      <ArrowUpDown className="ml-1 h-3 w-3" />
    </Button>
  );

  return (
    <MagicBentoCard className="rounded-lg col-span-full" glowColor="59, 130, 246">
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-primary" />
            Campanhas
            <Badge variant="outline" className="ml-2">{campaigns.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sorted.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Campanha</TableHead>
                    <TableHead className="text-right"><SortButton field="spend">Gasto</SortButton></TableHead>
                    <TableHead className="text-right"><SortButton field="impressions">Impressoes</SortButton></TableHead>
                    <TableHead className="text-right"><SortButton field="clicks">Cliques</SortButton></TableHead>
                    <TableHead className="text-right"><SortButton field="ctr">CTR</SortButton></TableHead>
                    <TableHead className="text-right"><SortButton field="cpc">CPC</SortButton></TableHead>
                    <TableHead className="text-right"><SortButton field="leads">Leads</SortButton></TableHead>
                    <TableHead className="text-right"><SortButton field="cpl">CPL</SortButton></TableHead>
                    <TableHead className="text-right"><SortButton field="purchases">Compras</SortButton></TableHead>
                    <TableHead className="text-right"><SortButton field="costPerPurchase">CPA</SortButton></TableHead>
                    <TableHead className="text-right"><SortButton field="roas">ROAS</SortButton></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((campaign) => (
                    <TableRow key={campaign.campaign_id}>
                      <TableCell className="font-medium max-w-[250px] truncate">
                        {campaign.campaign_name}
                      </TableCell>
                      <TableCell className="text-right">{formatUSD(campaign.spend)}</TableCell>
                      <TableCell className="text-right">{campaign.impressions.toLocaleString("en-US")}</TableCell>
                      <TableCell className="text-right">{campaign.clicks.toLocaleString("en-US")}</TableCell>
                      <TableCell className="text-right">{campaign.ctr.toFixed(2)}%</TableCell>
                      <TableCell className="text-right">{formatUSD(campaign.cpc)}</TableCell>
                      <TableCell className="text-right">{campaign.leads}</TableCell>
                      <TableCell className="text-right">{campaign.cpl > 0 ? formatUSD(campaign.cpl) : "-"}</TableCell>
                      <TableCell className="text-right">{campaign.purchases}</TableCell>
                      <TableCell className="text-right">{campaign.costPerPurchase > 0 ? formatUSD(campaign.costPerPurchase) : "-"}</TableCell>
                      <TableCell className="text-right">
                        {campaign.roas > 0 ? (
                          <Badge variant={campaign.roas >= 3 ? "default" : "outline"}>
                            {campaign.roas.toFixed(2)}x
                          </Badge>
                        ) : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-muted-foreground">
              Sem dados de campanhas disponiveis
            </div>
          )}
        </CardContent>
      </Card>
    </MagicBentoCard>
  );
}

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
import { BarChart3, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GoogleAdsCampaignRow } from "@/types/google-ads";

interface GoogleAdsCampaignTableProps {
  campaigns: GoogleAdsCampaignRow[];
}

type SortField = "spend" | "impressions" | "clicks" | "ctr" | "cpc" | "conversions" | "roas";

function formatUSD(value: number): string {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function GoogleAdsCampaignTable({ campaigns }: GoogleAdsCampaignTableProps) {
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

  const statusBadge = (status: string) => {
    if (status === "ENABLED" || status === "enabled") {
      return (
        <Badge variant="outline" className="text-xs gap-1.5 bg-success/10 text-success border-success/25">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          Ativa
        </Badge>
      );
    }
    if (status === "PAUSED" || status === "paused") {
      return (
        <Badge variant="outline" className="text-xs gap-1.5 text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
          Pausada
        </Badge>
      );
    }
    return <Badge variant="secondary" className="text-xs">{status}</Badge>;
  };

  return (
    <MagicBentoCard className="rounded-lg col-span-full" glowColor="228, 0, 43">
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-warning" />
            Campanhas Google Ads
            <Badge variant="outline" className="ml-2">{campaigns.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sorted.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="min-w-[200px] text-[10px] font-semibold uppercase tracking-wider">Campanha</TableHead>
                    <TableHead className="text-[10px] font-semibold uppercase tracking-wider">Status</TableHead>
                    <TableHead className="text-right"><SortButton field="spend">Gasto</SortButton></TableHead>
                    <TableHead className="text-right"><SortButton field="impressions">Impressoes</SortButton></TableHead>
                    <TableHead className="text-right"><SortButton field="clicks">Cliques</SortButton></TableHead>
                    <TableHead className="text-right"><SortButton field="ctr">CTR</SortButton></TableHead>
                    <TableHead className="text-right"><SortButton field="cpc">CPC</SortButton></TableHead>
                    <TableHead className="text-right"><SortButton field="conversions">Conv.</SortButton></TableHead>
                    <TableHead className="text-right"><SortButton field="roas">ROAS</SortButton></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map((campaign) => (
                    <TableRow key={campaign.campaign_id} className="odd:bg-muted/30 hover:bg-primary/5">
                      <TableCell className="font-medium max-w-[250px] truncate">
                        {campaign.campaign_name}
                      </TableCell>
                      <TableCell>{statusBadge(campaign.campaign_status)}</TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">{formatUSD(campaign.spend)}</TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">{campaign.impressions.toLocaleString("en-US")}</TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">{campaign.clicks.toLocaleString("en-US")}</TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">{campaign.ctr.toFixed(2)}%</TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">{formatUSD(campaign.cpc)}</TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">{Math.round(campaign.conversions)}</TableCell>
                      <TableCell className="text-right">
                        {campaign.roas > 0 ? (
                          <Badge
                            variant="outline"
                            className={campaign.roas >= 3
                              ? "tabular-nums bg-success/10 text-success border-success/25"
                              : "tabular-nums bg-warning/10 text-warning border-warning/25"}
                          >
                            {campaign.roas.toFixed(2)}×
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

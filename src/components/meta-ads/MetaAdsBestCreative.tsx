import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MagicBentoCard } from "@/components/ui/magic-bento-card";
import { Badge } from "@/components/ui/badge";
import { Award, Eye, MousePointerClick, DollarSign, ShoppingCart } from "lucide-react";
import type { MetaAdCreative } from "@/types/meta-ads";

interface MetaAdsBestCreativeProps {
  creatives: MetaAdCreative[];
}

function formatUSD(value: number): string {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function MetaAdsBestCreative({ creatives }: MetaAdsBestCreativeProps) {
  if (creatives.length === 0) {
    return (
      <MagicBentoCard className="rounded-lg" glowColor="59, 130, 246">
        <Card className="bg-card border-border h-full">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Award className="h-4 w-4 text-primary" />
              Melhores Criativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] flex items-center justify-center text-muted-foreground">
              Sem dados disponiveis
            </div>
          </CardContent>
        </Card>
      </MagicBentoCard>
    );
  }

  return (
    <MagicBentoCard className="rounded-lg" glowColor="59, 130, 246">
      <Card className="bg-card border-border h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" />
            Melhores Criativos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {creatives.map((creative, index) => (
            <div
              key={creative.ad_id}
              className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              {/* Rank badge */}
              <div className="flex-shrink-0">
                <Badge
                  variant={index === 0 ? "default" : "outline"}
                  className={index === 0 ? "bg-amber-500 hover:bg-amber-500 text-white" : ""}
                >
                  #{index + 1}
                </Badge>
              </div>

              {/* Thumbnail */}
              {creative.thumbnail_url && (
                <img
                  src={creative.thumbnail_url}
                  alt={creative.ad_name}
                  className="w-16 h-16 rounded-md object-cover flex-shrink-0"
                />
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{creative.ad_name}</p>
                {creative.title && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{creative.title}</p>
                )}
                <div className="flex flex-wrap gap-3 mt-2">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Eye className="h-3 w-3" />
                    {creative.impressions.toLocaleString("en-US")}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MousePointerClick className="h-3 w-3" />
                    {creative.clicks.toLocaleString("en-US")}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <DollarSign className="h-3 w-3" />
                    {formatUSD(creative.spend)}
                  </span>
                  {creative.purchases > 0 && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <ShoppingCart className="h-3 w-3" />
                      {creative.purchases} compras
                    </span>
                  )}
                  <Badge variant="outline" className="text-xs">
                    CTR {creative.ctr.toFixed(2)}%
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </MagicBentoCard>
  );
}

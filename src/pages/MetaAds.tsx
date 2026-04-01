import { useState } from "react";
import { format, subDays } from "date-fns";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Megaphone, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { MetaAdsKPICards } from "@/components/meta-ads/MetaAdsKPICards";
import { MetaAdsSpendChart } from "@/components/meta-ads/MetaAdsSpendChart";
import { MetaAdsPerformanceChart } from "@/components/meta-ads/MetaAdsPerformanceChart";
import { MetaAdsFunnelChart } from "@/components/meta-ads/MetaAdsFunnelChart";
import { MetaAdsBestCreative } from "@/components/meta-ads/MetaAdsBestCreative";
import { MetaAdsCampaignTable } from "@/components/meta-ads/MetaAdsCampaignTable";
import {
  useMetaAdsKPIs,
  useMetaAdsDailyInsights,
  useMetaAdsBestCreatives,
  useMetaAdsCampaigns,
  useMetaAdsSupabaseMetrics,
  hasMetaCredentials,
} from "@/hooks/useMetaAdsData";

type Period = "7" | "30" | "90";

function getDateRange(period: Period) {
  const dateTo = format(new Date(), "yyyy-MM-dd");
  const dateFrom = format(subDays(new Date(), parseInt(period)), "yyyy-MM-dd");
  return { dateFrom, dateTo };
}

export default function MetaAds() {
  const [period, setPeriod] = useState<Period>("30");
  const navigate = useNavigate();
  const { dateFrom, dateTo } = getDateRange(period);

  const configured = hasMetaCredentials();

  const { data: kpis, isLoading: kpisLoading } = useMetaAdsKPIs(dateFrom, dateTo);
  const { data: dailyData, isLoading: dailyLoading } = useMetaAdsDailyInsights(dateFrom, dateTo);
  const { data: creatives, isLoading: creativesLoading } = useMetaAdsBestCreatives(dateFrom, dateTo, 5);
  const { data: campaigns, isLoading: campaignsLoading } = useMetaAdsCampaigns(dateFrom, dateTo);
  const { data: supabaseMetrics } = useMetaAdsSupabaseMetrics(dateFrom, dateTo);

  if (!configured) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-3">
            <Megaphone className="h-6 w-6 text-primary" />
            Meta Ads
          </h1>
          <p className="text-muted-foreground mt-1">Performance de campanhas Meta (Facebook / Instagram)</p>
        </div>

        <Alert className="border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/50">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <AlertTitle className="text-amber-800 dark:text-amber-200 font-semibold">
            Configuracao Necessaria
          </AlertTitle>
          <AlertDescription className="text-sm text-amber-700 dark:text-amber-300 mt-1">
            Configure suas credenciais Meta Ads para visualizar os dados.
            <div className="mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/settings")}
                className="gap-2"
              >
                <Settings className="h-4 w-4" />
                Ir para Configuracoes
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const isLoading = kpisLoading || dailyLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-3">
            <Megaphone className="h-6 w-6 text-primary" />
            Meta Ads
          </h1>
          <p className="text-muted-foreground mt-1">Performance de campanhas Meta (Facebook / Instagram)</p>
        </div>
        <ToggleGroup
          type="single"
          value={period}
          onValueChange={(v) => v && setPeriod(v as Period)}
          className="bg-muted p-1 rounded-lg"
        >
          <ToggleGroupItem
            value="7"
            className="text-xs px-3 h-7 data-[state=on]:bg-background data-[state=on]:shadow-sm rounded-md"
          >
            7 dias
          </ToggleGroupItem>
          <ToggleGroupItem
            value="30"
            className="text-xs px-3 h-7 data-[state=on]:bg-background data-[state=on]:shadow-sm rounded-md"
          >
            30 dias
          </ToggleGroupItem>
          <ToggleGroupItem
            value="90"
            className="text-xs px-3 h-7 data-[state=on]:bg-background data-[state=on]:shadow-sm rounded-md"
          >
            90 dias
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* KPI Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      ) : kpis ? (
        <MetaAdsKPICards data={kpis} supabaseMetrics={supabaseMetrics} />
      ) : null}

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {dailyLoading ? (
          <>
            <Skeleton className="h-[320px] rounded-lg" />
            <Skeleton className="h-[320px] rounded-lg" />
          </>
        ) : (
          <>
            <MetaAdsSpendChart data={dailyData || []} />
            <MetaAdsPerformanceChart data={dailyData || []} />
          </>
        )}
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {kpisLoading || creativesLoading ? (
          <>
            <Skeleton className="h-[320px] rounded-lg" />
            <Skeleton className="h-[320px] rounded-lg" />
          </>
        ) : (
          <>
            {kpis && <MetaAdsFunnelChart data={kpis} />}
            <MetaAdsBestCreative creatives={creatives || []} />
          </>
        )}
      </div>

      {/* Campaign Table */}
      {campaignsLoading ? (
        <Skeleton className="h-[400px] rounded-lg" />
      ) : (
        <MetaAdsCampaignTable campaigns={campaigns || []} />
      )}
    </div>
  );
}

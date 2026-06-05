import { useState, useMemo } from "react";
import { format } from "date-fns";
import { PeriodFilter } from "@/components/dashboard/PeriodFilter";
import { resolvePeriod, type PeriodValue } from "@/lib/period";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3 } from "lucide-react";
import { GoogleAdsKPICards } from "@/components/google-ads/GoogleAdsKPICards";
import { GoogleAdsSpendChart } from "@/components/google-ads/GoogleAdsSpendChart";
import { GoogleAdsPerformanceChart } from "@/components/google-ads/GoogleAdsPerformanceChart";
import { GoogleAdsCampaignTable } from "@/components/google-ads/GoogleAdsCampaignTable";
import {
  useGoogleAdsKPIs,
  useGoogleAdsDailyData,
  useGoogleAdsCampaigns,
} from "@/hooks/useGoogleAdsData";

export default function GoogleAds() {
  const [period, setPeriod] = useState<PeriodValue>({ preset: "30" });
  const range = useMemo(() => resolvePeriod(period), [period]);
  const dateFrom = range.from ? format(range.from, "yyyy-MM-dd") : undefined;
  const dateTo = range.to ? format(range.to, "yyyy-MM-dd") : undefined;

  const { data: kpis, isLoading: kpisLoading } = useGoogleAdsKPIs(dateFrom, dateTo);
  const { data: dailyData, isLoading: dailyLoading } = useGoogleAdsDailyData(dateFrom, dateTo);
  const { data: campaigns, isLoading: campaignsLoading } = useGoogleAdsCampaigns(dateFrom, dateTo);

  const isLoading = kpisLoading || dailyLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-3">
            <BarChart3 className="h-6 w-6 text-yellow-500" />
            Google Ads
          </h1>
          <p className="text-muted-foreground mt-1">Performance de campanhas Google Ads</p>
        </div>
        <PeriodFilter value={period} onChange={setPeriod} presets={["today", "yesterday", "7", "30", "90"]} />
      </div>

      {/* KPI Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      ) : kpis ? (
        <GoogleAdsKPICards data={kpis} />
      ) : null}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {dailyLoading ? (
          <>
            <Skeleton className="h-[320px] rounded-lg" />
            <Skeleton className="h-[320px] rounded-lg" />
          </>
        ) : (
          <>
            <GoogleAdsSpendChart data={dailyData || []} />
            <GoogleAdsPerformanceChart data={dailyData || []} />
          </>
        )}
      </div>

      {/* Campaign Table */}
      {campaignsLoading ? (
        <Skeleton className="h-[400px] rounded-lg" />
      ) : (
        <GoogleAdsCampaignTable campaigns={campaigns || []} />
      )}
    </div>
  );
}

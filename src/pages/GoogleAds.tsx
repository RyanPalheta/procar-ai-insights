import { useState } from "react";
import { format, subDays } from "date-fns";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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

type Period = "7" | "30" | "90";

function getDateRange(period: Period) {
  const dateTo = format(new Date(), "yyyy-MM-dd");
  const dateFrom = format(subDays(new Date(), parseInt(period)), "yyyy-MM-dd");
  return { dateFrom, dateTo };
}

export default function GoogleAds() {
  const [period, setPeriod] = useState<Period>("30");
  const { dateFrom, dateTo } = getDateRange(period);

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

import { useQuery } from "@tanstack/react-query";
import type {
  GoogleAdsKPIs,
  GoogleAdsDailyData,
  GoogleAdsCampaignRow,
} from "@/types/google-ads";

const GADS_SUPABASE_URL = "https://supabase.procarsoundsecuritytech.com/rest/v1";
const GADS_SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzE1MDUwODAwLAogICJleHAiOiAxODcyODE3MjAwCn0.L72cJvchrTJJWjwRPrZGbkjxI2DpIlg-YfMyLiEBlHg";

interface GadsMetricRow {
  date: string;
  customer_id: string;
  campaign_id: string;
  campaign_name: string;
  campaign_status: string;
  impressions: number;
  clicks: number;
  cost_micros: number;
  conversions: number;
  conversions_value: number;
  ctr: number;
  average_cpc_micros: number;
  roas: number;
}

async function fetchGads(endpoint: string): Promise<GadsMetricRow[]> {
  const res = await fetch(`${GADS_SUPABASE_URL}${endpoint}`, {
    headers: {
      apikey: GADS_SUPABASE_KEY,
      Authorization: `Bearer ${GADS_SUPABASE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Google Ads API error: ${res.status}`);
  return res.json();
}

export function useGoogleAdsKPIs(dateFrom: string, dateTo: string) {
  return useQuery<GoogleAdsKPIs>({
    queryKey: ["google-ads-kpis", dateFrom, dateTo],
    queryFn: async () => {
      const data = await fetchGads(
        `/google_ads_metrics?select=impressions,clicks,cost_micros,conversions,conversions_value,campaign_id,campaign_status&date=gte.${dateFrom}&date=lte.${dateTo}`
      );

      if (!data || data.length === 0) {
        return {
          impressions: 0, clicks: 0, spend: 0, conversions: 0,
          conversionsValue: 0, ctr: 0, cpc: 0, roas: 0, activeCampaigns: 0,
        };
      }

      const impressions = data.reduce((s, r) => s + (r.impressions || 0), 0);
      const clicks = data.reduce((s, r) => s + (r.clicks || 0), 0);
      const costMicros = data.reduce((s, r) => s + (r.cost_micros || 0), 0);
      const conversions = data.reduce((s, r) => s + (r.conversions || 0), 0);
      const conversionsValue = data.reduce((s, r) => s + (r.conversions_value || 0), 0);
      const spend = costMicros / 1_000_000;

      const activeCampaigns = new Set(
        data.filter((r) => r.campaign_status === "ENABLED").map((r) => r.campaign_id)
      ).size;

      return {
        impressions,
        clicks,
        spend,
        conversions,
        conversionsValue,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        cpc: clicks > 0 ? spend / clicks : 0,
        roas: spend > 0 ? conversionsValue / spend : 0,
        activeCampaigns,
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useGoogleAdsDailyData(dateFrom: string, dateTo: string) {
  return useQuery<GoogleAdsDailyData[]>({
    queryKey: ["google-ads-daily", dateFrom, dateTo],
    queryFn: async () => {
      const data = await fetchGads(
        `/google_ads_metrics?select=date,impressions,clicks,cost_micros,conversions&date=gte.${dateFrom}&date=lte.${dateTo}&order=date.asc`
      );

      if (!data) return [];

      const grouped = new Map<string, GoogleAdsDailyData>();
      for (const row of data) {
        const existing = grouped.get(row.date) || {
          date: row.date,
          impressions: 0,
          clicks: 0,
          spend: 0,
          conversions: 0,
        };
        existing.impressions += row.impressions || 0;
        existing.clicks += row.clicks || 0;
        existing.spend += (row.cost_micros || 0) / 1_000_000;
        existing.conversions += row.conversions || 0;
        grouped.set(row.date, existing);
      }

      return Array.from(grouped.values());
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useGoogleAdsCampaigns(dateFrom: string, dateTo: string) {
  return useQuery<GoogleAdsCampaignRow[]>({
    queryKey: ["google-ads-campaigns", dateFrom, dateTo],
    queryFn: async () => {
      const data = await fetchGads(
        `/google_ads_metrics?select=campaign_id,campaign_name,campaign_status,impressions,clicks,cost_micros,conversions,conversions_value&date=gte.${dateFrom}&date=lte.${dateTo}`
      );

      if (!data) return [];

      const grouped = new Map<string, GoogleAdsCampaignRow>();
      for (const row of data) {
        const key = row.campaign_id;
        const existing = grouped.get(key) || {
          campaign_id: row.campaign_id,
          campaign_name: row.campaign_name,
          campaign_status: row.campaign_status,
          impressions: 0,
          clicks: 0,
          spend: 0,
          conversions: 0,
          conversions_value: 0,
          ctr: 0,
          cpc: 0,
          roas: 0,
        };
        existing.impressions += row.impressions || 0;
        existing.clicks += row.clicks || 0;
        existing.spend += (row.cost_micros || 0) / 1_000_000;
        existing.conversions += row.conversions || 0;
        existing.conversions_value += row.conversions_value || 0;
        existing.campaign_name = row.campaign_name;
        existing.campaign_status = row.campaign_status;
        grouped.set(key, existing);
      }

      return Array.from(grouped.values()).map((c) => ({
        ...c,
        ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
        cpc: c.clicks > 0 ? c.spend / c.clicks : 0,
        roas: c.spend > 0 ? c.conversions_value / c.spend : 0,
      })).sort((a, b) => b.spend - a.spend);
    },
    staleTime: 5 * 60 * 1000,
  });
}

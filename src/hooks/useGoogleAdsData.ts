import { useQuery } from "@tanstack/react-query";
import type {
  GoogleAdsKPIs,
  GoogleAdsDailyData,
  GoogleAdsCampaignRow,
  GoogleAdsConversionAction,
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
  all_conversions: number;
  ctr: number;
  average_cpc_micros: number;
  search_impression_share: number | null;
  search_budget_lost_is: number | null;
  search_rank_lost_is: number | null;
}

interface GadsConvActionRow {
  conversion_action_name: string;
  conversion_category: string | null;
  conversions: number;
  conversions_value: number;
}

async function fetchGads<T = GadsMetricRow>(endpoint: string): Promise<T[]> {
  const res = await fetch(`${GADS_SUPABASE_URL}${endpoint}`, {
    headers: {
      apikey: GADS_SUPABASE_KEY,
      Authorization: `Bearer ${GADS_SUPABASE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Google Ads API error: ${res.status}`);
  return res.json();
}

const isEnabled = (status: string) => (status || "").toUpperCase() === "ENABLED";

/**
 * Agrega a Parcela de Impressões corretamente: pondera pelas "impressões
 * elegíveis" (impressões ÷ IS), não por média simples. Linhas sem IS
 * (PMax/Display não reportam) são ignoradas.
 */
function aggregateImpressionShare(rows: GadsMetricRow[]) {
  let totalImpr = 0, totalEligible = 0, budgetLostW = 0, rankLostW = 0;
  for (const r of rows) {
    const is = r.search_impression_share;
    if (is == null || is <= 0) continue;
    const impr = r.impressions || 0;
    const eligible = impr / is;
    totalImpr += impr;
    totalEligible += eligible;
    budgetLostW += (r.search_budget_lost_is || 0) * eligible;
    rankLostW += (r.search_rank_lost_is || 0) * eligible;
  }
  if (totalEligible <= 0) return { searchImpressionShare: 0, budgetLostIS: 0, rankLostIS: 0 };
  return {
    searchImpressionShare: totalImpr / totalEligible,
    budgetLostIS: budgetLostW / totalEligible,
    rankLostIS: rankLostW / totalEligible,
  };
}

export function useGoogleAdsKPIs(dateFrom: string, dateTo: string) {
  return useQuery<GoogleAdsKPIs>({
    queryKey: ["google-ads-kpis", dateFrom, dateTo],
    queryFn: async () => {
      const data = await fetchGads(
        `/google_ads_metrics?select=impressions,clicks,cost_micros,conversions,conversions_value,all_conversions,campaign_id,campaign_status,search_impression_share,search_budget_lost_is,search_rank_lost_is&date=gte.${dateFrom}&date=lte.${dateTo}`
      );

      const empty: GoogleAdsKPIs = {
        impressions: 0, clicks: 0, spend: 0, conversions: 0, conversionsValue: 0,
        allConversions: 0, ctr: 0, cpc: 0, cpa: 0,
        searchImpressionShare: 0, budgetLostIS: 0, rankLostIS: 0, activeCampaigns: 0,
      };
      if (!data || data.length === 0) return empty;

      const impressions = data.reduce((s, r) => s + (r.impressions || 0), 0);
      const clicks = data.reduce((s, r) => s + (r.clicks || 0), 0);
      const costMicros = data.reduce((s, r) => s + (r.cost_micros || 0), 0);
      const conversions = data.reduce((s, r) => s + (r.conversions || 0), 0);
      const conversionsValue = data.reduce((s, r) => s + (r.conversions_value || 0), 0);
      const allConversions = data.reduce((s, r) => s + (r.all_conversions || 0), 0);
      const spend = costMicros / 1_000_000;

      const activeCampaigns = new Set(
        data.filter((r) => isEnabled(r.campaign_status)).map((r) => r.campaign_id)
      ).size;

      return {
        impressions,
        clicks,
        spend,
        conversions,
        conversionsValue,
        allConversions,
        ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
        cpc: clicks > 0 ? spend / clicks : 0,
        cpa: conversions > 0 ? spend / conversions : 0,
        ...aggregateImpressionShare(data),
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
        `/google_ads_metrics?select=campaign_id,campaign_name,campaign_status,impressions,clicks,cost_micros,conversions,conversions_value,all_conversions&date=gte.${dateFrom}&date=lte.${dateTo}`
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
          all_conversions: 0,
          ctr: 0,
          cpc: 0,
          cpa: 0,
        };
        existing.impressions += row.impressions || 0;
        existing.clicks += row.clicks || 0;
        existing.spend += (row.cost_micros || 0) / 1_000_000;
        existing.conversions += row.conversions || 0;
        existing.conversions_value += row.conversions_value || 0;
        existing.all_conversions += row.all_conversions || 0;
        existing.campaign_name = row.campaign_name;
        existing.campaign_status = row.campaign_status;
        grouped.set(key, existing);
      }

      return Array.from(grouped.values()).map((c) => ({
        ...c,
        ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
        cpc: c.clicks > 0 ? c.spend / c.clicks : 0,
        cpa: c.conversions > 0 ? c.spend / c.conversions : 0,
      })).sort((a, b) => b.spend - a.spend);
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useGoogleAdsConversionActions(dateFrom: string, dateTo: string) {
  return useQuery<GoogleAdsConversionAction[]>({
    queryKey: ["google-ads-conv-actions", dateFrom, dateTo],
    queryFn: async () => {
      const data = await fetchGads<GadsConvActionRow>(
        `/google_ads_conversion_actions?select=conversion_action_name,conversion_category,conversions,conversions_value&date=gte.${dateFrom}&date=lte.${dateTo}`
      );

      if (!data) return [];

      const grouped = new Map<string, GoogleAdsConversionAction>();
      for (const row of data) {
        const key = row.conversion_action_name;
        const existing = grouped.get(key) || {
          name: row.conversion_action_name,
          category: row.conversion_category || "",
          conversions: 0,
          value: 0,
        };
        existing.conversions += row.conversions || 0;
        existing.value += row.conversions_value || 0;
        if (row.conversion_category) existing.category = row.conversion_category;
        grouped.set(key, existing);
      }

      return Array.from(grouped.values()).sort((a, b) => b.conversions - a.conversions);
    },
    staleTime: 5 * 60 * 1000,
  });
}

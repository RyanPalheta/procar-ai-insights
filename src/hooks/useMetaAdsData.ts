import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  MetaAdsKPIs,
  MetaAdsDailyData,
  MetaAdCreative,
  MetaCampaignRow,
  MetaAction,
} from "@/types/meta-ads";

// All Meta Ads calls now go through the `meta-ads` Supabase edge function,
// which holds the access token as a server-side secret. This prevents the
// Meta API token from leaking into the client bundle.

type MetaAdsAction =
  | "test"
  | "account_insights"
  | "daily_insights"
  | "ad_insights"
  | "campaign_insights";

interface MetaAdsRequestBody {
  action: MetaAdsAction;
  params?: {
    date_from?: string;
    date_to?: string;
    limit?: number;
  };
}

async function invokeMetaAds<T = any>(body: MetaAdsRequestBody): Promise<T> {
  const { data, error } = await supabase.functions.invoke("meta-ads", { body });
  if (error) {
    throw new Error(error.message || "meta-ads function call failed");
  }
  if (data && typeof data === "object" && "error" in data && data.error) {
    throw new Error(String(data.error));
  }
  return data as T;
}

// Always enabled — the edge function decides whether credentials are present.
export function hasMetaCredentials(): boolean {
  return true;
}

// Kept for backward compatibility with any consumer that still reads it.
// The actual token lives in the edge function secrets.
export function getMetaCredentials() {
  return { accessToken: "", adAccountId: "" };
}

function getActionValue(actions: MetaAction[] | undefined, actionType: string): number {
  if (!actions) return 0;
  const action = actions.find((a) => a.action_type === actionType);
  return action ? parseFloat(action.value) : 0;
}

function parseInsightToKPIs(row: any): MetaAdsKPIs {
  const purchases = getActionValue(row.actions, "purchase");
  const leads = getActionValue(row.actions, "lead");
  const spend = parseFloat(row.spend || "0");
  const purchaseRevenue = getActionValue(row.action_values, "purchase");

  return {
    impressions: parseInt(row.impressions || "0"),
    clicks: parseInt(row.clicks || "0"),
    reach: parseInt(row.reach || "0"),
    spend,
    cpm: parseFloat(row.cpm || "0"),
    cpc: parseFloat(row.cpc || "0"),
    ctr: parseFloat(row.ctr || "0"),
    cpl: leads > 0 ? spend / leads : 0,
    frequency: parseFloat(row.frequency || "0"),
    purchases,
    costPerPurchase: purchases > 0 ? spend / purchases : 0,
    roas: spend > 0 ? purchaseRevenue / spend : 0,
    leads,
  };
}

export function useMetaAdsKPIs(dateFrom: string, dateTo: string) {
  return useQuery<MetaAdsKPIs>({
    queryKey: ["meta-ads-kpis", dateFrom, dateTo],
    queryFn: async () => {
      const data = await invokeMetaAds({
        action: "account_insights",
        params: { date_from: dateFrom, date_to: dateTo },
      });
      if (!data?.data || data.data.length === 0) {
        return {
          impressions: 0, clicks: 0, reach: 0, spend: 0, cpm: 0, cpc: 0,
          ctr: 0, cpl: 0, frequency: 0, purchases: 0, costPerPurchase: 0, roas: 0, leads: 0,
        };
      }
      return parseInsightToKPIs(data.data[0]);
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useMetaAdsDailyInsights(dateFrom: string, dateTo: string) {
  return useQuery<MetaAdsDailyData[]>({
    queryKey: ["meta-ads-daily", dateFrom, dateTo],
    queryFn: async () => {
      const data = await invokeMetaAds({
        action: "daily_insights",
        params: { date_from: dateFrom, date_to: dateTo },
      });
      if (!data?.data) return [];
      return data.data.map((row: any) => ({
        date: row.date_start,
        impressions: parseInt(row.impressions || "0"),
        clicks: parseInt(row.clicks || "0"),
        spend: parseFloat(row.spend || "0"),
        reach: parseInt(row.reach || "0"),
        purchases: getActionValue(row.actions, "purchase"),
        leads: getActionValue(row.actions, "lead"),
      }));
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useMetaAdsBestCreatives(dateFrom: string, dateTo: string, limit = 5) {
  return useQuery<MetaAdCreative[]>({
    queryKey: ["meta-ads-creatives", dateFrom, dateTo, limit],
    queryFn: async () => {
      const data = await invokeMetaAds({
        action: "ad_insights",
        params: { date_from: dateFrom, date_to: dateTo, limit },
      });
      if (!data?.data) return [];
      return data.data.map((row: any) => {
        const purchases = getActionValue(row.actions, "purchase");
        const spend = parseFloat(row.spend || "0");
        return {
          ad_id: row.ad_id,
          ad_name: row.ad_name,
          impressions: parseInt(row.impressions || "0"),
          clicks: parseInt(row.clicks || "0"),
          ctr: parseFloat(row.ctr || "0"),
          spend,
          purchases,
          costPerPurchase: purchases > 0 ? spend / purchases : 0,
          cpc: parseFloat(row.cpc || "0"),
          thumbnail_url: row.creative_thumbnail_url,
          title: row.creative_title,
          body: row.creative_body,
        };
      });
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useMetaAdsCampaigns(dateFrom: string, dateTo: string) {
  return useQuery<MetaCampaignRow[]>({
    queryKey: ["meta-ads-campaigns", dateFrom, dateTo],
    queryFn: async () => {
      const data = await invokeMetaAds({
        action: "campaign_insights",
        params: { date_from: dateFrom, date_to: dateTo },
      });
      if (!data?.data) return [];
      return data.data.map((row: any) => {
        const purchases = getActionValue(row.actions, "purchase");
        const leads = getActionValue(row.actions, "lead");
        const spend = parseFloat(row.spend || "0");
        const purchaseRevenue = getActionValue(row.action_values, "purchase");

        return {
          campaign_id: row.campaign_id,
          campaign_name: row.campaign_name,
          spend,
          impressions: parseInt(row.impressions || "0"),
          clicks: parseInt(row.clicks || "0"),
          ctr: parseFloat(row.ctr || "0"),
          cpc: parseFloat(row.cpc || "0"),
          reach: parseInt(row.reach || "0"),
          purchases,
          costPerPurchase: purchases > 0 ? spend / purchases : 0,
          leads,
          cpl: leads > 0 ? spend / leads : 0,
          roas: spend > 0 ? purchaseRevenue / spend : 0,
        };
      });
    },
    staleTime: 5 * 60 * 1000,
  });
}

export interface SupabaseMetrics {
  confirmedAppointments: number;
  financialPresented: number;
}

export function useMetaAdsSupabaseMetrics(dateFrom: string, dateTo: string) {
  return useQuery<SupabaseMetrics>({
    queryKey: ["meta-ads-supabase-metrics", dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_db")
        .select("sales_status, used_offer")
        .gte("created_at", `${dateFrom}T00:00:00`)
        .lte("created_at", `${dateTo}T23:59:59`);

      if (error) throw error;

      let confirmedAppointments = 0;
      let financialPresented = 0;

      (data || []).forEach((lead) => {
        if (lead.sales_status?.toLowerCase().includes("agendamento confirmado")) {
          confirmedAppointments++;
        }
        if (lead.used_offer) {
          financialPresented++;
        }
      });

      return { confirmedAppointments, financialPresented };
    },
    staleTime: 5 * 60 * 1000,
  });
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  MetaAdsKPIs,
  MetaAdsDailyData,
  MetaAdCreative,
  MetaCampaignRow,
  MetaAction,
} from "@/types/meta-ads";

const META_API_BASE = "https://graph.facebook.com/v21.0";

// Credentials fixed via environment variables — never lost on cache clear
export function getMetaCredentials() {
  return {
    accessToken: import.meta.env.VITE_META_ADS_TOKEN || "",
    adAccountId: import.meta.env.VITE_META_ADS_ACCOUNT_ID || "",
  };
}

export function hasMetaCredentials(): boolean {
  const { accessToken, adAccountId } = getMetaCredentials();
  return Boolean(accessToken && adAccountId);
}

function getActionValue(actions: MetaAction[] | undefined, actionType: string): number {
  if (!actions) return 0;
  const action = actions.find((a) => a.action_type === actionType);
  return action ? parseFloat(action.value) : 0;
}

async function fetchMeta(endpoint: string): Promise<any> {
  const { accessToken } = getMetaCredentials();
  const separator = endpoint.includes("?") ? "&" : "?";
  const url = `${META_API_BASE}${endpoint}${separator}access_token=${accessToken}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) {
    throw new Error(data.error.message || "Meta API error");
  }
  return data;
}

function buildTimeRange(dateFrom: string, dateTo: string): string {
  return `time_range={"since":"${dateFrom}","until":"${dateTo}"}`;
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
  const { adAccountId } = getMetaCredentials();
  const accountPath = `act_${adAccountId}`;
  const fields = "impressions,clicks,reach,spend,cpm,cpc,ctr,frequency,actions,action_values,cost_per_action_type";

  return useQuery<MetaAdsKPIs>({
    queryKey: ["meta-ads-kpis", dateFrom, dateTo],
    queryFn: async () => {
      const timeRange = buildTimeRange(dateFrom, dateTo);
      const data = await fetchMeta(
        `/${accountPath}/insights?fields=${fields}&${timeRange}`
      );
      if (!data.data || data.data.length === 0) {
        return {
          impressions: 0, clicks: 0, reach: 0, spend: 0, cpm: 0, cpc: 0,
          ctr: 0, cpl: 0, frequency: 0, purchases: 0, costPerPurchase: 0, roas: 0, leads: 0,
        };
      }
      return parseInsightToKPIs(data.data[0]);
    },
    enabled: hasMetaCredentials(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useMetaAdsDailyInsights(dateFrom: string, dateTo: string) {
  const { adAccountId } = getMetaCredentials();
  const accountPath = `act_${adAccountId}`;
  const fields = "impressions,clicks,reach,spend,actions";

  return useQuery<MetaAdsDailyData[]>({
    queryKey: ["meta-ads-daily", dateFrom, dateTo],
    queryFn: async () => {
      const timeRange = buildTimeRange(dateFrom, dateTo);
      const data = await fetchMeta(
        `/${accountPath}/insights?fields=${fields}&${timeRange}&time_increment=1`
      );
      if (!data.data) return [];

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
    enabled: hasMetaCredentials(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useMetaAdsBestCreatives(dateFrom: string, dateTo: string, limit = 5) {
  const { adAccountId } = getMetaCredentials();
  const accountPath = `act_${adAccountId}`;
  const fields = "ad_id,ad_name,impressions,clicks,ctr,spend,cpc,actions,cost_per_action_type";

  return useQuery<MetaAdCreative[]>({
    queryKey: ["meta-ads-creatives", dateFrom, dateTo, limit],
    queryFn: async () => {
      const timeRange = buildTimeRange(dateFrom, dateTo);
      const data = await fetchMeta(
        `/${accountPath}/insights?fields=${fields}&level=ad&${timeRange}&sort=impressions_descending&limit=${limit}`
      );
      if (!data.data) return [];

      const creatives: MetaAdCreative[] = data.data.map((row: any) => {
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
        };
      });

      // Try to fetch thumbnails for top creatives
      for (const creative of creatives.slice(0, 3)) {
        try {
          const adData = await fetchMeta(
            `/${creative.ad_id}?fields=creative{thumbnail_url,title,body}`
          );
          if (adData.creative) {
            creative.thumbnail_url = adData.creative.thumbnail_url;
            creative.title = adData.creative.title;
            creative.body = adData.creative.body;
          }
        } catch {
          // ignore thumbnail fetch errors
        }
      }

      return creatives;
    },
    enabled: hasMetaCredentials(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useMetaAdsCampaigns(dateFrom: string, dateTo: string) {
  const { adAccountId } = getMetaCredentials();
  const accountPath = `act_${adAccountId}`;
  const fields = "campaign_id,campaign_name,impressions,clicks,reach,spend,cpm,cpc,ctr,frequency,actions,action_values,cost_per_action_type";

  return useQuery<MetaCampaignRow[]>({
    queryKey: ["meta-ads-campaigns", dateFrom, dateTo],
    queryFn: async () => {
      const timeRange = buildTimeRange(dateFrom, dateTo);
      const data = await fetchMeta(
        `/${accountPath}/insights?fields=${fields}&level=campaign&${timeRange}&sort=spend_descending&limit=50`
      );
      if (!data.data) return [];

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
    enabled: hasMetaCredentials(),
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

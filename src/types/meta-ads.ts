export interface MetaAction {
  action_type: string;
  value: string;
}

export interface MetaAdsInsight {
  impressions: string;
  clicks: string;
  reach: string;
  spend: string;
  cpm: string;
  cpc: string;
  ctr: string;
  frequency: string;
  actions?: MetaAction[];
  action_values?: MetaAction[];
  cost_per_action_type?: MetaAction[];
  date_start: string;
  date_stop: string;
}

export interface MetaAdInsight extends MetaAdsInsight {
  ad_id: string;
  ad_name: string;
  creative_thumbnail_url?: string;
  creative_title?: string;
  creative_body?: string;
}

export interface MetaCampaignInsight extends MetaAdsInsight {
  campaign_id: string;
  campaign_name: string;
}

export interface MetaAdsKPIs {
  impressions: number;
  clicks: number;
  reach: number;
  spend: number;
  cpm: number;
  cpc: number;
  ctr: number;
  cpl: number;
  frequency: number;
  purchases: number;
  costPerPurchase: number;
  roas: number;
  leads: number;
}

export interface MetaAdsDailyData {
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
  reach: number;
  purchases: number;
  leads: number;
}

export interface MetaAdCreative {
  ad_id: string;
  ad_name: string;
  thumbnail_url?: string;
  title?: string;
  body?: string;
  impressions: number;
  clicks: number;
  ctr: number;
  spend: number;
  purchases: number;
  costPerPurchase: number;
  cpc: number;
}

export interface MetaCampaignRow {
  campaign_id: string;
  campaign_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  reach: number;
  purchases: number;
  costPerPurchase: number;
  leads: number;
  cpl: number;
  roas: number;
}

export interface GoogleAdsKPIs {
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  conversionsValue: number;
  ctr: number;
  cpc: number;
  roas: number;
  activeCampaigns: number;
}

export interface GoogleAdsDailyData {
  date: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
}

export interface GoogleAdsCampaignRow {
  campaign_id: string;
  campaign_name: string;
  campaign_status: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  conversions_value: number;
  ctr: number;
  cpc: number;
  roas: number;
}

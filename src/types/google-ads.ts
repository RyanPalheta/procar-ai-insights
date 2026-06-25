export interface GoogleAdsKPIs {
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  conversionsValue: number;
  /** Conversões "todas" (inclui ligações, store visits, etc. que a métrica primária pode não contar). */
  allConversions: number;
  ctr: number;
  cpc: number;
  /** Custo por conversão (spend / conversions). Substitui o ROAS, que era sempre 0 (sem valor de conversão). */
  cpa: number;
  /** Parcela de impressões em Search (0..1). 0 = sem dados de Search no período. */
  searchImpressionShare: number;
  /** Parcela de impressões perdida por orçamento (0..1). */
  budgetLostIS: number;
  /** Parcela de impressões perdida por lance/qualidade (0..1). */
  rankLostIS: number;
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
  all_conversions: number;
  ctr: number;
  cpc: number;
  /** Custo por conversão (spend / conversions). */
  cpa: number;
}

/** Conversões agrupadas por TIPO de ação (Ligação, Formulário, etc.). */
export interface GoogleAdsConversionAction {
  name: string;
  category: string;
  conversions: number;
  value: number;
}

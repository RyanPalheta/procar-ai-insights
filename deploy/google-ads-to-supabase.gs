// ============================================================
// Google Ads Script -> Supabase (dashboard ProCar) — v2 (Fase 2)
// Alimenta:  google_ads_metrics  +  google_ads_conversion_actions
// API: GAQL (AdsApp.search). Agende em Ferramentas -> Scripts -> Diariamente.
//
// O QUE MUDOU vs v1:
//  - AWQL (CAMPAIGN_PERFORMANCE_REPORT) -> GAQL (AdsApp.search), à prova de
//    descontinuação e com acesso a métricas novas.
//  - campaign.status vem ENABLED/PAUSED/REMOVED (maiúsculo) -> conserta
//    "Campanhas Ativas" no painel.
//  - cost_micros nativo (NÃO multiplica mais por 1e6).
//  - + all_conversions / all_conversions_value (pega ligações que a conversão
//    primária pode não contar).
//  - + Parcela de Impressões (Search) e perdas por verba/lance.
//  - + 2ª consulta: conversões por TIPO de ação (ligação, formulário...).
// ============================================================

var SB_BASE  = 'https://supabase.procarsoundsecuritytech.com/rest/v1';
var SB_KEY   = 'COLE_AQUI_O_SERVICE_ROLE';   // o MESMO service_role do seu script v1
var DAYS_BACK = 30;     // janela reenviada a cada run; upsert cura buracos sem duplicar
var BATCH = 100;

function main() {
  var acc = AdsApp.currentAccount();
  var customerId = acc.getCustomerId().replace(/-/g, '');
  var tz = acc.getTimeZone();
  var end = new Date(), start = new Date();
  start.setDate(start.getDate() - DAYS_BACK);
  var d1 = Utilities.formatDate(start, tz, 'yyyy-MM-dd');
  var d2 = Utilities.formatDate(end,   tz, 'yyyy-MM-dd');
  Logger.log('Conta ' + customerId + ' | ' + d1 + ' a ' + d2);

  collectMetrics(customerId, d1, d2);
  collectConversionActions(customerId, d1, d2);
}

// ---- 1) Métricas por campanha/dia (+ all_conversions + impression share) ----
function collectMetrics(customerId, d1, d2) {
  // OBS: impression share só pode ser combinada com segments.date (não com
  // segments.conversion_action) — por isso as conversões por tipo são à parte.
  var q =
    'SELECT segments.date, campaign.id, campaign.name, campaign.status, ' +
    'metrics.impressions, metrics.clicks, metrics.cost_micros, ' +
    'metrics.conversions, metrics.conversions_value, ' +
    'metrics.all_conversions, metrics.all_conversions_value, ' +
    'metrics.search_impression_share, ' +
    'metrics.search_budget_lost_impression_share, ' +
    'metrics.search_rank_lost_impression_share ' +
    'FROM campaign ' +
    'WHERE segments.date BETWEEN "' + d1 + '" AND "' + d2 + '" ' +
    'AND metrics.impressions > 0 ORDER BY segments.date';

  var it = AdsApp.search(q), batch = [], n = 0;
  while (it.hasNext()) {
    var r = it.next();
    var impressions = toInt(r.metrics.impressions);
    var clicks      = toInt(r.metrics.clicks);
    var costMicros  = toInt(r.metrics.costMicros);   // já em micros
    batch.push({
      date: r.segments.date,
      customer_id: customerId,
      campaign_id: String(r.campaign.id),
      campaign_name: r.campaign.name,
      campaign_status: String(r.campaign.status),    // ENABLED / PAUSED / REMOVED
      impressions: impressions,
      clicks: clicks,
      cost_micros: costMicros,
      conversions: toFloat(r.metrics.conversions),
      conversions_value: toFloat(r.metrics.conversionsValue),
      all_conversions: toFloat(r.metrics.allConversions),
      all_conversions_value: toFloat(r.metrics.allConversionsValue),
      // null quando não é Search (PMax/Display não reportam IS)
      search_impression_share: orNull(r.metrics.searchImpressionShare),
      search_budget_lost_is:   orNull(r.metrics.searchBudgetLostImpressionShare),
      search_rank_lost_is:     orNull(r.metrics.searchRankLostImpressionShare),
      ctr: impressions > 0 ? clicks / impressions : 0,
      average_cpc_micros: clicks > 0 ? Math.round(costMicros / clicks) : 0
    });
    n++;
    if (batch.length >= BATCH) { upsert('/google_ads_metrics', batch); batch = []; }
  }
  if (batch.length) upsert('/google_ads_metrics', batch);
  Logger.log('metrics: ' + n + ' linhas');
}

// ---- 2) Conversões por TIPO de ação (ligação, formulário, etc.) ----
function collectConversionActions(customerId, d1, d2) {
  var q =
    'SELECT segments.date, campaign.id, campaign.name, ' +
    'segments.conversion_action_name, segments.conversion_action_category, ' +
    'metrics.all_conversions, metrics.all_conversions_value ' +
    'FROM campaign ' +
    'WHERE segments.date BETWEEN "' + d1 + '" AND "' + d2 + '" ' +
    'AND metrics.all_conversions > 0';

  var it = AdsApp.search(q), batch = [], n = 0;
  while (it.hasNext()) {
    var r = it.next();
    batch.push({
      date: r.segments.date,
      customer_id: customerId,
      campaign_id: String(r.campaign.id),
      campaign_name: r.campaign.name,
      conversion_action_name: r.segments.conversionActionName,
      conversion_category: String(r.segments.conversionActionCategory || ''),
      conversions: toFloat(r.metrics.allConversions),
      conversions_value: toFloat(r.metrics.allConversionsValue)
    });
    n++;
    if (batch.length >= BATCH) { upsert('/google_ads_conversion_actions', batch); batch = []; }
  }
  if (batch.length) upsert('/google_ads_conversion_actions', batch);
  Logger.log('conversion_actions: ' + n + ' linhas');
}

function toInt(v){ return parseInt(v, 10) || 0; }
function toFloat(v){ return parseFloat(v) || 0; }
function orNull(v){ return (v === null || v === undefined || v === '') ? null : Number(v); }

function upsert(path, rows) {
  var res = UrlFetchApp.fetch(SB_BASE + path, {
    method: 'POST', contentType: 'application/json',
    headers: {
      apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY,
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    payload: JSON.stringify(rows), muteHttpExceptions: true
  });
  var c = res.getResponseCode();
  Logger.log(c >= 300 ? ('ERRO ' + path + ' HTTP ' + c + ': ' + res.getContentText())
                       : (path + ' lote ' + rows.length + ' OK'));
}

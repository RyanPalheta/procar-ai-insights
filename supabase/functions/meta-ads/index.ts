const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const META_API_BASE = 'https://graph.facebook.com/v21.0';

interface MetaAdsRequest {
  action: 'account_insights' | 'daily_insights' | 'ad_insights' | 'campaign_insights' | 'test';
  params?: {
    date_from?: string;
    date_to?: string;
    limit?: number;
  };
}

async function fetchMetaAPI(endpoint: string, accessToken: string): Promise<any> {
  const separator = endpoint.includes('?') ? '&' : '?';
  const url = `${META_API_BASE}${endpoint}${separator}access_token=${accessToken}`;

  const res = await fetch(url);
  const data = await res.json();

  if (data.error) {
    throw new Error(`Meta API Error: ${data.error.message} (code: ${data.error.code})`);
  }

  return data;
}

function buildTimeRange(dateFrom?: string, dateTo?: string): string {
  if (dateFrom && dateTo) {
    return `time_range={"since":"${dateFrom}","until":"${dateTo}"}`;
  }
  return 'date_preset=last_30d';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accessToken = Deno.env.get('META_ACCESS_TOKEN');
    const adAccountId = Deno.env.get('META_AD_ACCOUNT_ID');

    if (!accessToken || !adAccountId) {
      return new Response(
        JSON.stringify({ error: 'Meta Ads credentials not configured. Set META_ACCESS_TOKEN and META_AD_ACCOUNT_ID as secrets.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accountPath = `act_${adAccountId}`;
    const { action, params } = await req.json() as MetaAdsRequest;

    console.log(`[meta-ads] Action: ${action}, Params:`, params);

    const timeRange = buildTimeRange(params?.date_from, params?.date_to);
    const baseFields = 'impressions,clicks,reach,spend,cpm,cpc,ctr,frequency,actions,action_values,cost_per_action_type';

    let result: any;

    switch (action) {
      case 'test': {
        result = await fetchMetaAPI(`/${accountPath}?fields=name,account_id,currency`, accessToken);
        break;
      }

      case 'account_insights': {
        result = await fetchMetaAPI(
          `/${accountPath}/insights?fields=${baseFields}&${timeRange}`,
          accessToken
        );
        break;
      }

      case 'daily_insights': {
        result = await fetchMetaAPI(
          `/${accountPath}/insights?fields=${baseFields}&${timeRange}&time_increment=1`,
          accessToken
        );
        break;
      }

      case 'ad_insights': {
        const limit = params?.limit ?? 10;
        result = await fetchMetaAPI(
          `/${accountPath}/insights?fields=ad_id,ad_name,${baseFields}&level=ad&${timeRange}&sort=impressions_descending&limit=${limit}`,
          accessToken
        );

        // Fetch creative thumbnails for top ads
        if (result.data && result.data.length > 0) {
          const adIds = result.data.map((d: any) => d.ad_id).filter(Boolean);
          const uniqueAdIds = [...new Set(adIds)] as string[];

          for (const adId of uniqueAdIds.slice(0, 5)) {
            try {
              const creative = await fetchMetaAPI(
                `/${adId}?fields=creative{thumbnail_url,title,body}`,
                accessToken
              );
              const match = result.data.find((d: any) => d.ad_id === adId);
              if (match && creative.creative) {
                match.creative_thumbnail_url = creative.creative.thumbnail_url;
                match.creative_title = creative.creative.title;
                match.creative_body = creative.creative.body;
              }
            } catch (e) {
              console.warn(`[meta-ads] Could not fetch creative for ad ${adId}:`, e);
            }
          }
        }
        break;
      }

      case 'campaign_insights': {
        result = await fetchMetaAPI(
          `/${accountPath}/insights?fields=campaign_id,campaign_name,${baseFields}&level=campaign&${timeRange}&sort=spend_descending&limit=50`,
          accessToken
        );
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[meta-ads] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

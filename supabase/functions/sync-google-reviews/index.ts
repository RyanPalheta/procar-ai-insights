// sync-google-reviews — puxa a contagem REAL de avaliações + nota do Google Maps da
// loja e grava um snapshot diário (tabela google_reviews_snapshot). Alimenta o card
// "Avaliações Google" da Visão Geral.
//
// Usa a Google Places API (New). Requer GOOGLE_PLACES_API_KEY no ambiente das functions
// (key do Maps Platform, com billing ativo e a "Places API (New)" habilitada).
//   - GOOGLE_PLACE_ID  (opcional): ChIJ... — se setado, vai direto no Place Details
//                       (mais barato e determinístico; sem Text Search).
//   - GOOGLE_PLACE_QUERY (opcional): texto da busca, se ainda não tiver o place_id.
//
// Dica: rode 1x sem o place_id, pegue o `place_id` do retorno e salve como
// GOOGLE_PLACE_ID — assim as próximas chamadas pulam a busca por texto.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const PLACES = 'https://places.googleapis.com/v1';
// Endereço da loja (Malden, MA) — usado só quando GOOGLE_PLACE_ID não está setado.
const DEFAULT_QUERY = 'Pro Car Sound & Security, 267 Broadway, Malden, MA 02148';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Text Search (New): descobre o place_id e já devolve rating/userRatingCount.
async function searchPlace(query: string, apiKey: string): Promise<any> {
  const r = await fetch(`${PLACES}/places:searchText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.rating,places.userRatingCount',
    },
    body: JSON.stringify({ textQuery: query }),
  });
  if (!r.ok) throw new Error(`Places searchText ${r.status}: ${await r.text()}`);
  const d = await r.json();
  const p = d?.places?.[0];
  if (!p) throw new Error(`Nenhum lugar encontrado para a busca: "${query}"`);
  return p;
}

// Place Details (New): consulta direta por place_id (rating + userRatingCount).
async function getDetails(placeId: string, apiKey: string): Promise<any> {
  const r = await fetch(`${PLACES}/places/${encodeURIComponent(placeId)}`, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'id,displayName,rating,userRatingCount',
    },
  });
  if (!r.ok) throw new Error(`Places details ${r.status}: ${await r.text()}`);
  return await r.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY');
    if (!apiKey) {
      return json({ error: 'Falta GOOGLE_PLACES_API_KEY no ambiente das functions (Places API New, billing ativo).' }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const placeId = body.place_id ?? Deno.env.get('GOOGLE_PLACE_ID') ?? null;
    const query = body.query ?? Deno.env.get('GOOGLE_PLACE_QUERY') ?? DEFAULT_QUERY;

    // Com place_id -> Details direto; sem -> descobre via Text Search.
    const place = placeId ? await getDetails(placeId, apiKey) : await searchPlace(query, apiKey);

    const resolvedPlaceId: string | undefined = place.id;
    const placeName: string | null = place.displayName?.text ?? null;
    const rating: number | null = place.rating ?? null;
    const reviewCount: number | null = place.userRatingCount ?? null;

    if (!resolvedPlaceId) return json({ error: 'API não retornou place id', place }, 502);
    if (reviewCount == null) return json({ error: 'API não retornou userRatingCount', place }, 502);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const nowIso = new Date().toISOString();
    const capturedDay = nowIso.slice(0, 10); // YYYY-MM-DD (UTC)

    const { error } = await supabase.from('google_reviews_snapshot').upsert({
      place_id: resolvedPlaceId,
      place_name: placeName,
      rating,
      review_count: reviewCount,
      captured_at: nowIso,
      captured_day: capturedDay,
    }, { onConflict: 'place_id,captured_day' });
    if (error) throw new Error('upsert google_reviews_snapshot: ' + error.message);

    return json({
      place_id: resolvedPlaceId,
      place_name: placeName,
      rating,
      review_count: reviewCount,
      captured_at: nowIso,
      used_place_id: !!placeId, // false => veio da busca por texto (salve o place_id como GOOGLE_PLACE_ID)
    });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});

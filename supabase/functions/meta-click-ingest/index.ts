// meta-click-ingest — recebe {rows:[{phone, ctwa_clid, fbc}]} (do cron na VPS que lê a
// Data Table `tracking` do n8n, alimentada pela uazapi) e faz upsert em meta_click.
// É a ponte de atribuição: telefone -> click-id do anúncio, lida no Purchase do CAPI.
// Guard: ?s=<META_CLICK_INGEST_SECRET>. Usa service_role (RLS da meta_click é fechada).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const j = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
const last10 = (p: string) => (p || '').replace(/\D/g, '').slice(-10);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const secret = Deno.env.get('META_CLICK_INGEST_SECRET');
    if (secret && new URL(req.url).searchParams.get('s') !== secret) return j({ error: 'forbidden' }, 403);

    const body = await req.json().catch(() => ({} as any));
    const rows: any[] = Array.isArray(body.rows) ? body.rows : [];

    const upserts = rows
      .map((r) => ({
        phone_normalized: last10(String(r.phone ?? '')),
        ctwa_clid: r.ctwa_clid || null,
        fbc: r.fbc || null,
        source: r.source || 'whatsapp_ad',
        updated_at: new Date().toISOString(),
      }))
      .filter((r) => r.phone_normalized.length === 10 && r.ctwa_clid);

    if (!upserts.length) return j({ ok: true, upserted: 0 });

    const sb = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { error } = await sb.from('meta_click').upsert(upserts, { onConflict: 'phone_normalized' });
    if (error) return j({ error: error.message }, 500);

    return j({ ok: true, upserted: upserts.length });
  } catch (e) {
    return j({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});

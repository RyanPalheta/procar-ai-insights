// sync-shopmonkey — traz os dados REAIS da loja (ShopMonkey) para o dashboard.
//
// Agendamentos = appointments com color='green' (por startDate na janela).
// Vendas       = orders pagos (paid=true, por fullyPaidDate na janela);
//                receita = paid_cost_cents/100 (USD).
// Upsert idempotente nas tabelas shopmonkey_appointment / shopmonkey_sale (PK=id).
//
// Requer SHOPMONKEY_API_TOKEN no ambiente das functions (mesmo token do integration).
// Acesso à API (descoberto): POST /v3/appointment/search {where:{startDate:{gte,lte}}};
// GET /v3/order/?where={"fullyPaidDate":{"gte","lte"}}  — operadores gte/lte (sem $).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const SM = 'https://api.shopmonkey.cloud';
const PAGE = 100;
const MAX = 6000; // trava de segurança

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const days = Math.max(1, Math.min(90, Number(body.days ?? 14)));

    const token = Deno.env.get('SHOPMONKEY_API_TOKEN');
    if (!token) return json({ error: 'Falta SHOPMONKEY_API_TOKEN no ambiente das functions' }, 500);
    const smHeaders = { Authorization: `Bearer ${token}`, 'User-Agent': 'procar-sync', 'Content-Type': 'application/json' };

    const now = new Date();
    const since = new Date(now.getTime() - days * 86400000).toISOString();
    const nowIso = now.toISOString();

    // --- Agendamentos: POST /v3/appointment/search (por startDate) ---
    const appts: any[] = [];
    for (let skip = 0; skip < MAX; skip += PAGE) {
      const r = await fetch(`${SM}/v3/appointment/search`, {
        method: 'POST',
        headers: smHeaders,
        body: JSON.stringify({ where: { startDate: { gte: since, lte: nowIso } }, limit: PAGE, skip }),
      });
      if (!r.ok) return json({ error: `ShopMonkey appointment ${r.status}`, detail: await r.text() }, 502);
      const d = await r.json();
      const batch = d?.data ?? [];
      if (!batch.length) break;
      appts.push(...batch);
      if (!d?.meta?.hasMore) break;
    }

    // --- Vendas: GET /v3/order/?where=fullyPaidDate (pagos) ---
    const orders: any[] = [];
    const where = encodeURIComponent(JSON.stringify({ fullyPaidDate: { gte: since, lte: nowIso } }));
    for (let skip = 0; skip < MAX; skip += PAGE) {
      const r = await fetch(`${SM}/v3/order/?where=${where}&limit=${PAGE}&skip=${skip}`, { headers: smHeaders });
      if (!r.ok) return json({ error: `ShopMonkey order ${r.status}`, detail: await r.text() }, 502);
      const d = await r.json();
      const batch = d?.data ?? [];
      if (!batch.length) break;
      orders.push(...batch);
      if (!d?.meta?.hasMore) break;
    }

    // --- Upsert ---
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // ShopMonkey pode repetir ids no resultado paginado (recorrência/overlap);
    // deduplica por id, senão o upsert falha ("cannot affect row a second time").
    const dedupe = <T extends { id: string }>(rows: T[]): T[] => {
      const m = new Map<string, T>();
      for (const r of rows) if (r.id) m.set(r.id, r);
      return [...m.values()];
    };

    const apptRows = dedupe(appts.map((a) => ({
      id: a.id,
      start_date: a.startDate ?? null,
      end_date: a.endDate ?? null,
      color: a.color ?? null,
      customer_id: a.customerId ?? null,
      order_id: a.orderId ?? null,
      created_date: a.createdDate ?? null,
      synced_at: nowIso,
    })));
    const saleRows = dedupe(orders
      .filter((o) => o.paid)
      .map((o) => ({
        id: o.id,
        fully_paid_date: o.fullyPaidDate ?? null,
        paid_cost_cents: o.paidCostCents ?? null,
        total_cost_cents: o.totalCostCents ?? null,
        customer_id: o.customerId ?? null,
        invoiced: o.invoiced ?? null,
        created_date: o.createdDate ?? null,
        synced_at: nowIso,
      })));

    if (apptRows.length) {
      const { error } = await supabase.from('shopmonkey_appointment').upsert(apptRows, { onConflict: 'id' });
      if (error) throw new Error('upsert appointment: ' + error.message);
    }
    if (saleRows.length) {
      const { error } = await supabase.from('shopmonkey_sale').upsert(saleRows, { onConflict: 'id' });
      if (error) throw new Error('upsert sale: ' + error.message);
    }

    const green = apptRows.filter((a) => a.color === 'green').length;
    const revenue = Math.round(saleRows.reduce((s, r) => s + (r.paid_cost_cents || 0), 0) / 100);

    return json({
      window_days: days,
      since,
      appointments_synced: apptRows.length,
      agendamentos_green: green,
      sales_synced: saleRows.length,
      revenue_usd: revenue,
    });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});

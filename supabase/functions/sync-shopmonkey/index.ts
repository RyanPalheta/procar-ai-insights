// sync-shopmonkey — traz os dados REAIS da loja (ShopMonkey) para o dashboard.
//
// Agendamentos = appointments com color='green' (por startDate na janela).
// Vendas       = orders pagos (paid=true, por fullyPaidDate na janela);
//                receita = paid_cost_cents/100 (USD).
// Upsert idempotente nas tabelas shopmonkey_appointment / shopmonkey_sale (PK=id).
//
// Janela: {days: N} (móvel, default 14) OU {date_from, date_to} ISO explícitos —
// p/ backfill histórico em fatias (janela única >45d estoura o tempo da function).
//
// Requer SHOPMONKEY_API_TOKEN no ambiente das functions (mesmo token do integration).
// Acesso à API (descoberto): POST /v3/appointment/search {where:{startDate:{gte,lte}}};
// GET /v3/order/?where={"fullyPaidDate":{"gte","lte"}}  — operadores gte/lte (sem $).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';
import { parseNote } from '../_shared/parse-note.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const SM = 'https://api.shopmonkey.cloud';
const PAGE = 100;
const MAX = 6000; // trava de segurança
// A paginação por skip da API do ShopMonkey é INSTÁVEL: cada chamada devolve um
// subconjunto parcial/aleatório (1 passe pega ~70-90% do total). Repetimos a varredura
// PASSES vezes e deduplicamos por id — a união aproxima o total real (cobertura ~100%).
const PASSES = 4;

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
    const nowIso = now.toISOString();
    // Janela explícita {date_from, date_to} p/ backfill em FATIAS: uma chamada com
    // janela grande (60-90d) estoura o limite de tempo da function (os PASSES
    // multiplicam o volume). Sem date_from, segue a janela móvel por `days`.
    let since: string;
    let until: string;
    if (body.date_from) {
      const from = new Date(body.date_from);
      const to = body.date_to ? new Date(body.date_to) : now;
      if (isNaN(from.getTime()) || isNaN(to.getTime()) || from >= to) {
        return json({ error: 'date_from/date_to inválidos (ISO, date_from < date_to)' }, 400);
      }
      since = from.toISOString();
      until = to.toISOString();
    } else {
      since = new Date(now.getTime() - days * 86400000).toISOString();
      until = nowIso;
    }

    // --- Agendamentos: POST /v3/appointment/search (por startDate) ---
    const appts: any[] = [];
    for (let pass = 0; pass < PASSES; pass++)
    for (let skip = 0; skip < MAX; skip += PAGE) {
      const r = await fetch(`${SM}/v3/appointment/search`, {
        method: 'POST',
        headers: smHeaders,
        body: JSON.stringify({ where: { startDate: { gte: since, lte: until } }, limit: PAGE, skip }),
      });
      if (!r.ok) return json({ error: `ShopMonkey appointment ${r.status}`, detail: await r.text() }, 502);
      const d = await r.json();
      const batch = d?.data ?? [];
      if (!batch.length) break;
      appts.push(...batch);
      if (!d?.meta?.hasMore) break;
    }

    // --- Vendas: GET /v3/order/?where=fullyPaidDate (pagos, por data de pagamento) ---
    const orders: any[] = [];
    const where = encodeURIComponent(JSON.stringify({ fullyPaidDate: { gte: since, lte: until } }));
    for (let pass = 0; pass < PASSES; pass++)
    for (let skip = 0; skip < MAX; skip += PAGE) {
      const r = await fetch(`${SM}/v3/order/?where=${where}&limit=${PAGE}&skip=${skip}`, { headers: smHeaders });
      if (!r.ok) return json({ error: `ShopMonkey order ${r.status}`, detail: await r.text() }, 502);
      const d = await r.json();
      const batch = d?.data ?? [];
      if (!batch.length) break;
      orders.push(...batch);
      if (!d?.meta?.hasMore) break;
    }

    // --- Orçamentos: GET /v3/order/?where=createdDate (TODOS os orders criados na
    //     janela). Todo order nasce orçamento; vira venda quando pago. É a "cotação"
    //     real (o chat capta pouquíssimas) — contado por vendedor na aba Vendedores. ---
    const allOrders: any[] = [];
    const whereCreated = encodeURIComponent(JSON.stringify({ createdDate: { gte: since, lte: until } }));
    for (let pass = 0; pass < PASSES; pass++)
    for (let skip = 0; skip < MAX; skip += PAGE) {
      const r = await fetch(`${SM}/v3/order/?where=${whereCreated}&limit=${PAGE}&skip=${skip}`, { headers: smHeaders });
      if (!r.ok) return json({ error: `ShopMonkey order(all) ${r.status}`, detail: await r.text() }, 502);
      const d = await r.json();
      const batch = d?.data ?? [];
      if (!batch.length) break;
      allOrders.push(...batch);
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

    const apptRows = dedupe(appts.map((a) => {
      const p = parseNote(a.note);
      // Walk-in = texto no note OU agendamento AZUL — convenção do calendário da
      // loja confirmada pela Pro Car em 11/06/2026 (2ª auditoria, item 5): 65% dos
      // azuis têm "WALKIN" escrito vs <5% das demais cores; o texto falta em ~35%.
      const isBlue = (a.color ?? '').toLowerCase() === 'blue';
      return {
        id: a.id,
        start_date: a.startDate ?? null,
        end_date: a.endDate ?? null,
        color: a.color ?? null,
        customer_id: a.customerId ?? null,
        order_id: a.orderId ?? null,
        created_date: a.createdDate ?? null,
        note: a.note ?? null,
        walk_in: p.walkIn || isBlue,
        source: p.source,
        seller: p.seller,
        channel: isBlue && !p.channel ? "presencial" : p.channel,
        synced_at: nowIso,
      };
    }));
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

    const orderRows = dedupe(allOrders.map((o) => ({
      id: o.id,
      created_date: o.createdDate ?? null,
      customer_id: o.customerId ?? null,
      paid: !!o.fullyPaidDate || !!o.paid,
      authorized: o.authorized ?? null,
      archived: o.archived ?? null,
      total_cost_cents: o.totalCostCents ?? null,
      synced_at: nowIso,
    })));
    if (orderRows.length) {
      const { error } = await supabase.from('shopmonkey_order').upsert(orderRows, { onConflict: 'id' });
      if (error) throw new Error('upsert order: ' + error.message);
    }

    // --- Clientes: telefone do customer ShopMonkey -> shopmonkey_customer.
    //     É a PONTE lead (chat/Kommo, phone_normalized) <-> venda paga, usada pela
    //     "conversão por orçamento pago" (gráficos de tempo de resposta/cotação).
    //     Só busca na API quem ainda não temos (defensivo; falha não derruba o sync).
    let customersFetched = 0;
    try {
      const custIds = new Set<string>();
      for (const a of apptRows) if (a.customer_id) custIds.add(a.customer_id);
      for (const o of orderRows) if (o.customer_id) custIds.add(o.customer_id);
      for (const s of saleRows) if (s.customer_id) custIds.add(s.customer_id);
      const allIds = [...custIds];
      const have = new Set<string>();
      for (let i = 0; i < allIds.length; i += 200) {
        const { data } = await supabase
          .from('shopmonkey_customer')
          .select('id')
          .in('id', allIds.slice(i, i + 200));
        for (const r of data ?? []) have.add(r.id);
      }
      const missing = allIds.filter((id) => !have.has(id)).slice(0, 250); // cap por run
      const custRows: any[] = [];
      for (const cid of missing) {
        try {
          const cr = await fetch(`${SM}/v3/customer/${cid}`, { headers: smHeaders });
          if (!cr.ok) continue;
          const cd = await cr.json();
          const d = cd.data ?? cd;
          let phone: string | null = null;
          const pn = d.phoneNumbers;
          if (Array.isArray(pn) && pn.length) phone = (typeof pn[0] === 'object' ? pn[0].number : pn[0]);
          else if (typeof d.phone === 'string') phone = d.phone;
          const norm = phone ? phone.replace(/\D/g, '').slice(-10) : null;
          custRows.push({ id: cid, phone: phone ?? null, phone_normalized: norm || null, synced_at: nowIso });
        } catch { /* segue */ }
      }
      if (custRows.length) {
        const { error } = await supabase.from('shopmonkey_customer').upsert(custRows, { onConflict: 'id' });
        if (error) throw new Error('upsert customer: ' + error.message);
        customersFetched = custRows.length;
      }
    } catch (e) {
      console.error('customer sync falhou (segue):', e instanceof Error ? e.message : e);
    }

    const green = apptRows.filter((a) => a.color === 'green').length;
    const revenue = Math.round(saleRows.reduce((s, r) => s + (r.paid_cost_cents || 0), 0) / 100);

    return json({
      window_days: body.date_from ? undefined : days,
      since,
      until,
      appointments_synced: apptRows.length,
      agendamentos_green: green,
      walk_ins: apptRows.filter((a) => a.walk_in).length,
      orcamentos_synced: orderRows.length,
      sales_synced: saleRows.length,
      customers_synced: customersFetched,
      revenue_usd: revenue,
    });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});

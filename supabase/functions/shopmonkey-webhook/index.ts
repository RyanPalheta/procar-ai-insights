// shopmonkey-webhook — recebe o webhook do ShopMonkey (Appointment/Order/Payment
// Insert/Update) e faz upsert EM TEMPO REAL em shopmonkey_appointment / shopmonkey_sale
// / shopmonkey_order, com parseNote — tirando a dependência do sync horário.
//
// Robusto ao payload: re-busca a entidade por id na API (autoritativo). Detecta o tipo
// pelos campos (startDate/color=appointment; orderId=payment; paid/totalCostCents=order).
// Reusa SHOPMONKEY_API_TOKEN. Segurança: ?s=<SHOPMONKEY_WEBHOOK_SECRET> (se setado).
//
// Branches admin (JSON): {diag}, {probe,method,body}, {list_webhooks},
// {setup_webhook, url, triggers, name}, {enable_webhook:<id>}, {delete_webhook:<id>}.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';
import { parseNote } from '../_shared/parse-note.ts';
import { sendCapiEvent } from '../_shared/meta-capi.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const SM = 'https://api.shopmonkey.cloud';
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const secret = Deno.env.get('SHOPMONKEY_WEBHOOK_SECRET');
    if (secret) {
      const url = new URL(req.url);
      if (url.searchParams.get('s') !== secret) return json({ error: 'forbidden' }, 403);
    }

    const token = Deno.env.get('SHOPMONKEY_API_TOKEN');
    const smH = { Authorization: `Bearer ${token}`, 'User-Agent': 'procar-sync', 'Content-Type': 'application/json' };
    const nowIso = new Date().toISOString();

    const ctype = req.headers.get('content-type') || '';
    const body = ctype.includes('application/json') ? await req.json().catch(() => ({} as any)) : {};

    // ---------------- ADMIN / DESCOBERTA ----------------
    if (body.diag === true) return json({ has_token: !!token });
    if (body.probe) {
      if (!token) return json({ error: 'sem SHOPMONKEY_API_TOKEN' }, 500);
      const method = (body.method || 'GET').toUpperCase();
      const init: RequestInit = { method, headers: smH };
      if (body.body != null && method !== 'GET') init.body = JSON.stringify(body.body);
      const r = await fetch(`${SM}${body.probe}`, init);
      const text = await r.text();
      let parsed: unknown = null; try { parsed = JSON.parse(text); } catch { /* */ }
      return json({ probe: body.probe, method, status: r.status, body: parsed ?? text.slice(0, 2000) });
    }
    if (body.list_webhooks === true) {
      const r = await fetch(`${SM}/v3/webhook`, { headers: smH });
      return json({ list: true, status: r.status, body: await r.json().catch(() => null) });
    }
    if (body.enable_webhook) {
      const r = await fetch(`${SM}/v3/webhook/${body.enable_webhook}`, { method: 'PUT', headers: smH, body: JSON.stringify({ enabled: true }) });
      return json({ enable: body.enable_webhook, status: r.status, body: await r.json().catch(() => null) });
    }
    if (body.delete_webhook) {
      // DELETE do ShopMonkey rejeita Content-Type JSON com corpo vazio -> só Authorization.
      const r = await fetch(`${SM}/v3/webhook/${body.delete_webhook}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'procar-sync' } });
      return json({ deleted: body.delete_webhook, status: r.status, body: await r.text() });
    }
    if (body.setup_webhook === true) {
      const payload = {
        name: body.name || '(ProCar AI) Loja tempo real',
        url: body.url,
        enabled: true,
        triggers: Array.isArray(body.triggers) && body.triggers.length
          ? body.triggers : ['AppointmentInsert', 'AppointmentUpdate', 'PaymentInsert', 'OrderInsert'],
      };
      const r = await fetch(`${SM}/v3/webhook`, { method: 'POST', headers: smH, body: JSON.stringify(payload) });
      return json({ setup: true, status: r.status, sent: payload, body: await r.json().catch(() => null) });
    }

    // ---------------- HANDLER REAL ----------------
    if (!token) return json({ error: 'sem SHOPMONKEY_API_TOKEN' }, 500);
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    const entity = body?.data ?? body ?? {};
    const triggerHint = String(body?.type ?? body?.trigger ?? body?.event ?? '').toLowerCase();

    const smGet = async (path: string) => {
      const r = await fetch(`${SM}${path}`, { headers: smH });
      if (!r.ok) return null;
      const d = await r.json();
      return d?.data ?? d ?? null;
    };

    // Dados do cliente ShopMonkey p/ match do CAPI (telefone SEMPRE; email quando houver).
    const customerForCapi = async (customerId: string | null | undefined) => {
      if (!customerId) return {} as Record<string, string | null>;
      const c: any = await smGet(`/v3/customer/${customerId}`);
      if (!c) return {};
      const pn = c.phoneNumbers;
      const phone = Array.isArray(pn) && pn.length ? (typeof pn[0] === 'object' ? pn[0].number : pn[0])
        : (typeof c.phone === 'string' ? c.phone : null);
      const em = c.emails;
      const email = Array.isArray(em) && em.length ? (typeof em[0] === 'object' ? em[0].email : em[0])
        : (typeof c.email === 'string' ? c.email : null);
      const addr = (Array.isArray(c.addresses) && c.addresses[0]) ? c.addresses[0] : c;
      return {
        phone: phone ?? null,
        email: email ?? null,
        firstName: c.firstName ?? null,
        lastName: c.lastName ?? null,
        city: addr.city ?? null,
        state: addr.state ?? null,
        country: addr.country ?? 'us',
        zip: addr.postalCode ?? addr.zip ?? null,
      };
    };

    const upsertAppointment = async (a: any) => {
      const p = parseNote(a.note);
      const isBlue = (a.color ?? '').toLowerCase() === 'blue';
      const row = {
        id: a.id, start_date: a.startDate ?? null, end_date: a.endDate ?? null,
        color: a.color ?? null, customer_id: a.customerId ?? null, order_id: a.orderId ?? null,
        created_date: a.createdDate ?? null, note: a.note ?? null,
        walk_in: p.walkIn || isBlue, source: p.source, seller: p.seller,
        channel: isBlue && !p.channel ? 'presencial' : p.channel,
        upsell: p.upsell, financing: p.financing, is_referral: p.isReferral,
        is_absoluto: p.isAbsoluto, phone_active_booking: p.phoneActiveBooking, synced_at: nowIso,
      };
      const { error } = await supabase.from('shopmonkey_appointment').upsert(row, { onConflict: 'id' });
      // Rota B: agendamento CONFIRMADO (green) -> evento Schedule (MQL) no Meta CAPI.
      let capi: unknown;
      if ((a.color ?? '').toLowerCase() === 'green') {
        const cust = await customerForCapi(a.customerId);
        capi = await sendCapiEvent(supabase, {
          eventName: 'Schedule',
          sourceId: String(a.id),
          // event_time = quando o agendamento foi MARCADO (passado), não a data do
          // agendamento (futura -> Meta recusa). createdDate primeiro; startDate é fallback.
          eventTimeIso: a.createdDate ?? a.startDate ?? undefined,
          customerId: a.customerId ?? null,
          ...cust,
        });
      }
      return error ? { error: error.message } : { ok: 'appointment', id: a.id, color: a.color, capi };
    };

    const upsertOrder = async (o: any) => {
      const orderRow = {
        id: o.id, created_date: o.createdDate ?? null, customer_id: o.customerId ?? null,
        paid: o.paid ?? null, authorized: o.authorized ?? null, archived: o.archived ?? null,
        total_cost_cents: o.totalCostCents ?? null, synced_at: nowIso,
      };
      const { error: oErr } = await supabase.from('shopmonkey_order').upsert(orderRow, { onConflict: 'id' });
      let saleRes: unknown = 'not_paid';
      let capiRes: unknown;
      if (o.paid) {
        const saleRow = {
          id: o.id, fully_paid_date: o.fullyPaidDate ?? null, paid_cost_cents: o.paidCostCents ?? null,
          total_cost_cents: o.totalCostCents ?? null, customer_id: o.customerId ?? null,
          invoiced: o.invoiced ?? null, created_date: o.createdDate ?? null, synced_at: nowIso,
        };
        const { error: sErr } = await supabase.from('shopmonkey_sale').upsert(saleRow, { onConflict: 'id' });
        saleRes = sErr ? { error: sErr.message } : 'sale_upserted';

        // Rota B: pedido PAGO -> evento Purchase no Meta CAPI (value USD, match telefone+email,
        // ctwa_clid da ponte). Idempotente por order id.
        const cust = await customerForCapi(o.customerId);
        capiRes = await sendCapiEvent(supabase, {
          eventName: 'Purchase',
          sourceId: String(o.id),
          eventTimeIso: o.fullyPaidDate ?? undefined,
          valueCents: o.paidCostCents ?? o.totalCostCents ?? 0,
          customerId: o.customerId ?? null,
          ...cust,
        });
      }
      return { ok: 'order', id: o.id, paid: !!o.paid, order: oErr ? oErr.message : 'ok', sale: saleRes, capi: capiRes };
    };

    // Decide o tipo e processa.
    let result: unknown;
    const isAppt = entity.startDate != null || entity.color != null || triggerHint.includes('appointment');
    const isPayment = entity.orderId != null || triggerHint.includes('payment');
    const isOrder = entity.paid != null || entity.totalCostCents != null || entity.fullyPaidDate != null || triggerHint.includes('order');

    if (isAppt && entity.id) {
      const a = (await smGet(`/v3/appointment/${entity.id}`)) ?? entity;
      result = await upsertAppointment(a);
    } else if (isPayment && entity.orderId) {
      const o = await smGet(`/v3/order/${entity.orderId}`);
      result = o ? await upsertOrder(o) : { skip: 'order não encontrada', orderId: entity.orderId };
    } else if (isOrder && entity.id) {
      const o = (await smGet(`/v3/order/${entity.id}`)) ?? entity;
      result = await upsertOrder(o);
    } else if (entity.id) {
      // tipo ambíguo: tenta appointment, depois order
      const a = await smGet(`/v3/appointment/${entity.id}`);
      if (a) result = await upsertAppointment(a);
      else { const o = await smGet(`/v3/order/${entity.id}`); result = o ? await upsertOrder(o) : { skip: 'id não é appointment nem order', id: entity.id }; }
    } else {
      result = { skip: 'sem id no payload', keys: Object.keys(entity).slice(0, 20) };
    }

    console.log('[shopmonkey-webhook]', JSON.stringify(result));
    return json({ ok: true, result });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});

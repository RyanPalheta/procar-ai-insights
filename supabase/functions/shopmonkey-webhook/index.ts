// shopmonkey-webhook — recebe eventos do ShopMonkey em TEMPO REAL e faz, em código
// puro, o que o n8n/Atlas fazia (e que está QUEBRADO desde mar/2026:
// "Unrecognized node type: n8n-nodes-kommo.kommo"). Substitui esse passo.
//
// Em AppointmentInsert/Update:
//   parseNote(note) -> walk-in/origem/vendedor (93%, sem Gemini)
//   upsert shopmonkey_appointment
//   ponte: customer -> telefone -> lead na Kommo -> escreve CF "Vendedor shopmonkey"
//          -> propaga pro lead_db.sales_person_id (só vazio/sentinela/genérico).
//
// Segurança: como verify_jwt=false, exige ?token=<SHOPMONKEY_WEBHOOK_SECRET>.
// Sempre responde 200 (mesmo em erro parcial) pra não entrar em estado de erro no
// ShopMonkey; o cron sync-seller-to-kommo é a rede de segurança p/ o que escapar.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';
import { parseNote } from '../_shared/parse-note.ts';
import { canonicalSeller } from '../_shared/canonical-seller.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const SM = 'https://api.shopmonkey.cloud';
const CF = 1823653;
const GENERIC = 'Pro Car Sound & Security';
const SENTINEL = /registrad|no notes/i;
const digits = (s: string) => (s || '').replace(/\D/g, '');
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// Extrai o objeto do agendamento do payload (defensivo a variações de formato).
function pickAppointment(payload: any): any {
  const cands = [payload, payload?.data, payload?.appointment, payload?.record, payload?.row, payload?.body];
  for (const c of cands) {
    const o = Array.isArray(c) ? c[0] : c;
    if (o && (o.startDate || o.note !== undefined || o.customerId || o.color)) return o;
  }
  return Array.isArray(payload?.data) ? payload.data[0] : null;
}

async function bridgeSeller(supabase: any, smH: any, kH: any, KB: string, customerId: string, seller: string) {
  let cf = 0, prop = 0;
  const cr = await fetch(`${SM}/v3/customer/${customerId}`, { headers: smH });
  if (!cr.ok) return { cf, prop, reason: `customer ${cr.status}` };
  const cd = await cr.json(); const d = cd.data ?? cd;
  let phone: string | null = null;
  const pn = d.phoneNumbers;
  if (Array.isArray(pn) && pn.length) phone = (typeof pn[0] === 'object' ? pn[0].number : pn[0]);
  else if (typeof d.phone === 'string') phone = d.phone;
  if (!phone) return { cf, prop, reason: 'no phone' };
  const ph = digits(phone).slice(-10);

  const kr = await fetch(`${KB}/contacts?query=${ph}&with=leads`, { headers: kH });
  if (!kr.ok) return { cf, prop, reason: `kommo ${kr.status}` };
  const kd = await kr.json();
  const leadIds = [...new Set((kd?._embedded?.contacts ?? []).flatMap((c: any) => (c?._embedded?.leads ?? []).map((l: any) => l.id)))];

  for (const lid of leadIds) {
    const lr = await fetch(`${KB}/leads/${lid}`, { headers: kH });
    if (!lr.ok) continue;
    const lead = await lr.json();
    const cfv = (lead.custom_fields_values ?? []).find((c: any) => c.field_id === CF);
    const cur: string | null = cfv?.values?.[0]?.value ?? null;
    if (!cur || SENTINEL.test(cur)) {
      const pr = await fetch(`${KB}/leads/${lid}`, {
        method: 'PATCH', headers: kH,
        body: JSON.stringify({ custom_fields_values: [{ field_id: CF, values: [{ value: seller }] }] }),
      });
      if (pr.ok) cf++;
    }
    for (const apply of [
      (q: any) => q.eq('source_system', 'kommo_sync'),
      (q: any) => q.is('sales_person_id', null),
      (q: any) => q.eq('sales_person_id', GENERIC),
    ]) {
      const { data } = await apply(
        supabase.from('lead_db').update({ sales_person_id: seller }).eq('session_id', lid),
      ).select('session_id');
      prop += data?.length ?? 0;
    }
  }
  return { cf, prop };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const secret = Deno.env.get('SHOPMONKEY_WEBHOOK_SECRET');
    if (secret) {
      const token = new URL(req.url).searchParams.get('token') ?? req.headers.get('x-webhook-token');
      if (token !== secret) return json({ error: 'unauthorized' }, 401);
    }
    const payload = await req.json().catch(() => ({}));
    const a = pickAppointment(payload);
    if (!a || !a.id) return json({ ok: true, ignored: 'sem appointment no payload' });

    const smTok = Deno.env.get('SHOPMONKEY_API_TOKEN');
    const kTok = Deno.env.get('KOMMO_ACCESS_TOKEN');
    const sub = Deno.env.get('KOMMO_SUBDOMAIN');
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    // 1) upsert do agendamento (parseNote em código puro)
    const p = parseNote(a.note);
    const now = new Date().toISOString();
    await supabase.from('shopmonkey_appointment').upsert({
      id: a.id, start_date: a.startDate ?? null, end_date: a.endDate ?? null, color: a.color ?? null,
      customer_id: a.customerId ?? null, order_id: a.orderId ?? null, created_date: a.createdDate ?? null,
      note: a.note ?? null, walk_in: p.walkIn, source: p.source, seller: p.seller, synced_at: now,
    }, { onConflict: 'id' });

    // 2) ponte do vendedor (tempo real)
    const seller = canonicalSeller(p.seller);
    let bridge: any = { cf: 0, prop: 0, reason: 'sem vendedor/cliente' };
    if (seller && a.customerId && smTok && kTok && sub) {
      const smH = { Authorization: `Bearer ${smTok}`, 'User-Agent': 'procar-sync' };
      const kH = { Authorization: `Bearer ${kTok}`, 'Content-Type': 'application/json' };
      const KB = `https://${sub}.kommo.com/api/v4`;
      bridge = await bridgeSeller(supabase, smH, kH, KB, a.customerId, seller);
    }
    return json({ ok: true, appointment: a.id, seller, cf_written: bridge.cf, propagated: bridge.prop, reason: bridge.reason });
  } catch (e) {
    // 200 de propósito: não queremos que o ShopMonkey marque o webhook como erro;
    // a falha fica logada e o cron de reconciliação cobre.
    return json({ ok: false, error: String(e instanceof Error ? e.message : e) }, 200);
  }
});

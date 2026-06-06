// sync-seller-to-kommo — mantém a ATRIBUIÇÃO DE VENDEDOR viva (keystone).
//
// O vendedor real só existe no note do agendamento ShopMonkey (parseNote, ~93%).
// Esta função faz a ponte para os leads de chat/Kommo, recorrente (cron):
//   shopmonkey_appointment(seller) -> ShopMonkey /v3/customer/{id} (telefone)
//   -> Kommo busca lead por telefone -> escreve o CF 1823653 "Vendedor shopmonkey"
//   -> propaga pro lead_db.sales_person_id.
// SEGURO: só preenche onde está VAZIO/SENTINELA (não sobrescreve nome correto);
// no lead_db só atualiza nulo/genérico/kommo_sync. Janela curta (days, default 3).
//
// Requer SHOPMONKEY_API_TOKEN, KOMMO_ACCESS_TOKEN (write), KOMMO_SUBDOMAIN.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';
import { canonicalSeller } from '../_shared/canonical-seller.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const SM = 'https://api.shopmonkey.cloud';
const CF = 1823653;                          // custom field "Vendedor shopmonkey"
const GENERIC = 'Pro Car Sound & Security';  // conta genérica da Kommo (não é vendedor)
const SENTINEL = /registrad|no notes/i;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const digits = (s: string) => (s || '').replace(/\D/g, '');
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const days = Math.max(1, Math.min(120, Number(body.days ?? 3)));

    const smTok = Deno.env.get('SHOPMONKEY_API_TOKEN');
    const kTok = Deno.env.get('KOMMO_ACCESS_TOKEN');
    const sub = Deno.env.get('KOMMO_SUBDOMAIN');
    if (!smTok || !kTok || !sub) return json({ error: 'Faltam SHOPMONKEY_API_TOKEN / KOMMO_ACCESS_TOKEN / KOMMO_SUBDOMAIN' }, 500);
    const KB = `https://${sub}.kommo.com/api/v4`;
    const smH = { Authorization: `Bearer ${smTok}`, 'User-Agent': 'procar-sync' };
    const kH = { Authorization: `Bearer ${kTok}`, 'Content-Type': 'application/json' };
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    // 1) agendamentos recentes c/ vendedor -> dedupe por cliente (vendedor do mais recente)
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const { data: appts, error: aerr } = await supabase
      .from('shopmonkey_appointment')
      .select('customer_id, seller, start_date')
      .not('seller', 'is', null).not('customer_id', 'is', null)
      .gte('start_date', since).order('start_date', { ascending: false });
    if (aerr) throw new Error('read appointments: ' + aerr.message);
    const custSeller = new Map<string, string>();
    for (const a of appts ?? []) if (!custSeller.has(a.customer_id)) custSeller.set(a.customer_id, a.seller);

    let cfWritten = 0, noMatch = 0, errors = 0;
    const leadSeller = new Map<number, string>(); // session_id -> vendedor (p/ propagar)

    for (const [cid, rawSeller] of custSeller) {
      const seller = canonicalSeller(rawSeller);
      if (!seller) continue;
      // ShopMonkey customer -> telefone
      let phone: string | null = null;
      try {
        const cr = await fetch(`${SM}/v3/customer/${cid}`, { headers: smH });
        if (cr.ok) {
          const cd = await cr.json(); const d = cd.data ?? cd;
          const pn = d.phoneNumbers;
          if (Array.isArray(pn) && pn.length) phone = (typeof pn[0] === 'object' ? pn[0].number : pn[0]);
          else if (typeof d.phone === 'string') phone = d.phone;
        }
      } catch { errors++; continue; }
      if (!phone) { noMatch++; continue; }
      const ph = digits(phone).slice(-10);

      // Kommo: busca lead por telefone
      let leadIds: number[] = [];
      try {
        const kr = await fetch(`${KB}/contacts?query=${ph}&with=leads`, { headers: kH });
        await sleep(130);
        if (kr.ok) {
          const kd = await kr.json();
          for (const c of kd?._embedded?.contacts ?? []) for (const l of c?._embedded?.leads ?? []) leadIds.push(l.id);
        }
      } catch { errors++; continue; }
      leadIds = [...new Set(leadIds)];
      if (!leadIds.length) { noMatch++; continue; }

      for (const lid of leadIds) {
        try {
          const lr = await fetch(`${KB}/leads/${lid}`, { headers: kH }); await sleep(130);
          if (!lr.ok) { errors++; continue; }
          const lead = await lr.json();
          const cf = (lead.custom_fields_values ?? []).find((c: any) => c.field_id === CF);
          const cur: string | null = cf?.values?.[0]?.value ?? null;
          leadSeller.set(lid, seller); // sempre propaga (a propagação só toca nulo/genérico)
          if (cur && !SENTINEL.test(cur)) continue; // já tem nome real -> não sobrescreve
          const pr = await fetch(`${KB}/leads/${lid}`, {
            method: 'PATCH', headers: kH,
            body: JSON.stringify({ custom_fields_values: [{ field_id: CF, values: [{ value: seller }] }] }),
          });
          await sleep(130);
          if (pr.ok) cfWritten++; else errors++;
        } catch { errors++; }
      }
    }

    // 2) propaga pro lead_db (só nulo / genérico / espelho kommo_sync)
    const bySeller = new Map<string, number[]>();
    for (const [lid, s] of leadSeller) { const arr = bySeller.get(s) ?? []; arr.push(lid); bySeller.set(s, arr); }
    let propagated = 0;
    for (const [seller, ids] of bySeller) {
      for (let i = 0; i < ids.length; i += 300) {
        const slice = ids.slice(i, i + 300);
        for (const cond of [
          (q: any) => q.eq('source_system', 'kommo_sync'),
          (q: any) => q.is('sales_person_id', null),
          (q: any) => q.eq('sales_person_id', GENERIC),
        ]) {
          const { data } = await cond(
            supabase.from('lead_db').update({ sales_person_id: seller }).in('session_id', slice),
          ).select('session_id');
          propagated += data?.length ?? 0;
        }
      }
    }

    return json({
      window_days: days,
      customers: custSeller.size,
      cf_written: cfWritten,
      leads_propagated: propagated,
      no_match: noMatch,
      errors,
      note: 'Ponte ShopMonkey->Kommo->lead_db do vendedor. Só preenche vazio/sentinela; não sobrescreve nome correto.',
    });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});

// kommo-lead-webhook — recebe o WEBHOOK do Kommo de MUDANÇA DE LEAD (status,
// update, add) e atualiza o lead_db EM TEMPO REAL (etapa/sales_status, motivo de
// perda/loss_reason, tag absoluto). Tira a dependência do sync horário para essas
// mudanças. Reusa a lógica do sync-kommo, mas só para os leads do evento.
//
// Kommo envia application/x-www-form-urlencoded com chaves aninhadas, ex.:
//   leads[status][0][id]=123&leads[status][0][status_id]=456&leads[status][0][pipeline_id]=789
// Também aceita JSON { "lead_id": 123 } ou { "lead_ids": [..] } (p/ testes/n8n).
//
// Reusa KOMMO_ACCESS_TOKEN + KOMMO_SUBDOMAIN (mesmos secrets do sync-kommo).
// Segurança opcional: se KOMMO_WEBHOOK_SECRET estiver setado, exige ?s=<secret>.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';
import { canonicalSeller } from '../_shared/canonical-seller.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function channelFromPipeline(name: string): string {
  const n = (name || '').toLowerCase();
  if (n.includes('instagram')) return 'instagram';
  if (n.includes('whatsapp')) return 'whatsapp';
  if (n.includes('meta')) return 'meta ads';
  if (n.includes('mail')) return 'email';
  if (n.includes('parceria')) return 'indicação';
  return 'outros';
}
const CHANNEL_BY_SOURCE: Record<number, string> = {
  23036455: 'whatsapp', 23036209: 'whatsapp', 19009411: 'whatsapp', 19009467: 'whatsapp',
  23036387: 'whatsapp', 23036383: 'whatsapp', 23036243: 'whatsapp',
  19337407: 'instagram', 19337411: 'instagram', 19009471: 'facebook',
};
const VENDEDOR_SHOPMONKEY_CF = 1823653;
function cfValue(l: any, fieldId: number): string | null {
  for (const c of (l.custom_fields_values ?? [])) {
    if (c.field_id === fieldId) {
      const v = (c.values ?? [])[0]?.value;
      return v != null ? String(v) : null;
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    // Segurança opcional por shared-secret na query (?s=...).
    const secret = Deno.env.get('KOMMO_WEBHOOK_SECRET');
    if (secret) {
      const url = new URL(req.url);
      if (url.searchParams.get('s') !== secret) return json({ error: 'forbidden' }, 403);
    }

    // ---- extrai os ids de lead afetados (form-encoded do Kommo OU JSON) ----
    const ctype = req.headers.get('content-type') || '';
    const ids = new Set<number>();
    if (ctype.includes('application/json')) {
      const b = await req.json().catch(() => ({} as any));
      // diag: devolve só o subdomínio (público) p/ montar a URL do Kommo
      if (b.diag === true) {
        return json({ subdomain: Deno.env.get('KOMMO_SUBDOMAIN') ?? null, has_token: !!Deno.env.get('KOMMO_ACCESS_TOKEN') });
      }
      // admin: lista / cria / remove webhook no Kommo via API (mais confiável que a UI).
      if (b.list_webhooks === true || b.setup_webhook === true || b.delete_webhook != null) {
        const token = Deno.env.get('KOMMO_ACCESS_TOKEN');
        const sub = Deno.env.get('KOMMO_SUBDOMAIN');
        if (!token || !sub) return json({ error: 'faltam credenciais' }, 500);
        const kb = `https://${sub}.kommo.com/api/v4`;
        const kh = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
        if (b.list_webhooks === true) {
          const r = await fetch(`${kb}/webhooks`, { headers: kh });
          return json({ list: true, status: r.status, body: await r.json().catch(() => null) });
        }
        if (b.delete_webhook != null) {
          const r = await fetch(`${kb}/webhooks`, { method: 'DELETE', headers: kh, body: JSON.stringify({ destination: b.delete_webhook }) });
          return json({ deleted: true, status: r.status, body: await r.text() });
        }
        const dest = b.destination || 'https://barssssarrijyfzbwxep.supabase.co/functions/v1/kommo-lead-webhook';
        const events = Array.isArray(b.events) && b.events.length ? b.events : ['add_lead', 'status_lead'];
        const r = await fetch(`${kb}/webhooks`, { method: 'POST', headers: kh, body: JSON.stringify({ destination: dest, settings: events }) });
        return json({ setup: true, status: r.status, destination: dest, events, body: await r.json().catch(() => null) });
      }
      if (b.lead_id != null) ids.add(Number(b.lead_id));
      for (const x of (Array.isArray(b.lead_ids) ? b.lead_ids : [])) ids.add(Number(x));
    } else {
      const text = await req.text();
      const params = new URLSearchParams(text);
      for (const [k, v] of params) {
        if (/^leads\[(status|update|add)\]\[\d+\]\[id\]$/.test(k)) ids.add(Number(v));
      }
    }
    const leadIds = [...ids].filter((n) => Number.isFinite(n) && n > 0);
    // Kommo manda um "ping" ao salvar o webhook — responder 200 sem ids é o esperado.
    if (!leadIds.length) return json({ ok: true, received: true, note: 'sem ids de lead' });

    const token = Deno.env.get('KOMMO_ACCESS_TOKEN');
    const sub = Deno.env.get('KOMMO_SUBDOMAIN');
    if (!token || !sub) return json({ error: 'Faltam KOMMO_ACCESS_TOKEN / KOMMO_SUBDOMAIN' }, 500);
    const base = `https://${sub}.kommo.com/api/v4`;
    const kh = { Authorization: `Bearer ${token}` };
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    // mapa status_id -> {pipeline, status} (1 chamada)
    const statusMap = new Map<number, { pipeline: string; status: string }>();
    const pipes = await fetch(`${base}/leads/pipelines`, { headers: kh }).then((r) => r.ok ? r.json() : null).catch(() => null);
    for (const p of pipes?._embedded?.pipelines ?? []) {
      for (const s of p?._embedded?.statuses ?? []) statusMap.set(s.id, { pipeline: p.name, status: s.name });
    }

    let updated = 0, inserted = 0, errors = 0;
    const results: any[] = [];
    for (const id of leadIds) {
      try {
        const lr = await fetch(`${base}/leads/${id}?with=loss_reason,source_id`, { headers: kh });
        if (!lr.ok) { errors++; results.push({ id, error: `GET ${lr.status}` }); continue; }
        const l = await lr.json();
        const st = statusMap.get(l.status_id);
        const statusName = st?.status ?? null;
        const channel = (l.source_id != null ? CHANNEL_BY_SOURCE[l.source_id] : undefined) ?? channelFromPipeline(st?.pipeline ?? '');
        const seller = canonicalSeller(cfValue(l, VENDEDOR_SHOPMONKEY_CF));
        const isAbsoluto = (l?._embedded?.tags ?? []).some((t: any) => /absoluto/i.test(t?.name ?? ''));
        const lossReason: string | null = l?._embedded?.loss_reason?.[0]?.name ?? null;

        const { data: existing } = await supabase.from('lead_db').select('session_id, sales_status').eq('session_id', id).maybeSingle();

        if (existing) {
          // Atualiza só o que muda em tempo real; NÃO clobbera enriquecimento (seller/canal só se vier).
          const upd: Record<string, unknown> = {};
          if (statusName) upd.sales_status = statusName;
          if (lossReason) upd.loss_reason = lossReason;
          if (isAbsoluto) upd.is_absoluto = true;
          if (seller) upd.sales_person_id = seller;
          if (Object.keys(upd).length) {
            const { error } = await supabase.from('lead_db').update(upd).eq('session_id', id);
            if (error) { errors++; results.push({ id, error: error.message }); continue; }
            // histórico da mudança de etapa (rastreabilidade)
            if (statusName && existing.sales_status !== statusName) {
              await supabase.from('lead_history').insert({
                session_id: id, field_name: 'sales_status', old_value: existing.sales_status,
                new_value: statusName, changed_by: 'kommo-webhook', change_source: 'webhook',
              });
            }
          }
          updated++;
          results.push({ id, action: 'updated', sales_status: statusName, loss_reason: lossReason });
        } else {
          const { error } = await supabase.from('lead_db').insert({
            session_id: id,
            channel: channel ?? null,
            sales_status: statusName,
            loss_reason: lossReason,
            is_absoluto: isAbsoluto,
            sales_person_id: seller,
            source_system: 'kommo_webhook',
            created_at: l.created_at ? new Date(l.created_at * 1000).toISOString() : new Date().toISOString(),
          });
          if (error) { errors++; results.push({ id, error: error.message }); continue; }
          inserted++;
          results.push({ id, action: 'inserted', sales_status: statusName });
        }
      } catch (e) {
        errors++;
        results.push({ id, error: String(e instanceof Error ? e.message : e) });
      }
    }

    return json({ ok: true, leadIds, updated, inserted, errors, results });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});

// _shared/meta-capi.ts — envia eventos de conversão ao Meta (Conversions API) a partir
// do Supabase. Rota B: a "fonte de verdade" (pedido pago / agendamento) dispara aqui,
// sem depender dos webhooks antigos do n8n.
//
// - Idempotente: dedup por event_id (= "<Evento>:<sourceId>") via tabela meta_capi_event.
// - Match: telefone SEMPRE; email quando o lead tiver; + nome/cidade/estado/país/zip;
//   external_id (customer). Tudo SHA-256 normalizado (lower+trim), padrão do Meta.
// - Atribuição WhatsApp: ctwa_clid/fbc/fbp da ponte meta_click (lookup por telefone).
// - value em USD (valueCents/100) — NÃO mais centavos. action_source = physical_store.
//
// Secrets: META_CAPI_TOKEN, META_PIXEL_ID. Nunca lança (retorna objeto de resultado).

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const GRAPH = 'https://graph.facebook.com/v20.0';

const onlyDigits = (v: string) => (v || '').replace(/\D/g, '');
const last10 = (v: string) => onlyDigits(v).slice(-10);

async function sha256(value: string): Promise<string> {
  const norm = value.trim().toLowerCase();
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(norm));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface CapiInput {
  eventName: 'Purchase' | 'Lead' | 'Schedule';
  sourceId: string;            // id do pedido/agendamento -> chave de dedup
  eventTimeIso?: string;       // default: agora
  valueCents?: number | null;  // Purchase: valor pago em centavos
  currency?: string;           // default USD
  phone?: string | null;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;     // 2 letras (ex.: us)
  zip?: string | null;
  customerId?: string | null;
  actionSource?: string;       // default physical_store
}

export interface CapiResult {
  event_id: string;
  ok?: boolean;
  dedup?: boolean;
  skip?: string;
  matched_ctwa?: boolean;
  error?: string;
}

// Extrai os campos de match (telefone/email/nome/endereço) de um customer do ShopMonkey.
export function shopmonkeyCustomerToMatch(c: any): Record<string, string | null> {
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
}

export async function sendCapiEvent(sb: SupabaseClient, input: CapiInput): Promise<CapiResult> {
  const token = Deno.env.get('META_CAPI_TOKEN');
  const pixel = Deno.env.get('META_PIXEL_ID');
  const eventId = `${input.eventName}:${input.sourceId}`;
  if (!token || !pixel) return { event_id: eventId, skip: 'sem META_CAPI_TOKEN/META_PIXEL_ID' };

  try {
    // Dedup: se já enviado com sucesso, não reenvia.
    const { data: existing } = await sb
      .from('meta_capi_event').select('status').eq('event_id', eventId).maybeSingle();
    if (existing?.status === 'sent') return { event_id: eventId, dedup: true };

    const phoneDigits = input.phone ? onlyDigits(input.phone) : null;
    const phoneKey = input.phone ? last10(input.phone) : null;

    // Ponte de atribuição: telefone -> click-id do anúncio.
    let ctwa: string | null = null, fbc: string | null = null, fbp: string | null = null;
    if (phoneKey) {
      const { data: click } = await sb
        .from('meta_click').select('ctwa_clid,fbc,fbp').eq('phone_normalized', phoneKey).maybeSingle();
      ctwa = click?.ctwa_clid ?? null; fbc = click?.fbc ?? null; fbp = click?.fbp ?? null;
    }

    // user_data (Advanced Matching) — hasheado.
    const ud: Record<string, unknown> = {};
    if (phoneDigits) ud.ph = [await sha256(phoneDigits)];
    if (input.email) ud.em = [await sha256(input.email)];
    if (input.firstName) ud.fn = [await sha256(input.firstName)];
    if (input.lastName) ud.ln = [await sha256(input.lastName)];
    if (input.city) ud.ct = [await sha256(input.city)];
    if (input.state) ud.st = [await sha256(input.state)];
    if (input.country) ud.country = [await sha256(input.country)];
    if (input.zip) ud.zp = [await sha256(input.zip)];
    if (input.customerId) ud.external_id = [await sha256(String(input.customerId))];
    // Click-ids NÃO se hasheia.
    if (ctwa) ud.ctwa_clid = ctwa;
    if (fbc) ud.fbc = fbc;
    if (fbp) ud.fbp = fbp;

    // Meta RECUSA event_time no futuro (erro 100 "data e hora do evento no futuro").
    // Clampa ao "agora" no teto para nunca enviar timestamp futuro — ex.: Schedule cujo
    // event_time venha da data do agendamento (à frente). Os callers já passam o momento
    // da MARCAÇÃO (createdDate, passado); o clamp é a rede de segurança.
    const nowSec = Math.floor(Date.now() / 1000);
    const rawSec = Math.floor(new Date(input.eventTimeIso ?? new Date().toISOString()).getTime() / 1000);
    const eventTime = Math.min(rawSec, nowSec);
    const event: Record<string, unknown> = {
      event_name: input.eventName,
      event_time: eventTime,
      event_id: eventId,
      action_source: input.actionSource ?? 'physical_store',
      user_data: ud,
    };
    if (input.eventName === 'Purchase') {
      event.custom_data = {
        currency: input.currency ?? 'USD',
        value: Number((((input.valueCents ?? 0)) / 100).toFixed(2)),
      };
    }

    const res = await fetch(`${GRAPH}/${pixel}/events?access_token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [event] }),
    });
    const respJson = await res.json().catch(() => ({}));
    const ok = res.ok && !(respJson as any)?.error;

    await sb.from('meta_capi_event').upsert({
      event_id: eventId,
      event_name: input.eventName,
      source_id: input.sourceId,
      customer_id: input.customerId ?? null,
      phone_normalized: phoneKey,
      value_cents: input.valueCents ?? null,
      matched_ctwa: !!ctwa,
      has_email: !!input.email,
      status: ok ? 'sent' : 'error',
      fb_trace_id: (respJson as any)?.fbtrace_id ?? null,
      response: respJson,
      created_at: new Date().toISOString(),
    }, { onConflict: 'event_id' });

    console.log(`[meta-capi] ${eventId} ok=${ok} ctwa=${!!ctwa} email=${!!input.email}`);
    return { event_id: eventId, ok, matched_ctwa: !!ctwa, error: ok ? undefined : JSON.stringify((respJson as any)?.error ?? respJson) };
  } catch (e) {
    return { event_id: eventId, ok: false, error: String(e instanceof Error ? e.message : e) };
  }
}

// sync-kommo — espelha no lead_db os leads da Kommo que faltam (código puro,
// rumo a aposentar o n8n). SOMENTE INSERÇÃO (ignoreDuplicates por session_id):
// adiciona os leads ausentes e NUNCA sobrescreve os que o chat/IA já enriqueceu.
//
// VENDEDOR: usa o custom field 1823653 "Vendedor shopmonkey" (ÚNICO campo de
// vendedor na Kommo). O responsible_user_id é 100% a conta genérica "Pro Car
// Sound & Security" e NÃO carrega vendedor, por isso é ignorado. O valor é
// normalizado por canonicalSeller; o sentinela "Não registrado no notes do
// agendamento" vira NULL (não identificado). Cobertura desse campo é baixa (~2%);
// a fonte boa de vendedor é shopmonkey_appointment (parseNote dos notes, ~93%),
// usada na aba Vendedores via get_sellers_shopmonkey_kpis.
//
// Mapeamentos: pipeline -> canal (Instagram/Whatsapp/Meta Ads/E-mail/Parcerias=
// indicação/outros); status_id -> sales_status (142="Venda ganha"); "Cliente na
// loja" -> is_walking. Reusa KOMMO_ACCESS_TOKEN + KOMMO_SUBDOMAIN.

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

// CF "Vendedor shopmonkey" — único campo de vendedor da Kommo.
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
    const body = await req.json().catch(() => ({}));
    const days = Math.max(1, Math.min(120, Number(body.days ?? 14)));

    const token = Deno.env.get('KOMMO_ACCESS_TOKEN');
    const subdomain = Deno.env.get('KOMMO_SUBDOMAIN');
    if (!token || !subdomain) return json({ error: 'Faltam KOMMO_ACCESS_TOKEN / KOMMO_SUBDOMAIN' }, 500);
    const base = `https://${subdomain}.kommo.com/api/v4`;
    const kh = { Authorization: `Bearer ${token}` };
    const kget = async (path: string) => {
      const r = await fetch(`${base}${path}`, { headers: kh });
      if (r.status === 204) return null;
      if (!r.ok) throw new Error(`Kommo ${r.status} ${path}: ${await r.text()}`);
      return r.json();
    };

    // ---- mapa status_id -> {pipeline, status} ----
    const statusMap = new Map<number, { pipeline: string; status: string }>();
    const pipes = await kget('/leads/pipelines');
    for (const p of pipes?._embedded?.pipelines ?? []) {
      for (const s of p?._embedded?.statuses ?? []) {
        statusMap.set(s.id, { pipeline: p.name, status: s.name });
      }
    }

    // ---- leads criados na janela (a lista já traz custom_fields_values) ----
    const fromUnix = Math.floor((Date.now() - days * 86400000) / 1000);
    const leads: any[] = [];
    let page = 1;
    while (page <= 60) {
      const d = await kget(`/leads?filter[created_at][from]=${fromUnix}&limit=250&page=${page}`);
      const batch = d?._embedded?.leads ?? [];
      if (!batch.length) break;
      leads.push(...batch);
      if (!d?._links?.next) break;
      page++;
    }

    const rows = leads.map((l) => {
      const st = statusMap.get(l.status_id);
      const statusName = st?.status ?? null;
      const channel = channelFromPipeline(st?.pipeline ?? '');
      return {
        session_id: l.id,
        channel,
        sales_status: statusName,
        lead_price: l.price ? Number(l.price) : null,
        sales_person_id: canonicalSeller(cfValue(l, VENDEDOR_SHOPMONKEY_CF)),
        is_walking: (statusName ?? '').toLowerCase().includes('loja'),
        created_at: new Date((l.created_at ?? 0) * 1000).toISOString(),
        source_system: 'kommo_sync',
      };
    });

    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    // 1) INSERT-ONLY: só adiciona os que faltam, nunca sobrescreve (ignoreDuplicates).
    let inserted = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { data, error } = await supabase
        .from('lead_db')
        .upsert(chunk, { onConflict: 'session_id', ignoreDuplicates: true })
        .select('session_id');
      if (error) throw new Error('upsert lead_db: ' + error.message);
      inserted += data?.length ?? 0;
    }

    // 2) Atualiza o VENDEDOR dos espelhos já existentes — restrito a
    //    source_system='kommo_sync', então NUNCA toca em leads de chat/IA. Torna o
    //    re-run idempotente: corrige sales_person_id de quem já estava inserido (ex.:
    //    valores antigos vindos do responsible_user genérico). Agrupa por vendedor
    //    para poucas queries.
    const bySeller = new Map<string | null, number[]>();
    for (const r of rows) {
      const arr = bySeller.get(r.sales_person_id) ?? [];
      arr.push(r.session_id);
      bySeller.set(r.sales_person_id, arr);
    }
    let sellersSet = 0;
    for (const [seller, ids] of bySeller) {
      for (let i = 0; i < ids.length; i += 300) {
        const slice = ids.slice(i, i + 300);
        const { data, error } = await supabase
          .from('lead_db')
          .update({ sales_person_id: seller })
          .eq('source_system', 'kommo_sync')
          .in('session_id', slice)
          .select('session_id');
        if (error) throw new Error('update seller: ' + error.message);
        sellersSet += data?.length ?? 0;
      }
    }

    return json({
      window_days: days,
      kommo_leads: leads.length,
      inserted_missing: inserted,
      already_present: leads.length - inserted,
      leads_com_vendedor: rows.filter((r) => r.sales_person_id).length,
      espelhos_normalizados: sellersSet,
      note: 'Insert-only dos ausentes + normalização de vendedor nos espelhos (kommo_sync). Leads de chat/IA não foram alterados.',
    });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});

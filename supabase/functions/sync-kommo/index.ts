// sync-kommo — espelha no lead_db os leads da Kommo que faltam (código puro,
// rumo a aposentar o n8n). SOMENTE INSERÇÃO (ignoreDuplicates por session_id):
// adiciona os leads ausentes e NUNCA sobrescreve os que o chat/IA já enriqueceu.
//
// Mapeamentos (verificados na Kommo):
//   pipeline -> canal: Instagram/Whatsapp/Meta Ads/E-mail/Parcerias(indicação)/outros.
//   status_id -> sales_status (nome do status); 142="Venda ganha", 143="perdida".
//   "Cliente na loja" -> is_walking=true.  responsible_user_id -> vendedor.
//
// Reusa KOMMO_ACCESS_TOKEN + KOMMO_SUBDOMAIN (mesmos do sync-to-kommo).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

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

    // ---- mapas: status_id -> {pipeline, status}; user_id -> nome ----
    const statusMap = new Map<number, { pipeline: string; status: string }>();
    const pipes = await kget('/leads/pipelines');
    for (const p of pipes?._embedded?.pipelines ?? []) {
      for (const s of p?._embedded?.statuses ?? []) {
        statusMap.set(s.id, { pipeline: p.name, status: s.name });
      }
    }
    const userMap = new Map<number, string>();
    const users = await kget('/users?limit=250');
    for (const u of users?._embedded?.users ?? []) userMap.set(u.id, u.name);

    // ---- leads criados na janela ----
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
        sales_person_id: l.responsible_user_id ? (userMap.get(l.responsible_user_id) ?? String(l.responsible_user_id)) : null,
        is_walking: (statusName ?? '').toLowerCase().includes('loja'),
        created_at: new Date((l.created_at ?? 0) * 1000).toISOString(),
        source_system: 'kommo_sync',
      };
    });

    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    // INSERT-ONLY: só adiciona os que faltam, nunca sobrescreve (ignoreDuplicates).
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

    return json({
      window_days: days,
      kommo_leads: leads.length,
      inserted_missing: inserted,
      already_present: leads.length - inserted,
      note: 'Apenas inserção dos leads ausentes (insert-only). Leads existentes não foram alterados.',
    });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});

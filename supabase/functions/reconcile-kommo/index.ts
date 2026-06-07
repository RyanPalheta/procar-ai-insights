// reconcile-kommo — Protótipo de RECONCILIAÇÃO Kommo × lead_db.
//
// Quantifica o gargalo central da auditoria: o dashboard (lead_db) é um
// subconjunto da Kommo (só leads de chat). Esta função, para um intervalo de
// datas, conta os leads criados na Kommo (paginando a API v4) e compara com a
// contagem do lead_db, devolvendo o gap total e a distribuição por etapa.
//
// READ-ONLY: só lê a Kommo (GET) e o lead_db (count). Não escreve em lugar nenhum.
// Reusa as mesmas credenciais do sync-to-kommo: KOMMO_ACCESS_TOKEN + KOMMO_SUBDOMAIN.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    // Sem intervalo explícito (ex.: cron diário com body vazio): janela móvel —
    // default 30 dias, sobrescritível por window_days. Mantém compat com chamadas
    // que passam date_from/date_to ISO explícitos.
    const winDays = Math.max(1, Math.min(120, Number(body.window_days ?? 30)));
    const date_to = body.date_to ?? new Date().toISOString();
    const date_from = body.date_from ?? new Date(Date.now() - winDays * 86400000).toISOString();

    const token = Deno.env.get('KOMMO_ACCESS_TOKEN');
    const subdomain = Deno.env.get('KOMMO_SUBDOMAIN');
    if (!token || !subdomain) {
      return json({ error: 'Faltam KOMMO_ACCESS_TOKEN / KOMMO_SUBDOMAIN no ambiente das functions' }, 500);
    }
    const base = `https://${subdomain}.kommo.com/api/v4`;
    const authHeaders = { Authorization: `Bearer ${token}` };

    const fromUnix = Math.floor(new Date(date_from).getTime() / 1000);
    const toUnix = Math.floor(new Date(date_to).getTime() / 1000);

    // ---- mapa status_id -> nome (pipelines) p/ rotular a distribuição ----
    const statusNames: Record<string, string> = {};
    try {
      const pres = await fetch(`${base}/leads/pipelines`, { headers: authHeaders });
      if (pres.ok) {
        const pdata = await pres.json();
        for (const p of pdata?._embedded?.pipelines ?? []) {
          for (const s of p?._embedded?.statuses ?? []) {
            statusNames[String(s.id)] = `${p.name} / ${s.name}`;
          }
        }
      }
    } catch { /* nomes são opcionais */ }

    // ---- Kommo: pagina os leads criados no intervalo ----
    let kommoTotal = 0;
    const byStatus: Record<string, number> = {};
    let page = 1;
    const MAX_PAGES = 100; // 250 * 100 = 25k leads (trava de segurança)
    let truncated = false;
    while (true) {
      const url =
        `${base}/leads?filter[created_at][from]=${fromUnix}&filter[created_at][to]=${toUnix}` +
        `&limit=250&page=${page}`;
      const res = await fetch(url, { headers: authHeaders });
      if (res.status === 204) break; // sem conteúdo
      if (!res.ok) {
        return json({ error: `Kommo API retornou ${res.status}`, detail: await res.text() }, 502);
      }
      const data = await res.json();
      const leads = data?._embedded?.leads ?? [];
      if (leads.length === 0) break;
      for (const l of leads) {
        kommoTotal++;
        const key = String(l.status_id);
        byStatus[key] = (byStatus[key] || 0) + 1;
      }
      if (!data?._links?.next) break;
      page++;
      if (page > MAX_PAGES) { truncated = true; break; }
    }

    // ---- Dashboard: lead_db no mesmo intervalo ----
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    const dbCount = async (auditedOnly: boolean) => {
      let q = supabase
        .from('lead_db')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', date_from)
        .lte('created_at', date_to)
        .not('is_duplicate', 'is', true);   // dedup chat<->Kommo (fase 2): nao conta os espelhos marcados
      if (auditedOnly) q = q.not('last_ai_update', 'is', null);
      const { count, error } = await q;
      if (error) throw new Error(`lead_db: ${error.message}`);
      return count ?? 0;
    };
    const dashboardTotal = await dbCount(false);
    const dashboardAudited = await dbCount(true);

    const gap = kommoTotal - dashboardTotal;
    const gap_pct = kommoTotal > 0 ? Math.round((gap / kommoTotal) * 1000) / 10 : null;

    // Persiste 1 snapshot/dia (upsert por captured_day) para o card "Saúde da base"
    // acompanhar a convergência ao longo do tempo. Best-effort: não quebra a resposta.
    try {
      await supabase.from('kommo_reconciliation_snapshot').upsert({
        captured_day: new Date().toISOString().slice(0, 10),
        captured_at: new Date().toISOString(),
        window_days: Math.max(1, Math.round((new Date(date_to).getTime() - new Date(date_from).getTime()) / 86400000)),
        date_from,
        date_to,
        kommo_total: kommoTotal,
        dashboard_total: dashboardTotal,
        dashboard_audited: dashboardAudited,
        gap,
        gap_pct,
      }, { onConflict: 'captured_day' });
    } catch (_) { /* snapshot é best-effort */ }

    const byStatusLabeled = Object.entries(byStatus)
      .map(([id, count]) => ({ status_id: Number(id), label: statusNames[id] ?? `status ${id}`, count }))
      .sort((a, b) => b.count - a.count);

    return json({
      range: { date_from, date_to },
      kommo: { total: kommoTotal, by_status: byStatusLabeled, truncated },
      dashboard: { total: dashboardTotal, audited: dashboardAudited },
      gap,
      gap_pct: kommoTotal > 0 ? Math.round((gap / kommoTotal) * 1000) / 10 : null,
      note:
        'kommo.total = leads criados no período na Kommo. dashboard.total = linhas no lead_db. ' +
        'gap = leads que existem na Kommo mas NÃO no dashboard (positivo = subcontagem do BI). ' +
        'dashboard.audited = subconjunto auditado pela IA (last_ai_update).',
    });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});

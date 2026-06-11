// backfill-lead-language — preenche lead_db.lead_language (PT-BR/EN-USA/ES-ES) dos
// leads que têm mensagens mas ficaram sem idioma, usando o detector por código
// (detect-language). Idempotente: só toca quem está NULL/NDA. NUNCA sobrescreve
// idioma já preenchido. Inclui leads espelhados da Kommo (source_system='kommo_sync')
// cujo session_id casa com uma conversa ingerida — antes eram pulados e ficavam
// "Sem idioma" para sempre; quem não tem mensagem nenhuma simplesmente não detecta.
//
// POST { limit?: number } — processa até `limit` leads por chamada (default 1000).
// Retorna { candidates, detected, by_lang, remaining } p/ rodar em lotes / cron.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';
import { detectLanguage } from '../_shared/detect-language.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const MISSING = "lead_language.is.null,lead_language.in.(NDA,N/A,n/a,)";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    // CURSOR por session_id: varre TODOS os leads sem idioma uma vez, em lotes de 1000,
    // avançando além dos que não têm sinal (não re-processa os indetectáveis).
    let cursor = Number(body.after ?? 0);
    const maxBatches = Math.max(1, Math.min(20, Number(body.max_batches ?? 6)));

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    let candidates = 0, detected = 0;
    const counts: Record<string, number> = {};
    let done = false;

    for (let b = 0; b < maxBatches; b++) {
      // 1) próximo lote de leads de chat sem idioma (session_id > cursor)
      const { data: leads, error: leadErr } = await supabase
        .from('lead_db')
        .select('session_id')
        .or(MISSING)
        .gt('session_id', cursor)
        .order('session_id', { ascending: true })
        .limit(1000);
      if (leadErr) throw new Error('select leads: ' + leadErr.message);
      const ids = (leads ?? []).map((l: any) => l.session_id).filter((x: any) => x != null);
      if (!ids.length) { done = true; break; }
      candidates += ids.length;
      cursor = ids[ids.length - 1]; // avança o cursor além deste lote

      // 2) mensagens do CLIENTE (em sub-lotes de IN)
      const msgsBySession = new Map<number, string[]>();
      for (let i = 0; i < ids.length; i += 200) {
        const slice = ids.slice(i, i + 200);
        const { data: msgs, error: msgErr } = await supabase
          .from('interaction_db')
          .select('session_id, message_text, sender_type')
          .in('session_id', slice)
          .limit(20000);
        if (msgErr) throw new Error('select interactions: ' + msgErr.message);
        for (const m of msgs ?? []) {
          if (m.sender_type === 'agent') continue; // só cliente (client ou null)
          const arr = msgsBySession.get(m.session_id) ?? [];
          if (m.message_text) arr.push(m.message_text);
          msgsBySession.set(m.session_id, arr);
        }
      }

      // 3) detecta e agrupa por idioma
      const byLang: Record<string, number[]> = {};
      for (const [sid, texts] of msgsBySession) {
        const lang = detectLanguage(texts);
        if (lang) (byLang[lang] ??= []).push(sid);
      }

      // 4) atualiza (restrito a chat sem idioma; defensivo)
      for (const [lang, sids] of Object.entries(byLang)) {
        for (let i = 0; i < sids.length; i += 300) {
          const slice = sids.slice(i, i + 300);
          const { data, error } = await supabase
            .from('lead_db')
            .update({ lead_language: lang })
            .or(MISSING)
            .in('session_id', slice)
            .select('session_id');
          if (error) throw new Error('update lang: ' + error.message);
          const n = data?.length ?? 0;
          detected += n;
          counts[lang] = (counts[lang] ?? 0) + n;
        }
      }
    }

    // quantos ainda faltam sem idioma — após a varredura
    const { count: remaining } = await supabase
      .from('lead_db')
      .select('session_id', { count: 'exact', head: true })
      .or(MISSING);

    return json({ candidates, detected, by_lang: counts, done, next_after: done ? null : cursor, remaining: remaining ?? null });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Keyword-based product detection — zero LLM tokens.
// Canonical product name -> list of trigger keywords (case-insensitive substring match).
// Canonical names should match products.product_name in the DB so downstream
// (Kommo enum mapping, dashboards) recognises them.
const PRODUCT_KEYWORDS: Record<string, string[]> = {
  'Remote Start': [
    'remote start', 'remote starter', 'remote-start', 'partida remota', 'partida a distancia',
    'partida à distância', 'liga sozinho', 'controle remoto pra ligar', 'compustar', 'viper start',
  ],
  'CarPlay': [
    'carplay', 'car play', 'apple carplay', 'apple car play', 'android auto', 'sistema multimidia',
    'central multimidia', 'multimídia', 'head unit', 'head-unit', 'aftermarket unit',
    'aftermarket radio', 'screen upgrade', 'upgrade screen', 'upgrade radio', 'touch screen',
    'multimedia screen', 'pioneer dmh', 'pioneer 3000', 'pioneer avh', 'kenwood ddx',
    'kenwood dmx', 'sony xav', 'alpine ilx', 'atoto', 'double din',
  ],
  'Sound System': [
    // NÃO usar o token solto 'sound': a loja se chama "Pro Car Sound", então o
    // nome/assinatura/link casava em ~91% das conversas (falso positivo). Manter
    // só termos específicos de áudio.
    'sound system', ' som ', 'som automotivo', 'caixa de som', 'subwoofer', 'amplificador',
    'speaker', 'speakers', 'alto falante', 'alto-falante', 'alto-falantes', 'auto falante',
    'audio upgrade', 'audio system', ' sub ', ' sub.', ' sub,', 'sub and amp', 'sub & amp',
    ' amp ', ' amp.', ' amp,', 'amplifier', 'tweeter', 'tweeters', 'midrange', 'midbass',
    'crossover', 'enclosure', 'pillar pod', 'pillar pods', 'a-pillar', 'sound pod',
    'jl audio', 'kicker', 'rockford', 'rockford fosgate', 'hertz audio', 'hertz m', 'hertz mille',
    'focal audio', 'morel', 'audison', 'memphis audio', 'alpine type', 'alpine s-', 'alpine r-',
    'pioneer ts', 'kenwood ksc', 'jbl club', 'jbl gx', 'jbl stage',
  ],
  'Window Tint': [
    'window tint', ' tint ', 'tinted', 'tinting', 'insulfilm', 'pelicula', 'película',
    'pelicula automotiva', 'suntek', 'suntek carbon', 'suntek standart', 'suntek standard',
    'sunteck', 'llumar', 'ceramic pro', 'formula one', 'xpel', ' carbon ',
    '3m tint', 'window film', 'tonalizar vidro', 'escurecer vidro', 'ceramic tint',
    'ceramic film', 'shade', 'tint shade', 'vlt', 'darken windows',
  ],
  'Backup Camera': [
    'backup cam', 'backup camera', 'reverse camera', 'camera de re', 'câmera de ré',
    'camera de ré', 'camera traseira', 'rear camera', 'rearview camera', 'rear-view camera',
    'reversing camera',
  ],
  'Dashcam': [
    'dashcam', 'dash cam', 'dash-cam', 'camera de bordo', 'câmera de bordo', 'camera veicular',
    'camera frontal', 'front cam', 'thinkware', 'blackvue', 'viofo', 'nextbase',
  ],
  'Ambient Light': [
    'ambient light', 'ambient lights', 'ambient lighting', 'luz ambiente', 'iluminação ambiente',
    'iluminacao ambiente', 'luzes internas led', 'interior led', 'mood lighting', 'rgb interior',
  ],
  'LED Lights': [
    'led light', 'led lights', 'led headlight', 'led headlights', 'farol led', 'farois led',
    'faróis led', 'lampada led', 'lâmpada led', 'kit led', 'led bulb', 'led bulbs',
    'fog light', 'fog lights', 'underglow',
  ],
  'Key Programming': [
    'key copy', 'key programming', 'car key', 'copia de chave', 'cópia de chave',
    'programar chave', 'chave codificada', 'chave canivete', 'chave reserva',
    'spare key', 'key fob', 'fob programming', 'transponder key',
  ],
  'Labor': [
    ' labor ', 'mão de obra', 'mao de obra', 'instalação', 'instalacao', 'serviço de instalação',
    'install only', 'just install', 'installation cost',
  ],
};

interface ScanRequest {
  session_id?: number;            // single mode
  cursor_session_id?: number;     // batch mode pagination
  batch_size?: number;            // batch mode
  dry_run?: boolean;              // count only
  trigger_kommo_sync?: boolean;   // default true on real run; false for cheap scans
  overwrite?: boolean;            // default false (merge with existing services_detected)
  only_unscanned?: boolean;       // default true (skip leads that already have services_detected)
  newest_first?: boolean;         // default false; true = varre session_id DESC (mantém os recentes sempre frescos)
}

const DEFAULT_BATCH_SIZE = 50;
const MAX_DURATION_MS = 5 * 60 * 1000;

/**
 * Detects products mentioned in arbitrary text. Returns canonical product names.
 */
function detectProducts(text: string): string[] {
  if (!text) return [];
  // Pad with spaces so word-boundary keywords like " som " match at start/end too
  const lower = ` ${text.toLowerCase()} `;
  const matched = new Set<string>();
  for (const [product, keywords] of Object.entries(PRODUCT_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      matched.add(product);
    }
  }
  return Array.from(matched);
}

/**
 * Scans every interaction for a session and returns deduped product list.
 */
async function scanSessionProducts(
  supabase: any,
  sessionId: number
): Promise<{ detected: string[]; messages_scanned: number }> {
  const { data: interactions, error } = await supabase
    .from('interaction_db')
    .select('message_text')
    .eq('session_id', sessionId)
    .not('message_text', 'is', null);

  if (error) throw error;

  const all = new Set<string>();
  let scanned = 0;
  for (const row of interactions || []) {
    if (!row.message_text) continue;
    scanned++;
    detectProducts(row.message_text).forEach((p) => all.add(p));
  }
  return { detected: Array.from(all), messages_scanned: scanned };
}

/**
 * Merges new detection with existing services_detected (case-insensitive dedupe).
 * Returns the merged array, or null if nothing changes vs current.
 */
function mergeServices(current: string[] | null, detected: string[]): string[] | null {
  const seen = new Map<string, string>(); // lower -> original
  (current || []).forEach((s) => {
    if (s && !seen.has(s.toLowerCase())) seen.set(s.toLowerCase(), s);
  });
  let added = false;
  for (const d of detected) {
    if (!seen.has(d.toLowerCase())) {
      seen.set(d.toLowerCase(), d);
      added = true;
    }
  }
  if (!added && (current || []).length === Array.from(seen.values()).length) return null;
  return Array.from(seen.values());
}

async function processSingleLead(
  supabase: any,
  sessionId: number,
  opts: { overwrite: boolean; triggerKommo: boolean }
): Promise<{
  session_id: number;
  detected: string[];
  written: string[] | null;
  messages_scanned: number;
  kommo_synced: boolean;
  changed: boolean;
}> {
  const { data: lead, error: leadErr } = await supabase
    .from('lead_db')
    .select('session_id, service_desired, services_detected')
    .eq('session_id', sessionId)
    .single();
  if (leadErr || !lead) throw new Error(`lead ${sessionId} not found`);

  const { detected, messages_scanned } = await scanSessionProducts(supabase, sessionId);

  // Palavra-chave PRIMEIRO; se não achar nada, cai para o serviço primário que a
  // IA detectou (service_desired). Cobre os casos que o catálogo de keywords não
  // tem (ex.: ALPINE, REMOTE START, AMBIENT LIGHT). O canonical_product() da RPC
  // normaliza na leitura, então gravamos o texto cru da IA.
  let finalDetected = detected;
  const aiService = (lead.service_desired || '').trim();
  if (finalDetected.length === 0 && aiService) {
    finalDetected = [aiService];
  }

  const current = (lead.services_detected as string[] | null) ?? null;

  // Decide o que persistir. REGRA: nunca deixar services_detected NULL depois de
  // escanear — quando nada é detectado, gravamos [] para o lead SAIR da fila
  // only_unscanned (IS NULL) e o cron diário avançar (antes ele represava nos
  // leads antigos sem chat e nunca chegava nos recentes).
  let toWrite: string[];
  if (opts.overwrite) {
    toWrite = finalDetected; // pode ser []
  } else {
    const merged = mergeServices(current, finalDetected);
    if (merged) {
      toWrite = merged;
    } else if (current === null) {
      toWrite = finalDetected; // [] aqui — carimba como escaneado
    } else {
      // Já escaneado e nada novo -> no-op real.
      return {
        session_id: sessionId,
        detected: finalDetected,
        written: null,
        messages_scanned,
        kommo_synced: false,
        changed: false,
      };
    }
  }

  const updates: Record<string, any> = { services_detected: toWrite };
  // Keep service_desired in sync as primary (first) for backward compat, only if it's empty
  if (!lead.service_desired && toWrite.length > 0) {
    updates.service_desired = toWrite[0];
  }

  const { error: updErr } = await supabase
    .from('lead_db')
    .update(updates)
    .eq('session_id', sessionId);
  if (updErr) throw updErr;

  // Só sincroniza Kommo quando há produto de fato (pula os carimbos vazios).
  let kommoSynced = false;
  if (opts.triggerKommo && toWrite.length > 0) {
    try {
      await supabase.functions.invoke('sync-to-kommo', { body: { session_id: sessionId } });
      kommoSynced = true;
    } catch (err) {
      console.warn(`[scan-services] kommo sync failed for ${sessionId}:`, (err as any)?.message);
    }
  }

  return {
    session_id: sessionId,
    detected: finalDetected,
    written: toWrite,
    messages_scanned,
    kommo_synced: kommoSynced,
    changed: toWrite.length > 0,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const body = (await req.json().catch(() => ({}))) as ScanRequest;
    const dryRun = body.dry_run === true;
    const triggerKommo = body.trigger_kommo_sync !== false; // default true
    const overwrite = body.overwrite === true;
    const onlyUnscanned = body.only_unscanned !== false; // default true

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ---- Single-lead mode ----
    if (body.session_id) {
      const result = await processSingleLead(supabase, body.session_id, {
        overwrite,
        triggerKommo: !dryRun && triggerKommo,
      });
      return new Response(
        JSON.stringify({
          success: true,
          mode: 'single',
          dry_run: dryRun,
          ...result,
          duration_ms: Date.now() - startTime,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ---- Batch mode ----
    const batchSize = Math.min(body.batch_size || DEFAULT_BATCH_SIZE, 200);
    const newestFirst = body.newest_first === true;
    // Cursor é a fronteira de paginação. Ascendente parte de 0 (mais antigos);
    // descendente parte do topo (mais novos). O teto precisa caber no int4 do
    // session_id (usar MAX_SAFE_INTEGER estoura o tipo no Postgres -> 500).
    const INT4_MAX = 2147483647;
    const cursor = body.cursor_session_id ?? (newestFirst ? INT4_MAX : 0);

    let q = supabase
      .from('lead_db')
      .select('session_id', { count: 'exact' });
    q = newestFirst
      ? q.lt('session_id', cursor).order('session_id', { ascending: false })
      : q.gt('session_id', cursor).order('session_id', { ascending: true });
    q = q.limit(batchSize);

    if (onlyUnscanned) {
      q = q.is('services_detected', null);
    }

    const { data: leads, error: leadsErr, count } = await q;
    if (leadsErr) throw leadsErr;

    if (!leads || leads.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          mode: 'batch',
          done: true,
          message: 'No more leads to scan',
          total_remaining: count ?? 0,
          processed_this_run: 0,
          duration_ms: Date.now() - startTime,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (dryRun) {
      return new Response(
        JSON.stringify({
          success: true,
          mode: 'batch',
          dry_run: true,
          would_process: leads.length,
          total_remaining_estimate: count ?? leads.length,
          first_session_ids: leads.slice(0, 10).map((l) => l.session_id),
          last_session_id_in_batch: leads[leads.length - 1].session_id,
          duration_ms: Date.now() - startTime,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: Array<{ session_id: number; ok: boolean; changed?: boolean; detected?: string[]; error?: string }> = [];
    let lastProcessedId = cursor;

    for (const lead of leads) {
      if (Date.now() - startTime > MAX_DURATION_MS) {
        console.warn(`[scan-services] time ceiling at ${lastProcessedId}`);
        break;
      }
      try {
        const r = await processSingleLead(supabase, lead.session_id, { overwrite, triggerKommo });
        results.push({
          session_id: lead.session_id,
          ok: true,
          changed: r.changed,
          detected: r.detected,
        });
        lastProcessedId = lead.session_id;
      } catch (err: any) {
        results.push({ session_id: lead.session_id, ok: false, error: err.message?.substring(0, 200) });
        lastProcessedId = lead.session_id;
      }
    }

    // Audit
    await supabase.from('audit_logs').insert({
      event_type: 'scan_services_batch',
      function_name: 'scan-services',
      status: results.every((r) => r.ok) ? 'success' : 'partial',
      event_details: {
        cursor_in: cursor,
        cursor_out: lastProcessedId,
        attempted: results.length,
        succeeded: results.filter((r) => r.ok).length,
        changed: results.filter((r) => r.changed).length,
        failed: results.filter((r) => !r.ok).length,
        params: { onlyUnscanned, overwrite, triggerKommo },
      },
      execution_time_ms: Date.now() - startTime,
    }).then(() => {}, (e) => console.error('audit log error:', e));

    const moreAvailable = leads.length === batchSize;

    return new Response(
      JSON.stringify({
        success: true,
        mode: 'batch',
        done: !moreAvailable,
        processed_this_run: results.length,
        succeeded: results.filter((r) => r.ok).length,
        changed: results.filter((r) => r.changed).length,
        failed: results.filter((r) => !r.ok).length,
        next_cursor: lastProcessedId,
        sample_changes: results.filter((r) => r.changed).slice(0, 10),
        failures: results.filter((r) => !r.ok).slice(0, 10),
        hint: moreAvailable
          ? `Re-invoke with cursor_session_id=${lastProcessedId}`
          : 'Scan complete for given filters',
        duration_ms: Date.now() - startTime,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[scan-services] fatal:', error);
    return new Response(
      JSON.stringify({ error: error.message, duration_ms: Date.now() - startTime }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

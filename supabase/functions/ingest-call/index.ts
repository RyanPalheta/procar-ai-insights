import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Adiciona uma TAG ao lead na Kommo PRESERVANDO as existentes (o PATCH de tags
// substitui a lista; relemos e anexamos). session_id = id do lead na Kommo.
// Defensivo: 404/sem credencial -> 'skip', nunca lança.
async function addTagToKommo(leadId: number | string, tagName: string): Promise<'ok' | 'already' | 'skip' | 'error'> {
  const kTok = Deno.env.get('KOMMO_ACCESS_TOKEN');
  const sub = Deno.env.get('KOMMO_SUBDOMAIN');
  if (!kTok || !sub) return 'skip';
  const KB = `https://${sub}.kommo.com/api/v4`;
  const kH = { Authorization: `Bearer ${kTok}`, 'Content-Type': 'application/json' };
  const lr = await fetch(`${KB}/leads/${leadId}`, { headers: kH });
  if (lr.status === 404) return 'skip';
  if (!lr.ok) { console.error(`[ingest-call] GET lead ${leadId} ${lr.status}`); return 'error'; }
  const lead = await lr.json();
  const tags = lead?._embedded?.tags ?? [];
  if (tags.some((t: { name?: string }) => (t?.name ?? '').toLowerCase() === tagName.toLowerCase())) return 'already';
  const patchBody = { _embedded: { tags: [...tags.map((t: { id: number }) => ({ id: t.id })), { name: tagName }] } };
  const pr = await fetch(`${KB}/leads/${leadId}`, { method: 'PATCH', headers: kH, body: JSON.stringify(patchBody) });
  if (!pr.ok) { console.error(`[ingest-call] PATCH tag lead ${leadId} ${pr.status}: ${await pr.text()}`); return 'error'; }
  return 'ok';
}

const TWILIO_TAG = 'Ligação Twilio';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    console.log('Received call data:', JSON.stringify(body, null, 2));

    // BACKFILL: tagueia "Ligação Twilio" no Kommo em TODOS os leads vazios criados pela
    // integração de ligação (channel=phone, têm call_db, sem chat). Acionar uma vez com
    // { "backfill_twilio_tag": true }.
    if (body.backfill_twilio_tag === true) {
      const { data: ids, error: idsErr } = await supabase.rpc('get_integration_call_lead_ids');
      if (idsErr) {
        return new Response(JSON.stringify({ error: 'rpc falhou: ' + idsErr.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const all = (ids as { session_id: number }[]) ?? [];
      // Paginado p/ não estourar o timeout da edge function: offset/max por chamada.
      const offset = Math.max(0, Number(body.offset ?? 0));
      const max = Math.max(1, Math.min(150, Number(body.max ?? 120)));
      const slice = all.slice(offset, offset + max);
      let ok = 0, already = 0, skip = 0, error = 0;
      for (const row of slice) {
        try {
          const r = await addTagToKommo(row.session_id, TWILIO_TAG);
          if (r === 'ok') ok++; else if (r === 'already') already++; else if (r === 'skip') skip++; else error++;
        } catch { error++; }
        await new Promise((res) => setTimeout(res, 120)); // rate-limit Kommo
      }
      const next_offset = offset + max < all.length ? offset + max : null;
      return new Response(
        JSON.stringify({ backfill_twilio_tag: true, total: all.length, processed: slice.length, offset, next_offset, ok, already, skip, error }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Basic validation
    if (!body.session_id) {
      return new Response(
        JSON.stringify({ error: 'session_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Dedup: skip if same recording_sid already stored ──────────────────────
    if (body.recording_sid) {
      const { data: existing } = await supabase
        .from('call_db')
        .select('call_id, transcription_status')
        .eq('recording_sid', body.recording_sid)
        .maybeSingle();

      if (existing) {
        console.log(`[ingest-call] Already processed recording_sid: ${body.recording_sid}`);
        return new Response(
          JSON.stringify({
            success: true,
            call_id: existing.call_id,
            already_processed: true,
            transcription_status: existing.transcription_status,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ── Verify session_id exists in lead_db (auto-create if missing) ──────────
    const { data: leadExists, error: checkError } = await supabase
      .from('lead_db')
      .select('session_id')
      .eq('session_id', body.session_id)
      .maybeSingle();

    let leadAutoCreated = false;
    if (checkError || !leadExists) {
      // Auto-create a minimal lead entry so call data is never lost
      console.log(`[ingest-call] Lead ${body.session_id} not found — auto-creating minimal entry`);
      const { error: createErr } = await supabase
        .from('lead_db')
        .insert({
          session_id: body.session_id,
          channel: 'phone',
          processed: false,
        });

      if (createErr && !createErr.message?.includes('duplicate')) {
        console.error('[ingest-call] Failed to auto-create lead:', createErr);
        return new Response(
          JSON.stringify({ error: 'session_id not found and auto-create failed: ' + createErr.message }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      leadAutoCreated = true;
    }

    // A partir de agora: lead CRIADO pela nossa integração de ligação recebe a tag
    // "Ligação Twilio" no Kommo (await defensivo — só na criação, não a cada call).
    if (leadAutoCreated) {
      try {
        const tagRes = await addTagToKommo(body.session_id, TWILIO_TAG);
        console.log(`[ingest-call] tag "${TWILIO_TAG}" no Kommo p/ lead ${body.session_id}: ${tagRes}`);
      } catch (e) {
        console.error('[ingest-call] erro ao taguear "Ligação Twilio" no Kommo:', e);
      }
    }

    // ── Build call record ──────────────────────────────────────────────────────
    const hasTranscript = !!body.transcription_text;

    const callData: Record<string, unknown> = {
      session_id:     body.session_id,
      type:           body.type           || 'phone',
      call_tag:       body.call_tag       || null,
      call_result:    body.call_result    || null,
      call_duration:  body.call_duration  ? parseInt(String(body.call_duration), 10) : null,
      ai_analysis_status: body.ai_analysis_status || null,
      lead_score:     body.lead_score     ? parseFloat(String(body.lead_score)) : null,
      // InnovatSolution / recording fields
      recording_sid:  body.recording_sid  || null,
      recording_url:  body.recording_url  || null,
      from_number:    body.from_number    || null,
      to_number:      body.to_number      || null,
      // Twilio-specific (kept for backward compat)
      twilio_call_sid: body.twilio_call_sid || null,
      // Metadata
      call_status:    body.call_direction === 'inbound' ? 'inbound' : (body.call_status || null),
      // Transcription (optional — provided by n8n when available)
      transcription_text:   body.transcription_text   || null,
      transcription_status: body.transcription_status || (hasTranscript ? 'completed' : 'pending'),
    };

    console.log('[ingest-call] Inserting call:', callData);

    const { data, error } = await supabase
      .from('call_db')
      .insert(callData)
      .select('call_id')
      .single();

    if (error) {
      console.error('[ingest-call] Database error:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[ingest-call] Call created successfully:', data.call_id);

    // ── Fire-and-forget: transcrição (Whisper) é o padrão ─────────────────────
    // Se o n8n já mandou transcript → segue direto pra auditoria (analyze-call).
    // Se veio só a gravação (recording_sid/url) SEM transcript → transcreve com
    // Whisper via transcribe-call, que por sua vez dispara o analyze-call.
    const hasRecording = !!(body.recording_sid || body.recording_url);
    if (data.call_id) {
      const supabaseUrl    = Deno.env.get('SUPABASE_URL') ?? '';
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      const trigger = (fn: string) => {
        console.log(`[ingest-call] Triggering ${fn} for call_id: ${data.call_id}`);
        fetch(`${supabaseUrl}/functions/v1/${fn}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ call_id: data.call_id }),
        }).catch(err => console.error(`[ingest-call] ${fn} trigger error:`, err));
      };

      if (hasTranscript) {
        trigger('analyze-call');
      } else if (hasRecording) {
        trigger('transcribe-call');
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        call_id: data.call_id,
        already_processed: false,
        message: 'Call created successfully',
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ingest-call] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // ── Fire-and-forget analyze-call when transcript is ready ─────────────────
    if (hasTranscript && data.call_id) {
      const supabaseUrl    = Deno.env.get('SUPABASE_URL') ?? '';
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      console.log(`[ingest-call] Triggering analyze-call for call_id: ${data.call_id}`);
      fetch(`${supabaseUrl}/functions/v1/analyze-call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ call_id: data.call_id }),
      }).catch(err => console.error('[ingest-call] analyze-call trigger error:', err));
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

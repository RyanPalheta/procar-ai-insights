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

    // Twilio sends application/x-www-form-urlencoded
    const contentType = req.headers.get('content-type') || '';
    let body: Record<string, string> = {};

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.text();
      const params = new URLSearchParams(formData);
      params.forEach((value, key) => { body[key] = value; });
    } else {
      body = await req.json();
    }

    console.log('[twilio-webhook] Received:', JSON.stringify(body, null, 2));

    const callSid = body.CallSid;
    const callStatus = body.CallStatus;
    const callDuration = body.CallDuration ? parseInt(body.CallDuration) : null;
    const from = body.From || null;
    const to = body.To || null;
    const recordingUrl = body.RecordingUrl || null;
    const recordingSid = body.RecordingSid || null;

    if (!callSid) {
      return new Response(
        JSON.stringify({ error: 'CallSid is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if call already exists (deduplication)
    const { data: existing } = await supabase
      .from('call_db')
      .select('call_id')
      .eq('twilio_call_sid', callSid)
      .maybeSingle();

    let callId: string;

    if (existing) {
      // Update existing call
      const { error: updateErr } = await supabase
        .from('call_db')
        .update({
          call_status: callStatus,
          call_duration: callDuration,
          recording_url: recordingUrl,
          recording_sid: recordingSid,
          transcription_status: recordingUrl ? 'pending' : null,
        })
        .eq('call_id', existing.call_id);

      if (updateErr) {
        console.error('[twilio-webhook] Update error:', updateErr);
        throw updateErr;
      }
      callId = existing.call_id;
      console.log('[twilio-webhook] Updated existing call:', callId);
    } else {
      // Try to find lead by phone number
      let sessionId: number | null = null;
      // Look in custom field or try to match by phone
      // For now, create without session_id - can be linked later
      
      const { data: newCall, error: insertErr } = await supabase
        .from('call_db')
        .insert({
          twilio_call_sid: callSid,
          from_number: from,
          to_number: to,
          call_status: callStatus,
          call_duration: callDuration,
          recording_url: recordingUrl,
          recording_sid: recordingSid,
          type: 'twilio',
          transcription_status: recordingUrl ? 'pending' : null,
          session_id: sessionId,
        })
        .select('call_id')
        .single();

      if (insertErr) {
        console.error('[twilio-webhook] Insert error:', insertErr);
        throw insertErr;
      }
      callId = newCall.call_id;
      console.log('[twilio-webhook] Created new call:', callId);
    }

    // If recording is available, trigger transcription asynchronously
    if (recordingUrl && recordingSid) {
      console.log('[twilio-webhook] Triggering transcription for call:', callId);
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      
      // Fire and forget - don't await
      fetch(`${supabaseUrl}/functions/v1/transcribe-call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ call_id: callId }),
      }).catch(err => console.error('[twilio-webhook] Error triggering transcription:', err));
    }

    // Log audit
    await supabase.from('audit_logs').insert({
      event_type: 'twilio_call_received',
      status: 'success',
      function_name: 'twilio-webhook',
      event_details: { call_id: callId, call_sid: callSid, call_status: callStatus, has_recording: !!recordingUrl },
    });

    // Return TwiML empty response (Twilio expects XML or empty)
    return new Response(
      JSON.stringify({ success: true, call_id: callId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[twilio-webhook] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Google Gemini API for audio transcription
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let supabase: any;

  try {
    supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { call_id } = await req.json();
    if (!call_id) {
      return new Response(
        JSON.stringify({ error: 'call_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[transcribe-call] Starting transcription for call_id: ${call_id}`);

    // Get call data
    const { data: call, error: callErr } = await supabase
      .from('call_db')
      .select('*')
      .eq('call_id', call_id)
      .single();

    if (callErr || !call) {
      throw new Error(`Call not found: ${callErr?.message}`);
    }

    if (!call.recording_sid) {
      throw new Error('No recording_sid available for this call');
    }

    // Update status to processing
    await supabase.from('call_db').update({ transcription_status: 'processing' }).eq('call_id', call_id);

    // Get credentials
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const geminiApiKey = Deno.env.get('GOOGLE_GEMINI_API_KEY');

    if (!twilioAccountSid || !twilioAuthToken) {
      throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required');
    }
    if (!geminiApiKey) {
      throw new Error('GOOGLE_GEMINI_API_KEY is required');
    }

    // Download audio from Twilio
    const audioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Recordings/${call.recording_sid}.mp3`;
    console.log(`[transcribe-call] Downloading audio from Twilio...`);

    const audioResponse = await fetch(audioUrl, {
      headers: {
        'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
      },
    });

    if (!audioResponse.ok) {
      const errText = await audioResponse.text();
      throw new Error(`Twilio audio download failed (${audioResponse.status}): ${errText}`);
    }

    const audioBuffer = await audioResponse.arrayBuffer();
    const audioBase64 = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));
    console.log(`[transcribe-call] Audio downloaded: ${audioBuffer.byteLength} bytes`);

    // Send to Gemini for transcription
    console.log(`[transcribe-call] Sending to Gemini for transcription...`);

    const geminiResponse = await fetch(`${GEMINI_API_URL}?key=${geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: 'audio/mpeg',
                  data: audioBase64,
                },
              },
              {
                text: `Transcreva esta gravação de chamada telefônica em português brasileiro. 
Inclua identificação dos falantes quando possível (ex: "Vendedor:" e "Cliente:").
Mantenha a transcrição fiel ao áudio, incluindo pausas significativas indicadas com [...].
Se houver partes inaudíveis, indique com [inaudível].
Formate a transcrição de forma clara com quebras de linha entre cada fala.`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      const status = geminiResponse.status;
      
      await supabase.from('call_db').update({ transcription_status: 'failed' }).eq('call_id', call_id);
      
      await supabase.from('audit_logs').insert({
        event_type: 'transcription_failed',
        status: 'error',
        function_name: 'transcribe-call',
        error_message: `Gemini ${status}: ${errText.substring(0, 500)}`,
        event_details: { call_id, http_status: status },
        execution_time_ms: Date.now() - startTime,
      });
      
      throw new Error(`Gemini transcription failed (${status}): ${errText}`);
    }

    const geminiData = await geminiResponse.json();
    const transcription = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

    if (!transcription) {
      await supabase.from('call_db').update({ transcription_status: 'failed' }).eq('call_id', call_id);
      throw new Error('Empty transcription returned from Gemini');
    }

    console.log(`[transcribe-call] Transcription completed: ${transcription.length} chars`);

    // Save transcription
    await supabase.from('call_db').update({
      transcription_text: transcription,
      transcription_status: 'completed',
    }).eq('call_id', call_id);

    // Log success
    await supabase.from('audit_logs').insert({
      event_type: 'transcription_completed',
      status: 'success',
      function_name: 'transcribe-call',
      event_details: { call_id, transcription_length: transcription.length, audio_size_bytes: audioBuffer.byteLength },
      execution_time_ms: Date.now() - startTime,
    });

    // Trigger AI analysis
    console.log(`[transcribe-call] Triggering analyze-call for call_id: ${call_id}`);
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    fetch(`${supabaseUrl}/functions/v1/analyze-call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ call_id }),
    }).catch(err => console.error('[transcribe-call] Error triggering analysis:', err));

    return new Response(
      JSON.stringify({ success: true, call_id, transcription_length: transcription.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[transcribe-call] Error:', error);
    
    if (supabase) {
      await supabase.from('audit_logs').insert({
        event_type: 'transcription_error',
        status: 'error',
        function_name: 'transcribe-call',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        execution_time_ms: Date.now() - startTime,
      }).catch(() => {});
    }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

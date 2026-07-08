import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Transcrição de ligações via OpenAI Whisper, com áudio da InnovatSolution ──
// Substitui a versão antiga (Gemini 2.5 Flash forçando português — errado para
// ligações em inglês/espanhol). Fluxo:
//   call_id → lê recording_sid(=cdrId) + data → relista a Innovat p/ ref fresco
//   → baixa o WAV → Whisper (auto-idioma) → limpa loop de repetição → salva
//   → dispara analyze-call.
// A Innovat entrega o áudio em GSM 6.10 8kHz e o `recordingRef` é de uso único,
// então SEMPRE relistamos para pegar um ref novo na hora de baixar.

const ITP_BASE_URL = Deno.env.get('ITP_BASE_URL') || 'https://recordings-api.innovatsolution.com';
const OPENAI_TRANSCRIBE_URL = 'https://api.openai.com/v1/audio/transcriptions';
// "Whisper" é o padrão pedido. whisper-1 é o mais robusto a áudio de telefonia
// ruidoso; pode ser trocado por env sem redeploy de lógica.
const TRANSCRIBE_MODEL = Deno.env.get('OPENAI_TRANSCRIBE_MODEL') || 'whisper-1';

// Colapsa loops de repetição do Whisper ("Yeah. Yeah. Yeah…", "E aí E aí E aí…"),
// o modo de falha clássico em trechos de silêncio/ruído. Mantém no máximo
// `maxRepeat` cópias consecutivas de qualquer n-grama de 1 a 5 palavras.
function collapseRepeats(text: string, maxRepeat = 2): string {
  if (!text) return text;
  let words = text.trim().split(/\s+/).filter(Boolean);
  for (let n = 1; n <= 5; n++) {
    if (words.length < n * 2) break;
    const out: string[] = [];
    let i = 0;
    while (i < words.length) {
      const gram = words.slice(i, i + n).join(' ').toLowerCase();
      let reps = 1;
      while (
        i + (reps + 1) * n <= words.length &&
        words.slice(i + reps * n, i + (reps + 1) * n).join(' ').toLowerCase() === gram
      ) {
        reps++;
      }
      if (reps >= 2) {
        const keep = Math.min(reps, maxRepeat);
        for (let k = 0; k < keep * n; k++) out.push(words[i + k]);
        i += reps * n;
      } else {
        out.push(words[i]);
        i += 1;
      }
    }
    words = out;
  }
  return words.join(' ').replace(/\s+([.,!?])/g, '$1').trim();
}

function digits(num: string | null | undefined): string {
  if (!num) return '';
  const d = String(num).replace(/\D/g, '');
  return d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
}

// Relista a Innovat numa janela ao redor da data da ligação e acha o áudio.
// Match primário: cdrId === recording_sid. Fallback: telefone (from/to) batendo.
async function resolveInnovatRecording(
  itpKey: string,
  cdrId: string | null,
  fromNumber: string | null,
  toNumber: string | null,
  aroundIso: string,
): Promise<{ cdrId: string; recordingRef: string } | null> {
  // Timestamp da ligação: os 10 primeiros dígitos do cdrId são o Unix (segundos)
  // do início da chamada — dá pra mirar a janela com precisão. Fallback: created_at.
  let centerMs = new Date(aroundIso).getTime();
  const m = String(cdrId || '').match(/^(\d{10})/);
  const hasTs = !!m;
  if (m) {
    const ts = parseInt(m[1], 10) * 1000;
    if (ts > 1.5e12 && ts < 2.0e12) centerMs = ts;
  }

  // ARMADILHA Innovat: a listagem retorna VAZIO com limit alto (>~100). Mantemos
  // limit=100 e janela CURTA: ±20min quando temos o timestamp do cdrId; senão
  // (fallback created_at, que vem DEPOIS da ligação) olhamos até 4h atrás.
  const startMs = hasTs ? centerMs - 20 * 60000 : centerMs - 4 * 3600 * 1000;
  const endMs = hasTs ? centerMs + 20 * 60000 : centerMs + 15 * 60000;
  const start = new Date(startMs).toISOString();
  const end = new Date(endMs).toISOString();

  const url = `${ITP_BASE_URL}/portal/recordings`
    + `?startDate=${encodeURIComponent(start)}`
    + `&endDate=${encodeURIComponent(end)}`
    + `&includeInternal=true&limit=100`;

  const resp = await fetch(url, { headers: { Authorization: `Bearer ${itpKey}` } });
  if (!resp.ok) {
    throw new Error(`Innovat list failed (${resp.status}): ${(await resp.text()).slice(0, 300)}`);
  }
  const data = await resp.json();
  const recs: any[] = data?.recordings ?? [];

  if (cdrId) {
    const hit = recs.find((r) => r.cdrId === cdrId);
    if (hit?.recordingRef) return { cdrId: hit.cdrId, recordingRef: hit.recordingRef };
  }

  // Fallback por telefone + proximidade temporal (quando recording_sid não é cdrId).
  const f = digits(fromNumber), t = digits(toNumber);
  if (f || t) {
    const candidates = recs
      .filter((r) => {
        const rf = digits(r.fromNumber), rt = digits(r.toNumber);
        return (f && (rf === f || rt === f)) || (t && (rf === t || rt === t));
      })
      .sort((a, b) => {
        const da = Math.abs(new Date(a.startedAt).getTime() - centerMs);
        const db = Math.abs(new Date(b.startedAt).getTime() - centerMs);
        return da - db;
      });
    if (candidates[0]?.recordingRef) {
      return { cdrId: candidates[0].cdrId, recordingRef: candidates[0].recordingRef };
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let supabase: any;

  try {
    supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { call_id, force } = await req.json();
    if (!call_id) {
      return new Response(
        JSON.stringify({ error: 'call_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log(`[transcribe-call] Starting transcription for call_id: ${call_id}`);

    const { data: call, error: callErr } = await supabase
      .from('call_db')
      .select('*')
      .eq('call_id', call_id)
      .single();

    if (callErr || !call) {
      throw new Error(`Call not found: ${callErr?.message}`);
    }

    // Idempotência: não retranscreve o que já está pronto (a menos que force).
    if (!force && call.transcription_status === 'completed' && call.transcription_text) {
      console.log(`[transcribe-call] Already transcribed, skipping call_id: ${call_id}`);
      return new Response(
        JSON.stringify({ success: true, call_id, already_transcribed: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const itpKey = Deno.env.get('ITP_API_KEY');
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!itpKey) throw new Error('ITP_API_KEY is required');
    if (!openaiKey) throw new Error('OPENAI_API_KEY is required');

    await supabase.from('call_db').update({ transcription_status: 'processing' }).eq('call_id', call_id);

    // ── 1. Resolve o áudio na Innovat (ref fresco) ──────────────────────────
    const resolved = await resolveInnovatRecording(
      itpKey,
      call.recording_sid,
      call.from_number,
      call.to_number,
      call.created_at,
    );

    if (!resolved) {
      await supabase.from('call_db').update({ transcription_status: 'failed' }).eq('call_id', call_id);
      await supabase.from('audit_logs').insert({
        event_type: 'transcription_failed',
        status: 'error',
        function_name: 'transcribe-call',
        error_message: `Innovat recording not found (recording_sid=${call.recording_sid})`,
        event_details: { call_id, recording_sid: call.recording_sid },
        execution_time_ms: Date.now() - startTime,
      });
      throw new Error(`Innovat recording not found for call_id ${call_id}`);
    }

    // ── 2. Baixa o WAV ──────────────────────────────────────────────────────
    const audioUrl = `${ITP_BASE_URL}/portal/recordings/${resolved.cdrId}/audio`
      + `?ref=${encodeURIComponent(resolved.recordingRef)}`;
    console.log(`[transcribe-call] Downloading audio (cdrId ${resolved.cdrId})...`);

    const audioResp = await fetch(audioUrl, { headers: { Authorization: `Bearer ${itpKey}` } });
    if (!audioResp.ok) {
      throw new Error(`Innovat audio download failed (${audioResp.status}): ${(await audioResp.text()).slice(0, 300)}`);
    }
    const audioBytes = new Uint8Array(await audioResp.arrayBuffer());
    console.log(`[transcribe-call] Audio downloaded: ${audioBytes.byteLength} bytes`);

    if (audioBytes.byteLength < 1024) {
      await supabase.from('call_db').update({ transcription_status: 'failed' }).eq('call_id', call_id);
      throw new Error(`Audio too small (${audioBytes.byteLength} bytes) — likely empty recording`);
    }

    // ── 3. Whisper (auto-detecção de idioma) com retry em 429 ───────────────
    let whisperResp: Response | null = null;
    for (let attempt = 1; attempt <= 4; attempt++) {
      const form = new FormData();
      form.append('file', new Blob([audioBytes], { type: 'audio/wav' }), 'call.wav');
      form.append('model', TRANSCRIBE_MODEL);
      form.append('response_format', 'verbose_json');

      whisperResp = await fetch(OPENAI_TRANSCRIBE_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${openaiKey}` },
        body: form,
      });

      if (whisperResp.status !== 429) break;
      const retryAfter = parseInt(whisperResp.headers.get('retry-after') || '0') || attempt * 10;
      console.log(`[transcribe-call] OpenAI 429, retry in ${retryAfter}s (${attempt}/4)...`);
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
    }

    if (!whisperResp!.ok) {
      const errText = await whisperResp!.text();
      const status = whisperResp!.status;
      await supabase.from('call_db').update({ transcription_status: 'failed' }).eq('call_id', call_id);
      await supabase.from('audit_logs').insert({
        event_type: 'transcription_failed',
        status: 'error',
        function_name: 'transcribe-call',
        error_message: `OpenAI ${status}: ${errText.slice(0, 500)}`,
        event_details: { call_id, http_status: status, model: TRANSCRIBE_MODEL },
        execution_time_ms: Date.now() - startTime,
      });
      throw new Error(`OpenAI transcription failed (${status}): ${errText.slice(0, 300)}`);
    }

    const whisperData = await whisperResp!.json();
    const rawText: string = whisperData?.text || '';
    const language: string = whisperData?.language || '';
    const cleanText = collapseRepeats(rawText);

    if (!cleanText) {
      await supabase.from('call_db').update({ transcription_status: 'failed' }).eq('call_id', call_id);
      throw new Error('Empty transcription returned from Whisper');
    }

    console.log(`[transcribe-call] Transcribed: ${cleanText.length} chars, lang=${language} (raw ${rawText.length})`);

    // ── 4. Salva e dispara a auditoria ──────────────────────────────────────
    await supabase.from('call_db').update({
      transcription_text: cleanText,
      transcription_status: 'completed',
    }).eq('call_id', call_id);

    await supabase.from('audit_logs').insert({
      event_type: 'transcription_completed',
      status: 'success',
      function_name: 'transcribe-call',
      event_details: {
        call_id,
        transcription_length: cleanText.length,
        raw_length: rawText.length,
        language,
        model: TRANSCRIBE_MODEL,
        audio_size_bytes: audioBytes.byteLength,
        cdr_id: resolved.cdrId,
      },
      execution_time_ms: Date.now() - startTime,
    });

    console.log(`[transcribe-call] Triggering analyze-call for call_id: ${call_id}`);
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    fetch(`${supabaseUrl}/functions/v1/analyze-call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supabaseServiceKey}` },
      body: JSON.stringify({ call_id }),
    }).catch((err) => console.error('[transcribe-call] analyze-call trigger error:', err));

    return new Response(
      JSON.stringify({ success: true, call_id, transcription_length: cleanText.length, language }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
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
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

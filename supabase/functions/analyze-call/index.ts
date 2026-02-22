import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AI_GATEWAY = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const AI_MODEL = 'gemini-2.5-flash';

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

    console.log(`[analyze-call] Starting analysis for call_id: ${call_id}`);

    // Get call with transcription
    const { data: call, error: callErr } = await supabase
      .from('call_db')
      .select('*')
      .eq('call_id', call_id)
      .single();

    if (callErr || !call) {
      throw new Error(`Call not found: ${callErr?.message}`);
    }

    if (!call.transcription_text) {
      throw new Error('No transcription available for this call');
    }

    // Update AI status
    await supabase.from('call_db').update({ ai_analysis_status: 'processing' }).eq('call_id', call_id);

    const geminiApiKey = Deno.env.get('GOOGLE_GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('GOOGLE_GEMINI_API_KEY is required');
    }

    // Fetch playbook for compliance check
    let playbookText = '';
    const { data: playbooks } = await supabase.from('playbooks').select('title, content').limit(1).single();
    if (playbooks) {
      playbookText = `\n\nPLAYBOOK DE VENDAS (${playbooks.title}):\n${playbooks.content}`;
    }

    const systemPrompt = `Você é um analista de qualidade de chamadas telefônicas de vendas.
Analise a transcrição da chamada e avalie a qualidade do atendimento.
Responda usando a função 'analyze_call' com os campos solicitados.`;

    const userPrompt = `Analise esta transcrição de chamada telefônica de vendas:

TRANSCRIÇÃO:
${call.transcription_text}

DADOS DA CHAMADA:
- Duração: ${call.call_duration || 'N/A'}s
- De: ${call.from_number || 'N/A'}
- Para: ${call.to_number || 'N/A'}
${playbookText}

Avalie:
1. Sentimento geral do cliente
2. Score de qualidade da chamada (0-100)
3. Objeções identificadas
4. Se as objeções foram contornadas
5. Compliance com o playbook de vendas (se disponível)
6. Resumo executivo da chamada (2-3 frases)
7. Pontos de melhoria para o vendedor
8. Oportunidades de venda identificadas
9. Se o vendedor usou técnicas de ancoragem/oferta`;

    const toolParameters = {
      type: 'object',
      properties: {
        sentiment: { type: 'string', enum: ['Positivo', 'Neutro', 'Negativo'] },
        quality_score: { type: 'number', minimum: 0, maximum: 100, description: 'Score de qualidade geral da chamada' },
        executive_summary: { type: 'string', description: 'Resumo executivo da chamada (2-3 frases)' },
        improvement_points: { type: 'array', items: { type: 'string' }, description: 'Pontos de melhoria para o vendedor' },
        has_objection: { type: 'boolean' },
        objection_detail: { type: 'string', nullable: true },
        objection_categories: {
          type: 'array',
          items: { type: 'string', enum: ['preco', 'tempo', 'distancia', 'financiamento', 'confianca', 'concorrencia', 'tecnica', 'indecisao'] },
        },
        objection_overcome: { type: 'boolean', nullable: true },
        compliance_score: { type: 'number', minimum: 0, maximum: 100, nullable: true, description: 'Score de aderência ao playbook' },
        compliance_notes: { type: 'string', nullable: true, description: 'Notas sobre compliance com playbook' },
        used_offer: { type: 'boolean' },
        offer_detail: { type: 'string', nullable: true },
        used_anchoring: { type: 'boolean' },
        anchoring_detail: { type: 'string', nullable: true },
        sales_opportunities: { type: 'array', items: { type: 'string' }, description: 'Oportunidades de venda identificadas' },
        call_tags: { type: 'array', items: { type: 'string' }, description: '3-5 tags para categorizar a chamada' },
      },
      required: ['sentiment', 'quality_score', 'executive_summary', 'improvement_points', 'has_objection', 'used_offer', 'used_anchoring', 'call_tags'],
    };

    console.log(`[analyze-call] Calling Gemini API...`);

    const aiResponse = await fetch(AI_GATEWAY, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${geminiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'analyze_call',
            description: 'Analisa a qualidade de uma chamada telefônica de vendas',
            parameters: toolParameters,
          },
        }],
        tool_choice: { type: 'function', function: { name: 'analyze_call' } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      const status = aiResponse.status;

      await supabase.from('call_db').update({ ai_analysis_status: 'failed' }).eq('call_id', call_id);

      await supabase.from('audit_logs').insert({
        event_type: 'call_analysis_failed',
        status: 'error',
        function_name: 'analyze-call',
        error_message: `Gemini ${status}: ${errText.substring(0, 500)}`,
        event_details: { call_id, http_status: status },
        execution_time_ms: Date.now() - startTime,
      });

      throw new Error(`Gemini error (${status}): ${errText}`);
    }

    const aiData = await aiResponse.json();
    let analysis: any = {};

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        analysis = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        console.error('[analyze-call] Parse error:', e);
      }
    }

    console.log(`[analyze-call] Analysis result:`, analysis);

    // Save analysis to call_db
    await supabase.from('call_db').update({
      ai_analysis_status: 'completed',
      ai_call_analysis: analysis,
      lead_score: analysis.quality_score || null,
      call_tag: analysis.call_tags?.join(', ') || null,
      call_result: analysis.executive_summary?.substring(0, 200) || null,
    }).eq('call_id', call_id);

    const duration = Date.now() - startTime;

    await supabase.from('audit_logs').insert({
      event_type: 'call_analysis_completed',
      status: 'success',
      function_name: 'analyze-call',
      event_details: {
        call_id,
        quality_score: analysis.quality_score,
        sentiment: analysis.sentiment,
        has_objection: analysis.has_objection,
        duration_ms: duration,
      },
      execution_time_ms: duration,
    });

    return new Response(
      JSON.stringify({ success: true, call_id, analysis, duration_ms: duration }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[analyze-call] Error:', error);

    if (supabase) {
      await supabase.from('audit_logs').insert({
        event_type: 'call_analysis_error',
        status: 'error',
        function_name: 'analyze-call',
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

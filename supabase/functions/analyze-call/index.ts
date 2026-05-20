import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AI_GATEWAY = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const AI_MODEL = 'gemini-2.5-flash';

// Company phone for direction detection. Stored numbers appear in both formats:
// "17816053526" (US E.164 with leading 1) and "7816053526" (without).
const COMPANY_PHONE = '17816053526';

function normalizePhoneDigits(num: string | null | undefined): string {
  if (!num) return '';
  const d = String(num).replace(/\D/g, '');
  return d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
}

type CallDirection = 'active' | 'passive' | 'unknown';

function getCallDirection(from: string | null, to: string | null): CallDirection {
  const company = normalizePhoneDigits(COMPANY_PHONE);
  const fromN = normalizePhoneDigits(from);
  const toN = normalizePhoneDigits(to);
  if (fromN && fromN === company) return 'active';
  if (toN && toN === company) return 'passive';
  return 'unknown';
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

    // Determine call direction (active = seller called out, passive = customer called in)
    const direction = getCallDirection(call.from_number, call.to_number);
    console.log(`[analyze-call] Direction detected: ${direction} (from=${call.from_number} to=${call.to_number})`);

    const directionContext = direction === 'active'
      ? `📞 TIPO DE CHAMADA: ATIVA (OUTBOUND)
O vendedor da empresa LIGOU para o cliente. Isso muda os critérios de avaliação:

CRITÉRIOS ESPECÍFICOS DE CHAMADA ATIVA:
- Abertura forte é CRÍTICA (apresentação clara: nome do vendedor + empresa + motivo da ligação em ~10s)
- Pedir permissão para falar é ESPERADO ("Tem um minuto?" / "É um bom momento?")
- Cliente NÃO está esperando a ligação → tom não pode ser invasivo
- Hook nos primeiros 30 segundos é essencial (motivo relevante pro cliente)
- Qualificação rápida sem ser pushy
- Próximo passo concreto ao final (agendar, enviar proposta, retornar)
- AJUSTE NO SCORING: penalizar abertura fraca, premiar quem conseguiu segurar atenção
- Objeção mais comum esperada: "não tenho interesse / não tenho tempo agora" — avaliar como vendedor lidou`
      : direction === 'passive'
      ? `📞 TIPO DE CHAMADA: PASSIVA (INBOUND)
O CLIENTE ligou para a empresa. Ele já tem interesse — o vendedor NÃO precisa "vender" pra atenção, precisa SERVIR e FECHAR.

CRITÉRIOS ESPECÍFICOS DE CHAMADA PASSIVA:
- Atendimento cordial e rápido (não fazer cliente esperar/repetir)
- Identificar necessidade do cliente nos primeiros minutos
- Responder dúvidas com clareza e segurança técnica
- Cliente já está QUENTE → tentar FECHAR é esperado (agendar visita, fazer cotação, marcar instalação)
- Coletar dados de contato (nome, telefone, veículo)
- Criar urgência apropriada (estoque limitado, promoção, agenda)
- AJUSTE NO SCORING: premiar quem tentou fechar, penalizar quem só "informou" sem tentar avançar
- Falta de tentativa de fechamento numa chamada passiva é GRAVE
- Objeções esperadas: técnicas, preço — não devem haver objeções de "não tenho interesse"`
      : `📞 TIPO DE CHAMADA: NÃO IDENTIFICADO
Não foi possível determinar a direção da chamada pelos números. Avalie com critérios universais de qualidade.`;

    const systemPrompt = `Você é um analista de qualidade de chamadas telefônicas de vendas para a PROCAR (loja de som e segurança automotiva).

IMPORTANTE: O TIPO DE CHAMADA (ativa vs passiva) muda completamente o que se espera do vendedor. Use os critérios específicos do tipo para avaliar.

Responda usando a função 'analyze_call' com os campos solicitados.`;

    const userPrompt = `Analise esta transcrição de chamada telefônica de vendas:

${directionContext}

TRANSCRIÇÃO:
${call.transcription_text}

DADOS DA CHAMADA:
- Duração: ${call.call_duration || 'N/A'}s
- De: ${call.from_number || 'N/A'}
- Para: ${call.to_number || 'N/A'}
- Direção: ${direction}
${playbookText}

Avalie:
1. Sentimento geral do cliente
2. Score de qualidade da chamada (0-100) — USE OS CRITÉRIOS DA DIREÇÃO acima
3. Objeções identificadas
4. Se as objeções foram contornadas
5. Compliance com o playbook (se disponível)
6. Resumo executivo (2-3 frases)
7. Pontos de melhoria — devem ser ESPECÍFICOS ao tipo da chamada
8. Oportunidades de venda
9. Técnicas de ancoragem/oferta
10. CRÍTICOS DE DIREÇÃO:
    - Qualidade da abertura (0-10): apresentação, hook, transição
    - Pediu permissão para falar (só relevante em ATIVAS — em passivas marque false)
    - Tentou fechar / avançar próximo passo (especialmente crítico em PASSIVAS)
    - Quão bem o vendedor ADAPTOU sua abordagem ao tipo da chamada (0-10)`;

    const toolParameters = {
      type: 'object',
      properties: {
        sentiment: { type: 'string', enum: ['Positivo', 'Neutro', 'Negativo'] },
        quality_score: { type: 'number', minimum: 0, maximum: 100, description: 'Score de qualidade geral da chamada, considerando os critérios da DIREÇÃO (ativa vs passiva)' },
        executive_summary: { type: 'string', description: 'Resumo executivo da chamada (2-3 frases)' },
        improvement_points: { type: 'array', items: { type: 'string' }, description: 'Pontos de melhoria — específicos para o tipo da chamada' },
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

        // ↓↓↓ NEW DIRECTION-AWARE METRICS ↓↓↓
        call_direction: {
          type: 'string',
          enum: ['active', 'passive', 'unknown'],
          description: 'Tipo da chamada — use o valor passado em "Direção" acima',
        },
        opening_quality: {
          type: 'number',
          minimum: 0,
          maximum: 10,
          description: 'Qualidade da abertura (0-10). Em ATIVA: apresentação + hook + motivo. Em PASSIVA: cordialidade + identificar necessidade rapidamente.',
        },
        permission_asked: {
          type: 'boolean',
          description: 'Vendedor pediu permissão pra falar/continuar? Só relevante em ATIVAS (em passivas marque false).',
        },
        close_attempt: {
          type: 'boolean',
          description: 'Vendedor tentou fechar ou avançar pro próximo passo? (agendar visita, marcar instalação, enviar cotação formal). CRÍTICO em PASSIVAS.',
        },
        close_attempt_detail: {
          type: 'string',
          nullable: true,
          description: 'Que tipo de fechamento foi tentado, ou por que não houve tentativa.',
        },
        direction_appropriate_score: {
          type: 'number',
          minimum: 0,
          maximum: 10,
          description: 'Quão bem o vendedor adaptou abordagem/tom ao tipo da chamada (0-10). Ex: vendedor invasivo numa passiva = nota baixa; vendedor passivo numa ativa = nota baixa.',
        },
        urgency_created: {
          type: 'boolean',
          description: 'Vendedor criou urgência apropriada? (estoque limitado, promoção por tempo, agenda apertada)',
        },
      },
      required: [
        'sentiment', 'quality_score', 'executive_summary', 'improvement_points',
        'has_objection', 'used_offer', 'used_anchoring', 'call_tags',
        'call_direction', 'opening_quality', 'close_attempt', 'direction_appropriate_score',
      ],
    };

    console.log(`[analyze-call] Calling Gemini API...`);

    // Call Gemini with retry on 429 (rate limit)
    let aiResponse: Response | null = null;
    for (let attempt = 1; attempt <= 4; attempt++) {
      aiResponse = await fetch(AI_GATEWAY, {
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
          stream: false,
        }),
      });

      if (aiResponse.status !== 429) break;

      const retryAfter = parseInt(aiResponse.headers.get('retry-after') || '0') || (attempt * 15);
      console.log(`[analyze-call] Rate limited (429), retrying in ${retryAfter}s (attempt ${attempt}/4)...`);
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
    }

    if (!aiResponse!.ok) {
      const errText = await aiResponse!.text();
      const httpStatus = aiResponse!.status;

      await supabase.from('call_db').update({ ai_analysis_status: 'failed' }).eq('call_id', call_id);

      try {
        await supabase.from('audit_logs').insert({
          event_type: 'call_analysis_failed',
          status: 'error',
          function_name: 'analyze-call',
          error_message: `Gemini ${httpStatus}: ${errText.substring(0, 500)}`,
          event_details: { call_id, http_status: httpStatus },
          execution_time_ms: Date.now() - startTime,
        });
      } catch (_) { /* ignore log error */ }

      throw new Error(`Gemini error (${httpStatus}): ${errText}`);
    }

    const rawText = await aiResponse.text();
    console.log('[analyze-call] Gemini raw response (first 500 chars):', rawText.substring(0, 500));

    let aiData: any;
    try {
      aiData = JSON.parse(rawText);
    } catch (parseErr) {
      // Store raw response in audit_logs for debugging
      if (supabase) {
        await supabase.from('audit_logs').insert({
          event_type: 'call_analysis_debug',
          status: 'error',
          function_name: 'analyze-call',
          error_message: `JSON parse failed on Gemini response (HTTP ${aiResponse.status})`,
          event_details: { call_id, gemini_raw: rawText.substring(0, 800), model: AI_MODEL },
          execution_time_ms: Date.now() - startTime,
        });
      }
      throw new Error(`Gemini response not valid JSON (HTTP ${aiResponse.status}): ${rawText.substring(0, 300)}`);
    }

    let analysis: any = {};

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const args = toolCall.function.arguments;
        analysis = typeof args === 'object' ? args : JSON.parse(args);
      } catch (e) {
        console.error('[analyze-call] Parse error:', e);
      }
    }

    // Ensure the AI's direction matches what we computed (AI may hallucinate).
    // We always trust the server-side calculation as the source of truth.
    if (analysis.call_direction !== direction) {
      console.log(`[analyze-call] AI returned direction=${analysis.call_direction}, overriding with computed=${direction}`);
      analysis.call_direction = direction;
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

    // Propagate call insights back to lead_db via update-lead (ensures history tracking)
    if (call.session_id) {
      const qs = analysis.quality_score;
      const leadTemperature = (qs !== undefined && qs !== null)
        ? (qs >= 70 ? 'quente' : qs >= 40 ? 'morno' : 'frio')
        : undefined;

      const leadUpdatePayload: Record<string, any> = {
        session_id: call.session_id,
        change_source: 'call_analysis',
      };

      if (analysis.sentiment)                                         leadUpdatePayload.sentiment                = analysis.sentiment;
      if (qs !== undefined && qs !== null)                            leadUpdatePayload.lead_score               = qs;
      if (leadTemperature)                                            leadUpdatePayload.lead_temperature         = leadTemperature;
      if (analysis.has_objection !== undefined)                       leadUpdatePayload.has_objection            = analysis.has_objection;
      if (analysis.objection_detail)                                  leadUpdatePayload.objection_detail         = analysis.objection_detail;
      if (Array.isArray(analysis.objection_categories) && analysis.objection_categories.length > 0)
                                                                      leadUpdatePayload.objection_categories     = analysis.objection_categories;
      if (analysis.objection_overcome !== undefined && analysis.objection_overcome !== null)
                                                                      leadUpdatePayload.objection_overcome       = analysis.objection_overcome;
      if (analysis.used_offer !== undefined)                          leadUpdatePayload.used_offer               = analysis.used_offer;
      if (analysis.offer_detail)                                      leadUpdatePayload.offer_detail             = analysis.offer_detail;
      if (analysis.used_anchoring !== undefined)                      leadUpdatePayload.used_anchoring           = analysis.used_anchoring;
      if (analysis.anchoring_detail)                                  leadUpdatePayload.anchoring_detail         = analysis.anchoring_detail;
      if (analysis.compliance_score !== undefined && analysis.compliance_score !== null)
                                                                      leadUpdatePayload.playbook_compliance_score = analysis.compliance_score;
      if (analysis.compliance_notes)                                  leadUpdatePayload.playbook_violations      = analysis.compliance_notes;
      if (Array.isArray(analysis.improvement_points) && analysis.improvement_points.length > 0)
                                                                      leadUpdatePayload.improvement_point        = analysis.improvement_points.join(' | ');
      if (analysis.executive_summary)                                 leadUpdatePayload.need_summary             = analysis.executive_summary.substring(0, 200);
      if (Array.isArray(analysis.call_tags) && analysis.call_tags.length > 0)
                                                                      leadUpdatePayload.ai_tags                  = analysis.call_tags;

      console.log(`[analyze-call] Updating lead_db for session_id ${call.session_id} with ${Object.keys(leadUpdatePayload).length - 2} fields`);

      const { error: leadUpdateErr } = await supabase.functions.invoke('update-lead', {
        body: leadUpdatePayload,
      });

      if (leadUpdateErr) {
        console.warn(`[analyze-call] Failed to update lead_db for session_id ${call.session_id}:`, leadUpdateErr.message);
      } else {
        console.log(`[analyze-call] lead_db updated successfully for session_id ${call.session_id}`);
      }
    } else {
      console.warn(`[analyze-call] call_id ${call_id} has no session_id — skipping lead_db update`);
    }

    const duration = Date.now() - startTime;

    await supabase.from('audit_logs').insert({
      event_type: 'call_analysis_completed',
      status: 'success',
      function_name: 'analyze-call',
      event_details: {
        call_id,
        session_id: call.session_id,
        quality_score: analysis.quality_score,
        sentiment: analysis.sentiment,
        has_objection: analysis.has_objection,
        call_direction: direction,
        opening_quality: analysis.opening_quality,
        close_attempt: analysis.close_attempt,
        direction_appropriate_score: analysis.direction_appropriate_score,
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

    const errMsg = error instanceof Error ? error.message : 'Internal server error';

    try {
      if (supabase) {
        await supabase.from('audit_logs').insert({
          event_type: 'call_analysis_error',
          status: 'error',
          function_name: 'analyze-call',
          error_message: errMsg.substring(0, 1000),
          execution_time_ms: Date.now() - startTime,
        });
      }
    } catch (_logErr) {
      console.error('[analyze-call] Failed to write audit log:', _logErr);
    }

    return new Response(
      JSON.stringify({ error: errMsg.substring(0, 500) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

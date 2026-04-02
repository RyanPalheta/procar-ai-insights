import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Delay between AI calls to avoid rate limiting
const DELAY_BETWEEN_CALLS_MS = 3000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('[audit-cold-leads] Starting daily cold lead audit...');

    // Find leads with last_interaction_at > 24h ago AND no 'auditoria_fria' tag
    const { data: coldLeads, error: queryError } = await supabase
      .from('lead_db')
      .select('session_id, channel, sales_status, sales_person_id, last_interaction_at, ai_tags, lead_temperature, sentiment, service_desired')
      .not('last_interaction_at', 'is', null)
      .lt('last_interaction_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (queryError) {
      console.error('[audit-cold-leads] Query error:', queryError);
      throw new Error(queryError.message);
    }

    // Filter out leads that already have 'auditoria_fria' tag (can't do array contains NOT in postgrest easily)
    const eligibleLeads = (coldLeads || []).filter(lead => {
      const tags = lead.ai_tags || [];
      return !tags.includes('auditoria_fria');
    });

    console.log(`[audit-cold-leads] Found ${coldLeads?.length || 0} cold leads, ${eligibleLeads.length} eligible for audit`);

    if (eligibleLeads.length === 0) {
      await supabase.from('audit_logs').insert({
        event_type: 'cold_audit_run',
        status: 'success',
        function_name: 'audit-cold-leads',
        event_details: { total_found: 0, audited: 0 },
        execution_time_ms: Date.now() - startTime,
      });

      return new Response(
        JSON.stringify({ success: true, audited: 0, message: 'No cold leads to audit' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geminiApiKey = Deno.env.get('GOOGLE_GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('GOOGLE_GEMINI_API_KEY is not configured');
    }

    let audited = 0;
    let errors = 0;

    for (const lead of eligibleLeads) {
      try {
        console.log(`[audit-cold-leads] Auditing lead ${lead.session_id}...`);

        // Fetch last interactions for context
        const { data: interactions } = await supabase
          .from('interaction_db')
          .select('message_text, sender_type, timestamp')
          .eq('session_id', lead.session_id)
          .order('timestamp', { ascending: false })
          .limit(20);

        const conversationText = (interactions || []).reverse().map((i: any) => {
          const sender = i.sender_type === 'agent' ? 'VENDEDOR' : 'CLIENTE';
          return `${sender}: ${i.message_text || ''}`;
        }).join('\n') || 'Sem mensagens';

        const hoursSinceLastInteraction = Math.round(
          (Date.now() - new Date(lead.last_interaction_at).getTime()) / (1000 * 60 * 60)
        );

        const prompt = `Você é um analista de vendas. Este lead está sem interação há ${hoursSinceLastInteraction} horas.

DADOS DO LEAD:
- Canal: ${lead.channel || 'N/A'}
- Status de venda: ${lead.sales_status || 'N/A'}
- Vendedor: ${lead.sales_person_id || 'N/A'}
- Temperatura: ${lead.lead_temperature || 'N/A'}
- Sentimento: ${lead.sentiment || 'N/A'}
- Serviço desejado: ${lead.service_desired || 'N/A'}

ÚLTIMAS MENSAGENS:
${conversationText}

Analise e responda usando a função fornecida.`;

        const aiResponse = await fetch(
          'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${geminiApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gemini-2.5-flash',
              messages: [
                {
                  role: 'system',
                  content: `Você é um analista de vendas especializado em diagnóstico de leads frios. Analise por que o lead esfriou, se o vendedor fez follow-up adequado, qual a chance de reativação e sugira ações concretas.`
                },
                { role: 'user', content: prompt }
              ],
              tools: [{
                type: 'function',
                function: {
                  name: 'cold_audit',
                  description: 'Resultado da auditoria de lead frio',
                  parameters: {
                    type: 'object',
                    properties: {
                      cold_audit_reason: {
                        type: 'string',
                        description: 'Por que o lead esfriou? (1-2 frases)'
                      },
                      cold_audit_followup_ok: {
                        type: 'boolean',
                        description: 'O vendedor fez follow-up adequado? true/false'
                      },
                      cold_audit_reactivation_chance: {
                        type: 'string',
                        enum: ['alta', 'media', 'baixa', 'nenhuma'],
                        description: 'Chance de reativar este lead'
                      },
                      cold_audit_suggestion: {
                        type: 'string',
                        description: 'Sugestão concreta de ação para recuperar o lead (1-2 frases)'
                      }
                    },
                    required: ['cold_audit_reason', 'cold_audit_followup_ok', 'cold_audit_reactivation_chance', 'cold_audit_suggestion']
                  }
                }
              }],
              tool_choice: { type: 'function', function: { name: 'cold_audit' } }
            }),
          }
        );

        if (!aiResponse.ok) {
          const errText = await aiResponse.text();
          console.error(`[audit-cold-leads] AI error for lead ${lead.session_id}:`, aiResponse.status, errText);
          errors++;

          if (aiResponse.status === 429) {
            console.warn('[audit-cold-leads] Rate limited, waiting 10s...');
            await new Promise(r => setTimeout(r, 10000));
          }
          continue;
        }

        const aiData = await aiResponse.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

        if (!toolCall?.function?.arguments) {
          console.warn(`[audit-cold-leads] No tool call for lead ${lead.session_id}`);
          errors++;
          continue;
        }

        const result = JSON.parse(toolCall.function.arguments);

        // Update lead with cold audit results
        const existingTags = lead.ai_tags || [];
        const { error: updateError } = await supabase
          .from('lead_db')
          .update({
            cold_audit_reason: result.cold_audit_reason,
            cold_audit_followup_ok: result.cold_audit_followup_ok,
            cold_audit_reactivation_chance: result.cold_audit_reactivation_chance,
            cold_audit_suggestion: result.cold_audit_suggestion,
            cold_audit_at: new Date().toISOString(),
            ai_tags: [...existingTags, 'auditoria_fria'],
          })
          .eq('session_id', lead.session_id);

        if (updateError) {
          console.error(`[audit-cold-leads] Update error for lead ${lead.session_id}:`, updateError);
          errors++;
          continue;
        }

        audited++;
        console.log(`[audit-cold-leads] Lead ${lead.session_id} audited: reactivation=${result.cold_audit_reactivation_chance}, followup_ok=${result.cold_audit_followup_ok}`);

        // Delay between calls
        if (eligibleLeads.indexOf(lead) < eligibleLeads.length - 1) {
          await new Promise(r => setTimeout(r, DELAY_BETWEEN_CALLS_MS));
        }
      } catch (leadError) {
        console.error(`[audit-cold-leads] Error processing lead ${lead.session_id}:`, leadError);
        errors++;
      }
    }

    const duration = Date.now() - startTime;

    await supabase.from('audit_logs').insert({
      event_type: 'cold_audit_run',
      status: errors > 0 ? 'partial' : 'success',
      function_name: 'audit-cold-leads',
      event_details: {
        total_found: eligibleLeads.length,
        audited,
        errors,
        duration_ms: duration,
      },
      execution_time_ms: duration,
    });

    console.log(`[audit-cold-leads] Completed: ${audited} audited, ${errors} errors in ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        total_eligible: eligibleLeads.length,
        audited,
        errors,
        duration_ms: duration,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('[audit-cold-leads] Fatal error:', error);

    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

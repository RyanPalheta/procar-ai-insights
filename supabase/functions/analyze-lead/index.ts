import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Lovable AI Gateway
const AI_GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const AI_MODEL = 'google/gemini-2.5-flash';
const AI_VERSION = 'lovable-ai-gemini-flash-v2';

// Max messages to send to AI (first 15 + last 15 if > 30)
const MAX_MESSAGES = 30;

async function logEvent(supabase: any, eventType: string, eventData: any) {
  try {
    await supabase.from('audit_logs').insert({
      event_type: eventType,
      event_data: eventData,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error logging event:', error);
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let supabase: any;

  try {
    const { session_id } = await req.json();
    
    if (!session_id) {
      return new Response(
        JSON.stringify({ error: 'session_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[analyze-lead] Starting analysis for session_id: ${session_id}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get Lovable API Key
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Fetch lead data
    const { data: lead, error: leadError } = await supabase
      .from('lead_db')
      .select('*')
      .eq('session_id', session_id)
      .single();

    if (leadError || !lead) {
      console.error('Lead not found:', leadError);
      return new Response(
        JSON.stringify({ error: 'Lead not found', details: leadError }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch interactions (client messages only)
    const { data: interactions, error: interactionsError } = await supabase
      .from('interaction_db')
      .select('*')
      .eq('session_id', session_id)
      .order('timestamp', { ascending: true });

    if (interactionsError) {
      console.error('Error fetching interactions:', interactionsError);
    }

    // Fetch calls
    const { data: calls, error: callsError } = await supabase
      .from('call_db')
      .select('*')
      .eq('session_id', session_id)
      .order('created_at', { ascending: true });

    if (callsError) {
      console.error('Error fetching calls:', callsError);
    }

    // Fetch products for reference
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('product_name, product_type');

    if (productsError) {
      console.error('Error fetching products:', productsError);
    }

    const productList = products?.map((p: any) => `- ${p.product_name}`).join('\n') || 'Nenhum produto cadastrado';

    // Limit messages if too many (first 15 + last 15)
    let limitedInteractions = interactions || [];
    if (limitedInteractions.length > MAX_MESSAGES) {
      const firstHalf = limitedInteractions.slice(0, 15);
      const lastHalf = limitedInteractions.slice(-15);
      limitedInteractions = [...firstHalf, ...lastHalf];
      console.log(`[analyze-lead] Truncated interactions from ${interactions?.length} to ${limitedInteractions.length}`);
    }

    // Build conversation text (focus on client messages)
    const conversationText = limitedInteractions.map((i: any) => {
      const sender = i.sender_type || 'cliente';
      const time = new Date(i.timestamp).toLocaleString('pt-BR');
      return `[${time}] ${sender}: ${i.message_text || ''}`;
    }).join('\n');

    // Build call summary if available
    const callSummary = calls?.length > 0 
      ? calls.map((c: any) => `- Ligação ${c.type || 'N/A'}: duração ${c.call_duration || 0}s, resultado: ${c.call_result || 'N/A'}`).join('\n')
      : 'Nenhuma ligação registrada';

    console.log(`[analyze-lead] Interactions: ${limitedInteractions.length}, Calls: ${calls?.length || 0}`);

    // Single unified AI call for lead qualification
    const systemPrompt = `Você é um analista de qualificação de leads especializado em vendas.

Sua tarefa é analisar as mensagens de uma conversa e qualificar o lead.

IMPORTANTE:
- Foque em entender as NECESSIDADES e INTENÇÕES do cliente
- Identifique qual produto/serviço o cliente deseja
- Avalie o potencial de conversão

Responda usando a função 'analyze_lead' com os campos solicitados.`;

    const userPrompt = `Analise esta conversa e qualifique o lead.

PRODUTOS/SERVIÇOS DISPONÍVEIS:
${productList}

HISTÓRICO DE MENSAGENS:
${conversationText || 'Nenhuma mensagem disponível'}

RESUMO DE LIGAÇÕES:
${callSummary}

INFORMAÇÕES ADICIONAIS DO LEAD:
- Canal: ${lead.channel || 'N/A'}
- Idioma: ${lead.lead_language || 'N/A'}
- Status atual: ${lead.sales_status || 'N/A'}

Analise e responda:
1. Qual produto/serviço o cliente demonstra interesse? (escolha da lista ou null se não identificado)
2. Qual a temperatura do lead? (quente = pronto para comprar, morno = interessado mas com dúvidas, frio = apenas pesquisando)
3. Qual o sentimento geral do cliente? (Positivo, Neutro, Negativo)
4. Qual o potencial de conversão (0-100)?
5. Tags relevantes para categorização (3-5 tags)
6. Oportunidades de upsell identificadas
7. Resumo das principais necessidades do cliente (2-3 frases)
8. Qual a intenção principal do lead? (escolha UMA: Orçamento, Dúvida, Negociar, Comparar, Agendamento)
9. O cliente apresentou alguma objeção durante o atendimento? (sim/não)
10. Se houve objeção, qual foi ela em uma frase?`;

    console.log(`[analyze-lead] Calling Lovable AI Gateway...`);

    const aiResponse = await fetch(AI_GATEWAY, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'analyze_lead',
              description: 'Analisa e qualifica um lead com base na conversa',
              parameters: {
                type: 'object',
                properties: {
                  service_desired: {
                    type: 'string',
                    nullable: true,
                    description: 'Produto/serviço que o cliente deseja (da lista fornecida ou null)'
                  },
                  lead_temperature: {
                    type: 'string',
                    enum: ['quente', 'morno', 'frio'],
                    description: 'Temperatura do lead baseada na intenção de compra'
                  },
                  sentiment: {
                    type: 'string',
                    enum: ['Positivo', 'Neutro', 'Negativo'],
                    description: 'Sentimento geral do cliente na conversa'
                  },
                  lead_score: {
                    type: 'number',
                    minimum: 0,
                    maximum: 100,
                    description: 'Potencial de conversão de 0 a 100'
                  },
                  ai_tags: {
                    type: 'array',
                    items: { type: 'string' },
                    description: '3-5 tags para categorizar o lead'
                  },
                  upsell_opportunity: {
                    type: 'string',
                    nullable: true,
                    description: 'Oportunidades de upsell identificadas'
                  },
                  customer_needs_summary: {
                    type: 'string',
                    description: 'Resumo das principais necessidades do cliente (2-3 frases)'
                  },
                  lead_intent: {
                    type: 'string',
                    enum: ['Orçamento', 'Dúvida', 'Negociar', 'Comparar', 'Agendamento'],
                    description: 'Intenção principal do lead'
                  },
                  has_objection: {
                    type: 'boolean',
                    description: 'Se o cliente apresentou objeção no atendimento'
                  },
                  objection_detail: {
                    type: 'string',
                    nullable: true,
                    description: 'Detalhe da objeção em uma frase (se houver)'
                  }
                },
                required: ['lead_temperature', 'sentiment', 'lead_score', 'ai_tags', 'customer_needs_summary', 'lead_intent', 'has_objection']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'analyze_lead' } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error(`[analyze-lead] AI Gateway error: ${aiResponse.status}`, errorText);
      
      // Handle rate limits
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI Gateway error: ${aiResponse.status} - ${errorText}`);
    }

    const aiData = await aiResponse.json();
    console.log(`[analyze-lead] AI response received`);

    // Parse the tool call response
    let analysisResult: any = {};
    
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall && toolCall.function?.arguments) {
      try {
        analysisResult = JSON.parse(toolCall.function.arguments);
        console.log(`[analyze-lead] Parsed analysis:`, analysisResult);
      } catch (parseError) {
        console.error('[analyze-lead] Error parsing tool arguments:', parseError);
        analysisResult = {};
      }
    } else {
      console.warn('[analyze-lead] No tool call in response, using defaults');
    }

    // Validate service_desired against products
    let finalServiceDesired = null;
    if (analysisResult.service_desired && products) {
      const matchedProduct = products.find((p: any) => 
        p.product_name.toLowerCase() === analysisResult.service_desired?.toLowerCase() ||
        analysisResult.service_desired?.toLowerCase().includes(p.product_name.toLowerCase())
      );
      finalServiceDesired = matchedProduct?.product_name || lead.service_desired || null;
    }

    // Prepare update payload (only lead-focused metrics)
    const updatePayload: any = {
      session_id: session_id,
      sentiment: analysisResult.sentiment || 'Neutro',
      lead_score: analysisResult.lead_score || 50,
      lead_temperature: analysisResult.lead_temperature || 'morno',
      service_desired: finalServiceDesired,
      ai_tags: analysisResult.ai_tags || [],
      upsell_opportunity: analysisResult.upsell_opportunity || null,
      improvement_point: analysisResult.customer_needs_summary || null, // Reusing field for customer needs
      lead_intent: analysisResult.lead_intent || null,
      has_objection: analysisResult.has_objection || false,
      objection_detail: analysisResult.objection_detail || null,
      processed: true,
      ai_version: AI_VERSION,
      last_ai_update: new Date().toISOString(),
      // Explicitly set salesperson-related fields to null (not relevant without salesperson messages)
      playbook_compliance_score: null,
      playbook_steps_completed: null,
      playbook_steps_missing: null,
      playbook_violations: null,
      service_rating: null
    };

    // Call update-lead function
    const { data: updateData, error: updateError } = await supabase.functions.invoke('update-lead', {
      body: updatePayload
    });

    if (updateError) {
      console.error('[analyze-lead] Error calling update-lead:', updateError);
      throw new Error(`Failed to update lead: ${updateError.message}`);
    }

    const duration = Date.now() - startTime;
    console.log(`[analyze-lead] Analysis completed in ${duration}ms`);

    // Log success
    await logEvent(supabase, 'lead_analysis_completed', {
      session_id,
      duration_ms: duration,
      ai_version: AI_VERSION,
      service_desired: updatePayload.service_desired,
      lead_temperature: updatePayload.lead_temperature,
      lead_score: updatePayload.lead_score,
      sentiment: updatePayload.sentiment
    });

    return new Response(
      JSON.stringify({
        success: true,
        session_id,
        analysis: {
          service_desired: updatePayload.service_desired,
          lead_temperature: updatePayload.lead_temperature,
          sentiment: updatePayload.sentiment,
          lead_score: updatePayload.lead_score,
          ai_tags: updatePayload.ai_tags,
          upsell_opportunity: updatePayload.upsell_opportunity,
          customer_needs_summary: updatePayload.improvement_point
        },
        duration_ms: duration,
        ai_version: AI_VERSION
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error(`[analyze-lead] Error after ${duration}ms:`, error);

    // Log error
    if (supabase) {
      await logEvent(supabase, 'lead_analysis_error', {
        error: error.message,
        duration_ms: duration
      });
    }

    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

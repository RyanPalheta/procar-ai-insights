import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Google Gemini API (OpenAI-compatible endpoint)
const AI_GATEWAY = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const AI_MODEL = 'gemini-2.5-flash';
const AI_VERSION = 'google-gemini-flash-v1';

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

    // Get Google Gemini API Key
    const geminiApiKey = Deno.env.get('GOOGLE_GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('GOOGLE_GEMINI_API_KEY is not configured');
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

    // Fetch interactions (all messages)
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

    // Separate messages by sender type
    const allInteractions = interactions || [];
    const clientMessages = allInteractions.filter((i: any) => i.sender_type === 'client' || !i.sender_type);
    const agentMessages = allInteractions.filter((i: any) => i.sender_type === 'agent');
    
    console.log(`[analyze-lead] Total interactions: ${allInteractions.length}, Client: ${clientMessages.length}, Agent: ${agentMessages.length}`);

    // Limit messages if too many (first 15 + last 15)
    let limitedInteractions = allInteractions;
    if (limitedInteractions.length > MAX_MESSAGES) {
      const firstHalf = limitedInteractions.slice(0, 15);
      const lastHalf = limitedInteractions.slice(-15);
      limitedInteractions = [...firstHalf, ...lastHalf];
      console.log(`[analyze-lead] Truncated interactions from ${allInteractions.length} to ${limitedInteractions.length}`);
    }

    // Build conversation text with sender identification
    const conversationText = limitedInteractions.map((i: any) => {
      const sender = i.sender_type === 'agent' ? 'VENDEDOR' : 'CLIENTE';
      const time = new Date(i.timestamp).toLocaleString('pt-BR');
      return `[${time}] ${sender}: ${i.message_text || ''}`;
    }).join('\n');

    // Build separate texts for client and agent messages
    const clientMessagesText = clientMessages.map((i: any) => {
      const time = new Date(i.timestamp).toLocaleString('pt-BR');
      return `[${time}] ${i.message_text || ''}`;
    }).join('\n') || 'Nenhuma mensagem do cliente';

    const agentMessagesText = agentMessages.map((i: any) => {
      const time = new Date(i.timestamp).toLocaleString('pt-BR');
      return `[${time}] ${i.message_text || ''}`;
    }).join('\n') || 'Nenhuma mensagem do vendedor';

    // Build call summary if available
    const callSummary = calls?.length > 0 
      ? calls.map((c: any) => `- Ligação ${c.type || 'N/A'}: duração ${c.call_duration || 0}s, resultado: ${c.call_result || 'N/A'}`).join('\n')
      : 'Nenhuma ligação registrada';

    console.log(`[analyze-lead] Interactions: ${limitedInteractions.length}, Calls: ${calls?.length || 0}`);

    // Determine if we have agent messages for compliance analysis
    const hasAgentMessages = agentMessages.length > 0;

    // Build system prompt based on whether we have agent messages
    let systemPrompt = `Você é um analista de qualificação de leads especializado em vendas.

Sua tarefa é analisar as mensagens de uma conversa e qualificar o lead.

IMPORTANTE:
- Foque em entender as NECESSIDADES e INTENÇÕES do cliente
- Identifique qual produto/serviço o cliente deseja
- Avalie o potencial de conversão`;

    if (hasAgentMessages) {
      systemPrompt += `
- TAMBÉM avalie o desempenho do VENDEDOR em seguir o playbook de vendas
- Verifique se o vendedor seguiu todos os passos obrigatórios
- Identifique violações ou passos pulados
- Verifique se o vendedor utilizou estratégias de venda (ofertas, promoções, ancoragem de preço)`;
    }

    systemPrompt += `

Responda usando a função 'analyze_lead' com os campos solicitados.`;

    // Build user prompt
    let userPrompt = `Analise esta conversa e qualifique o lead.

PRODUTOS/SERVIÇOS DISPONÍVEIS:
${productList}

CONVERSA COMPLETA:
${conversationText}

MENSAGENS DO CLIENTE:
${clientMessagesText}

MENSAGENS DO VENDEDOR:
${agentMessagesText}

RESUMO DE LIGAÇÕES:
${callSummary}

INFORMAÇÕES ADICIONAIS DO LEAD:
- Canal: ${lead.channel || 'N/A'}
- Idioma: ${lead.lead_language || 'N/A'}
- Status atual: ${lead.sales_status || 'N/A'}`;

    // If we have agent messages, fetch and include playbook
    let playbook: any = null;
    if (hasAgentMessages) {
      // First, try to identify product from existing lead data or from products list
      let productType: string | null = null;
      
      if (lead.service_desired && products) {
        const matchedProduct = products.find((p: any) => 
          p.product_name.toLowerCase() === lead.service_desired?.toLowerCase() ||
          lead.service_desired?.toLowerCase().includes(p.product_name.toLowerCase())
        );
        productType = matchedProduct?.product_type || null;
      }

      // Fetch playbook if we have a product type
      if (productType) {
        const { data: playbookData, error: playbookError } = await supabase
          .from('playbooks')
          .select('title, content, steps')
          .eq('product_type', productType)
          .single();

        if (!playbookError && playbookData) {
          playbook = playbookData;
          console.log(`[analyze-lead] Found playbook for product_type: ${productType}`);
        } else {
          console.log(`[analyze-lead] No playbook found for product_type: ${productType}`);
        }
      }

      // If no product type yet, fetch a general playbook or skip compliance
      if (!playbook) {
        // Try to get any playbook to use as reference (will be refined after product identification)
        const { data: anyPlaybook } = await supabase
          .from('playbooks')
          .select('title, content, steps')
          .limit(1)
          .single();
        
        if (anyPlaybook) {
          playbook = anyPlaybook;
          console.log(`[analyze-lead] Using default playbook as reference`);
        }
      }

      if (playbook) {
        userPrompt += `

PLAYBOOK DE VENDAS A SER SEGUIDO (${playbook.title}):
${playbook.content}

AVALIAÇÃO DO VENDEDOR:
Analise se o vendedor seguiu corretamente o playbook acima. Verifique:
1. Quais passos foram executados corretamente
2. Quais passos foram pulados ou esquecidos
3. Se houve violações das diretrizes (ex: não se apresentou, não perguntou nome, pulou etapas importantes)
4. Dê uma nota geral do atendimento (0-10)
5. Calcule o score de aderência ao playbook (0-100)
6. Verifique se o vendedor usou técnicas de vendas (ofertas, ancoragem)
   - Usar estratégias de venda AUMENTA a nota do atendimento em até +2 pontos
   - Não usar estratégias em momento oportuno PODE diminuir a nota`;
      }
    }

    userPrompt += `

Analise e responda:
1. Qual produto/serviço o cliente demonstra interesse? (escolha da lista ou null se não identificado)
2. Qual a temperatura do lead? (quente = pronto para comprar, morno = interessado mas com dúvidas, frio = apenas pesquisando)
3. Qual o sentimento geral do cliente? (Positivo, Neutro, Negativo)
4. Qual o potencial de conversão (0-100)?
5. Tags relevantes para categorização (3-5 tags)
6. Oportunidades de upsell identificadas
7. Resumo das principais necessidades do cliente (2-3 frases)
8. Resumo da necessidade principal em UMA ÚNICA FRASE CURTA (máximo 15 palavras, ex: "Precisa de orçamento para festa de 50 pessoas")
9. Qual a intenção principal do lead? (escolha UMA: Orçamento, Dúvida, Negociar, Comparar, Agendamento)
10. O cliente apresentou alguma objeção durante o atendimento? (sim/não)
11. Se houve objeção, qual foi ela em uma frase?
12. Se houve objeção, classifique em UMA ou MAIS categorias:
    - preco (preço alto, orçamento limitado, busca desconto)
    - tempo (tempo de espera, agenda ocupada, prazo)
    - distancia (localização, distância da loja)
    - financiamento (parcelamento, juros, forma de pagamento)
    - confianca (qualidade, garantia, desconfiança)
    - concorrencia (comparando com outros, já tem proposta)
    - tecnica (dúvida técnica, compatibilidade)
    - indecisao (precisa pensar, não está pronto)
13. Se o cliente apresentou objeção, o vendedor conseguiu contorná-la?
    - Contornada (true): O vendedor apresentou argumentos, ofereceu soluções, ou o cliente demonstrou aceitar/entender
    - Não contornada (false): A objeção permaneceu sem resposta adequada ou o cliente manteve a resistência
14. O vendedor ofereceu alguma promoção, desconto ou condição especial durante a conversa? (sim/não)
    - Exemplos: desconto, promoção, oferta especial, condição especial, frete grátis, brinde, parcelamento sem juros
15. Se ofereceu, descreva qual oferta/promoção foi usada em uma frase curta
16. O vendedor utilizou estratégia de ancoragem de preço? (sim/não)
    - Exemplos: Mostrou preço "de X por Y", comparou com concorrência, apresentou valor agregado antes do preço, ofereceu pacote com mais valor percebido
17. Se usou ancoragem, descreva qual estratégia em uma frase curta
18. Foi mencionado algum valor/preço na conversa pelo vendedor? Se sim, extraia o valor numérico (ex: "$85" → 85, "R$ 450,00" → 450)
19. Uma cotação formal de preço foi apresentada ao cliente?`;

    if (hasAgentMessages && playbook) {
      userPrompt += `
13. Score de aderência ao playbook (0-100) - quanto o vendedor seguiu o roteiro
14. Lista de passos do playbook que foram seguidos corretamente
15. Lista de passos do playbook que NÃO foram seguidos
16. Violações críticas identificadas no atendimento (se houver)
17. Nota geral do atendimento do vendedor (0-10)`;
    }

    console.log(`[analyze-lead] Calling Google Gemini API...`);

    // Build tool parameters - base parameters for all analyses
    const toolParameters: any = {
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
        need_summary: {
          type: 'string',
          description: 'Resumo da necessidade principal em UMA ÚNICA FRASE CURTA (máximo 15 palavras)'
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
        },
        objection_categories: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['preco', 'tempo', 'distancia', 'financiamento', 'confianca', 'concorrencia', 'tecnica', 'indecisao']
          },
          description: 'Categorias de objeção identificadas (pode ser múltiplas)'
        },
        objection_overcome: {
          type: 'boolean',
          nullable: true,
          description: 'Se a objeção apresentada foi contornada pelo vendedor (true/false, null se não houver objeção)'
        },
        used_offer: {
          type: 'boolean',
          description: 'Se o vendedor ofereceu promoção, desconto ou condição especial'
        },
        offer_detail: {
          type: 'string',
          nullable: true,
          description: 'Descrição da oferta/promoção utilizada pelo vendedor'
        },
        used_anchoring: {
          type: 'boolean',
          description: 'Se o vendedor usou estratégia de ancoragem de preço'
        },
        anchoring_detail: {
          type: 'string',
          nullable: true,
          description: 'Descrição da estratégia de ancoragem utilizada'
        },
        quoted_price: {
          type: 'number',
          nullable: true,
          description: 'Valor monetário cotado pelo vendedor (ex: 85 para "$85", 450 para "R$ 450,00"). Null se nenhum preço foi mencionado.'
        },
        has_quote: {
          type: 'boolean',
          description: 'Se uma cotação ou preço formal foi apresentado ao cliente'
        }
      },
      required: ['lead_temperature', 'sentiment', 'lead_score', 'ai_tags', 'customer_needs_summary', 'need_summary', 'lead_intent', 'has_objection', 'used_offer', 'used_anchoring', 'has_quote']
    };

    // Add compliance fields if we have agent messages and a playbook
    if (hasAgentMessages && playbook) {
      toolParameters.properties.playbook_compliance_score = {
        type: 'number',
        minimum: 0,
        maximum: 100,
        description: 'Score de aderência ao playbook (0-100) - quanto o vendedor seguiu o roteiro de vendas'
      };
      toolParameters.properties.playbook_steps_completed = {
        type: 'array',
        items: { type: 'string' },
        description: 'Lista de passos do playbook que foram seguidos corretamente pelo vendedor'
      };
      toolParameters.properties.playbook_steps_missing = {
        type: 'array',
        items: { type: 'string' },
        description: 'Lista de passos do playbook que NÃO foram seguidos pelo vendedor'
      };
      toolParameters.properties.playbook_violations = {
        type: 'string',
        nullable: true,
        description: 'Violações críticas identificadas no atendimento do vendedor (ex: não se apresentou, foi rude, pulou etapas obrigatórias)'
      };
      toolParameters.properties.service_rating = {
        type: 'number',
        minimum: 0,
        maximum: 10,
        description: 'Nota geral do atendimento do vendedor (0-10)'
      };
      
      // Add to required fields
      toolParameters.required.push('playbook_compliance_score', 'service_rating');
    }

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
          { role: 'user', content: userPrompt }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'analyze_lead',
              description: 'Analisa e qualifica um lead com base na conversa, incluindo avaliação de compliance do vendedor se houver mensagens do vendedor',
              parameters: toolParameters
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
      finalServiceDesired = matchedProduct?.product_name || analysisResult.service_desired || lead.service_desired || null;
    }

    // Prepare update payload
    const updatePayload: any = {
      session_id: session_id,
      sentiment: analysisResult.sentiment || 'Neutro',
      lead_score: analysisResult.lead_score || 50,
      lead_temperature: analysisResult.lead_temperature || 'morno',
      service_desired: finalServiceDesired,
      ai_tags: analysisResult.ai_tags || [],
      upsell_opportunity: analysisResult.upsell_opportunity || null,
      improvement_point: analysisResult.customer_needs_summary || null, // Full needs summary
      need_summary: analysisResult.need_summary || null, // One-line summary
      lead_intent: analysisResult.lead_intent || null,
      has_objection: analysisResult.has_objection || false,
      objection_detail: analysisResult.objection_detail || null,
      objection_categories: analysisResult.objection_categories || null,
      objection_overcome: analysisResult.has_objection ? (analysisResult.objection_overcome ?? false) : null,
      processed: true,
      ai_version: AI_VERSION,
      last_ai_update: new Date().toISOString(),
      // Compliance fields - only populate if we analyzed agent messages
      playbook_compliance_score: hasAgentMessages && playbook ? (analysisResult.playbook_compliance_score || null) : null,
      playbook_steps_completed: hasAgentMessages && playbook ? (analysisResult.playbook_steps_completed || null) : null,
      playbook_steps_missing: hasAgentMessages && playbook ? (analysisResult.playbook_steps_missing || null) : null,
      playbook_violations: hasAgentMessages && playbook ? (analysisResult.playbook_violations || null) : null,
      service_rating: hasAgentMessages && playbook ? (analysisResult.service_rating || null) : null,
      // Sales strategy fields
      used_offer: hasAgentMessages ? (analysisResult.used_offer || false) : null,
      offer_detail: hasAgentMessages ? (analysisResult.offer_detail || null) : null,
      used_anchoring: hasAgentMessages ? (analysisResult.used_anchoring || false) : null,
      anchoring_detail: hasAgentMessages ? (analysisResult.anchoring_detail || null) : null,
      // Price extraction
      lead_price: analysisResult.quoted_price || null,
      // Mark this as AI analysis for history tracking
      change_source: 'ai_analysis'
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

    // Log success with compliance info
    await logEvent(supabase, 'lead_analysis_completed', {
      session_id,
      duration_ms: duration,
      ai_version: AI_VERSION,
      service_desired: updatePayload.service_desired,
      lead_temperature: updatePayload.lead_temperature,
      lead_score: updatePayload.lead_score,
      sentiment: updatePayload.sentiment,
      has_agent_messages: hasAgentMessages,
      has_playbook: !!playbook,
      playbook_compliance_score: updatePayload.playbook_compliance_score,
      service_rating: updatePayload.service_rating
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
          customer_needs_summary: updatePayload.improvement_point,
          need_summary: updatePayload.need_summary,
          // Compliance results
          playbook_compliance_score: updatePayload.playbook_compliance_score,
          playbook_steps_completed: updatePayload.playbook_steps_completed,
          playbook_steps_missing: updatePayload.playbook_steps_missing,
          playbook_violations: updatePayload.playbook_violations,
          service_rating: updatePayload.service_rating,
          has_agent_messages: hasAgentMessages,
          has_playbook: !!playbook
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

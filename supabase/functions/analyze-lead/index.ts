import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to log events to audit_logs
async function logEvent(
  supabase: any,
  eventType: string,
  functionName: string,
  status: string,
  sessionId?: number,
  eventDetails?: any,
  executionTimeMs?: number,
  errorMessage?: string
) {
  try {
    await supabase.from('audit_logs').insert({
      session_id: sessionId,
      event_type: eventType,
      function_name: functionName,
      event_details: eventDetails,
      status: status,
      execution_time_ms: executionTimeMs,
      error_message: errorMessage
    });
  } catch (error) {
    console.error('[audit_logs] Failed to log event:', error);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let sessionId: number | undefined;

  try {
    const { session_id } = await req.json();
    sessionId = session_id;
    
    if (!session_id) {
      return new Response(
        JSON.stringify({ error: 'session_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[analyze-lead] Starting analysis for session_id: ${session_id}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Log start of analysis
    await logEvent(
      supabase,
      'ai_analysis_started',
      'analyze-lead',
      'pending',
      session_id,
      { action: 'start_analysis' }
    );

    // Step 1: Fetch lead data
    const { data: lead, error: leadError } = await supabase
      .from('lead_db')
      .select('*')
      .eq('session_id', session_id)
      .single();

    if (leadError || !lead) {
      console.error('[analyze-lead] Lead not found:', leadError);
      return new Response(
        JSON.stringify({ error: 'Lead not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 2: Fetch interactions
    const { data: interactions, error: interactionsError } = await supabase
      .from('interaction_db')
      .select('*')
      .eq('session_id', session_id)
      .order('timestamp', { ascending: true });

    if (interactionsError) {
      console.error('[analyze-lead] Error fetching interactions:', interactionsError);
    }

    // Step 3: Fetch calls
    const { data: calls, error: callsError } = await supabase
      .from('call_db')
      .select('*')
      .eq('session_id', session_id);

    if (callsError) {
      console.error('[analyze-lead] Error fetching calls:', callsError);
    }

    // Step 4: Fetch all valid products first
    const { data: allProducts } = await supabase
      .from('products')
      .select('product_name, product_type');
    
    const validProductNames = allProducts?.map(p => p.product_name) || [];
    const productList = validProductNames.join('\n- ');
    
    // Helper function to validate and find exact product match
    const findValidProduct = (productText: string | null | undefined): string | null => {
      if (!productText) return null;
      
      // Exact match (case insensitive)
      const exactMatch = validProductNames.find(
        p => p.toLowerCase() === productText.toLowerCase()
      );
      if (exactMatch) return exactMatch;
      
      // Partial match (product name contains or is contained in the text)
      const partialMatch = validProductNames.find(p => 
        productText.toLowerCase().includes(p.toLowerCase()) ||
        p.toLowerCase().includes(productText.toLowerCase())
      );
      if (partialMatch) return partialMatch;
      
      return null;
    };
    
    // Step 5: Identify product if service_desired is empty
    let identifiedProduct = findValidProduct(lead.service_desired);
    
    if (!identifiedProduct && interactions && interactions.length > 0) {
      console.log('[analyze-lead] Identifying product with AI...');
      
      const conversationText = interactions
        .map(i => `[${i.sender_type}]: ${i.message_text}`)
        .join('\n');

      const identifyPrompt = `Analise as interações abaixo e identifique qual produto ou serviço o lead demonstrou interesse.

INTERAÇÕES:
${conversationText}

PRODUTOS VÁLIDOS (escolha APENAS UM da lista abaixo):
- ${productList}

INSTRUÇÕES CRÍTICAS:
- Retorne APENAS o nome EXATO de um dos produtos listados acima
- Se não conseguir identificar claramente, retorne: null
- NÃO invente produtos ou retorne textos descritivos
- NÃO retorne "NÃO IDENTIFICADO" ou frases explicativas

FORMATO DA RESPOSTA: Nome do produto OU null`;

      const identifyResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-5-mini-2025-08-07',
          messages: [
            { role: 'system', content: 'Você SEMPRE retorna APENAS o nome exato do produto da lista fornecida, ou a palavra "null". Nada mais.' },
            { role: 'user', content: identifyPrompt }
          ],
          max_completion_tokens: 50
        })
      });

      if (!identifyResponse.ok) {
        console.error('[analyze-lead] OpenAI error identifying product:', await identifyResponse.text());
      } else {
        const identifyData = await identifyResponse.json();
        const rawProduct = identifyData.choices[0].message.content.trim();
        console.log(`[analyze-lead] Raw AI response: ${rawProduct}`);
        
        // Validate the identified product
        identifiedProduct = findValidProduct(rawProduct);
        console.log(`[analyze-lead] Validated product: ${identifiedProduct || 'null'}`);
      }
    }

    // Step 6: Map product to playbook
    let playbook = null;
    
    if (identifiedProduct) {
      const product = allProducts?.find(p => p.product_name === identifiedProduct);

      if (product) {
        console.log(`[analyze-lead] Product type: ${product.product_type}`);
        
        const { data: fetchedPlaybook } = await supabase
          .from('playbooks')
          .select('*')
          .eq('product_type', product.product_type)
          .single();

        playbook = fetchedPlaybook;
        console.log(`[analyze-lead] Playbook found: ${playbook?.title || 'N/A'}`);
      }
    }

    // Step 7: Perform AI analysis
    const conversationText = interactions
      ?.map(i => `[${i.sender_type} - ${i.timestamp}]: ${i.message_text}`)
      .join('\n') || 'Sem interações registradas';

    const callsText = calls
      ?.map(c => `Duração: ${c.call_duration}s, Resultado: ${c.call_result}`)
      .join('\n') || 'Sem chamadas registradas';

    const analysisPrompt = playbook 
      ? `Você é um auditor de vendas especializado. Analise se o vendedor seguiu o playbook de vendas.

PLAYBOOK ESPERADO (${playbook.product_type}):
${playbook.content}

CONVERSA REAL:
${conversationText}

CHAMADAS REALIZADAS:
${callsText}

PRODUTOS VÁLIDOS:
- ${productList}

INSTRUÇÕES IMPORTANTES:
- Para service_desired: retorne APENAS um dos produtos da lista acima ou deixe null se não identificar
- NÃO invente nomes de produtos ou use textos descritivos
- Se houver playbook, avalie compliance honestamente (0-100)
- Se NÃO houver playbook, deixe compliance como 0
- Para quoted_price: extraia qualquer valor monetário mencionado pelo vendedor (ex: "R$ 450,00" -> 450, "450 reais" -> 450). Se não houver valor, retorne null
- Para has_quote: true se houve cotação formal/oficial, false se foi apenas estimativa/menção informal

Forneça uma análise completa seguindo a estrutura da ferramenta.`
      : `Você é um auditor de vendas. Analise a conversa abaixo e forneça insights sobre o atendimento.

CONVERSA:
${conversationText}

CHAMADAS REALIZADAS:
${callsText}

PRODUTOS VÁLIDOS:
- ${productList}

INSTRUÇÕES IMPORTANTES:
- Para service_desired: retorne APENAS um dos produtos da lista acima ou deixe null se não identificar
- NÃO invente nomes de produtos ou use textos descritivos
- Deixe playbook_compliance_score como 0 (sem playbook para comparar)
- Para quoted_price: extraia qualquer valor monetário mencionado pelo vendedor (ex: "R$ 450,00" -> 450, "450 reais" -> 450). Se não houver valor, retorne null
- Para has_quote: true se houve cotação formal/oficial, false se foi apenas estimativa/menção informal

Forneça uma análise completa seguindo a estrutura da ferramenta.`;

    console.log('[analyze-lead] Sending to OpenAI for analysis...');

    const analysisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-5-2025-08-07',
        messages: [
          { role: 'system', content: 'Você é um auditor comercial especializado.' },
          { role: 'user', content: analysisPrompt }
        ],
        tools: [{
          type: "function",
          function: {
            name: "analyze_lead_with_playbook",
            description: "Análise completa de lead incluindo verificação de playbook",
            parameters: {
              type: "object",
              properties: {
                sentiment: { 
                  type: "string", 
                  enum: ["positivo", "neutro", "negativo"],
                  description: "Sentimento geral do lead baseado nas interações"
                },
                lead_score: { 
                  type: "number", 
                  minimum: 0, 
                  maximum: 100,
                  description: "Pontuação de engajamento e qualidade do lead"
                },
                improvement_point: { 
                  type: "string",
                  description: "Principal ponto de melhoria no atendimento"
                },
                upsell_opportunity: { 
                  type: "string",
                  description: "Oportunidades identificadas de cross-sell ou upsell"
                },
                service_desired: { 
                  type: "string",
                  description: "Nome EXATO do produto da lista fornecida, ou null se não identificado. NÃO use textos descritivos.",
                  nullable: true
                },
                ai_tags: { 
                  type: "array", 
                  items: { type: "string" },
                  description: "3-5 tags de categorização"
                },
                playbook_compliance_score: { 
                  type: "number", 
                  minimum: 0, 
                  maximum: 100,
                  description: "Score de aderência ao playbook (se aplicável)"
                },
                playbook_steps_completed: { 
                  type: "array", 
                  items: { type: "string" },
                  description: "Lista de etapas do playbook que foram seguidas"
                },
                playbook_steps_missing: { 
                  type: "array", 
                  items: { type: "string" },
                  description: "Lista de etapas que faltaram"
                },
                playbook_violations: { 
                  type: "string",
                  description: "Descrição de violações graves do playbook (se houver)"
                },
                lead_temperature: { 
                  type: "string", 
                  enum: ["quente", "morno", "frio"],
                  description: "Temperatura do lead: QUENTE = alta intenção (pede orçamento, quer agendar, responde rápido, urgência); MORNO = interessado mas indeciso (perguntas genéricas, demora a responder); FRIO = apenas pesquisando (poucas interações, sem urgência)"
                },
                quoted_price: {
                  type: "number",
                  nullable: true,
                  description: "Valor monetário do serviço cotado/mencionado nas interações (em reais). Retorne null se não houver valor mencionado. Converta valores como 'R$ 450,00' para 450."
                },
                has_quote: {
                  type: "boolean",
                  description: "Indica se foi apresentada uma cotação formal ao cliente (true) ou apenas estimativa/menção informal (false)"
                },
                service_rating: {
                  type: "number",
                  minimum: 1,
                  maximum: 10,
                  description: "Nota geral do atendimento de 1 a 10. Considere: qualidade do lead (lead_score), aderência ao playbook (compliance_score), profissionalismo na comunicação, engajamento do vendedor, resolução de dúvidas. 1-3: Ruim, 4-6: Regular, 7-8: Bom, 9-10: Excelente"
                }
              },
              required: ["sentiment", "lead_score", "improvement_point", "has_quote", "service_rating"]
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "analyze_lead_with_playbook" } }
      })
    });

    if (!analysisResponse.ok) {
      const errorText = await analysisResponse.text();
      console.error('[analyze-lead] OpenAI analysis error:', errorText);
      return new Response(
        JSON.stringify({ error: 'AI analysis failed', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const analysisData = await analysisResponse.json();
    const analysisResult = JSON.parse(
      analysisData.choices[0].message.tool_calls[0].function.arguments
    );

    console.log('[analyze-lead] Raw analysis result:', analysisResult);

    // Step 8: Validate and normalize the service_desired field
    let finalServiceDesired = findValidProduct(analysisResult.service_desired) || identifiedProduct;
    console.log('[analyze-lead] Final service_desired after validation:', finalServiceDesired || 'null');

    // Step 9: Update lead via update-lead function
    const updatePayload = {
      session_id: session_id,
      sentiment: analysisResult.sentiment,
      lead_score: analysisResult.lead_score,
      improvement_point: analysisResult.improvement_point,
      upsell_opportunity: analysisResult.upsell_opportunity,
      service_desired: finalServiceDesired,
      ai_tags: analysisResult.ai_tags,
      playbook_compliance_score: analysisResult.playbook_compliance_score || 0,
      playbook_steps_completed: analysisResult.playbook_steps_completed || [],
      playbook_steps_missing: analysisResult.playbook_steps_missing || [],
      playbook_violations: analysisResult.playbook_violations,
      lead_price: analysisResult.quoted_price || null,
      lead_temperature: analysisResult.lead_temperature || null,
      service_rating: analysisResult.service_rating || null,
      processed: true,
      ai_version: 'gpt-5-playbook-audit-v3'
    };

    const { data: updateData, error: updateError } = await supabase.functions.invoke('update-lead', {
      body: updatePayload
    });

    if (updateError) {
      console.error('[analyze-lead] Error updating lead:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update lead', details: updateError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[analyze-lead] Lead updated successfully');

    const executionTime = Date.now() - startTime;

    // Log successful completion
    await logEvent(
      supabase,
      'ai_analysis_completed',
      'analyze-lead',
      'success',
      session_id,
      {
        sentiment: analysisResult.sentiment,
        lead_score: analysisResult.lead_score,
        compliance_score: analysisResult.playbook_compliance_score,
        playbook_used: playbook?.title || null
      },
      executionTime
    );

    return new Response(
      JSON.stringify({ 
        success: true, 
        session_id,
        analysis: analysisResult,
        playbook_used: playbook?.title || null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[analyze-lead] Unexpected error:', error);
    
    const executionTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Log error
    if (sessionId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      await logEvent(
        supabase,
        'ai_analysis_error',
        'analyze-lead',
        'error',
        sessionId,
        { error: errorMessage },
        executionTime,
        errorMessage
      );
    }

    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { session_id } = await req.json();
    
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

    // Step 4: Identify product if service_desired is empty
    let identifiedProduct = lead.service_desired;
    
    if (!identifiedProduct && interactions && interactions.length > 0) {
      console.log('[analyze-lead] Identifying product with AI...');
      
      const { data: allProducts } = await supabase
        .from('products')
        .select('product_name');
      
      const productList = allProducts?.map(p => p.product_name).join(', ') || '';
      
      const conversationText = interactions
        .map(i => `[${i.sender_type}]: ${i.message_text}`)
        .join('\n');

      const identifyPrompt = `Analise as interações abaixo e identifique qual produto ou serviço o lead demonstrou interesse.

INTERAÇÕES:
${conversationText}

PRODUTOS DISPONÍVEIS:
${productList}

Retorne APENAS o nome exato do produto da lista acima. Se não conseguir identificar, retorne "NÃO IDENTIFICADO".`;

      const identifyResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-5-mini-2025-08-07',
          messages: [
            { role: 'system', content: 'Você é um assistente que identifica produtos baseado em conversas.' },
            { role: 'user', content: identifyPrompt }
          ],
          max_completion_tokens: 50
        })
      });

      if (!identifyResponse.ok) {
        console.error('[analyze-lead] OpenAI error identifying product:', await identifyResponse.text());
      } else {
        const identifyData = await identifyResponse.json();
        identifiedProduct = identifyData.choices[0].message.content.trim();
        console.log(`[analyze-lead] Product identified: ${identifiedProduct}`);
      }
    }

    // Step 5: Map product to playbook
    let playbook = null;
    
    if (identifiedProduct && identifiedProduct !== 'NÃO IDENTIFICADO') {
      const { data: product } = await supabase
        .from('products')
        .select('product_type')
        .eq('product_name', identifiedProduct)
        .single();

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

    // Step 6: Perform AI analysis
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

Forneça uma análise completa seguindo a estrutura da ferramenta.`
      : `Você é um auditor de vendas. Analise a conversa abaixo e forneça insights sobre o atendimento.

CONVERSA:
${conversationText}

CHAMADAS REALIZADAS:
${callsText}

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
                sales_status: { 
                  type: "string",
                  description: "Status atual do lead no funil de vendas"
                },
                upsell_opportunity: { 
                  type: "string",
                  description: "Oportunidades identificadas de cross-sell ou upsell"
                },
                service_desired: { 
                  type: "string",
                  description: "Produto ou serviço identificado"
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
                }
              },
              required: ["sentiment", "lead_score", "improvement_point", "sales_status"]
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

    console.log('[analyze-lead] Analysis complete:', analysisResult);

    // Step 7: Update lead via update-lead function
    const updatePayload = {
      session_id: session_id,
      sentiment: analysisResult.sentiment,
      lead_score: analysisResult.lead_score,
      improvement_point: analysisResult.improvement_point,
      sales_status: analysisResult.sales_status,
      upsell_opportunity: analysisResult.upsell_opportunity,
      service_desired: analysisResult.service_desired || identifiedProduct,
      ai_tags: analysisResult.ai_tags,
      playbook_compliance_score: analysisResult.playbook_compliance_score,
      playbook_steps_completed: analysisResult.playbook_steps_completed,
      playbook_steps_missing: analysisResult.playbook_steps_missing,
      playbook_violations: analysisResult.playbook_violations,
      processed: true,
      ai_version: 'gpt-5-playbook-audit-v1'
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
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

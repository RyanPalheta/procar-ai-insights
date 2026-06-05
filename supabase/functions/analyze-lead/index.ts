import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// AI provider — switch via AI_PROVIDER env (default 'gemini')
const AI_PROVIDER = (Deno.env.get('AI_PROVIDER') || 'gemini').toLowerCase();
const AI_CONFIG = AI_PROVIDER === 'openai'
  ? {
      gateway: 'https://api.openai.com/v1/chat/completions',
      model: Deno.env.get('AI_MODEL_OVERRIDE') || 'gpt-4o-mini',
      version: 'openai-gpt-4o-mini-v1',
      keyEnv: 'OPENAI_API_KEY',
    }
  : {
      gateway: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      model: Deno.env.get('AI_MODEL_OVERRIDE') || 'gemini-2.5-flash',
      version: 'google-gemini-flash-v1',
      keyEnv: 'GOOGLE_GEMINI_API_KEY',
    };
const AI_GATEWAY = AI_CONFIG.gateway;
const AI_MODEL = AI_CONFIG.model;
const AI_VERSION = AI_CONFIG.version;

// Max messages to send to AI (first 15 + last 15 if > 30)
const MAX_MESSAGES = 30;

// Keyword fallback (mirror of scan-services PRODUCT_KEYWORDS).
// Used when the LLM fails to identify a product so the lead still gets
// services_detected populated for Kommo sync. Zero LLM cost.
const PRODUCT_KEYWORDS: Record<string, string[]> = {
  'Remote Start': ['remote start','remote starter','remote-start','partida remota','partida a distancia','partida à distância','liga sozinho','controle remoto pra ligar','compustar','viper start'],
  'CarPlay': ['carplay','car play','apple carplay','apple car play','android auto','sistema multimidia','central multimidia','multimídia','head unit','head-unit','aftermarket unit','aftermarket radio','screen upgrade','upgrade screen','upgrade radio','touch screen','multimedia screen','pioneer dmh','pioneer 3000','pioneer avh','kenwood ddx','kenwood dmx','sony xav','alpine ilx','atoto','double din'],
  'Sound System': ['sound system','sound',' som ','som automotivo','caixa de som','subwoofer','amplificador','speaker','speakers','alto falante','alto-falante','alto-falantes','auto falante','audio upgrade','audio system',' sub ',' sub.',' sub,','sub and amp','sub & amp',' amp ',' amp.',' amp,','amplifier','tweeter','tweeters','midrange','midbass','crossover','enclosure','pillar pod','pillar pods','a-pillar','sound pod','jl audio','kicker','rockford','rockford fosgate','hertz audio','hertz m','hertz mille','focal audio','morel','audison','memphis audio','alpine type','alpine s-','alpine r-','pioneer ts','kenwood ksc','jbl club','jbl gx','jbl stage'],
  'Window Tint': ['window tint',' tint ','tinted','tinting','insulfilm','pelicula','película','pelicula automotiva','suntek','suntek carbon','suntek standart','suntek standard','sunteck','llumar','ceramic pro','formula one','xpel',' carbon ','3m tint','window film','tonalizar vidro','escurecer vidro','ceramic tint','ceramic film','shade','tint shade','vlt','darken windows'],
  'Backup Camera': ['backup cam','backup camera','reverse camera','camera de re','câmera de ré','camera de ré','camera traseira','rear camera','rearview camera','rear-view camera','reversing camera'],
  'Dashcam': ['dashcam','dash cam','dash-cam','camera de bordo','câmera de bordo','camera veicular','camera frontal','front cam','thinkware','blackvue','viofo','nextbase'],
  'Ambient Light': ['ambient light','ambient lights','ambient lighting','luz ambiente','iluminação ambiente','iluminacao ambiente','luzes internas led','interior led','mood lighting','rgb interior'],
  'LED Lights': ['led light','led lights','led headlight','led headlights','farol led','farois led','faróis led','lampada led','lâmpada led','kit led','led bulb','led bulbs','fog light','fog lights','underglow'],
  'Key Programming': ['key copy','key programming','car key','copia de chave','cópia de chave','programar chave','chave codificada','chave canivete','chave reserva','spare key','key fob','fob programming','transponder key'],
  'Labor': [' labor ','mão de obra','mao de obra','instalação','instalacao','serviço de instalação','install only','just install','installation cost'],
};

function detectProductsFromText(text: string): string[] {
  if (!text) return [];
  const padded = ` ${text.toLowerCase()} `;
  const matched = new Set<string>();
  for (const [product, keywords] of Object.entries(PRODUCT_KEYWORDS)) {
    if (keywords.some((kw) => padded.includes(kw))) matched.add(product);
  }
  return Array.from(matched);
}

async function logAudit(supabase: any, params: {
  event_type: string;
  session_id?: number;
  status?: string;
  error_message?: string;
  event_details?: any;
  execution_time_ms?: number;
  function_name?: string;
}) {
  try {
    await supabase.from('audit_logs').insert({
      event_type: params.event_type,
      session_id: params.session_id ?? null,
      status: params.status ?? 'info',
      error_message: params.error_message ?? null,
      event_details: params.event_details ?? null,
      execution_time_ms: params.execution_time_ms ?? null,
      function_name: params.function_name ?? 'analyze-lead',
    });
  } catch (error) {
    console.error('Error logging audit event:', error);
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

    // Get AI provider key
    const geminiApiKey = Deno.env.get(AI_CONFIG.keyEnv);
    if (!geminiApiKey) {
      throw new Error(`${AI_CONFIG.keyEnv} is not configured (provider=${AI_PROVIDER})`);
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
- Verifique se o vendedor utilizou estratégias de venda (ofertas, promoções, ancoragem de preço)
- Verifique se o vendedor fez SAUDAÇÃO INICIAL (se apresentou, cumprimentou o cliente, disse nome/empresa)
- Verifique se o vendedor fez QUALIFICAÇÃO do cliente (perguntas sobre necessidade, veículo, ano, modelo, orçamento)`;
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
          .select('title, content, steps, stage_requirements')
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
          .select('title, content, steps, stage_requirements')
          .limit(1)
          .single();

        if (anyPlaybook) {
          playbook = anyPlaybook;
          console.log(`[analyze-lead] Using default playbook as reference`);
        }
      }

      if (playbook) {
        const stageReqJson = playbook.stage_requirements
          ? `\n\nMAPA DE STEPS POR ESTÁGIO (cada estágio exige APENAS estes steps):\n${JSON.stringify(playbook.stage_requirements, null, 2)}`
          : '';

        userPrompt += `

PLAYBOOK DE VENDAS A SER SEGUIDO (${playbook.title}):
${playbook.content}${stageReqJson}

AVALIAÇÃO DO VENDEDOR (consciente de estágio):
1. Identifique o ESTÁGIO ATUAL da conversa (conversation_stage):
   - abertura: saudação inicial, primeiras trocas
   - qualificacao: descoberta de necessidade, veículo, orçamento
   - apresentacao: proposta de valor, produto/serviço, preço
   - negociacao: objeções, ofertas, condições, ancoragem
   - fechamento: agendamento, contratação, próximos passos
2. Avalie compliance APENAS contra steps esperados ATÉ o estágio atual.
   NÃO penalize por steps de estágios futuros que ainda não deveriam ter ocorrido.
3. Liste em playbook_steps_completed os steps efetivamente executados.
4. Liste em playbook_steps_missing APENAS steps que já deveriam ter sido feitos no estágio atual mas foram pulados.
5. Identifique violações (ex: rude, mentiu, pulou saudação obrigatória).
6. Nota geral atendimento 0-10 considerando o estágio atual.
7. Score 0-100 = (steps_completed_no_estágio / steps_esperados_no_estágio) * 100.
8. Estratégias de venda (ofertas/ancoragem) aumentam nota em até +2 pontos quando aplicáveis ao estágio.`;
      }
    }

    userPrompt += `

Analise e responda:
1. Qual produto/serviço o cliente demonstra interesse? (escolha da lista ou null se não identificado)
2. Qual a temperatura do lead? (quente = pronto para comprar, morno = interessado mas com dúvidas, frio = apenas pesquisando)
3. Qual o sentimento geral do cliente? (Positivo, Neutro, Negativo)
4. Qual o potencial de conversão (0-100)?
5. Tags relevantes para categorização (3-5 tags)
6. Há oportunidade de upsell? (sim/não) - Identifique se o cliente poderia se beneficiar de produtos/serviços adicionais
7. Se há upsell, quais produtos/serviços adicionais o cliente poderia contratar? (lista)
8. Se há upsell, qual o valor estimado em USD (dólares americanos) dessa oportunidade? (número ou null se impossível estimar)
9. Descrição textual da oportunidade de upsell
10. Resumo das principais necessidades do cliente (2-3 frases)
11. Resumo da necessidade principal em UMA ÚNICA FRASE CURTA (máximo 15 palavras, ex: "Precisa de orçamento para festa de 50 pessoas")
12. Qual a intenção principal do lead? (escolha UMA: Orçamento, Dúvida, Negociar, Comparar, Agendamento)
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
18. Foi mencionado algum valor/preço na conversa pelo vendedor? Se sim, extraia o valor numérico exatamente como falado, em USD/dólares (ex: "$85" → 85, "$450.00" → 450). NÃO converta para outra moeda.
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

    // Helper: fetch with retry + exponential backoff for 429s
    async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const response = await fetch(url, options);
        if (response.status === 429 && attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 2000 + Math.random() * 1000; // 2s, 4s, 8s + jitter
          console.warn(`[analyze-lead] Rate limited (429), retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries})`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        return response;
      }
      // Should not reach here, but just in case
      return fetch(url, options);
    }

    // Build tool parameters - base parameters for all analyses
    const toolParameters: any = {
      type: 'object',
      properties: {
        service_desired: {
          type: 'string',
          nullable: true,
          description: 'Produto/serviço PRINCIPAL que o cliente deseja (primeiro item de services_detected). Da lista fornecida ou null.'
        },
        services_detected: {
          type: 'array',
          items: { type: 'string' },
          description: 'TODOS os produtos/serviços que o cliente demonstrou interesse na conversa. Use os nomes exatos da lista de produtos disponíveis. Inclua todos os mencionados, não apenas o principal. Pode ser vazio se nada identificado.'
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
          description: 'Oportunidades de upsell identificadas (texto descritivo)'
        },
        has_upsell: {
          type: 'boolean',
          description: 'Se há oportunidade de upsell identificada (true/false)'
        },
        upsell_products: {
          type: 'array',
          items: { type: 'string' },
          description: 'Lista de produtos/serviços adicionais que o cliente poderia contratar como upsell'
        },
        upsell_value_estimate: {
          type: 'number',
          nullable: true,
          description: 'Valor estimado em dólares americanos (USD) da oportunidade de upsell (null se não for possível estimar)'
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
        has_greeting: {
          type: 'boolean',
          description: 'Se o vendedor fez saudação inicial e se apresentou ao cliente (nome, empresa, cargo)'
        },
        has_qualification: {
          type: 'boolean',
          description: 'Se o vendedor realizou qualificação do cliente (perguntas sobre necessidade, veículo, ano, modelo, orçamento, etc.)'
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
          description: 'Valor monetário cotado pelo vendedor em USD/dólares, extraído exatamente como falado (ex: 85 para "$85", 450 para "$450.00"). NÃO converta moeda. Null se nenhum preço foi mencionado.'
        },
        has_quote: {
          type: 'boolean',
          description: 'Se uma cotação ou preço formal foi apresentado ao cliente'
        },
        conversation_stage: {
          type: 'string',
          enum: ['abertura', 'qualificacao', 'apresentacao', 'negociacao', 'fechamento'],
          description: 'Estágio atual da conversa baseado no progresso e conteúdo das mensagens'
        }
      },
      required: ['lead_temperature', 'sentiment', 'lead_score', 'ai_tags', 'customer_needs_summary', 'need_summary', 'lead_intent', 'has_objection', 'has_greeting', 'has_qualification', 'used_offer', 'used_anchoring', 'has_quote', 'has_upsell']
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
      toolParameters.required.push('playbook_compliance_score', 'service_rating', 'conversation_stage');
    }

    const aiResponse = await fetchWithRetry(AI_GATEWAY, {
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
        tool_choice: { type: 'function', function: { name: 'analyze_lead' } },
        stream: false,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      const aiStatus = aiResponse.status;
      console.error(`[analyze-lead] AI Gateway error: ${aiStatus}`, errorText);

      // Categorize and log the error to audit_logs for diagnostics
      let errorCategory = 'ai_gateway_error';
      if (aiStatus === 429) errorCategory = 'ai_rate_limit';
      else if (aiStatus === 401 || aiStatus === 403) errorCategory = 'ai_auth_error';
      else if (aiStatus === 402) errorCategory = 'ai_credits_exhausted';
      else if (aiStatus === 408 || aiStatus === 504) errorCategory = 'ai_timeout';

      await logAudit(supabase, {
        event_type: errorCategory,
        session_id: session_id,
        status: 'error',
        error_message: `Gemini ${aiStatus}: ${errorText.substring(0, 500)}`,
        event_details: { 
          http_status: aiStatus, 
          response_body: errorText.substring(0, 1000),
          interactions_count: allInteractions.length,
        },
        execution_time_ms: Date.now() - startTime,
      });

      // Handle rate limits
      if (aiStatus === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.', category: errorCategory }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiStatus === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add credits to continue.', category: errorCategory }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI Gateway error: ${aiStatus} - ${errorText}`);
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

    // Reject AI tokens that are sentinel strings ("null", "undefined", "n/a", "")
    // — Gemini function-calling sometimes returns these as plain strings instead
    // of JSON null, which previously polluted services_detected with ["null"].
    function isInvalidServiceToken(s: any): boolean {
      if (s === null || s === undefined) return true;
      if (typeof s !== 'string') return true;
      const lower = s.trim().toLowerCase();
      return lower === '' || lower === 'null' || lower === 'undefined' || lower === 'n/a' || lower === 'none';
    }

    // Validate services against products table
    function matchProduct(input: string): string | null {
      if (isInvalidServiceToken(input) || !products) return null;
      const lower = input.toLowerCase().trim();
      const matched = products.find((p: any) =>
        p.product_name.toLowerCase() === lower ||
        lower.includes(p.product_name.toLowerCase())
      );
      return matched?.product_name || input;
    }

    // Build services_detected array (validated + deduped)
    let finalServicesDetected: string[] = [];
    const rawServicesIn: string[] = Array.isArray(analysisResult.services_detected)
      ? analysisResult.services_detected
      : [];
    const rawServices: string[] = rawServicesIn.filter((s) => !isInvalidServiceToken(s));
    if (!isInvalidServiceToken(analysisResult.service_desired) && !rawServices.includes(analysisResult.service_desired)) {
      rawServices.unshift(analysisResult.service_desired);
    }
    const seen = new Set<string>();
    for (const raw of rawServices) {
      const matched = matchProduct(raw);
      if (matched && !seen.has(matched.toLowerCase())) {
        seen.add(matched.toLowerCase());
        finalServicesDetected.push(matched);
      }
    }

    // Primary service = first in array; fallback to existing lead.service_desired
    // (also guard against legacy string-"null" rows still in DB)
    const existingServiceDesired = isInvalidServiceToken(lead.service_desired) ? null : lead.service_desired;
    let finalServiceDesired: string | null =
      finalServicesDetected[0] || existingServiceDesired || null;

    // If AI returned nothing but lead already had a service, preserve it in array
    if (finalServicesDetected.length === 0 && finalServiceDesired) {
      finalServicesDetected = [finalServiceDesired];
    }

    // Keyword fallback: when AI couldn't pin a product (LLM returned null/empty
    // and lead has no prior service), run keyword scan over the conversation
    // before giving up. Recovers ~17% of cases that LLM misses, zero token cost.
    if (finalServicesDetected.length === 0) {
      const allText = allInteractions
        .map((i: any) => i.message_text || '')
        .filter((s: string) => s)
        .join(' \n ');
      const keywordHits = detectProductsFromText(allText);
      if (keywordHits.length > 0) {
        finalServicesDetected = keywordHits;
        finalServiceDesired = keywordHits[0];
        console.log(`[analyze-lead] Keyword fallback hit for session ${session_id}: ${keywordHits.join(', ')}`);
      }
    }

    // Stage-aware compliance computation
    const CLOSED_STATUSES = ['ganha', 'perdida', 'descartada', 'ganhou', 'perdeu'];
    const isClosed = CLOSED_STATUSES.includes((lead.sales_status || '').toLowerCase().trim());
    const conversationStage = analysisResult.conversation_stage || null;
    const stageRequirements: string[] = playbook?.stage_requirements?.[conversationStage] || [];
    const completedSteps: string[] = analysisResult.playbook_steps_completed || [];

    let computedPartialScore: number | null = null;
    if (hasAgentMessages && playbook) {
      if (stageRequirements.length > 0) {
        // Stage-aware: only count steps expected up to current stage
        const completedInStage = completedSteps.filter((s: string) =>
          stageRequirements.some((req: string) => req.toLowerCase() === s.toLowerCase())
        );
        computedPartialScore = Math.round((completedInStage.length / stageRequirements.length) * 100);
      } else {
        // Legacy fallback: trust AI's absolute score
        computedPartialScore = analysisResult.playbook_compliance_score ?? null;
      }
    }
    const computedFinalScore = isClosed ? computedPartialScore : null;

    console.log(`[analyze-lead] Stage=${conversationStage}, expected=${stageRequirements.length} steps, completed_in_stage=${completedSteps.length}, partial=${computedPartialScore}, final=${computedFinalScore}, closed=${isClosed}`);

    // Prepare update payload
    const updatePayload: any = {
      session_id: session_id,
      sentiment: analysisResult.sentiment || 'Neutro',
      lead_score: analysisResult.lead_score || 50,
      lead_temperature: analysisResult.lead_temperature || 'morno',
      service_desired: finalServiceDesired,
      services_detected: finalServicesDetected.length > 0 ? finalServicesDetected : null,
      ai_tags: analysisResult.ai_tags || [],
      upsell_opportunity: analysisResult.upsell_opportunity || null,
      has_upsell: analysisResult.has_upsell || false,
      upsell_products: analysisResult.upsell_products || null,
      upsell_value_estimate: analysisResult.upsell_value_estimate || null,
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
      // Stage-aware compliance fields
      conversation_stage: hasAgentMessages && playbook ? conversationStage : null,
      compliance_steps_expected: hasAgentMessages && playbook ? stageRequirements : null,
      compliance_score_partial: computedPartialScore,
      compliance_score_final: computedFinalScore,
      // Legacy field kept as alias to partial score for backward compatibility
      playbook_compliance_score: computedPartialScore,
      playbook_steps_completed: hasAgentMessages && playbook ? (analysisResult.playbook_steps_completed || null) : null,
      playbook_steps_missing: hasAgentMessages && playbook ? (analysisResult.playbook_steps_missing || null) : null,
      playbook_violations: hasAgentMessages && playbook ? (analysisResult.playbook_violations || null) : null,
      service_rating: hasAgentMessages && playbook ? (analysisResult.service_rating || null) : null,
      // Greeting & qualification fields
      has_greeting: hasAgentMessages ? (analysisResult.has_greeting || false) : null,
      has_qualification: hasAgentMessages ? (analysisResult.has_qualification || false) : null,
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

    // Sync to Kommo CRM (fire-and-forget)
    supabase.functions.invoke('sync-to-kommo', {
      body: { session_id }
    }).catch((err: Error) => console.error('[analyze-lead] Kommo sync error:', err));

    const duration = Date.now() - startTime;
    console.log(`[analyze-lead] Analysis completed in ${duration}ms`);

    // Log success with compliance info
    await logAudit(supabase, {
      event_type: 'ai_analysis_completed',
      session_id: session_id,
      status: 'success',
      event_details: {
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
      },
      execution_time_ms: duration,
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

    // Log error with full details
    if (supabase) {
      const sessionId = (() => { try { return JSON.parse(JSON.stringify(error))?.session_id; } catch { return null; } })();
      await logAudit(supabase, {
        event_type: 'ai_analysis_error',
        session_id: sessionId,
        status: 'error',
        error_message: error.message || 'Unknown error',
        event_details: {
          error_name: error.name,
          error_stack: error.stack?.substring(0, 500),
          duration_ms: duration,
        },
        execution_time_ms: duration,
      });
    }

    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

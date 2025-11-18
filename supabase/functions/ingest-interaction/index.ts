import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    console.log('Received interaction data:', JSON.stringify(body, null, 2));

    // Validação básica
    const requiredFields = ['session_id', 'channel'];
    const missingFields = requiredFields.filter(field => !body[field]);
    
    if (missingFields.length > 0) {
      console.error('Missing required fields:', missingFields);
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields', 
          fields: missingFields 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Verificar se session_id existe na lead_db
    const { data: leadExists, error: checkError } = await supabase
      .from('lead_db')
      .select('session_id')
      .eq('session_id', body.session_id)
      .single();

    if (checkError || !leadExists) {
      console.error('Invalid session_id:', body.session_id);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid session_id. Lead not found.' 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Preparar dados para inserção
    const interactionData = {
      session_id: body.session_id,
      channel: body.channel,
      message_text: body.message_text || null,
      sender_type: body.sender_type || null,
    };

    console.log('Inserting interaction:', interactionData);

    // Inserir no banco
    const { data, error } = await supabase
      .from('interaction_db')
      .insert(interactionData)
      .select('interaction_id')
      .single();

    if (error) {
      console.error('Database error:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Interaction created successfully:', data.interaction_id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        interaction_id: data.interaction_id,
        message: 'Interaction created successfully'
      }),
      { 
        status: 201, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

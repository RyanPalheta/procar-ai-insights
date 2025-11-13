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
    console.log('Received call data:', JSON.stringify(body, null, 2));

    // Validação básica
    if (!body.session_id) {
      console.error('Missing session_id');
      return new Response(
        JSON.stringify({ 
          error: 'session_id is required' 
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
    const callData = {
      session_id: body.session_id,
      type: body.type || null,
      call_tag: body.call_tag || null,
      call_result: body.call_result || null,
      call_duration: body.call_duration ? parseInt(body.call_duration) : null,
      ai_analysis_status: body.ai_analysis_status || null,
      lead_score: body.lead_score ? parseFloat(body.lead_score) : null,
    };

    console.log('Inserting call:', callData);

    // Inserir no banco
    const { data, error } = await supabase
      .from('call_db')
      .insert(callData)
      .select('call_id')
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

    console.log('Call created successfully:', data.call_id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        call_id: data.call_id,
        message: 'Call created successfully'
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

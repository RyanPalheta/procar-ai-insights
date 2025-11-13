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
    console.log('Received lead data:', JSON.stringify(body, null, 2));

    // Validação básica
    const requiredFields = ['channel'];
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

    // Preparar dados para inserção
    const leadData = {
      lead_language: body.lead_language || null,
      lead_price: body.lead_price ? parseFloat(body.lead_price) : null,
      sales_person_id: body.sales_person_id || null,
      channel: body.channel,
      sales_status: body.sales_status || null,
      upsell_opportunity: body.upsell_opportunity || null,
      lead_score: body.lead_score ? parseFloat(body.lead_score) : null,
      improvement_point: body.improvement_point || null,
      service_desired: body.service_desired || null,
      ai_version: body.ai_version || null,
    };

    console.log('Inserting lead:', leadData);

    // Inserir no banco
    const { data, error } = await supabase
      .from('lead_db')
      .insert(leadData)
      .select('session_id')
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

    console.log('Lead created successfully:', data.session_id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        session_id: data.session_id,
        message: 'Lead created successfully'
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

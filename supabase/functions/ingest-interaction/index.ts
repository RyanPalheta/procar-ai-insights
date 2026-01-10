import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// deno-lint-ignore no-explicit-any
async function logToAudit(
  supabase: any,
  sessionId: number | null,
  status: 'success' | 'error',
  eventDetails: Record<string, unknown>,
  errorMessage?: string
) {
  try {
    await supabase.from('audit_logs').insert({
      event_type: status === 'success' ? 'interaction_ingest' : 'interaction_ingest_error',
      function_name: 'ingest-interaction',
      session_id: sessionId,
      status,
      error_message: errorMessage || null,
      event_details: eventDetails,
    });
  } catch (e) {
    console.error('Failed to log to audit_logs:', e);
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  let body: Record<string, unknown> = {};

  try {
    body = await req.json();
    console.log('Received interaction data:', JSON.stringify(body, null, 2));

    // Validação básica
    const requiredFields = ['session_id', 'channel'];
    const missingFields = requiredFields.filter(field => !body[field]);
    
    if (missingFields.length > 0) {
      console.error('Missing required fields:', missingFields);
      await logToAudit(supabase, null, 'error', { raw_body: body }, `Missing required fields: ${missingFields.join(', ')}`);
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

    // Parse session_id como inteiro
    const sessionId = parseInt(String(body.session_id));
    if (isNaN(sessionId)) {
      console.error('Invalid session_id format:', body.session_id);
      await logToAudit(supabase, null, 'error', { raw_body: body }, 'session_id must be a valid integer');
      return new Response(
        JSON.stringify({ error: 'session_id must be a valid integer' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Verificar se session_id existe na lead_db
    const { data: leadExists } = await supabase
      .from('lead_db')
      .select('session_id')
      .eq('session_id', sessionId)
      .maybeSingle();

    let leadCreated = false;

    // Se não existe, criar o lead automaticamente
    if (!leadExists) {
      console.log('Lead not found, creating automatically:', sessionId);
      
      const { error: createError } = await supabase
        .from('lead_db')
        .insert({
          session_id: sessionId,
          channel: body.channel,
          processed: false,
        });
      
      if (createError) {
        console.error('Error creating lead:', createError);
        await logToAudit(supabase, sessionId, 'error', { raw_body: body }, `Failed to create lead: ${createError.message}`);
        return new Response(
          JSON.stringify({ error: 'Failed to create lead: ' + createError.message }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
      leadCreated = true;
      console.log('Lead created automatically:', sessionId);
    }

    // Preparar dados para inserção
    const interactionData = {
      session_id: sessionId,
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
      await logToAudit(supabase, sessionId, 'error', { raw_body: body }, error.message);
      return new Response(
        JSON.stringify({ error: error.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Interaction created successfully:', data.interaction_id, leadCreated ? '(lead was auto-created)' : '');

    // Log success to audit_logs
    await logToAudit(supabase, sessionId, 'success', {
      interaction_id: data.interaction_id,
      channel: body.channel,
      sender_type: body.sender_type || null,
      lead_created: leadCreated,
      message_preview: typeof body.message_text === 'string' ? body.message_text.substring(0, 100) : null,
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        interaction_id: data.interaction_id,
        lead_created: leadCreated,
        message: leadCreated ? 'Lead and interaction created successfully' : 'Interaction created successfully'
      }),
      { 
        status: 201, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    await logToAudit(supabase, null, 'error', { raw_body: body }, errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

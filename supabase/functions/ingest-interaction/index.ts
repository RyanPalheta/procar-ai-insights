import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Milestones that trigger automatic AI analysis
const ANALYSIS_MILESTONES = [5, 10, 20, 30, 40];

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

    // Parse session_id como inteiro
    const sessionId = parseInt(body.session_id);
    if (isNaN(sessionId)) {
      console.error('Invalid session_id format:', body.session_id);
      return new Response(
        JSON.stringify({ error: 'session_id must be a valid integer' }),
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
      .eq('session_id', sessionId)
      .maybeSingle();

    let leadCreated = false;

    // Se não existe, criar o lead automaticamente
    if (!leadExists) {
      console.log('Lead not found, creating automatically:', sessionId);
      
      const { error: createError } = await supabase
        .from('lead_db')
        .upsert({
          session_id: sessionId,
          channel: body.channel,
          processed: false,
        }, { onConflict: 'session_id', ignoreDuplicates: true });

      if (createError) {
        console.error('Error creating lead:', createError);
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
      return new Response(
        JSON.stringify({ error: error.message }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Interaction created successfully:', data.interaction_id, leadCreated ? '(lead was auto-created)' : '');

    // Update sales_status if provided in payload
    let statusUpdated = false;
    if (body.sales_status) {
      // Get current lead status
      const { data: currentLead } = await supabase
        .from('lead_db')
        .select('sales_status')
        .eq('session_id', sessionId)
        .single();

      const oldStatus = currentLead?.sales_status;
      const newStatus = body.sales_status;

      // Only update if there's a change
      if (oldStatus !== newStatus) {
        console.log(`[ingest-interaction] Updating sales_status: "${oldStatus}" -> "${newStatus}"`);

        // Update the lead
        const { error: updateError } = await supabase
          .from('lead_db')
          .update({ sales_status: newStatus })
          .eq('session_id', sessionId);

        if (updateError) {
          console.error('[ingest-interaction] Error updating sales_status:', updateError);
        } else {
          // Record in history
          await supabase
            .from('lead_history')
            .insert({
              session_id: sessionId,
              field_name: 'sales_status',
              old_value: oldStatus,
              new_value: newStatus,
              changed_by: 'n8n',
              change_source: 'api'
            });

          statusUpdated = true;
          console.log(`[ingest-interaction] sales_status updated and recorded in history`);
        }
      }
    }

    // Update is_walking if provided in payload
    let isWalkingUpdated = false;
    if (body.is_walking !== undefined) {
      const { data: currentLeadWalking } = await supabase
        .from('lead_db')
        .select('is_walking')
        .eq('session_id', sessionId)
        .single();

      const oldIsWalking = currentLeadWalking?.is_walking;
      const newIsWalking = Boolean(body.is_walking);

      if (oldIsWalking !== newIsWalking) {
        console.log(`[ingest-interaction] Updating is_walking: "${oldIsWalking}" -> "${newIsWalking}"`);

        const { error: walkingUpdateError } = await supabase
          .from('lead_db')
          .update({ is_walking: newIsWalking })
          .eq('session_id', sessionId);

        if (walkingUpdateError) {
          console.error('[ingest-interaction] Error updating is_walking:', walkingUpdateError);
        } else {
          await supabase
            .from('lead_history')
            .insert({
              session_id: sessionId,
              field_name: 'is_walking',
              old_value: String(oldIsWalking),
              new_value: String(newIsWalking),
              changed_by: 'n8n',
              change_source: 'api'
            });

          isWalkingUpdated = true;
          console.log(`[ingest-interaction] is_walking updated and recorded in history`);
        }
      }
    }

    // Count total interactions for this lead
    const { count: interactionCount, error: countError } = await supabase
      .from('interaction_db')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId);

    if (countError) {
      console.error('Error counting interactions:', countError);
    }

    const totalInteractions = interactionCount || 0;
    console.log(`[ingest-interaction] Lead ${sessionId} now has ${totalInteractions} interactions`);

    // Check if we hit an analysis milestone
    let analysisTriggered = false;
    let analysisError: string | null = null;

    if (ANALYSIS_MILESTONES.includes(totalInteractions)) {
      console.log(`[ingest-interaction] Lead ${sessionId} hit milestone ${totalInteractions} - triggering auto-analysis`);
      
      // Trigger AI analysis in background using waitUntil
      const analyzePromise = (async () => {
        try {
          const { data: analysisResult, error: analysisErr } = await supabase.functions.invoke('analyze-lead', {
            body: { session_id: sessionId }
          });

          if (analysisErr) {
            // Capture detailed error from response body (SDK returns data even on non-2xx)
            let errorDetail = analysisErr.message;
            try {
              if (analysisResult) {
                errorDetail = typeof analysisResult === 'string' ? analysisResult : JSON.stringify(analysisResult);
              }
            } catch {}

            console.error(`[ingest-interaction] Auto-analysis failed for lead ${sessionId}:`, errorDetail);
            
            // Log the failed analysis attempt with detailed error
            await supabase.from('audit_logs').insert({
              event_type: 'auto_analysis_failed',
              session_id: sessionId,
              event_details: { 
                milestone: totalInteractions,
                error: errorDetail,
                raw_response: analysisResult,
                original_error: analysisErr.message
              },
              status: 'error',
              error_message: errorDetail
            });
          } else {
            console.log(`[ingest-interaction] Auto-analysis completed for lead ${sessionId} at milestone ${totalInteractions}`);
            
            // Log successful auto-analysis
            await supabase.from('audit_logs').insert({
              event_type: 'auto_analysis_triggered',
              session_id: sessionId,
              event_details: { 
                milestone: totalInteractions,
                analysis_result: analysisResult 
              },
              status: 'success'
            });
          }
        } catch (err) {
          console.error(`[ingest-interaction] Unexpected error during auto-analysis for lead ${sessionId}:`, err);
        }
      })();

      // Run analysis in background - don't await, let it run independently
      analyzePromise.catch(console.error);
      analysisTriggered = true;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        interaction_id: data.interaction_id,
        lead_created: leadCreated,
        status_updated: statusUpdated,
        is_walking_updated: isWalkingUpdated,
        total_interactions: totalInteractions,
        analysis_triggered: analysisTriggered,
        milestone_reached: ANALYSIS_MILESTONES.includes(totalInteractions) ? totalInteractions : null,
        message: leadCreated 
          ? 'Lead and interaction created successfully' 
          : statusUpdated
            ? `Interaction created, sales_status updated`
            : isWalkingUpdated
              ? `Interaction created, is_walking updated`
              : analysisTriggered 
                ? `Interaction created, auto-analysis triggered at milestone ${totalInteractions}`
                : 'Interaction created successfully'
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

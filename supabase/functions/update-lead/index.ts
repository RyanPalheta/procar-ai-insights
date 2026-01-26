import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
}

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

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let sessionId: number | undefined;

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json()
    sessionId = body.session_id;
    console.log('Received update request:', JSON.stringify(body, null, 2))

    // Validate required field
    if (!body.session_id) {
      console.error('Validation error: session_id is required')
      return new Response(
        JSON.stringify({ error: 'session_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch current lead data for history tracking
    const { data: existingLead, error: checkError } = await supabaseClient
      .from('lead_db')
      .select('*')
      .eq('session_id', body.session_id)
      .single()

    if (checkError || !existingLead) {
      console.error('Lead not found:', body.session_id)
      return new Response(
        JSON.stringify({ error: 'Lead not found with the provided session_id' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Prepare update data - only include fields that are provided
    const updateData: Record<string, any> = {
      last_ai_update: new Date().toISOString()
    }

    // Add optional fields if provided
    if (body.lead_score !== undefined) {
      updateData.lead_score = parseFloat(body.lead_score)
    }
    if (body.improvement_point !== undefined) {
      updateData.improvement_point = body.improvement_point
    }
    if (body.sales_status !== undefined) {
      updateData.sales_status = body.sales_status
    }
    if (body.upsell_opportunity !== undefined) {
      updateData.upsell_opportunity = body.upsell_opportunity
    }
    if (body.service_desired !== undefined) {
      updateData.service_desired = body.service_desired
    }
    if (body.lead_price !== undefined) {
      updateData.lead_price = parseFloat(body.lead_price)
    }
    if (body.ai_version !== undefined) {
      updateData.ai_version = body.ai_version
    }
    if (body.sentiment !== undefined) {
      updateData.sentiment = body.sentiment
    }
    if (body.ai_tags !== undefined) {
      updateData.ai_tags = body.ai_tags
    }
    if (body.processed !== undefined) {
      updateData.processed = body.processed
    }
    // Playbook analysis fields
    if (body.playbook_compliance_score !== undefined) {
      updateData.playbook_compliance_score = parseFloat(body.playbook_compliance_score)
    }
    if (body.playbook_steps_completed !== undefined) {
      updateData.playbook_steps_completed = body.playbook_steps_completed
    }
    if (body.playbook_steps_missing !== undefined) {
      updateData.playbook_steps_missing = body.playbook_steps_missing
    }
    if (body.playbook_violations !== undefined) {
      updateData.playbook_violations = body.playbook_violations
    }
    if (body.lead_temperature !== undefined) {
      updateData.lead_temperature = body.lead_temperature
    }
    if (body.service_rating !== undefined) {
      updateData.service_rating = parseFloat(body.service_rating)
    }
    if (body.lead_intent !== undefined) {
      updateData.lead_intent = body.lead_intent
    }
    if (body.has_objection !== undefined) {
      updateData.has_objection = body.has_objection
    }
    if (body.objection_detail !== undefined) {
      updateData.objection_detail = body.objection_detail
    }
    if (body.need_summary !== undefined) {
      updateData.need_summary = body.need_summary
    }
    if (body.is_walking !== undefined) {
      updateData.is_walking = body.is_walking
    }
    if (body.objection_categories !== undefined) {
      updateData.objection_categories = body.objection_categories
    }

    console.log('Update data prepared:', JSON.stringify(updateData, null, 2))

    // Track field changes for history
    const changeSource = body.change_source || 'manual'
    const changedBy = body.changed_by || 'sistema'
    const historyRecords: Array<{
      session_id: number
      field_name: string
      old_value: string | null
      new_value: string | null
      changed_by: string
      change_source: string
    }> = []

    // Compare and record changes (excluding last_ai_update which is always updated)
    for (const [field, newValue] of Object.entries(updateData)) {
      if (field === 'last_ai_update') continue
      
      const oldValue = existingLead[field]
      const oldStr = oldValue !== null && oldValue !== undefined ? String(oldValue) : null
      const newStr = newValue !== null && newValue !== undefined ? String(newValue) : null
      
      if (oldStr !== newStr) {
        historyRecords.push({
          session_id: body.session_id,
          field_name: field,
          old_value: oldStr,
          new_value: newStr,
          changed_by: changedBy,
          change_source: changeSource
        })
      }
    }

    // Insert history records if any fields changed
    if (historyRecords.length > 0) {
      const { error: historyError } = await supabaseClient
        .from('lead_history')
        .insert(historyRecords)
      
      if (historyError) {
        console.error('Failed to insert history records:', historyError)
        // Don't fail the update, just log the error
      } else {
        console.log(`Recorded ${historyRecords.length} field changes to history`)
      }
    }

    // Update the lead
    const { data, error } = await supabaseClient
      .from('lead_db')
      .update(updateData)
      .eq('session_id', body.session_id)
      .select()

    if (error) {
      console.error('Database update error:', error)
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Lead updated successfully:', data[0].session_id)
    
    const executionTime = Date.now() - startTime;

    // Log successful update
    await logEvent(
      supabaseClient,
      'lead_update',
      'update-lead',
      'success',
      body.session_id,
      {
        updated_fields: Object.keys(updateData),
        has_ai_data: !!body.sentiment || !!body.playbook_compliance_score
      },
      executionTime
    );

    return new Response(
      JSON.stringify({ 
        message: 'Lead updated successfully',
        session_id: data[0].session_id,
        updated_fields: Object.keys(updateData)
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    
    const executionTime = Date.now() - startTime;

    // Log error
    if (sessionId) {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )
      
      await logEvent(
        supabaseClient,
        'lead_update_error',
        'update-lead',
        'error',
        sessionId,
        { error: errorMessage },
        executionTime,
        errorMessage
      );
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

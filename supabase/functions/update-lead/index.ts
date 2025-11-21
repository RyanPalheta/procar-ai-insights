import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json()
    console.log('Received update request:', JSON.stringify(body, null, 2))

    // Validate required field
    if (!body.session_id) {
      console.error('Validation error: session_id is required')
      return new Response(
        JSON.stringify({ error: 'session_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if lead exists
    const { data: existingLead, error: checkError } = await supabaseClient
      .from('lead_db')
      .select('session_id')
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

    console.log('Update data prepared:', JSON.stringify(updateData, null, 2))

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
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

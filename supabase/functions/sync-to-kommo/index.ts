import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- Field Mappings ---

const PRODUCT_MAP: Record<string, string> = {
  'remote start': 'REMOTE START',
  'remote starter': 'REMOTE START',
  'carplay': 'CARPLAY',
  'sound system': 'SOUND SYSTEM',
  'sound': 'SOUND SYSTEM',
  'tint': 'TINT',
  'window tint': 'TINT',
  'backup cam': 'BACKUP CAM',
  'backup camera': 'BACKUP CAM',
  'dashcam': 'DASHCAM',
  'dash cam': 'DASHCAM',
  'ambient light': 'AMBIENT LIGHT',
  'ambient lights': 'AMBIENT LIGHT',
  'led': 'LED LIGHTS',
  'led lights': 'LED LIGHTS',
  'led light': 'LED LIGHTS',
  'labor': 'LABOR',
  'key copy': 'KEY COPY',
  'key programming': 'KEY COPY',
  'car key': 'KEY COPY',
  'checagem': 'CHECAGEM',
  'check': 'CHECAGEM',
  'check service': 'CHECAGEM',
};

const OBJECTION_MAP: Record<string, string> = {
  'preco': 'Orçamento insuficiente',
  'tempo': 'Vai pensar e retornar',
  'distancia': 'Muito distante',
  'concorrencia': 'Fechou com concorrente',
  'tecnica': 'Carro incompatível',
  'confianca': 'Não satisfeito com as condições',
  'financiamento': 'Aguardando aprovação do parceiro (esposa/marido)',
  'indecisao': 'Cliente fazendo orçamento',
};

const LANGUAGE_MAP: Record<string, string> = {
  'inglês': 'Inglês',
  'ingles': 'Inglês',
  'english': 'Inglês',
  'português': 'Português',
  'portugues': 'Português',
  'portuguese': 'Português',
  'espanhol': 'Espanhol',
  'spanish': 'Espanhol',
};

// --- Helper Functions ---

function mapScoreToSelect(score: number | null): string | null {
  if (score === null || score === undefined) return null;
  if (score <= 20) return '1';
  if (score <= 40) return '2';
  if (score <= 60) return '3';
  if (score <= 80) return '4';
  return '5';
}

function capitalize(s: string | null): string {
  if (!s) return 'N/A';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function boolIcon(val: boolean | null | undefined): string {
  if (val === true) return '✅';
  if (val === false) return '❌';
  return '—';
}

function mapProduct(serviceDesired: string | null): Array<{ value: string }> | null {
  if (!serviceDesired) return null;
  const lower = serviceDesired.toLowerCase().trim();
  const mapped = PRODUCT_MAP[lower];
  if (mapped) return [{ value: mapped }];
  // Try partial matching
  for (const [key, val] of Object.entries(PRODUCT_MAP)) {
    if (lower.includes(key)) return [{ value: val }];
  }
  return null;
}

function mapObjections(categories: string[] | null): Array<{ value: string }> | null {
  if (!categories || categories.length === 0) return null;
  const values: Array<{ value: string }> = [];
  for (const cat of categories) {
    const mapped = OBJECTION_MAP[cat.toLowerCase().trim()];
    if (mapped) values.push({ value: mapped });
  }
  return values.length > 0 ? values : null;
}

function mapLanguage(lang: string | null): string | null {
  if (!lang) return null;
  return LANGUAGE_MAP[lang.toLowerCase().trim()] || 'Não categorizado';
}

function buildAtlasSolutionsText(lead: any): string {
  const lines: string[] = [];

  lines.push(`🔥 Temperatura: ${capitalize(lead.lead_temperature)}`);
  lines.push(`📊 Score: ${lead.lead_score ?? 'N/A'}/100`);
  lines.push(`💭 Sentimento: ${lead.sentiment ?? 'N/A'}`);
  lines.push(`🎯 Intenção: ${lead.lead_intent ?? 'N/A'}`);
  if (lead.need_summary) lines.push(`📝 Resumo: ${lead.need_summary}`);
  lines.push('');

  if (lead.improvement_point) lines.push(`📋 Necessidades: ${lead.improvement_point}`);
  if (lead.service_desired) lines.push(`🛒 Serviço desejado: ${lead.service_desired}`);
  if (lead.upsell_opportunity) lines.push(`💡 Upsell: ${lead.upsell_opportunity}`);
  lines.push('');

  if (lead.has_objection) {
    lines.push(`⚠️ Objeção: ${lead.objection_detail || 'Sim'}`);
    lines.push(`✅ Objeção superada: ${boolIcon(lead.objection_overcome)}`);
    if (lead.objection_categories?.length > 0) {
      lines.push(`📂 Categorias: ${lead.objection_categories.join(', ')}`);
    }
    lines.push('');
  }

  if (lead.playbook_compliance_score !== null && lead.playbook_compliance_score !== undefined) {
    lines.push(`📊 Conformidade com script: ${lead.playbook_compliance_score}%`);
    if (lead.playbook_steps_completed?.length > 0) {
      lines.push(`✅ Etapas cumpridas: ${lead.playbook_steps_completed.join(', ')}`);
    }
    if (lead.playbook_steps_missing?.length > 0) {
      lines.push(`❌ Etapas faltantes: ${lead.playbook_steps_missing.join(', ')}`);
    }
    if (lead.playbook_violations) {
      lines.push(`⚡ Violações: ${lead.playbook_violations}`);
    }
    lines.push('');
  }

  lines.push(`🤝 Saudação: ${boolIcon(lead.has_greeting)} | Qualificação: ${boolIcon(lead.has_qualification)}`);

  if (lead.used_offer && lead.offer_detail) lines.push(`💰 Oferta: ${lead.offer_detail}`);
  if (lead.used_anchoring && lead.anchoring_detail) lines.push(`⚓ Ancoragem: ${lead.anchoring_detail}`);

  if (lead.service_rating !== null && lead.service_rating !== undefined) {
    lines.push(`⭐ Nota atendimento: ${lead.service_rating}/10`);
  }

  lines.push('');
  lines.push(`🔄 Última análise: ${lead.last_ai_update ? new Date(lead.last_ai_update).toLocaleString('pt-BR') : 'N/A'}`);
  lines.push(`🤖 Versão IA: ${lead.ai_version ?? 'N/A'}`);

  return lines.filter(l => l !== undefined).join('\n');
}

function buildAuditText(lead: any): string {
  return `Saudação: ${boolIcon(lead.has_greeting)} | Qualificação: ${boolIcon(lead.has_qualification)} | Oferta: ${boolIcon(lead.used_offer)} | Ancoragem: ${boolIcon(lead.used_anchoring)}`;
}

function buildKommoPayload(lead: any): { custom_fields_values: any[]; price?: number } {
  const fields: any[] = [];

  // Atlas Solutions - full summary (textarea 1823073)
  fields.push({ field_id: 1823073, values: [{ value: buildAtlasSolutionsText(lead) }] });

  // Lead score textarea (1823227)
  if (lead.lead_score !== null && lead.lead_score !== undefined) {
    fields.push({
      field_id: 1823227,
      values: [{ value: `Score: ${lead.lead_score}/100 - ${capitalize(lead.lead_temperature)}` }],
    });
  }

  // Lead Score select 1-5 (1821573)
  const selectScore = mapScoreToSelect(lead.lead_score);
  if (selectScore) {
    fields.push({ field_id: 1821573, values: [{ value: selectScore }] });
  }

  // Produto de interesse (1820617)
  const products = mapProduct(lead.service_desired);
  if (products) {
    fields.push({ field_id: 1820617, values: products });
  }

  // Idioma (1820619)
  const lang = mapLanguage(lead.lead_language);
  if (lang) {
    fields.push({ field_id: 1820619, values: [{ value: lang }] });
  }

  // Objeções multiselect (1820707)
  const objections = mapObjections(lead.objection_categories);
  if (objections) {
    fields.push({ field_id: 1820707, values: objections });
  }

  // Objeções registradas mensagem (1823133)
  if (lead.objection_detail) {
    fields.push({ field_id: 1823133, values: [{ value: lead.objection_detail }] });
  }

  // % conforme script mensagem (1823127)
  if (lead.playbook_compliance_score !== null && lead.playbook_compliance_score !== undefined) {
    fields.push({ field_id: 1823127, values: [{ value: `${lead.playbook_compliance_score}%` }] });
  }

  // Item faltante (1823833)
  if (lead.playbook_steps_missing?.length > 0) {
    fields.push({ field_id: 1823833, values: [{ value: lead.playbook_steps_missing.join('\n') }] });
  }

  // Nota atendimento mensagem (1823119)
  if (lead.service_rating !== null && lead.service_rating !== undefined) {
    fields.push({ field_id: 1823119, values: [{ value: `${lead.service_rating}/10` }] });
  }

  // Nota lead mensagem (1823123)
  if (lead.lead_score !== null && lead.lead_score !== undefined) {
    fields.push({ field_id: 1823123, values: [{ value: `${lead.lead_score}/100` }] });
  }

  // Promoção/ancoragem checkbox (1823115)
  fields.push({
    field_id: 1823115,
    values: [{ value: lead.used_offer === true || lead.used_anchoring === true }],
  });

  // Walk-in checkbox (1823587)
  if (lead.is_walking !== null && lead.is_walking !== undefined) {
    fields.push({ field_id: 1823587, values: [{ value: lead.is_walking === true }] });
  }

  // Auditoria de mensagem (1823117)
  fields.push({ field_id: 1823117, values: [{ value: buildAuditText(lead) }] });

  const payload: any = { custom_fields_values: fields };

  // Native price field
  if (lead.lead_price !== null && lead.lead_price !== undefined && lead.lead_price > 0) {
    payload.price = Number(lead.lead_price);
  }

  return payload;
}

async function patchKommoLead(
  subdomain: string,
  token: string,
  leadId: number,
  payload: any,
  retries = 3
): Promise<{ ok: boolean; status: number; body: any }> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const response = await fetch(
      `https://${subdomain}.kommo.com/api/v4/leads/${leadId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    if (response.status === 429 && attempt < retries) {
      const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
      console.log(`[sync-to-kommo] Rate limited (429), retrying in ${Math.round(delay)}ms (attempt ${attempt}/${retries})`);
      await new Promise(r => setTimeout(r, delay));
      continue;
    }

    let body: any;
    try {
      body = await response.json();
    } catch {
      body = await response.text();
    }

    return { ok: response.ok, status: response.status, body };
  }

  return { ok: false, status: 429, body: 'Max retries exceeded' };
}

// --- Main Handler ---

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    const sessionId = body.session_id;

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'session_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[sync-to-kommo] Syncing lead ${sessionId} to Kommo`);

    const kommoToken = Deno.env.get('KOMMO_ACCESS_TOKEN');
    const kommoSubdomain = Deno.env.get('KOMMO_SUBDOMAIN');

    if (!kommoToken || !kommoSubdomain) {
      console.error('[sync-to-kommo] Missing KOMMO_ACCESS_TOKEN or KOMMO_SUBDOMAIN env vars');
      return new Response(
        JSON.stringify({ error: 'Kommo credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch lead data
    const { data: lead, error: leadError } = await supabase
      .from('lead_db')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (leadError || !lead) {
      console.error('[sync-to-kommo] Lead not found:', leadError);
      return new Response(
        JSON.stringify({ error: 'Lead not found', details: leadError?.message }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build payload
    const kommoPayload = buildKommoPayload(lead);
    console.log(`[sync-to-kommo] Sending ${kommoPayload.custom_fields_values.length} fields to Kommo`);

    // PATCH Kommo
    const result = await patchKommoLead(kommoSubdomain, kommoToken, sessionId, kommoPayload);

    // Log to audit_logs
    await supabase.from('audit_logs').insert({
      event_type: result.ok ? 'kommo_sync_success' : 'kommo_sync_error',
      session_id: sessionId,
      function_name: 'sync-to-kommo',
      event_details: {
        fields_sent: kommoPayload.custom_fields_values.length,
        kommo_status: result.status,
        kommo_response: typeof result.body === 'string' ? result.body : JSON.stringify(result.body).substring(0, 500),
      },
      status: result.ok ? 'success' : 'error',
      error_message: result.ok ? null : `Kommo API returned ${result.status}`,
    });

    if (!result.ok) {
      console.error(`[sync-to-kommo] Kommo API error ${result.status}:`, result.body);
      return new Response(
        JSON.stringify({ error: `Kommo API error`, status: result.status, details: result.body }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[sync-to-kommo] Successfully synced lead ${sessionId} to Kommo`);

    return new Response(
      JSON.stringify({
        success: true,
        session_id: sessionId,
        fields_synced: kommoPayload.custom_fields_values.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[sync-to-kommo] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- Field Mappings ---

// Produto de interesse (1820617) - enum_id map
const PRODUCT_ENUM: Record<string, number> = {
  'remote start': 1269485, 'remote starter': 1269485,
  'carplay': 1269487,
  'sound system': 1269489, 'sound': 1269489,
  'tint': 1269491, 'window tint': 1269491, 'insulfilm': 1269491,
  'suntek': 1269491, 'suntek carbon': 1269491, 'llumar': 1269491,
  '3m': 1269491, 'ceramic pro': 1269491, 'formula one': 1269491,
  'xpel': 1269491, 'carbon': 1269491,
  'backup cam': 1269493, 'backup camera': 1269493,
  'dashcam': 1269495, 'dash cam': 1269495,
  'ambient light': 1269497, 'ambient lights': 1269497,
  'led': 1269499, 'led lights': 1269499, 'led light': 1269499,
  'labor': 1269693,
  'key copy': 1269965, 'key programming': 1269965, 'car key': 1269965,
  'checagem': 1270467, 'check': 1270467, 'check service': 1270467,
};

// Idioma (1820619) - enum_id map
const LANGUAGE_ENUM: Record<string, number> = {
  'inglês': 1269501, 'ingles': 1269501, 'english': 1269501,
  'português': 1269503, 'portugues': 1269503, 'portuguese': 1269503,
  'espanhol': 1269505, 'spanish': 1269505,
};
const LANGUAGE_DEFAULT_ENUM = 1272947; // "Não categorizado"

// Objeções (1820707) - enum_id map
const OBJECTION_ENUM: Record<string, number> = {
  'preco': 1269573,
  'distancia': 1269575,
  'concorrencia': 1269577,
  'tecnica': 1269579,
  'necessidade': 1269581,
  'financiamento': 1269583,
  'confianca': 1269585,
  'indecisao': 1269655,
  'semresposta': 1272747,
  'endereco': 1272749,
  'preco_sumiu': 1272751,
  'tempo': 1272753,
  'opcoes': 1272755,
  'distante_estado': 1272781,
  'fora_perto': 1269637,
  'fora_longe': 1269639,
};

// Cliente Necessita (1820775) - enum_id map
const CLIENT_NEEDS_ENUM: Record<string, number> = {
  'remote start': 1269723, 'remote starter': 1269723,
  'window tint': 1269725, 'tint': 1269725, 'insulfilm': 1269725,
  'suntek': 1269725, 'suntek carbon': 1269725, 'llumar': 1269725,
  '3m': 1269725, 'ceramic pro': 1269725, 'carbon': 1269725,
  'carplay': 1269891,
  'sound system': 1269893, 'sound': 1269893,
  'dashcam': 1269895, 'dash cam': 1269895,
  'backup cam': 1269897, 'backup camera': 1269897,
  'led': 1269899, 'led lights': 1269899,
  'ambient light': 1269901, 'ambient lights': 1269901,
};

// Lead Score select (1821573) - enum_id map
const SCORE_ENUM: Record<number, number> = {
  1: 1271135, 2: 1271137, 3: 1271139, 4: 1271141, 5: 1271143,
};

// --- Helper Functions ---

function mapScoreToEnumId(score: number | null): number | null {
  if (score === null || score === undefined) return null;
  if (score <= 20) return SCORE_ENUM[1];
  if (score <= 40) return SCORE_ENUM[2];
  if (score <= 60) return SCORE_ENUM[3];
  if (score <= 80) return SCORE_ENUM[4];
  return SCORE_ENUM[5];
}

function mapProductEnumIds(serviceDesired: string | null): Array<{ enum_id: number }> | null {
  if (!serviceDesired) return null;
  const lower = serviceDesired.toLowerCase().trim();
  const found: number[] = [];
  for (const [key, enumId] of Object.entries(PRODUCT_ENUM)) {
    if (lower.includes(key) && !found.includes(enumId)) found.push(enumId);
  }
  return found.length > 0 ? found.map(id => ({ enum_id: id })) : null;
}

function mapClientNeedsEnumIds(upsellProducts: string[] | null, serviceDesired: string | null): Array<{ enum_id: number }> | null {
  const sources = [...(upsellProducts || [])];
  if (serviceDesired) sources.push(serviceDesired);
  if (sources.length === 0) return null;
  const found: number[] = [];
  for (const item of sources) {
    const lower = item.toLowerCase().trim();
    for (const [key, enumId] of Object.entries(CLIENT_NEEDS_ENUM)) {
      if (lower.includes(key) && !found.includes(enumId)) found.push(enumId);
    }
  }
  return found.length > 0 ? found.map(id => ({ enum_id: id })) : null;
}

function mapObjectionEnumIds(categories: string[] | null): Array<{ enum_id: number }> | null {
  if (!categories || categories.length === 0) return null;
  const found: number[] = [];
  for (const cat of categories) {
    const enumId = OBJECTION_ENUM[cat.toLowerCase().trim()];
    if (enumId && !found.includes(enumId)) found.push(enumId);
  }
  return found.length > 0 ? found.map(id => ({ enum_id: id })) : null;
}

function mapLanguageEnumId(lang: string | null): number {
  if (!lang) return LANGUAGE_DEFAULT_ENUM;
  return LANGUAGE_ENUM[lang.toLowerCase().trim()] ?? LANGUAGE_DEFAULT_ENUM;
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

  // Lead Score select 1-5 (1821573) - uses enum_id
  const scoreEnumId = mapScoreToEnumId(lead.lead_score);
  if (scoreEnumId) {
    fields.push({ field_id: 1821573, values: [{ enum_id: scoreEnumId }] });
  }

  // Produto de interesse (1820617) - uses enum_id
  const products = mapProductEnumIds(lead.service_desired);
  if (products) {
    fields.push({ field_id: 1820617, values: products });
  }

  // Idioma (1820619) - uses enum_id
  const langEnumId = mapLanguageEnumId(lead.lead_language);
  fields.push({ field_id: 1820619, values: [{ enum_id: langEnumId }] });

  // Objeções multiselect (1820707) - uses enum_id
  const objections = mapObjectionEnumIds(lead.objection_categories);
  if (objections) {
    fields.push({ field_id: 1820707, values: objections });
  }

  // Cliente Necessita (1820775) - uses enum_id
  const clientNeeds = mapClientNeedsEnumIds(lead.upsell_products, lead.service_desired);
  if (clientNeeds) {
    fields.push({ field_id: 1820775, values: clientNeeds });
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

  // --- Novos campos AI ---

  // Temperatura (AI) - 1823979
  if (lead.lead_temperature) {
    fields.push({ field_id: 1823979, values: [{ value: capitalize(lead.lead_temperature) }] });
  }

  // Sentimento (AI) - 1823981
  if (lead.sentiment) {
    fields.push({ field_id: 1823981, values: [{ value: capitalize(lead.sentiment) }] });
  }

  // Intenção (AI) - 1823983
  if (lead.lead_intent) {
    fields.push({ field_id: 1823983, values: [{ value: capitalize(lead.lead_intent) }] });
  }

  // Serviço desejado (AI) - 1823985
  if (lead.service_desired) {
    fields.push({ field_id: 1823985, values: [{ value: lead.service_desired }] });
  }

  // Resumo (AI) - 1823987
  if (lead.need_summary) {
    fields.push({ field_id: 1823987, values: [{ value: lead.need_summary }] });
  }

  // Necessidades (AI) - 1823989
  if (lead.improvement_point) {
    fields.push({ field_id: 1823989, values: [{ value: lead.improvement_point }] });
  }

  // Conformidade com script (AI) - 1823991
  if (lead.playbook_compliance_score !== null && lead.playbook_compliance_score !== undefined) {
    fields.push({ field_id: 1823991, values: [{ value: `${lead.playbook_compliance_score}%` }] });
  }

  // Etapas faltantes (AI) - 1823993
  if (lead.playbook_steps_missing?.length > 0) {
    fields.push({ field_id: 1823993, values: [{ value: lead.playbook_steps_missing.join('\n') }] });
  }

  // Violações (AI) - 1823995
  if (lead.playbook_violations) {
    fields.push({ field_id: 1823995, values: [{ value: lead.playbook_violations }] });
  }

  // Nota atendimento mensagem (1823119)
  if (lead.service_rating !== null && lead.service_rating !== undefined) {
    fields.push({ field_id: 1823119, values: [{ value: `${lead.service_rating}/10` }] });
  }

  // Nota lead mensagem (1823123)
  if (lead.lead_score !== null && lead.lead_score !== undefined) {
    fields.push({ field_id: 1823123, values: [{ value: `${lead.lead_score}/100` }] });
  }

  // Promoção/ancoragem feita checkbox (1823115)
  fields.push({
    field_id: 1823115,
    values: [{ value: lead.used_offer === true || lead.used_anchoring === true }],
  });

  // Financeira apresentada checkbox (1823113)
  // True if seller used anchoring with financing detail
  const financieiraApresentada = lead.used_anchoring === true &&
    (lead.anchoring_detail?.toLowerCase().includes('financ') ||
     lead.offer_detail?.toLowerCase().includes('financ') ||
     lead.used_offer === true);
  fields.push({ field_id: 1823113, values: [{ value: financieiraApresentada === true }] });

  // Walk-in checkbox (1823587)
  if (lead.is_walking !== null && lead.is_walking !== undefined) {
    fields.push({ field_id: 1823587, values: [{ value: lead.is_walking === true }] });
  }

  // Auditoria de mensagem (1823117)
  fields.push({ field_id: 1823117, values: [{ value: buildAuditText(lead) }] });

  const payload: any = { custom_fields_values: fields };

  // Native price field
  if (lead.lead_price !== null && lead.lead_price !== undefined && lead.lead_price > 0) {
    payload.price = Math.round(Number(lead.lead_price));
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

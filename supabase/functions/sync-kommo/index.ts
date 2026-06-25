// sync-kommo — espelha no lead_db os leads da Kommo que faltam (código puro,
// rumo a aposentar o n8n). SOMENTE INSERÇÃO (ignoreDuplicates por session_id):
// adiciona os leads ausentes e NUNCA sobrescreve os que o chat/IA já enriqueceu.
//
// VENDEDOR: usa o custom field 1823653 "Vendedor shopmonkey" (ÚNICO campo de
// vendedor na Kommo). O responsible_user_id é 100% a conta genérica "Pro Car
// Sound & Security" e NÃO carrega vendedor, por isso é ignorado. O valor é
// normalizado por canonicalSeller; o sentinela "Não registrado no notes do
// agendamento" vira NULL (não identificado). Cobertura desse campo é baixa (~2%);
// a fonte boa de vendedor é shopmonkey_appointment (parseNote dos notes, ~93%),
// usada na aba Vendedores via get_sellers_shopmonkey_kpis.
//
// Mapeamentos: pipeline -> canal (Instagram/Whatsapp/Meta Ads/E-mail/Parcerias=
// indicação/outros); status_id -> sales_status (142="Venda ganha"); "Cliente na
// loja" -> is_walking. Reusa KOMMO_ACCESS_TOKEN + KOMMO_SUBDOMAIN.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.81.1';
import { canonicalSeller } from '../_shared/canonical-seller.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function channelFromPipeline(name: string): string {
  const n = (name || '').toLowerCase();
  if (n.includes('instagram')) return 'instagram';
  if (n.includes('whatsapp')) return 'whatsapp';
  if (n.includes('meta')) return 'meta ads';
  if (n.includes('mail')) return 'email';
  if (n.includes('parceria')) return 'indicação';
  return 'outros';
}

// source_id (Kommo) -> canal. A Kommo guarda o source_id em cada lead, mas o GET
// /sources volta VAZIO (204) para este token (as fontes de chat pertencem às
// integrações de WhatsApp/IG, não à nossa). Mapa das fontes observadas (10 ids
// cobrem ~100% dos leads). WhatsApp confirmado por 100% de telefone nos contatos
// (regra Pro Car: telefone => WhatsApp); Instagram por handles; Facebook inferido.
// Ajustável: confirmar o nome de cada fonte no Kommo. Sem match, cai no canal do
// pipeline (geralmente 'outros').
const CHANNEL_BY_SOURCE: Record<number, string> = {
  23036455: 'whatsapp',  // maior fonte (~3.7k); 100% telefone
  23036209: 'whatsapp',  // 2ª maior (~2.7k); 100% telefone
  19009411: 'whatsapp',
  19009467: 'whatsapp',
  23036387: 'whatsapp',
  23036383: 'whatsapp',
  23036243: 'whatsapp',  // nome do lead = número de telefone
  19337407: 'instagram', // handles
  19337411: 'instagram', // handles (djfariflow, mirandahereee...)
  19009471: 'facebook',  // nomes reais (inferido; confirmar)
};

// CF "Vendedor shopmonkey" — único campo de vendedor da Kommo.
const VENDEDOR_SHOPMONKEY_CF = 1823653;
function cfValue(l: any, fieldId: number): string | null {
  for (const c of (l.custom_fields_values ?? [])) {
    if (c.field_id === fieldId) {
      const v = (c.values ?? [])[0]?.value;
      return v != null ? String(v) : null;
    }
  }
  return null;
}

// Telefone do CONTATO (campo padrão da Kommo, field_code='PHONE').
function contactPhone(contact: any): string | null {
  for (const c of (contact?.custom_fields_values ?? [])) {
    if (c.field_code === 'PHONE') {
      const v = (c.values ?? [])[0]?.value;
      if (v != null) return String(v);
    }
  }
  return null;
}

// Normaliza p/ chave de dedup: só dígitos, tira DDI '1' (US) quando 11 díg., últimos 10.
function normPhone(s: string | null): string | null {
  const d = (s ?? '').replace(/\D/g, '');
  if (d.length < 10) return null;
  const ten = d.length === 11 && d.startsWith('1') ? d.slice(1) : d.slice(-10);
  return ten.slice(-10);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const days = Math.max(1, Math.min(120, Number(body.days ?? 14)));

    const token = Deno.env.get('KOMMO_ACCESS_TOKEN');
    const subdomain = Deno.env.get('KOMMO_SUBDOMAIN');
    if (!token || !subdomain) return json({ error: 'Faltam KOMMO_ACCESS_TOKEN / KOMMO_SUBDOMAIN' }, 500);
    const base = `https://${subdomain}.kommo.com/api/v4`;
    const kh = { Authorization: `Bearer ${token}` };
    const kget = async (path: string) => {
      const r = await fetch(`${base}${path}`, { headers: kh });
      if (r.status === 204) return null;
      if (!r.ok) throw new Error(`Kommo ${r.status} ${path}: ${await r.text()}`);
      return r.json();
    };

    // ---- mapa status_id -> {pipeline, status} ----
    const statusMap = new Map<number, { pipeline: string; status: string }>();
    const pipes = await kget('/leads/pipelines');
    for (const p of pipes?._embedded?.pipelines ?? []) {
      for (const s of p?._embedded?.statuses ?? []) {
        statusMap.set(s.id, { pipeline: p.name, status: s.name });
      }
    }

    // ---- leads criados na janela. Extrai SÓ o necessário por lead (lean) durante a
    //      paginação p/ não estourar memória no backfill: with=contacts engorda cada
    //      lead, então NÃO guardamos o objeto cru, só {id,status,price,seller,contato}. ----
    const fromUnix = Math.floor((Date.now() - days * 86400000) / 1000);
    // CURSOR: start_page + max_pages limitam o lote por chamada. Backfill de janelas
    // grandes não cabe numa invocação só (limite de compute/tempo do edge function);
    // chame em sequência avançando start_page até has_more=false. Default = run completo
    // (max_pages=60), então o cron (days=2) segue inalterado.
    const startPage = Math.max(1, Number(body.start_page ?? 1));
    const maxPages = Math.max(1, Math.min(60, Number(body.max_pages ?? 60)));
    const leads: { id: number; status_id: number; price: any; created_at: number; sellerRaw: string | null; contactId: number | null; source_id: number | null; isAbsoluto: boolean; lossReason: string | null }[] = [];
    let page = startPage;
    let pagesRead = 0;
    let nextStartPage: number | null = null;
    while (pagesRead < maxPages) {
      const d = await kget(`/leads?filter[created_at][from]=${fromUnix}&with=contacts,source_id,loss_reason&limit=250&page=${page}`);
      const batch = d?._embedded?.leads ?? [];
      if (!batch.length) break;
      for (const l of batch) {
        const cs = l?._embedded?.contacts ?? [];
        const main = cs.find((c: any) => c.is_main) ?? cs[0];
        leads.push({
          id: l.id,
          status_id: l.status_id,
          price: l.price,
          created_at: l.created_at,
          sellerRaw: cfValue(l, VENDEDOR_SHOPMONKEY_CF),
          contactId: main?.id ?? null,
          source_id: l.source_id ?? null,
          // BLOCO G: tag "absoluto" aplicada ao lead na Kommo (via webhook de mensagem).
          isAbsoluto: (l?._embedded?.tags ?? []).some((t: any) => /absoluto/i.test(t?.name ?? "")),
          // BLOCO N #50: motivo de perda do Kommo (ex.: "Local distante"), quando o
          // lead foi para um status de perdido (with=loss_reason).
          lossReason: l?._embedded?.loss_reason?.[0]?.name ?? null,
        });
      }
      pagesRead++;
      if (!d?._links?.next) break;
      page++;
      if (pagesRead >= maxPages) nextStartPage = page; // ainda há páginas além deste lote
    }

    // ---- telefone: resolve os contatos (is_main já capturado em contactId) -> CF PHONE.
    //      DEFENSIVO: qualquer falha aqui NUNCA quebra o sync; só deixa o telefone nulo. ----
    const phoneByLead = new Map<number, { raw: string; norm: string | null }>();
    try {
      const contactIds = [...new Set(leads.map((l) => l.contactId).filter((x): x is number => !!x))];
      const phoneByContact = new Map<number, { raw: string; norm: string | null }>();
      for (let i = 0; i < contactIds.length; i += 250) {
        const qs = contactIds.slice(i, i + 250).map((id) => `filter[id][]=${id}`).join('&');
        const cd = await kget(`/contacts?${qs}&limit=250`);
        for (const c of cd?._embedded?.contacts ?? []) {
          const raw = contactPhone(c);
          if (raw) phoneByContact.set(c.id, { raw, norm: normPhone(raw) });
        }
      }
      for (const l of leads) {
        const ph = l.contactId != null ? phoneByContact.get(l.contactId) : undefined;
        if (ph) phoneByLead.set(l.id, ph);
      }
    } catch (e) {
      console.error('phone enrichment falhou (segue sem telefone):', e instanceof Error ? e.message : e);
    }

    const rows = leads.map((l) => {
      const st = statusMap.get(l.status_id);
      const statusName = st?.status ?? null;
      const channel = (l.source_id != null ? CHANNEL_BY_SOURCE[l.source_id] : undefined) ?? channelFromPipeline(st?.pipeline ?? '');
      const ph = phoneByLead.get(l.id);
      return {
        session_id: l.id,
        channel,
        sales_status: statusName,
        lead_price: l.price ? Number(l.price) : null,
        sales_person_id: canonicalSeller(l.sellerRaw),
        is_walking: (statusName ?? '').toLowerCase().includes('loja'),
        created_at: new Date((l.created_at ?? 0) * 1000).toISOString(),
        source_system: 'kommo_sync',
        phone: ph?.raw ?? null,
        phone_normalized: ph?.norm ?? null,
        is_absoluto: l.isAbsoluto,
        loss_reason: l.lossReason,
      };
    });

    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    // 1) INSERT-ONLY: só adiciona os que faltam, nunca sobrescreve (ignoreDuplicates).
    let inserted = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { data, error } = await supabase
        .from('lead_db')
        .upsert(chunk, { onConflict: 'session_id', ignoreDuplicates: true })
        .select('session_id');
      if (error) throw new Error('upsert lead_db: ' + error.message);
      inserted += data?.length ?? 0;
    }

    // 2) Atualiza o VENDEDOR dos espelhos já existentes — restrito a
    //    source_system='kommo_sync', então NUNCA toca em leads de chat/IA. Torna o
    //    re-run idempotente: corrige sales_person_id de quem já estava inserido (ex.:
    //    valores antigos vindos do responsible_user genérico). Agrupa por vendedor
    //    para poucas queries.
    const bySeller = new Map<string | null, number[]>();
    for (const r of rows) {
      const arr = bySeller.get(r.sales_person_id) ?? [];
      arr.push(r.session_id);
      bySeller.set(r.sales_person_id, arr);
    }
    let sellersSet = 0;
    for (const [seller, ids] of bySeller) {
      for (let i = 0; i < ids.length; i += 300) {
        const slice = ids.slice(i, i + 300);
        const { data, error } = await supabase
          .from('lead_db')
          .update({ sales_person_id: seller })
          .eq('source_system', 'kommo_sync')
          .in('session_id', slice)
          .select('session_id');
        if (error) throw new Error('update seller: ' + error.message);
        sellersSet += data?.length ?? 0;
      }
    }

    // 2b) Espelha a ETAPA (sales_status) em TODAS as linhas existentes — a etapa é
    //     verdade da Kommo. Linhas criadas pela ponte em tempo real (chat/telefone)
    //     nasciam sem etapa e o insert-only nunca preenchia: ficavam "Sem etapa
    //     (ainda)" para sempre no gráfico de status (caso 23907017, 11/06).
    const byStatus = new Map<string, number[]>();
    for (const r of rows) {
      if (!r.sales_status) continue;
      const arr = byStatus.get(r.sales_status) ?? [];
      arr.push(r.session_id);
      byStatus.set(r.sales_status, arr);
    }
    let statusSet = 0;
    for (const [statusName, ids] of byStatus) {
      for (let i = 0; i < ids.length; i += 300) {
        const slice = ids.slice(i, i + 300);
        const { data, error } = await supabase
          .from('lead_db')
          .update({ sales_status: statusName })
          .in('session_id', slice)
          .select('session_id');
        if (error) throw new Error('update status: ' + error.message);
        statusSet += data?.length ?? 0;
      }
    }

    // 2c) BLOCO G (absoluto): marca is_absoluto=true nos leads cuja TAG "absoluto" chegou
    //     da Kommo (aplicada por webhook de mensagem). Só marca os positivos (tag rara);
    //     não reseta os demais. Idempotente.
    const absolutoIds = rows.filter((r) => r.is_absoluto).map((r) => r.session_id);
    let absolutoSet = 0;
    for (let i = 0; i < absolutoIds.length; i += 300) {
      const slice = absolutoIds.slice(i, i + 300);
      const { data, error } = await supabase
        .from('lead_db')
        .update({ is_absoluto: true })
        .in('session_id', slice)
        .select('session_id');
      if (error) throw new Error('update absoluto: ' + error.message);
      absolutoSet += data?.length ?? 0;
    }

    // 2d) BLOCO N #50: espelha o MOTIVO DE PERDA (loss_reason) do Kommo nas linhas
    //     existentes — agrupado por motivo p/ poucas queries. Só grava onde o Kommo tem
    //     motivo (lead perdido); não apaga os demais.
    const byLoss = new Map<string, number[]>();
    for (const r of rows) {
      if (!r.loss_reason) continue;
      const arr = byLoss.get(r.loss_reason) ?? [];
      arr.push(r.session_id);
      byLoss.set(r.loss_reason, arr);
    }
    let lossSet = 0;
    for (const [reason, ids] of byLoss) {
      for (let i = 0; i < ids.length; i += 300) {
        const slice = ids.slice(i, i + 300);
        const { data, error } = await supabase
          .from('lead_db')
          .update({ loss_reason: reason })
          .in('session_id', slice)
          .select('session_id');
        if (error) throw new Error('update loss_reason: ' + error.message);
        lossSet += data?.length ?? 0;
      }
    }

    // 3) Backfill do TELEFONE: refresca os espelhos kommo_sync E preenche linhas de
    //    chat/ponte que estejam SEM telefone (o telefone do contato Kommo é verdade;
    //    sem ele a linha de chat não liga à venda paga do ShopMonkey nem deduplica).
    //    DEFENSIVO: falha aqui não derruba o sync de leads.
    let phonesSet = 0;
    try {
      const byPhone = new Map<string, { raw: string | null; ids: number[] }>();
      for (const r of rows) {
        if (!r.phone_normalized) continue;
        const e = byPhone.get(r.phone_normalized) ?? { raw: r.phone, ids: [] };
        e.ids.push(r.session_id);
        byPhone.set(r.phone_normalized, e);
      }
      for (const [norm, { raw, ids }] of byPhone) {
        for (let i = 0; i < ids.length; i += 300) {
          const slice = ids.slice(i, i + 300);
          const { data, error } = await supabase
            .from('lead_db')
            .update({ phone: raw, phone_normalized: norm })
            .or('source_system.eq.kommo_sync,phone_normalized.is.null')
            .in('session_id', slice)
            .select('session_id');
          if (error) throw new Error('update phone: ' + error.message);
          phonesSet += data?.length ?? 0;
        }
      }
    } catch (e) {
      console.error('phone backfill falhou (segue):', e instanceof Error ? e.message : e);
    }

    // 4) Atualiza o CANAL dos espelhos kommo_sync existentes (por source_id da Kommo),
    //    restrito a source_system='kommo_sync'. Re-channela o backfill (que saía 'outros').
    const byChannel = new Map<string, number[]>();
    for (const r of rows) {
      const arr = byChannel.get(r.channel) ?? [];
      arr.push(r.session_id);
      byChannel.set(r.channel, arr);
    }
    let channelsSet = 0;
    for (const [channel, ids] of byChannel) {
      for (let i = 0; i < ids.length; i += 300) {
        const slice = ids.slice(i, i + 300);
        const { data, error } = await supabase
          .from('lead_db')
          .update({ channel })
          .eq('source_system', 'kommo_sync')
          .in('session_id', slice)
          .select('session_id');
        if (error) throw new Error('update channel: ' + error.message);
        channelsSet += data?.length ?? 0;
      }
    }

    return json({
      window_days: days,
      start_page: startPage,
      pages_read: pagesRead,
      has_more: nextStartPage != null,
      next_start_page: nextStartPage,
      kommo_leads: leads.length,
      inserted_missing: inserted,
      already_present: leads.length - inserted,
      leads_com_vendedor: rows.filter((r) => r.sales_person_id).length,
      espelhos_normalizados: sellersSet,
      etapas_normalizadas: statusSet,
      absoluto_marcados: absolutoSet,
      loss_reason_gravados: lossSet,
      canais_normalizados: channelsSet,
      leads_com_telefone: rows.filter((r) => r.phone_normalized).length,
      telefones_gravados: phonesSet,
      note: 'Insert-only + normalização de vendedor/etapa/canal + backfill de telefone. A ETAPA (sales_status) é espelhada da Kommo para TODAS as linhas (a Kommo é a verdade do funil). Use start_page/max_pages p/ backfill em lotes.',
    });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});

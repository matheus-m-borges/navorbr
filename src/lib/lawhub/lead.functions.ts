import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAuthenticatedAccount } from "@/core/security/authorization.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type LeadInput = Record<string, any> & { accountId?: string };
type LeadRow = Record<string, any> & { id: string; account_id: string };

export type LawHubConflictResult = {
  hasConflict: boolean;
  notes: string;
  matchedRecords: Array<{ type: "client" | "process"; name: string; details?: string }>;
};

async function accountFor(context: { userId: string }, requested?: string) {
  return requireAuthenticatedAccount(context.userId, requested);
}

export const checkLawHubLeadConflict = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { opposingParty?: string; opposingPartyDoc?: string; accountId?: string }) => input || {})
  .handler(async ({ data, context }): Promise<LawHubConflictResult> => {
    const { accountId } = await accountFor(context, data.accountId);
    const party = String(data.opposingParty || "").trim().toLowerCase();
    const document = String(data.opposingPartyDoc || "").replace(/\D/g, "");
    if (!party && !document) return { hasConflict: false, notes: "Nenhuma parte contrária informada para checagem.", matchedRecords: [] };
    const db = supabaseAdmin as any;
    const [{ data: clients, error: clientsError }, { data: processes, error: processesError }] = await Promise.all([
      db.from("clients").select("name, document").eq("account_id", accountId),
      db.from("law_processes").select("title, cnj_number, client_name, active_pole").eq("account_id", accountId),
    ]);
    if (clientsError || processesError) throw new Error(`Falha na checagem de conflito: ${clientsError?.message || processesError?.message}`);
    const matchedRecords: LawHubConflictResult["matchedRecords"] = [];
    for (const client of clients || []) {
      const clientName = String(client.name || "");
      const clientDoc = String(client.document || "").replace(/\D/g, "");
      if ((document && clientDoc && document === clientDoc) || (party.length > 4 && clientName.toLowerCase().includes(party)) || (clientName.length > 4 && party.includes(clientName.toLowerCase()))) {
        matchedRecords.push({ type: "client", name: clientName, details: client.document || undefined });
      }
    }
    for (const process of processes || []) {
      const names = [process.client_name, process.active_pole, process.title].filter(Boolean).map((value: unknown) => String(value).toLowerCase());
      if (party.length > 4 && names.some((name: string) => name.includes(party) || party.includes(name))) {
        matchedRecords.push({ type: "process", name: String(process.client_name || process.title || "Processo"), details: process.cnj_number || undefined });
      }
    }
    return matchedRecords.length
      ? { hasConflict: true, notes: "Parte relacionada encontrada na base real da conta.", matchedRecords }
      : { hasConflict: false, notes: "Nenhum vínculo correspondente encontrado na base real da conta.", matchedRecords: [] };
  });

export const listLawHubLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { accountId?: string; pipelineId?: string }) => input || {})
  .handler(async ({ data, context }): Promise<{ accountId: string; stages: LeadRow[]; leads: LeadRow[]; customFields: LeadRow[] }> => {
    const { accountId } = await accountFor(context, data.accountId);
    const pipelineId = data.pipelineId;
    const db = supabaseAdmin as any;
    let stagesQuery = db.from("law_lead_pipeline_stages").select("*").eq("account_id", accountId).order("position");
    if (pipelineId) stagesQuery = stagesQuery.eq("pipeline_id", pipelineId);
    const leadsQuery = db.from("law_leads").select("*").eq("account_id", accountId).order("created_at", { ascending: false });
    const fieldsQuery = db.from("law_lead_custom_fields").select("*").eq("account_id", accountId).order("position");
    const [{ data: stages, error: stagesError }, { data: leads, error: leadsError }, { data: fields, error: fieldsError }] = await Promise.all([
      stagesQuery,
      pipelineId ? leadsQuery.eq("lead_type", pipelineId === "pipe-futuros" ? "futuro" : "imediato") : leadsQuery,
      fieldsQuery,
    ]);
    if (stagesError || leadsError || fieldsError) {
      throw new Error(`Falha ao carregar pipeline LawHub: ${stagesError?.message || leadsError?.message || fieldsError?.message}`);
    }
    return { accountId, stages: (stages || []) as LeadRow[], leads: (leads || []) as LeadRow[], customFields: (fields || []) as LeadRow[] };
  });

export const getLawHubLeadWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { leadId: string; accountId?: string }) => input)
  .handler(async ({ data, context }): Promise<{ lead: LeadRow; stages: LeadRow[]; customFields: LeadRow[]; proposals: LeadRow[]; timeline: LeadRow[] }> => {
    const { accountId } = await accountFor(context, data.accountId);
    const db = supabaseAdmin as any;
    const [{ data: lead, error: leadError }, { data: stages, error: stagesError }, { data: customFields, error: fieldsError }, { data: proposals, error: proposalsError }, { data: timeline, error: timelineError }] = await Promise.all([
      db.from("law_leads").select("*").eq("id", data.leadId).eq("account_id", accountId).single(),
      db.from("law_lead_pipeline_stages").select("*").eq("account_id", accountId).order("position"),
      db.from("law_lead_custom_fields").select("*").eq("account_id", accountId).order("position"),
      db.from("law_lead_proposals").select("*").eq("lead_id", data.leadId).eq("account_id", accountId).order("created_at", { ascending: false }),
      db.from("law_lead_timeline").select("*").eq("lead_id", data.leadId).eq("account_id", accountId).order("created_at", { ascending: false }),
    ]);
    const firstError = leadError || stagesError || fieldsError || proposalsError || timelineError;
    if (firstError || !lead) throw new Error(`Falha ao carregar workspace do lead: ${firstError?.message || "lead não localizado"}`);
    return { lead: lead as LeadRow, stages: (stages || []) as LeadRow[], customFields: (customFields || []) as LeadRow[], proposals: (proposals || []) as LeadRow[], timeline: (timeline || []) as LeadRow[] };
  });

export const updateLawHubLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { leadId: string; accountId?: string; changes: Record<string, any> }) => input)
  .handler(async ({ data, context }): Promise<LeadRow> => {
    const { accountId } = await accountFor(context, data.accountId);
    const changes = { ...data.changes, updated_at: new Date().toISOString() };
    const db = supabaseAdmin as any;
    const { data: updated, error } = await db.from("law_leads").update(changes).eq("id", data.leadId).eq("account_id", accountId).select().single();
    if (error || !updated) throw new Error(`Falha ao atualizar lead: ${error?.message || "lead não localizado"}`);
    return updated as LeadRow;
  });

export const saveLawHubLeadProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { leadId: string; accountId?: string; proposal: Record<string, any> }) => input)
  .handler(async ({ data, context }): Promise<LeadRow> => {
    const { accountId } = await accountFor(context, data.accountId);
    const db = supabaseAdmin as any;
    const { data: saved, error } = await db.from("law_lead_proposals").upsert({ ...data.proposal, lead_id: data.leadId, account_id: accountId, updated_at: new Date().toISOString() }).select().single();
    if (error || !saved) throw new Error(`Falha ao gravar proposta: ${error?.message || "resposta vazia"}`);
    return saved as LeadRow;
  });

export const addLawHubLeadTimelineEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { leadId: string; accountId?: string; eventType: string; description: string; metadata?: Record<string, any> }) => input)
  .handler(async ({ data, context }): Promise<LeadRow> => {
    const { accountId } = await accountFor(context, data.accountId);
    const db = supabaseAdmin as any;
    const { data: entry, error } = await db.from("law_lead_timeline").insert({ lead_id: data.leadId, account_id: accountId, user_id: context.userId, event_type: data.eventType, description: data.description, metadata: data.metadata || {} }).select().single();
    if (error || !entry) throw new Error(`Falha ao gravar timeline: ${error?.message || "resposta vazia"}`);
    return entry as LeadRow;
  });

export const createLawHubLeadStage = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: { stage: Record<string, any>; accountId?: string }) => input).handler(async ({ data, context }): Promise<LeadRow> => {
  const { accountId } = await accountFor(context, data.accountId); const db = supabaseAdmin as any;
  const { data: row, error } = await db.from("law_lead_pipeline_stages").insert({ ...data.stage, account_id: accountId }).select().single();
  if (error || !row) throw new Error(`Falha ao criar etapa: ${error?.message || "resposta vazia"}`); return row as LeadRow;
});

export const updateLawHubLeadStage = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: { stageId: string; updates: Record<string, any>; accountId?: string }) => input).handler(async ({ data, context }): Promise<LeadRow> => {
  const { accountId } = await accountFor(context, data.accountId); const db = supabaseAdmin as any;
  const { data: row, error } = await db.from("law_lead_pipeline_stages").update({ ...data.updates, updated_at: new Date().toISOString() }).eq("id", data.stageId).eq("account_id", accountId).select().single();
  if (error || !row) throw new Error(`Falha ao atualizar etapa: ${error?.message || "etapa não localizada"}`); return row as LeadRow;
});

export const deleteLawHubLeadStage = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: { stageId: string; accountId?: string }) => input).handler(async ({ data, context }) => {
  const { accountId } = await accountFor(context, data.accountId); const db = supabaseAdmin as any;
  const { error } = await db.from("law_lead_pipeline_stages").delete().eq("id", data.stageId).eq("account_id", accountId); if (error) throw new Error(`Falha ao excluir etapa: ${error.message}`); return { deleted: true };
});

export const createLawHubLeadCustomField = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: { field: Record<string, any>; accountId?: string }) => input).handler(async ({ data, context }): Promise<LeadRow> => {
  const { accountId } = await accountFor(context, data.accountId); const db = supabaseAdmin as any;
  const { data: row, error } = await db.from("law_lead_custom_fields").insert({ ...data.field, account_id: accountId }).select().single(); if (error || !row) throw new Error(`Falha ao criar campo: ${error?.message || "resposta vazia"}`); return row as LeadRow;
});

export const deleteLawHubLeadCustomField = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: { fieldId: string; accountId?: string }) => input).handler(async ({ data, context }) => {
  const { accountId } = await accountFor(context, data.accountId); const db = supabaseAdmin as any;
  const { error } = await db.from("law_lead_custom_fields").delete().eq("id", data.fieldId).eq("account_id", accountId); if (error) throw new Error(`Falha ao excluir campo: ${error.message}`); return { deleted: true };
});

export const moveLawHubLeadToFuture = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: { leadId: string; stageId: string; contactDate: string; contactTime?: string; reason?: string; accountId?: string }) => input).handler(async ({ data, context }): Promise<LeadRow> => {
  const { accountId } = await accountFor(context, data.accountId); const db = supabaseAdmin as any;
  const { data: row, error } = await db.from("law_leads").update({ pipeline_id: "pipe-futuros", lead_type: "futuro", stage_id: data.stageId, future_contact_date: data.contactDate, future_contact_time: data.contactTime || null, future_contact_reason: data.reason || null, updated_at: new Date().toISOString() }).eq("id", data.leadId).eq("account_id", accountId).select().single();
  if (error || !row) throw new Error(`Falha ao mover lead para o futuro: ${error?.message || "lead não localizado"}`);
  await db.from("law_lead_timeline").insert({ lead_id: data.leadId, account_id: accountId, user_id: context.userId, event_type: "stage_change", description: `Lead movido para o pipeline futuro com retorno em ${data.contactDate}.` });
  return row as LeadRow;
});

export const returnLawHubFutureLeadToMain = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: { leadId: string; stageId: string; accountId?: string }) => input).handler(async ({ data, context }): Promise<LeadRow> => {
  const { accountId } = await accountFor(context, data.accountId); const db = supabaseAdmin as any;
  const { data: row, error } = await db.from("law_leads").update({ pipeline_id: "pipe-principal", lead_type: "imediato", stage_id: data.stageId, updated_at: new Date().toISOString() }).eq("id", data.leadId).eq("account_id", accountId).select().single();
  if (error || !row) throw new Error(`Falha ao retornar lead ao pipeline principal: ${error?.message || "lead não localizado"}`);
  await db.from("law_lead_timeline").insert({ lead_id: data.leadId, account_id: accountId, user_id: context.userId, event_type: "stage_change", description: "Lead retornado do pipeline futuro ao pipeline principal." });
  return row as LeadRow;
});

export const convertLawHubLeadToClient = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: { leadId: string; accountId?: string }) => input).handler(async ({ data, context }): Promise<{ lead: LeadRow; client: LeadRow }> => {
  const { accountId } = await accountFor(context, data.accountId); const db = supabaseAdmin as any;
  const { data: result, error } = await db.rpc("convert_lawhub_lead_to_client", { p_lead_id: data.leadId });
  if (error || !result) throw new Error(`Falha na conversão transacional do lead: ${error?.message || "resposta vazia"}`);
  const [{ data: lead, error: leadError }, { data: client, error: clientError }] = await Promise.all([
    db.from("law_leads").select("*").eq("id", data.leadId).eq("account_id", accountId).single(),
    db.from("law_clients").select("*").eq("id", result.client_id).eq("account_id", accountId).single(),
  ]);
  if (leadError || clientError || !lead || !client) throw new Error(`Conversão concluída, mas falhou a leitura do resultado: ${leadError?.message || clientError?.message || "dados ausentes"}`);
  return { lead: lead as LeadRow, client: client as LeadRow };
});

export const validateLawHubContactAsLead = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((input: { existingLeadId?: string; name: string; phone: string; area?: string; option: "imediato" | "futuro"; futureContactDate?: string; futureContactTime?: string; futureContactReason?: string; notes?: string; trafficCode?: string; trafficAction?: string; accountId?: string }) => input).handler(async ({ data, context }): Promise<LeadRow> => {
  const { accountId } = await accountFor(context, data.accountId); const db = supabaseAdmin as any;
  if (data.option === "futuro" && !data.futureContactDate) throw new Error("A data para novo contato é obrigatória.");
  let lead: any = null;
  if (data.existingLeadId) { const found = await db.from("law_leads").select("*").eq("id", data.existingLeadId).eq("account_id", accountId).maybeSingle(); if (found.error) throw new Error(found.error.message); lead = found.data; }
  if (!lead && data.phone) { const found = await db.from("law_leads").select("*").eq("account_id", accountId).eq("phone", data.phone).maybeSingle(); if (found.error) throw new Error(found.error.message); lead = found.data; }
  const stageQuery = await db.from("law_lead_pipeline_stages").select("id").eq("account_id", accountId).eq("pipeline_id", data.option === "futuro" ? "pipe-futuros" : "pipe-principal").order("position").limit(1).maybeSingle();
  if (stageQuery.error || !stageQuery.data?.id) throw new Error(`Pipeline ${data.option} sem etapa configurada.`);
  const patch: Record<string, any> = { name: data.name, phone: data.phone, area_direito: data.area || "Geral", stage_id: stageQuery.data.id, pipeline_id: data.option === "futuro" ? "pipe-futuros" : "pipe-principal", lead_type: data.option, future_contact_date: data.option === "futuro" ? data.futureContactDate : null, future_contact_time: data.option === "futuro" ? data.futureContactTime || null : null, future_contact_reason: data.option === "futuro" ? data.futureContactReason || null : null, notes: data.notes || lead?.notes || null, traffic_code: data.trafficCode || lead?.traffic_code || null, traffic_action_name: data.trafficAction || lead?.traffic_action_name || null, updated_at: new Date().toISOString() };
  const result = lead ? await db.from("law_leads").update(patch).eq("id", lead.id).eq("account_id", accountId).select().single() : await db.from("law_leads").insert({ ...patch, account_id: accountId }).select().single();
  if (result.error || !result.data) throw new Error(`Falha ao validar contato como lead: ${result.error?.message || "resposta vazia"}`);
  const timeline = await db.from("law_lead_timeline").insert({ lead_id: result.data.id, account_id: accountId, user_id: context.userId, event_type: data.option === "futuro" ? "stage_change" : "created", description: data.option === "futuro" ? `Lead futuro agendado para ${data.futureContactDate}.` : "Contato validado como lead apto no pipeline principal." });
  if (timeline.error) throw new Error(`Lead persistido, mas timeline não persistiu: ${timeline.error.message}`);
  return result.data as LeadRow;
});

export const moveLawHubLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { leadId: string; stageId: string; accountId?: string }) => input)
  .handler(async ({ data, context }): Promise<LeadRow> => {
    const { accountId } = await accountFor(context, data.accountId);
    const db = supabaseAdmin as any;
    const { data: updated, error } = await db.from("law_leads").update({ stage_id: data.stageId, updated_at: new Date().toISOString() }).eq("id", data.leadId).eq("account_id", accountId).select().single();
    if (error || !updated) throw new Error(`Falha ao mover lead: ${error?.message || "lead não localizado"}`);
    const { error: timelineError } = await db.from("law_lead_timeline").insert({ account_id: accountId, lead_id: data.leadId, event_type: "stage_change", description: `Etapa alterada para ${data.stageId}.`, user_id: context.userId });
    if (timelineError) throw new Error(`Lead atualizado, mas timeline não persistiu: ${timelineError.message}`);
    return updated as LeadRow;
  });

export const deleteLawHubLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { leadId: string; accountId?: string }) => input)
  .handler(async ({ data, context }) => {
    const { accountId } = await accountFor(context, data.accountId);
    const db = supabaseAdmin as any;
    const { error } = await db.from("law_leads").delete().eq("id", data.leadId).eq("account_id", accountId);
    if (error) throw new Error(`Falha ao excluir lead: ${error.message}`);
    return { deleted: true, leadId: data.leadId };
  });

export const createLawHubLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: LeadInput) => input)
  .handler(async ({ data, context }): Promise<LeadRow> => {
    const { accountId } = await accountFor(context, data.accountId);
    const conflict = await checkLawHubLeadConflict({ data: { opposingParty: data.opposing_party, opposingPartyDoc: data.opposing_party_doc, accountId } });
    const payload: Record<string, unknown> = { ...data, account_id: accountId, conflict_check_status: conflict.hasConflict ? "conflict_detected" : "cleared", conflict_notes: conflict.notes };
    delete payload.accountId;
    const db = supabaseAdmin as any;
    const { data: created, error } = await db.from("law_leads").insert(payload).select().single();
    if (error || !created) throw new Error(`Falha ao criar lead: ${error?.message || "resposta vazia"}`);
    return created as LeadRow;
  });

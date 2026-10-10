import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAuthenticatedAccount } from "@/core/security/authorization.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
type Row = { id: string; account_id: string; [key: string]: JsonValue };

async function accountFor(userId: string, requested?: string): Promise<string> {
  const auth = await requireAuthenticatedAccount(userId, requested);
  return auth.accountId;
}

export const listLawHubContractClients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { accountId?: string } = {}) => input)
  .handler(async ({ data, context }): Promise<Row[]> => {
    const accountId = await accountFor(context.userId, data.accountId);
    const { data: rows, error } = await (supabaseAdmin as any).from("law_clients")
      .select("id,account_id,name,document,rg,marital_status,profession,email,phone,mobile,address,city,state,zip_code")
      .eq("account_id", accountId).is("deleted_at", null).order("name");
    if (error) throw new Error(`Falha ao listar clientes: ${error.message}`);
    return (rows || []) as Row[];
  });

export const listLawHubContractTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { accountId?: string } = {}) => input)
  .handler(async ({ data, context }): Promise<Row[]> => {
    const accountId = await accountFor(context.userId, data.accountId);
    const { data: rows, error } = await (supabaseAdmin as any)
      .from("law_contract_templates")
      .select("*")
      .eq("account_id", accountId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Falha ao listar modelos de contrato: ${error.message}`);
    return (rows || []) as Row[];
  });

export const getLawHubContractTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { templateId: string; accountId?: string }) => input)
  .handler(async ({ data, context }): Promise<Row> => {
    const accountId = await accountFor(context.userId, data.accountId);
    const { data: row, error } = await (supabaseAdmin as any)
      .from("law_contract_templates").select("*").eq("id", data.templateId).eq("account_id", accountId).single();
    if (error || !row) throw new Error(`Modelo de contrato não localizado: ${error?.message || "não encontrado"}`);
    return row as Row;
  });

export const createLawHubContractTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { accountId?: string; title: string; legalArea?: string; content: string; variables?: unknown }) => input)
  .handler(async ({ data, context }): Promise<Row> => {
    const accountId = await accountFor(context.userId, data.accountId);
    if (!data.title.trim() || !data.content.trim()) throw new Error("Título e conteúdo do modelo são obrigatórios.");
    const { data: row, error } = await (supabaseAdmin as any).from("law_contract_templates").insert({
      account_id: accountId, title: data.title.trim(), legal_area: data.legalArea || "Geral",
      content: data.content, variables: data.variables || [], is_system_template: false, is_active: true,
    }).select().single();
    if (error || !row) throw new Error(`Falha ao criar modelo de contrato: ${error?.message || "resposta vazia"}`);
    return row as Row;
  });

export const updateLawHubContractTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { templateId: string; accountId?: string; changes: { title?: string; legal_area?: string; content?: string; variables?: unknown; is_active?: boolean } }) => input)
  .handler(async ({ data, context }): Promise<Row> => {
    const accountId = await accountFor(context.userId, data.accountId);
    const { data: row, error } = await (supabaseAdmin as any).from("law_contract_templates").update(data.changes).eq("id", data.templateId).eq("account_id", accountId).select().single();
    if (error || !row) throw new Error(`Falha ao atualizar modelo: ${error?.message || "não encontrado"}`);
    return row as Row;
  });

export const archiveLawHubContractTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { templateId: string; accountId?: string }) => input)
  .handler(async ({ data, context }): Promise<{ archived: true }> => {
    const accountId = await accountFor(context.userId, data.accountId);
    const { data: updated, error } = await (supabaseAdmin as any)
      .from("law_contract_templates")
      .update({ is_active: false })
      .eq("id", data.templateId)
      .eq("account_id", accountId)
      .select("id");
    if (error) throw new Error(`Falha ao arquivar modelo: ${error.message}`);
    if (!updated || updated.length === 0) {
      throw new Error("Modelo não localizado ou não autorizado para arquivamento.");
    }
    return { archived: true };
  });

export const listLawHubContracts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { accountId?: string; clientId?: string } = {}) => input)
  .handler(async ({ data, context }): Promise<Row[]> => {
    const accountId = await accountFor(context.userId, data.accountId);
    let query = (supabaseAdmin as any).from("law_fee_contracts")
      .select("*, law_clients!inner(id,name,document,email,phone,address), law_fee_contract_items(*)")
      .eq("account_id", accountId).order("created_at", { ascending: false });
    if (data.clientId) query = query.eq("client_id", data.clientId);
    const { data: rows, error } = await query;
    if (error) throw new Error(`Falha ao listar contratos: ${error.message}`);
    return (rows || []) as Row[];
  });

export const getLawHubContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { contractId: string; accountId?: string }) => input)
  .handler(async ({ data, context }): Promise<Row> => {
    const accountId = await accountFor(context.userId, data.accountId);
    const { data: row, error } = await (supabaseAdmin as any).from("law_fee_contracts")
      .select("*, law_clients!inner(id,name,document,email,phone,address), law_fee_contract_items(*), law_contract_versions(*)")
      .eq("id", data.contractId).eq("account_id", accountId).single();
    if (error || !row) throw new Error(`Contrato não localizado: ${error?.message || "não encontrado"}`);
    return row as Row;
  });

export const createLawHubContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    accountId?: string;
    clientId: string;
    templateId: string;
    processId?: string;
    contractNumber?: string;
    title?: string;
    contractType?: string;
    content?: string;
    totalAmount?: number;
    entryAmount?: number;
    installmentsCount?: number;
    monthlyAmount?: number;
    contingencyPercentage?: number;
    sucumbencePercentage?: number;
    startDate?: string;
    notes?: string;
  }) => input)
  .handler(async ({ data, context }): Promise<Row> => {
    const accountId = await accountFor(context.userId, data.accountId);
    const db = supabaseAdmin as any;

    if (!data.clientId?.trim()) {
      throw new Error("Cliente persistido é obrigatório para emissão de contrato.");
    }
    if (!data.templateId?.trim()) {
      throw new Error("Modelo de contrato ativo é obrigatório para emissão de contrato.");
    }

    const { data: row, error } = await db.rpc("create_lawhub_contract_atomic", {
      p_account_id: accountId,
      p_actor_id: context.userId,
      p_client_id: data.clientId.trim(),
      p_template_id: data.templateId.trim(),
      p_process_id: data.processId?.trim() || null,
      p_contract_number: data.contractNumber?.trim() || null,
      p_title: data.title?.trim() || null,
      p_contract_type: data.contractType || "fixo",
      p_total_amount: data.totalAmount ?? 0,
      p_entry_amount: data.entryAmount ?? 0,
      p_installments_count: data.installmentsCount ?? 1,
      p_monthly_amount: data.monthlyAmount ?? 0,
      p_contingency_percentage: data.contingencyPercentage ?? 0,
      p_sucumbence_percentage: data.sucumbencePercentage ?? 0,
      p_start_date: data.startDate?.trim() || null,
      p_notes: data.notes || null,
    });

    if (error) {
      throw new Error(`Falha ao criar contrato: ${error.message}`);
    }
    if (!row) {
      throw new Error("Falha ao criar contrato: resposta vazia da RPC.");
    }

    return row as Row;
  });

const ALLOWED_CONTRACT_UPDATE_FIELDS = new Set([
  "title",
  "content",
  "notes",
  "contract_type",
  "total_amount",
  "entry_amount",
  "installments_count",
  "monthly_amount",
  "contingency_percentage",
  "sucumbence_percentage",
  "due_day",
  "start_date",
  "end_date",
  "status",
]);

export const updateLawHubContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { contractId: string; accountId?: string; changes: Record<string, unknown> }) => input)
  .handler(async ({ data, context }): Promise<Row> => {
    const accountId = await accountFor(context.userId, data.accountId);
    const db = supabaseAdmin as any;

    if (!data.contractId?.trim()) {
      throw new Error("Identificador do contrato é obrigatório.");
    }

    const rawChanges = data.changes || {};
    const safePayload: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(rawChanges)) {
      if (value === undefined) continue;
      if (!ALLOWED_CONTRACT_UPDATE_FIELDS.has(key)) {
        throw new Error(`Campo não permitido para atualização: ${key}`);
      }
      safePayload[key] = value;
    }

    if (safePayload.status === "assinado") {
      throw new Error("Alteração para status assinado não é permitida pelo payload de edição.");
    }

    const { data: row, error } = await db.rpc("update_lawhub_contract_atomic", {
      p_contract_id: data.contractId,
      p_account_id: accountId,
      p_actor_id: context.userId,
      p_changes: safePayload,
    });

    if (error) {
      throw new Error(`Falha ao atualizar contrato: ${error.message}`);
    }
    if (!row) {
      throw new Error("Falha ao atualizar contrato: resposta vazia da RPC.");
    }

    return row as Row;
  });

export const archiveLawHubContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { contractId: string; reason?: string; accountId?: string }) => input)
  .handler(async ({ data, context }): Promise<{ archived: true }> => {
    const accountId = await accountFor(context.userId, data.accountId);
    const { data: updated, error } = await (supabaseAdmin as any)
      .from("law_fee_contracts")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: context.userId,
        deletion_reason: data.reason || "Arquivado pelo usuário",
      })
      .eq("id", data.contractId)
      .eq("account_id", accountId)
      .select("id");
    if (error) throw new Error(`Falha ao arquivar contrato: ${error.message}`);
    if (!updated || updated.length === 0) {
      throw new Error("Contrato não localizado ou não autorizado para arquivamento.");
    }
    return { archived: true };
  });

export const listLawHubContractVersions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { contractId: string; accountId?: string }) => input)
  .handler(async ({ data, context }): Promise<Row[]> => {
    const accountId = await accountFor(context.userId, data.accountId);
    const { data: rows, error } = await (supabaseAdmin as any).from("law_contract_versions").select("*").eq("contract_id", data.contractId).eq("account_id", accountId).order("version_number", { ascending: false });
    if (error) throw new Error(`Falha ao listar versões: ${error.message}`);
    return (rows || []) as Row[];
  });

export const listLawHubContractItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { contractId: string; accountId?: string }) => input)
  .handler(async ({ data, context }): Promise<Row[]> => {
    const accountId = await accountFor(context.userId, data.accountId);
    const { data: rows, error } = await (supabaseAdmin as any).from("law_fee_contract_items").select("*").eq("contract_id", data.contractId).eq("account_id", accountId).order("created_at");
    if (error) throw new Error(`Falha ao listar itens de honorários: ${error.message}`);
    return (rows || []) as Row[];
  });

export const createLawHubContractItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { contractId: string; accountId?: string; phaseName: string; description?: string; triggerEvent?: string; amount: number; dueDate?: string }) => input)
  .handler(async ({ data, context }): Promise<Row> => {
    const accountId = await accountFor(context.userId, data.accountId);
    const { data: contract } = await (supabaseAdmin as any).from("law_fee_contracts").select("id").eq("id", data.contractId).eq("account_id", accountId).single();
    if (!contract) throw new Error("Contrato não localizado na conta atual.");
    const { data: row, error } = await (supabaseAdmin as any).from("law_fee_contract_items").insert({ account_id: accountId, contract_id: data.contractId, phase_name: data.phaseName, description: data.description || null, trigger_event: data.triggerEvent || null, amount: data.amount, due_date: data.dueDate || null }).select().single();
    if (error || !row) throw new Error(`Falha ao criar item de honorários: ${error?.message || "resposta vazia"}`);
    return row as Row;
  });

const ALLOWED_ITEM_UPDATE_FIELDS = new Set([
  "phase_name",
  "description",
  "trigger_event",
  "amount",
  "due_date",
  "status",
]);

export const updateLawHubContractItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { itemId: string; accountId?: string; changes: Record<string, JsonValue> }) => input)
  .handler(async ({ data, context }): Promise<Row> => {
    const accountId = await accountFor(context.userId, data.accountId);
    const db = supabaseAdmin as any;

    const { data: existing, error: existError } = await db
      .from("law_fee_contract_items")
      .select("id,account_id,contract_id")
      .eq("id", data.itemId)
      .eq("account_id", accountId)
      .single();
    if (existError || !existing) throw new Error("Item de honorários não localizado na conta atual.");

    const rawChanges = data.changes || {};
    const safePayload: Record<string, JsonValue> = {};

    for (const [key, value] of Object.entries(rawChanges)) {
      if (ALLOWED_ITEM_UPDATE_FIELDS.has(key)) {
        safePayload[key] = value;
      }
    }

    if (Object.keys(safePayload).length === 0) {
      return existing as Row;
    }

    const { data: row, error } = await db
      .from("law_fee_contract_items")
      .update(safePayload)
      .eq("id", data.itemId)
      .eq("account_id", accountId)
      .select()
      .single();
    if (error || !row) throw new Error(`Falha ao atualizar item: ${error?.message || "não encontrado"}`);
    return row as Row;
  });

export const deleteLawHubContractItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { itemId: string; accountId?: string }) => input)
  .handler(async ({ data, context }): Promise<{ deleted: true }> => {
    const accountId = await accountFor(context.userId, data.accountId);
    const { data: deleted, error } = await (supabaseAdmin as any)
      .from("law_fee_contract_items")
      .delete()
      .eq("id", data.itemId)
      .eq("account_id", accountId)
      .select("id");
    if (error) throw new Error(`Falha ao remover item: ${error.message}`);
    if (!deleted || deleted.length === 0) {
      throw new Error("Item de honorários não localizado ou não autorizado para remoção.");
    }
    return { deleted: true };
  });

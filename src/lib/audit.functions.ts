import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Tipos de registro aceitos no histórico, com a tabela correspondente. */
const ENTITY_TABLES: Record<string, string> = {
  order: "orders",
  invoice: "invoices",
  invoice_installment: "invoice_installments",
  commission: "commissions",
  commission_receipt: "commission_receipts",
  client: "clients",
  lead: "leads",
  brand: "brands",
  factory: "factories",
  collection: "collections",
  brand_collection: "brand_collections",
  expense: "expenses",
  document: "documents",
  error: "system", // Dummy table name para passar na validação de permissão
  access: "system",
  page_view: "system",
};

type AuditInput = {
  entityType: string;
  entityId?: string | null;
  action: string;
  description: string;
};

/**
 * Registra uma entrada no histórico. O autor e o nome são preenchidos pelo
 * servidor e o tipo de registro é validado, evitando históricos inventados.
 */
export const writeAuditLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: AuditInput) => {
    const entityType = String(data?.entityType ?? "").trim();
    if (!ENTITY_TABLES[entityType]) throw new Error("Tipo de registro não permitido no histórico.");
    const action = String(data?.action ?? "").trim().slice(0, 60);
    const description = String(data?.description ?? "").trim().slice(0, 500);
    if (!action || !description) throw new Error("Informe a ação e a descrição do registro.");
    const entityId = data?.entityId ? String(data.entityId) : null;
    if (entityId && !/^[0-9a-fA-F-]{36}$/.test(entityId))
      throw new Error("Registro inválido para o histórico.");
    return { entityType, entityId, action, description };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { requireAuthenticatedAccount } = await import("@/lib/security/authorization.server");
    const { accountId } = await requireAuthenticatedAccount(context.userId);

    // O registro citado precisa existir de verdade (apenas para entidades reais).
    if (data.entityId && !["error", "access", "page_view"].includes(data.entityType)) {
      const { data: row } = await admin
        .from(ENTITY_TABLES[data.entityType] as string)
        .select("id")
        .eq("id", data.entityId)
        .eq("account_id", accountId)
        .maybeSingle();
      if (!row) throw new Error("Registro não encontrado para o histórico.");
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", context.userId)
      .maybeSingle();

    const { error } = await admin.from("audit_logs").insert({
      entity_type: data.entityType,
      entity_id: data.entityId,
      action: data.action,
      description: data.description,
      user_id: context.userId,
      user_name: (profile?.full_name as string | undefined) ?? null,
      account_id: accountId,
    });
    if (error) throw new Error(`Erro ao registrar histórico: ${error.message}`);

    return { success: true };
  });

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAuthenticatedAccount } from "@/core/security/authorization.server";
import { ComunicaPJeQueryError, ComunicaPJEService } from "@/lib/lawhub/comunicapje-service";
import type { LawPublication } from "@/products/lawhub/types/domain";

export type PublicationQueryResult =
  | { status: "ok"; publications: LawPublication[]; source: "DJEN / ComunicaPJe (CNJ)"; fetchedAt: string }
  | { status: "not_configured"; publications: []; message: string }
  | { status: "unavailable"; publications: []; message: string };

type LawyerSearchProfile = {
  name: string;
  oab_number: string | null;
  oab_state: string | null;
};

export type StoredPublicationRow = {
  id: string;
  account_id: string;
  provider: string;
  source_id: string;
  process_number: string | null;
  tribunal: string | null;
  organ: string | null;
  content: string | null;
  source_publication_date: string | null;
  source_availability_date: string | null;
  fetched_at: string;
  matched_by: string | null;
  match_classification: string | null;
  processing_status: "received" | "read" | "treated" | "discarded";
  provenance: Record<string, any>;
  created_at: string;
  updated_at: string;
};

export type PublicationMonitorRow = {
  id: string;
  account_id: string;
  monitor_type: "oab" | "lawyer" | "party" | "company" | "text" | "process";
  term: string;
  metadata: Record<string, any>;
  status: "active" | "paused" | "revoked";
  created_at: string;
  updated_at: string;
};

/**
 * Consulta o DJEN / ComunicaPJe e sincroniza as publicações diretamente no banco de dados (public.law_publications),
 * preservando o estado de triagem (processing_status) caso a publicação já tenha sido lida, tratada ou descartada.
 */
export const queryCurrentLawyerPublications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { accountId?: string } = {}) => input)
  .handler(async ({ data: inputData, context }): Promise<PublicationQueryResult> => {
    const auth = await requireAuthenticatedAccount(context.userId, inputData?.accountId);
    const accountId = auth.accountId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await (supabaseAdmin as any)
      .from("law_lawyers")
      .select("name, oab_number, oab_state")
      .eq("account_id", accountId)
      .eq("user_id", context.userId)
      .eq("status", "active")
      .maybeSingle();

    if (error) throw new Error(`Falha ao carregar o perfil profissional: ${error.message}`);

    const profile = data as LawyerSearchProfile | null;
    const oabNumber = profile?.oab_number?.replace(/\D/g, "") ?? "";
    const oabState = profile?.oab_state?.trim().toUpperCase() ?? "";
    if (!profile || !oabNumber || !oabState) {
      return {
        status: "not_configured",
        publications: [],
        message: "Cadastre a OAB e a UF no perfil do advogado vinculado ao seu usuário para consultar o DJEN.",
      };
    }

    try {
      const publications = await ComunicaPJEService.fetchByOAB({ numeroOab: oabNumber, ufOab: oabState });

      // Se retornou publicações, persiste no banco com preservação do status
      if (publications && publications.length > 0) {
        const sourceIds = publications.map((p) => String(p.id));

        const { data: existingRows } = await (supabaseAdmin as any)
          .from("law_publications")
          .select("source_id, processing_status")
          .eq("account_id", accountId)
          .eq("provider", "comunicapje")
          .in("source_id", sourceIds);

        const existingStatusMap = new Map<string, string>();
        if (existingRows) {
          for (const row of existingRows) {
            existingStatusMap.set(String(row.source_id), String(row.processing_status));
          }
        }

        const rowsToUpsert = publications.map((p) => {
          const sid = String(p.id);
          const currentStatus = existingStatusMap.get(sid) || "received";
          return {
            account_id: accountId,
            provider: "comunicapje",
            source_id: sid,
            process_number: p.process_cnj || null,
            tribunal: p.court || null,
            organ: p.vara || null,
            content: p.full_text || null,
            source_publication_date: p.publication_date || null,
            source_availability_date: p.release_date || null,
            matched_by: `OAB/${oabState} ${oabNumber}`,
            processing_status: currentStatus,
            provenance: {
              source: "DJEN / ComunicaPJe (CNJ)",
              gazette_name: p.gazette_name || null,
              edition: p.edition_number || null,
              source_url: p.source_url || null,
              searched_name: p.searched_name || null,
              comarca: p.comarca || null,
            },
            updated_at: new Date().toISOString(),
          };
        });

        await (supabaseAdmin as any)
          .from("law_publications")
          .upsert(rowsToUpsert, { onConflict: "account_id,provider,source_id" });

        // Garante que o monitor correspondente existe em public.law_publication_monitors
        await (supabaseAdmin as any)
          .from("law_publication_monitors")
          .upsert(
            {
              account_id: accountId,
              monitor_type: "oab",
              term: `${cleanOabFormat(oabNumber)}/${oabState}`,
              metadata: {
                oab_number: oabNumber,
                oab_state: oabState,
                lawyer_name: profile.name,
                last_checked_at: new Date().toISOString(),
              },
              status: "active",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id" }
          )
          .catch(() => {});
      }

      return { status: "ok", publications, source: "DJEN / ComunicaPJe (CNJ)", fetchedAt: new Date().toISOString() };
    } catch (error) {
      const message = error instanceof ComunicaPJeQueryError
        ? error.userMessage
        : "Não foi possível consultar o DJEN neste momento.";
      return { status: "unavailable", publications: [], message };
    }
  });

function cleanOabFormat(oab: string): string {
  return oab.replace(/\D/g, "");
}

/**
 * Lista publicações jurídicas persistidas em public.law_publications com suporte a filtros e ordenação determinística.
 */
export const listLawHubPublications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    accountId?: string;
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}) => input)
  .handler(async ({ data, context }): Promise<{ rows: StoredPublicationRow[]; totalCount: number }> => {
    const auth = await requireAuthenticatedAccount(context.userId, data?.accountId);
    const accountId = auth.accountId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = (supabaseAdmin as any)
      .from("law_publications")
      .select("*", { count: "exact" })
      .eq("account_id", accountId);

    if (data.status && data.status !== "todas" && data.status !== "all") {
      const mappedStatus = data.status === "nao_tratada" ? "received" : data.status;
      query = query.eq("processing_status", mappedStatus);
    }

    if (data.search && data.search.trim()) {
      const q = `%${data.search.trim()}%`;
      query = query.or(`content.ilike.${q},process_number.ilike.${q},matched_by.ilike.${q}`);
    }

    const limit = Math.min(Math.max(Number(data.limit) || 50, 1), 100);
    const offset = Math.max(Number(data.offset) || 0, 0);

    query = query
      .order("source_publication_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: rows, count, error } = await query;
    if (error) {
      throw new Error(`Falha ao listar publicações: ${error.message}`);
    }

    return {
      rows: (rows || []) as StoredPublicationRow[],
      totalCount: count || 0,
    };
  });

/**
 * Atualiza o status de processamento de uma publicação (ex: read, treated, discarded)
 * com validação estrita de tenant.
 */
export const updateLawHubPublicationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    accountId?: string;
    publicationId: string;
    status: "received" | "read" | "treated" | "discarded";
    provenanceUpdates?: Record<string, any>;
  }) => input)
  .handler(async ({ data, context }): Promise<{ success: boolean; id: string }> => {
    const auth = await requireAuthenticatedAccount(context.userId, data.accountId);
    const accountId = auth.accountId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Valida que a publicação pertence ao tenant autenticado
    const { data: existing, error: findErr } = await (supabaseAdmin as any)
      .from("law_publications")
      .select("id, provenance")
      .eq("id", data.publicationId)
      .eq("account_id", accountId)
      .single();

    if (findErr || !existing) {
      throw new Error("Publicação não localizada ou não autorizada para atualização.");
    }

    const mergedProvenance = {
      ...(existing.provenance || {}),
      ...(data.provenanceUpdates || {}),
      status_updated_at: new Date().toISOString(),
      updated_by_user_id: context.userId,
    };

    const { error: updateErr } = await (supabaseAdmin as any)
      .from("law_publications")
      .update({
        processing_status: data.status,
        provenance: mergedProvenance,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.publicationId)
      .eq("account_id", accountId);

    if (updateErr) {
      throw new Error(`Falha ao atualizar status da publicação: ${updateErr.message}`);
    }

    return { success: true, id: data.publicationId };
  });

/**
 * Descarte auditável de publicação. Nunca remove a linha física do banco de dados,
 * apenas transiciona para status = 'discarded' registrando o motivo e timestamp em provenance.
 */
export const discardLawHubPublication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    accountId?: string;
    publicationId: string;
    reason?: string;
  }) => input)
  .handler(async ({ data, context }): Promise<{ success: boolean; id: string }> => {
    const auth = await requireAuthenticatedAccount(context.userId, data.accountId);
    const accountId = auth.accountId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing, error: findErr } = await (supabaseAdmin as any)
      .from("law_publications")
      .select("id, provenance")
      .eq("id", data.publicationId)
      .eq("account_id", accountId)
      .single();

    if (findErr || !existing) {
      throw new Error("Publicação não localizada ou não autorizada para descarte.");
    }

    const mergedProvenance = {
      ...(existing.provenance || {}),
      discarded_at: new Date().toISOString(),
      discarded_by: context.userId,
      discard_reason: data.reason || "Descartada pelo operador",
    };

    const { error: updateErr } = await (supabaseAdmin as any)
      .from("law_publications")
      .update({
        processing_status: "discarded",
        provenance: mergedProvenance,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.publicationId)
      .eq("account_id", accountId);

    if (updateErr) {
      throw new Error(`Falha ao descartar publicação: ${updateErr.message}`);
    }

    return { success: true, id: data.publicationId };
  });

/**
 * Tratamento de publicação com persistência da entidade gerada (prazo, audiência, tarefa ou andamento)
 * e marcação da publicação como 'treated' de forma consistente.
 */
export const treatLawHubPublication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    accountId?: string;
    publicationId: string;
    type: "prazo" | "audiencia" | "tarefa" | "historico";
    title: string;
    description?: string;
    date?: string;
    time?: string;
    priority?: string;
    responsibleName?: string;
    processCnj?: string;
    processId?: string;
    clientName?: string;
  }) => input)
  .handler(async ({ data, context }): Promise<{ success: boolean; createdItemId?: string }> => {
    const auth = await requireAuthenticatedAccount(context.userId, data.accountId);
    const accountId = auth.accountId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Valida que a publicação existe no tenant
    const { data: pub, error: pubErr } = await (supabaseAdmin as any)
      .from("law_publications")
      .select("id, provenance, process_number")
      .eq("id", data.publicationId)
      .eq("account_id", accountId)
      .single();

    if (pubErr || !pub) {
      throw new Error("Publicação não localizada para tratamento.");
    }

    const { data: rpcResult, error: rpcErr } = await (supabaseAdmin as any).rpc(
      "treat_lawhub_publication_atomic",
      {
        p_actor_user_id: context.userId,
        p_account_id: accountId,
        p_publication_id: data.publicationId,
        p_treatment_type: data.type,
        p_title: data.title,
        p_description: data.description || null,
        p_date: data.date || null,
        p_time: data.time || null,
        p_priority: data.priority || "urgente",
        p_process_id: data.processId || null,
        p_metadata: {
          process_cnj: data.processCnj || pub.process_number || null,
          client_name: data.clientName || null,
          responsible_name: data.responsibleName || null,
        },
      }
    );

    if (rpcErr) {
      throw new Error(`Falha no tratamento atômico da publicação: ${rpcErr.message}`);
    }

    return {
      success: true,
      createdItemId: rpcResult?.created_item_id || undefined,
    };
  });

/**
 * Lista monitores ativos de publicações do tenant em public.law_publication_monitors.
 */
export const listLawHubPublicationMonitors = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { accountId?: string } = {}) => input)
  .handler(async ({ data, context }): Promise<PublicationMonitorRow[]> => {
    const auth = await requireAuthenticatedAccount(context.userId, data?.accountId);
    const accountId = auth.accountId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await (supabaseAdmin as any)
      .from("law_publication_monitors")
      .select("*")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Falha ao listar monitores: ${error.message}`);
    }

    return (rows || []) as PublicationMonitorRow[];
  });

/**
 * Cria ou atualiza monitor de publicação com isolamento de tenant.
 */
export const createLawHubPublicationMonitor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    accountId?: string;
    monitorType: "oab" | "lawyer" | "party" | "company" | "text" | "process";
    term: string;
    metadata?: Record<string, any>;
  }) => input)
  .handler(async ({ data, context }): Promise<PublicationMonitorRow> => {
    const auth = await requireAuthenticatedAccount(context.userId, data.accountId);
    const accountId = auth.accountId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (!data.term || !data.term.trim()) {
      throw new Error("Termo ou OAB do monitor é obrigatório.");
    }

    const { data: row, error } = await (supabaseAdmin as any)
      .from("law_publication_monitors")
      .insert({
        account_id: accountId,
        monitor_type: data.monitorType,
        term: data.term.trim(),
        metadata: data.metadata || {},
        status: "active",
      })
      .select()
      .single();

    if (error || !row) {
      throw new Error(`Falha ao criar monitor: ${error?.message || "resposta vazia"}`);
    }

    return row as PublicationMonitorRow;
  });

/**
 * Ativa ou pausa um monitor existente.
 */
export const toggleLawHubPublicationMonitor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    accountId?: string;
    monitorId: string;
    status: "active" | "paused" | "revoked";
  }) => input)
  .handler(async ({ data, context }): Promise<{ success: boolean; id: string }> => {
    const auth = await requireAuthenticatedAccount(context.userId, data.accountId);
    const accountId = auth.accountId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await (supabaseAdmin as any)
      .from("law_publication_monitors")
      .update({
        status: data.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.monitorId)
      .eq("account_id", accountId);

    if (error) {
      throw new Error(`Falha ao alterar status do monitor: ${error.message}`);
    }

    return { success: true, id: data.monitorId };
  });

/**
 * Remove um monitor de publicação do tenant.
 */
export const deleteLawHubPublicationMonitor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    accountId?: string;
    monitorId: string;
  }) => input)
  .handler(async ({ data, context }): Promise<{ success: boolean; id: string }> => {
    const auth = await requireAuthenticatedAccount(context.userId, data.accountId);
    const accountId = auth.accountId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await (supabaseAdmin as any)
      .from("law_publication_monitors")
      .delete()
      .eq("id", data.monitorId)
      .eq("account_id", accountId);

    if (error) {
      throw new Error(`Falha ao remover monitor: ${error.message}`);
    }

    return { success: true, id: data.monitorId };
  });

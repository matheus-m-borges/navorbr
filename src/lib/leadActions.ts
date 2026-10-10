import { crmDb } from "@/hooks/useCrm";
import type { Lead } from "@/hooks/useCrm";

export async function changeLeadStatus(opts: {
  lead: Lead;
  to: string;
  userName?: string | null;
  userId?: string | null;
  lossReason?: string | null;
  lossNotes?: string | null;
  followupDays?: number;
}) {
  const { lead, to, userName, userId } = opts;
  const patch: Record<string, unknown> = { status: to, updated_by: userId ?? null };

  if (to === "Catálogo enviado") {
    patch["catalog_sent"] = true;
    if (!lead.catalog_sent_at) patch["catalog_sent_at"] = new Date().toISOString().slice(0, 10);
  }
  if (to === "Positivado") {
    patch["positivado"] = "Sim";
    if (!lead.positivado_at) patch["positivado_at"] = new Date().toISOString().slice(0, 10);
  }
  if (to === "Em negociação") patch["positivado"] = "Em negociação";
  if (to === "Não quis" || to === "Perdido") {
    patch["loss_reason"] = opts.lossReason ?? lead.loss_reason ?? null;
    patch["loss_notes"] = opts.lossNotes ?? lead.loss_notes ?? null;
    patch["next_followup_at"] = null;
  }

  const { error } = await crmDb.from("leads").update(patch).eq("id", lead.id);
  if (error) throw error;

  await crmDb.from("lead_status_history").insert({
    lead_id: lead.id,
    from_status: lead.status,
    to_status: to,
    changed_by: userId ?? null,
    changed_by_name: userName ?? null,
    note: opts.lossReason ? `Motivo: ${opts.lossReason}` : null,
  });

  // Automação 2: catálogo enviado -> tarefa de follow-up
  if (to === "Catálogo enviado") {
    const days = opts.followupDays ?? 2;
    await crmDb.from("tasks").insert({
      title: "Follow-up do catálogo",
      description: `Verificar retorno do catálogo enviado para ${lead.company_name}.`,
      task_type: "Follow-up",
      priority: "Alta",
      due_at: new Date(Date.now() + days * 86400000).toISOString(),
      lead_id: lead.id,
      owner_name: userName ?? null,
      owner_id: userId ?? null,
    });
    await crmDb
      .from("leads")
      .update({ next_followup_at: new Date(Date.now() + days * 86400000).toISOString() })
      .eq("id", lead.id);
  }

  if (to === "Positivado") {
    await crmDb.from("notifications").insert({
      title: "Lead positivado",
      body: `${lead.company_name} foi positivado.`,
      kind: "success",
      lead_id: lead.id,
    });
  }
  if (to === "Não quis" || to === "Perdido") {
    await crmDb.from("notifications").insert({
      title: "Lead marcado como perdido",
      body: `${lead.company_name} — motivo: ${opts.lossReason ?? "não informado"}.`,
      kind: "error",
      lead_id: lead.id,
    });
  }
}

export async function convertLeadToClient(lead: Lead, userName?: string | null) {
  if (lead.converted_client_id) return lead.converted_client_id;

  const brands = (lead.lead_brands ?? [])
    .map((lb) => lb.brands?.brand)
    .filter((b): b is string => Boolean(b));

  const { data, error } = await crmDb
    .from("clients")
    .insert({
      cnpj: lead.cnpj,
      legal_name: lead.legal_name ?? lead.company_name,
      trade_name: lead.trade_name ?? lead.company_name,
      segment: null,
      city: lead.city,
      state: lead.state,
      contact_name: lead.contact_name,
      contact_role: lead.contact_role,
      phone: lead.phone,
      whatsapp: lead.whatsapp,
      email: lead.email,
      instagram: lead.instagram,
      interest_brands: brands,
      owner_name: lead.owner_name ?? userName ?? null,
      first_contact_date: lead.entry_at.slice(0, 10),
      source: lead.source,
      status: "Cliente ativo",
      purchase_potential: (lead.effective_value ?? lead.estimated_value ?? 0) > 30000 ? "Alto" : "Médio",
      notes: lead.notes,
      origin_lead_id: lead.id,
    })
    .select("id")
    .single();
  if (error) throw error;
  const clientId = (data as { id: string }).id;

  // Libera marcas de interesse do lead na tabela de acesso do portal (client_brand_access)
  const brandIds = (lead.lead_brands ?? [])
    .map((lb: any) => lb.brand_id || lb.brands?.id)
    .filter((bId: string | undefined): bId is string => Boolean(bId));

  if (brandIds.length > 0) {
    try {
      const accessRows = brandIds.map((bId) => ({
        client_id: clientId,
        brand_id: bId,
        status: "Ativa",
      }));
      await crmDb.from("client_brand_access").upsert(accessRows, { onConflict: "client_id,brand_id" });
    } catch (e) {
      console.warn("Aviso ao vincular marcas em client_brand_access:", e);
    }
  }

  // Copia contato principal e o histórico do lead para o cliente (histórico do lead é preservado)
  if (lead.contact_name) {
    await crmDb.from("contacts").insert({
      client_id: clientId,
      name: lead.contact_name,
      role: lead.contact_role,
      phone: lead.phone,
      whatsapp: lead.whatsapp,
      email: lead.email,
      instagram: lead.instagram,
    });
  }

  const { data: history } = await crmDb.from("lead_interactions").select("*").eq("lead_id", lead.id);
  const rows = (history ?? []) as {
    occurred_at: string;
    contact_type: string;
    responsible_name: string | null;
    description: string;
    result: string | null;
  }[];
  if (rows.length > 0) {
    await crmDb.from("lead_interactions").insert(
      rows.map((r) => ({
        client_id: clientId,
        occurred_at: r.occurred_at,
        contact_type: r.contact_type,
        responsible_name: r.responsible_name,
        description: r.description,
        result: r.result,
      })),
    );
  }

  await crmDb.from("leads").update({ converted_client_id: clientId }).eq("id", lead.id);
  return clientId;
}

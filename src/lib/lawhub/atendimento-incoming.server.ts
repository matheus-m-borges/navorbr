import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { processAITriageForConversation } from "./ai-atendimento.server";
import { getTenantSecret } from "@/lib/security/tenant-secret-vault.server";

type IncomingMessage = {
  id?: string;
  from?: string;
  type?: string;
  text?: { body?: string };
  image?: { caption?: string };
  document?: { caption?: string; filename?: string };
  audio?: unknown;
  video?: { caption?: string };
  interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
};

const getMessageBody = (message: IncomingMessage) =>
  message.text?.body ||
  message.interactive?.button_reply?.title ||
  message.interactive?.list_reply?.title ||
  message.image?.caption ||
  message.document?.caption ||
  message.video?.caption ||
  null;

const getMediaLabel = (message: IncomingMessage) => {
  if (message.document) return `[Documento recebido${message.document.filename ? `: ${message.document.filename}` : ""}]`;
  if (message.image) return "[Imagem recebida]";
  if (message.audio) return "[Áudio recebido - aguardando transcrição]";
  if (message.video) return "[Vídeo recebido]";
  return "[Mensagem sem texto recebida]";
};

const priorityFromUrgency = (urgency: string) =>
  urgency === "alta" ? "urgent" : urgency === "baixa" ? "low" : "medium";

function isWithinBusinessHours(settings: any, now = new Date()) {
  const day = now.getDay() === 0 ? 7 : now.getDay();
  const days = Array.isArray(settings?.business_days) ? settings.business_days : [1, 2, 3, 4, 5];
  if (!days.includes(day)) return false;
  const current = now.toTimeString().slice(0, 5);
  const start = String(settings?.business_hours_start || "08:00").slice(0, 5);
  const end = String(settings?.business_hours_end || "18:00").slice(0, 5);
  return current >= start && current <= end;
}

function findCampaign(text: string, campaigns: any[]) {
  const normalized = text.toUpperCase();
  return campaigns.find((campaign) => {
    const code = String(campaign.code || "").trim().toUpperCase().replace(/^#/, "");
    return code && new RegExp(`(^|[^A-Z0-9])#?${code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^A-Z0-9])`, "i").test(normalized);
  }) || null;
}

async function ensureLeadForConversation(input: {
  accountId: string; conversationId: string; contactName: string; contactPhone: string;
  area: string; summary: string; campaign: any | null;
}) {
  const { data: existingConversation } = await (supabaseAdmin as any).from("law_atendimento_conversations")
    .select("lead_id").eq("id", input.conversationId).maybeSingle();
  if (existingConversation?.lead_id) return existingConversation.lead_id;

  const { data: existingLead } = await (supabaseAdmin as any).from("law_leads")
    .select("id").eq("account_id", input.accountId).eq("phone", input.contactPhone).order("created_at", { ascending: false }).limit(1).maybeSingle();
  let leadId = existingLead?.id;
  if (!leadId) {
    const { data: stage } = await (supabaseAdmin as any).from("law_lead_pipeline_stages")
      .select("id").eq("account_id", input.accountId).eq("pipeline_id", "pipe-principal")
      .order("position", { ascending: true }).limit(1).maybeSingle();
    if (!stage?.id) return null;
    const { data: created, error } = await (supabaseAdmin as any).from("law_leads").insert({
      account_id: input.accountId, stage_id: stage.id, name: input.contactName || "Contato WhatsApp",
      phone: input.contactPhone, area_direito: input.campaign?.area_direito || input.area || "Geral",
      source: input.campaign ? `WhatsApp / Campanha ${input.campaign.code}` : "WhatsApp CallCenter",
      notes: input.summary, conflict_check_status: "pending",
    }).select("id").single();
    if (error) throw error;
    leadId = created?.id;
  }
  if (!leadId) return null;
  await (supabaseAdmin as any).from("law_atendimento_conversations").update({ lead_id: leadId }).eq("id", input.conversationId);
  await (supabaseAdmin as any).from("law_lead_timeline").insert({
    account_id: input.accountId, lead_id: leadId, event_type: "whatsapp",
    description: input.campaign ? `Lead identificado pela campanha ${input.campaign.code} no WhatsApp.` : "Lead criado automaticamente pelo CallCenter via WhatsApp.",
    metadata: { conversation_id: input.conversationId, campaign_code: input.campaign?.code || null },
  });
  return leadId;
}

async function sendViaMetaCloudApi(input: {
  phoneNumberId: string;
  accessToken: string;
  recipient: string;
  text: string;
}) {
  const version = process.env.META_GRAPH_API_VERSION || "v21.0";
  const response = await fetch(`https://graph.facebook.com/${version}/${input.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: input.recipient,
      type: "text",
      text: { preview_url: false, body: input.text },
    }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    return { success: false, error: payload?.error?.message || `Meta retornou ${response.status}` };
  }
  return { success: true, messageId: payload?.messages?.[0]?.id || null };
}

/** Recebe, registra, classifica e responde uma mensagem do WhatsApp oficial de um escritório. */
export async function processLawHubIncomingMessage(input: {
  phoneNumberId?: string;
  contactPhone: string;
  contactName: string;
  message: IncomingMessage;
}) {
  const contactPhone = input.contactPhone.replace(/\D/g, "");
  if (!contactPhone) return { status: "ignored_missing_sender" };

  const body = getMessageBody(input.message) || getMediaLabel(input.message);
  const externalMessageId = input.message.id || null;
  const incomingType = input.message.type || (getMessageBody(input.message) ? "text" : "document");

  // O identificador do número Meta isola o tenant. Nunca use o telefone do contato
  // como atalho para inferir o escritório destinatário.
  const { data: whatsappAccount } = await (supabaseAdmin as any)
    .from("law_whatsapp_accounts")
    .select("id, account_id, status, phone_number_id")
    .eq("phone_number_id", input.phoneNumberId || "__missing__")
    .maybeSingle();
  if (!whatsappAccount?.account_id || whatsappAccount.status !== "connected") {
    return { status: "ignored_unconfigured_account" };
  }

  if (externalMessageId) {
    const { data: duplicate } = await (supabaseAdmin as any)
      .from("law_atendimento_messages")
      .select("id")
      .eq("account_id", whatsappAccount.account_id)
      .eq("external_message_id", externalMessageId)
      .maybeSingle();
    if (duplicate) return { status: "duplicate" };
  }

  const { data: settings } = await (supabaseAdmin as any)
    .from("law_atendimento_settings")
    .select("bot_name, welcome_message, out_of_hours_message, business_hours_start, business_hours_end, business_days, ai_enabled, ai_auto_create_leads, ai_system_prompt, reception_mode, lead_rule, bot_menu_text")
    .eq("account_id", whatsappAccount.account_id)
    .maybeSingle();

  const { data: activeConversation } = await (supabaseAdmin as any)
    .from("law_atendimento_conversations")
    .select("*")
    .eq("account_id", whatsappAccount.account_id)
    .eq("contact_phone", contactPhone)
    .in("status", ["WAITING_AI", "WAITING_QUEUE", "ASSIGNED", "IN_PROGRESS", "WAITING_CLIENT", "WAITING_INTERNAL", "TRANSFERRED"])
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let conversation = activeConversation;
  if (!conversation) {
    const { data, error } = await (supabaseAdmin as any)
      .from("law_atendimento_conversations")
      .insert({
        account_id: whatsappAccount.account_id,
        whatsapp_account_id: whatsappAccount.id,
        contact_phone: contactPhone,
        contact_name: input.contactName || "Contato WhatsApp",
        status: "WAITING_AI",
        ai_mode: "ACTIVE",
      })
      .select()
      .single();
    if (error) throw error;
    conversation = data;
  }

  const safeType = ["text", "image", "audio", "video", "document", "location"].includes(incomingType)
    ? incomingType
    : "text";
  const { error: insertError } = await (supabaseAdmin as any).from("law_atendimento_messages").insert({
    conversation_id: conversation.id,
    account_id: whatsappAccount.account_id,
    sender_type: "contact",
    sender_name: input.contactName || "Contato WhatsApp",
    message_type: safeType,
    body,
    external_message_id: externalMessageId,
    status: "delivered",
  });
  if (insertError) {
    if (insertError.code === "23505" || insertError.message?.includes("uq_law_atendimento_messages_external_id")) {
      return { status: "duplicate" };
    }
    throw insertError;
  }

  const { data: campaigns } = await (supabaseAdmin as any).from("law_atendimento_campaign_codes")
    .select("code,action_type,area_direito,description").eq("account_id", whatsappAccount.account_id).eq("active", true);
  const campaign = findCampaign(body, campaigns || []);

  // Um operador que assumiu a conversa tem precedência absoluta sobre a IA.
  const receptionMode = settings?.reception_mode || "hybrid";
  if (receptionMode === "human" || conversation.ai_mode !== "ACTIVE" || ["ASSIGNED", "IN_PROGRESS"].includes(conversation.status)) {
    return { status: "saved_for_human", conversationId: conversation.id };
  }

  const { data: historyRows } = await (supabaseAdmin as any)
    .from("law_atendimento_messages")
    .select("sender_type, body")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: false })
    .limit(12);
  const historySnippet = (historyRows || [])
    .reverse()
    .map((row: any) => `${row.sender_type === "contact" ? "Cliente" : "Atendimento"}: ${row.body || "[sem texto]"}`)
    .join("\n");

  const firstContact = (historyRows || []).filter((row: any) => row.sender_type === "contact").length <= 1;
  const outsideHours = !isWithinBusinessHours(settings);
  const shouldUseMenu = receptionMode === "bot" || (receptionMode === "hybrid" && firstContact);
  const menuText = settings?.bot_menu_text || settings?.welcome_message || "Olá! Como podemos ajudar?";
  if (outsideHours || shouldUseMenu) {
    const replyText = outsideHours ? (settings?.out_of_hours_message || "Recebemos sua mensagem e retornaremos no próximo horário útil.") : menuText;
    const { data: outbound, error: outboundError } = await (supabaseAdmin as any).from("law_atendimento_messages").insert({
      conversation_id: conversation.id, account_id: whatsappAccount.account_id, sender_type: "ai",
      sender_name: settings?.bot_name || "Assistente Jurídica", message_type: "text", body: replyText, status: "pending",
    }).select("id").single();
    if (outboundError) throw outboundError;
    const metaAccessToken = await getTenantSecret(whatsappAccount.account_id, "meta_whatsapp");
    const delivery = metaAccessToken ? await sendViaMetaCloudApi({ phoneNumberId: whatsappAccount.phone_number_id, accessToken: metaAccessToken, recipient: contactPhone, text: replyText }) : { success: false, error: "Credenciais da Meta incompletas para este escritório." };
    await (supabaseAdmin as any).from("law_atendimento_messages").update({ external_message_id: delivery.messageId || null, status: delivery.success ? "sent" : "failed", error_details: delivery.success ? null : delivery.error }).eq("id", outbound.id);
    return { status: delivery.success ? (outsideHours ? "out_of_hours_replied" : "bot_menu_replied") : "delivery_failed", conversationId: conversation.id };
  }

  if (!settings?.ai_enabled) return { status: "saved_for_human", conversationId: conversation.id };

  const triage = await processAITriageForConversation({
    contactName: input.contactName || "Contato",
    contactPhone,
    messageText: body,
    historySnippet,
    accountId: whatsappAccount.account_id,
    botName: settings?.bot_name || "Assistente Jurídica",
    customPrompt: settings?.ai_system_prompt || undefined,
  });

  const { data: department } = await (supabaseAdmin as any)
    .from("law_atendimento_departments")
    .select("id")
    .eq("account_id", whatsappAccount.account_id)
    .eq("slug", triage.targetDepartmentSlug)
    .eq("is_active", true)
    .maybeSingle();
  const { data: queue } = department
    ? await (supabaseAdmin as any)
        .from("law_atendimento_queues")
        .select("id")
        .eq("account_id", whatsappAccount.account_id)
        .eq("department_id", department.id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle()
    : { data: null };

  const needsHuman = triage.shouldHandoff || Boolean(input.message.document || input.message.audio || input.message.image);
  await (supabaseAdmin as any)
    .from("law_atendimento_conversations")
    .update({
      contact_name: input.contactName || conversation.contact_name,
      department_id: department?.id || null,
      queue_id: queue?.id || null,
      status: needsHuman ? "WAITING_QUEUE" : "WAITING_AI",
      priority: priorityFromUrgency(triage.detectedUrgency),
      ai_summary: triage.aiSummary,
      ai_detected_area: triage.detectedArea,
      ai_detected_urgency: triage.detectedUrgency,
    })
    .eq("id", conversation.id);

  const shouldCreateLead = settings?.ai_auto_create_leads !== false && settings?.lead_rule !== "manual" && (
    settings?.lead_rule === "instant" || Boolean(campaign) || triage.shouldHandoff
  );
  const leadId = shouldCreateLead ? await ensureLeadForConversation({
    accountId: whatsappAccount.account_id, conversationId: conversation.id, contactName: input.contactName || conversation.contact_name,
    contactPhone, area: triage.detectedArea, summary: triage.aiSummary, campaign,
  }) : null;

  const { data: outbound, error: outboundError } = await (supabaseAdmin as any)
    .from("law_atendimento_messages")
    .insert({
      conversation_id: conversation.id,
      account_id: whatsappAccount.account_id,
      sender_type: "ai",
      sender_name: settings?.bot_name || "Assistente Jurídica",
      message_type: "text",
      body: triage.replyText,
      status: "pending",
    })
    .select("id")
    .single();
  if (outboundError) throw outboundError;

  // A credencial Meta pertence ao escritório. Ela não é reutilizada entre tenants
  // e nunca é exposta ao navegador ou aos logs.
  const metaAccessToken = await getTenantSecret(whatsappAccount.account_id, "meta_whatsapp");
  const delivery = whatsappAccount.phone_number_id && metaAccessToken
    ? await sendViaMetaCloudApi({
        phoneNumberId: whatsappAccount.phone_number_id,
        accessToken: metaAccessToken,
        recipient: contactPhone,
        text: triage.replyText,
      })
    : { success: false, error: "Credenciais da Meta incompletas para este escritório." };
  await (supabaseAdmin as any)
    .from("law_atendimento_messages")
    .update({
      external_message_id: delivery.messageId || null,
      status: delivery.success ? "sent" : "failed",
      error_details: delivery.success ? null : delivery.error || "Falha de entrega desconhecida",
    })
    .eq("id", outbound.id);

  await (supabaseAdmin as any).from("law_atendimento_audit_logs").insert({
    account_id: whatsappAccount.account_id,
    conversation_id: conversation.id,
    action: delivery.success ? "ai_triage_replied" : "ai_triage_delivery_failed",
    details: { area: triage.detectedArea, urgency: triage.detectedUrgency, handoff: needsHuman, campaign_code: campaign?.code || null, lead_id: leadId },
  });

  return { status: delivery.success ? "processed" : "delivery_failed", conversationId: conversation.id, leadId };
}

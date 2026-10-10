import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getActiveEmailProvider } from "@/lib/email/email-provider";
import type { NotificationAction } from "./rule-engine";
import type { CreatedNotification } from "./notification-service";
import { resolveTemplate } from "./template-resolver";
import { resolveRecipients } from "./rule-engine";
import { shouldDeliver } from "./preferences-service";

export interface DeliveryResult {
  deliveryId: string;
  status: "sent" | "failed" | "pending";
  providerMessageId?: string | null;
  error?: string | null;
}

/**
 * Creates a delivery record and attempts to send via the specified channel.
 * For email: uses existing Resend infrastructure with fail-closed semantics.
 * For in_app: delivery is immediate (no external provider).
 */
export async function deliverNotification(
  notification: CreatedNotification,
  action: NotificationAction,
  recipientEmail?: string | null,
  templateData?: Record<string, string | number | boolean>,
): Promise<DeliveryResult> {
  // Create delivery record
  const { data: delivery, error: createError } = await supabaseAdmin
    .from("notification_deliveries")
    .insert({
      notification_id: notification.id,
      channel: action.channel,
      status: "pending",
      attempt_count: 0,
      max_attempts: action.maxRetries,
    })
    .select("id")
    .single();

  if (createError || !delivery) {
    throw new Error(`Failed to create delivery record: ${createError?.message}`);
  }

  const deliveryId = delivery.id;

  if (action.channel === "in_app") {
    // In-app delivery is immediate — notification already exists in DB
    await supabaseAdmin
      .from("notification_deliveries")
      .update({
        status: "delivered",
        sent_at: new Date().toISOString(),
        delivered_at: new Date().toISOString(),
        attempt_count: 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", deliveryId);

    return { deliveryId, status: "sent" };
  }

  if (action.channel === "email") {
    if (!recipientEmail) {
      await supabaseAdmin
        .from("notification_deliveries")
        .update({
          status: "failed",
          last_error: "RECIPIENT_EMAIL_MISSING",
          attempt_count: 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", deliveryId);

      return { deliveryId, status: "failed", error: "RECIPIENT_EMAIL_MISSING" };
    }

    try {
      const provider = await getActiveEmailProvider();
      const result = await provider.send({
        eventType: action.templateKey as any,
        to: recipientEmail,
        templateData: templateData ?? {},
      });

      if (result.success && result.providerMessageId) {
        await supabaseAdmin
          .from("notification_deliveries")
          .update({
            status: "sent",
            provider_message_id: result.providerMessageId,
            sent_at: new Date().toISOString(),
            attempt_count: 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", deliveryId);

        return { deliveryId, status: "sent", providerMessageId: result.providerMessageId };
      }

      // Failed — check if retryable
      const retryable = (result as any).retryable === true;
      const errorMsg = (result as any).errorSanitized ?? "UNKNOWN_PROVIDER_ERROR";

      if (retryable && action.maxRetries > 1) {
        const nextAttempt = new Date(Date.now() + 5 * 60_000).toISOString();

        await supabaseAdmin
          .from("notification_deliveries")
          .update({
            status: "pending",
            last_error: errorMsg,
            attempt_count: 1,
            next_attempt_at: nextAttempt,
            updated_at: new Date().toISOString(),
          })
          .eq("id", deliveryId);

        return { deliveryId, status: "pending", error: errorMsg };
      }

      await supabaseAdmin
        .from("notification_deliveries")
        .update({
          status: "failed",
          last_error: errorMsg,
          attempt_count: 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", deliveryId);

      return { deliveryId, status: "failed", error: errorMsg };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "DELIVERY_EXCEPTION";

      await supabaseAdmin
        .from("notification_deliveries")
        .update({
          status: "failed",
          last_error: msg.slice(0, 500),
          attempt_count: 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", deliveryId);

      return { deliveryId, status: "failed", error: msg };
    }
  }

  // Unknown channel
  await supabaseAdmin
    .from("notification_deliveries")
    .update({
      status: "failed",
      last_error: "UNKNOWN_CHANNEL",
      attempt_count: 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", deliveryId);

  return { deliveryId, status: "failed", error: "UNKNOWN_CHANNEL" };
}

/**
 * Retries pending deliveries that are due for retry.
 * FIX P1#4: Implements actual resend instead of tracking-only.
 * Removes all references to non-existent processed_at column.
 */
export async function processPendingDeliveries(limit = 25): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  const now = new Date().toISOString();
  const { data: pending, error } = await supabaseAdmin
    .from("notification_deliveries")
    .select("id, notification_id, channel, attempt_count, max_attempts")
    .eq("status", "pending")
    .lte("next_attempt_at", now)
    .order("next_attempt_at", { ascending: true })
    .limit(limit);

  if (error || !pending) {
    console.error("[DeliveryService] Failed to fetch pending deliveries:", error?.message);
    return { processed: 0, sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (const item of pending) {
    if (item.attempt_count >= item.max_attempts) {
      // Exhausted retries — mark as failed (dead letter)
      await supabaseAdmin
        .from("notification_deliveries")
        .update({
          status: "failed",
          last_error: "MAX_RETRIES_EXCEEDED",
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
      failed++;
      continue;
    }

    try {
      // FIX P1#4: Actually resend by re-resolving notification, rule, template, and recipient
      const { data: notification, error: notifError } = await supabaseAdmin
        .from("notifications")
        .select("id, account_id, user_id, event_id, rule_id, title, body, severity")
        .eq("id", item.notification_id)
        .maybeSingle();

      if (notifError || !notification) {
        await supabaseAdmin
          .from("notification_deliveries")
          .update({
            status: "failed",
            last_error: "NOTIFICATION_NOT_FOUND",
            attempt_count: item.attempt_count + 1,
            last_attempt_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);
        failed++;
        continue;
      }

      // Resolve rule to get template key and audience
      const { data: rule, error: ruleError } = await supabaseAdmin
        .from("notification_rules")
        .select("template_key, audience, channel")
        .eq("id", notification.rule_id)
        .maybeSingle();

      if (ruleError || !rule) {
        await supabaseAdmin
          .from("notification_deliveries")
          .update({
            status: "failed",
            last_error: "RULE_NOT_FOUND",
            attempt_count: item.attempt_count + 1,
            last_attempt_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);
        failed++;
        continue;
      }

      // Resolve recipients
      const recipients = await resolveRecipients(rule.audience, notification.account_id, notification.user_id);
      if (recipients.length === 0) {
        await supabaseAdmin
          .from("notification_deliveries")
          .update({
            status: "failed",
            last_error: "NO_RECIPIENTS_RESOLVED",
            attempt_count: item.attempt_count + 1,
            last_attempt_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);
        failed++;
        continue;
      }

      // Get recipient email from profiles
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("id", recipients[0])
        .maybeSingle();

      const recipientEmail = profile?.email;
      if (!recipientEmail) {
        await supabaseAdmin
          .from("notification_deliveries")
          .update({
            status: "failed",
            last_error: "RECIPIENT_EMAIL_MISSING",
            attempt_count: item.attempt_count + 1,
            last_attempt_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);
        failed++;
        continue;
      }

      // Check preferences before resending
      const canDeliver = await shouldDeliver(recipients[0], "transactional", "email");
      if (!canDeliver) {
        await supabaseAdmin
          .from("notification_deliveries")
          .update({
            status: "failed",
            last_error: "USER_OPTED_OUT",
            attempt_count: item.attempt_count + 1,
            last_attempt_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);
        failed++;
        continue;
      }

      // Resolve template
      const template = await resolveTemplate(rule.template_key, "email", {
        recipientName: profile.full_name ?? "",
        accountName: "",
        productName: "",
      });

      if (!template) {
        await supabaseAdmin
          .from("notification_deliveries")
          .update({
            status: "failed",
            last_error: "TEMPLATE_NOT_FOUND",
            attempt_count: item.attempt_count + 1,
            last_attempt_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);
        failed++;
        continue;
      }

      // Actual resend via provider
      const provider = await getActiveEmailProvider();
      const result = await provider.send({
        eventType: rule.template_key as any,
        to: recipientEmail,
        templateData: { subject: template.subject ?? notification.title, body: template.body },
      });

      if (result.success && result.providerMessageId) {
        await supabaseAdmin
          .from("notification_deliveries")
          .update({
            status: "sent",
            provider_message_id: result.providerMessageId,
            sent_at: new Date().toISOString(),
            attempt_count: item.attempt_count + 1,
            last_attempt_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);
        sent++;
      } else {
        const errorMsg = (result as any).errorSanitized ?? "RETRY_FAILED";
        const retryable = (result as any).retryable === true;
        const nextAttempt = new Date(
          Date.now() + Math.pow(2, item.attempt_count + 1) * 5 * 60_000,
        ).toISOString();

        if (retryable && item.attempt_count + 1 < item.max_attempts) {
          await supabaseAdmin
            .from("notification_deliveries")
            .update({
              status: "pending",
              last_error: errorMsg,
              attempt_count: item.attempt_count + 1,
              next_attempt_at: nextAttempt,
              last_attempt_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.id);
        } else {
          await supabaseAdmin
            .from("notification_deliveries")
            .update({
              status: "failed",
              last_error: errorMsg,
              attempt_count: item.attempt_count + 1,
              last_attempt_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.id);
          failed++;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "RETRY_EXCEPTION";
      await supabaseAdmin
        .from("notification_deliveries")
        .update({
          status: "failed",
          last_error: msg.slice(0, 500),
          attempt_count: item.attempt_count + 1,
          last_attempt_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
      failed++;
    }
  }

  return { processed: pending.length, sent, failed };
}

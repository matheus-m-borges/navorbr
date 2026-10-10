import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { NotificationEventType, CreatedEvent } from "./event-store";

export interface NotificationRule {
  id: string;
  name: string;
  event_type: string;
  audience: string;
  channel: "in_app" | "email";
  template_key: string;
  severity: "info" | "warning" | "error" | "critical";
  enabled: boolean;
  lead_time_minutes: number;
  dedup_window_minutes: number;
  max_retries: number;
}

export interface NotificationAction {
  ruleId: string;
  channel: "in_app" | "email";
  templateKey: string;
  severity: "info" | "warning" | "error" | "critical";
  audience: string;
  maxRetries: number;
}

/**
 * Evaluates all enabled rules for a given event type and returns
 * the list of notification actions to execute.
 * No arbitrary code execution — purely declarative matching.
 */
export async function evaluateRules(event: CreatedEvent): Promise<NotificationAction[]> {
  const { data: rules, error } = await supabaseAdmin
    .from("notification_rules")
    .select("*")
    .eq("event_type", event.event_type)
    .eq("enabled", true);

  if (error) {
    console.error("[RuleEngine] Failed to fetch rules:", error.message);
    return [];
  }

  if (!rules || rules.length === 0) {
    return [];
  }

  const actions: NotificationAction[] = [];

  for (const rule of rules as NotificationRule[]) {
    // Check dedup window: skip if a notification was already created
    // for this event+rule within the dedup window
    const dedupCutoff = new Date(
      Date.now() - rule.dedup_window_minutes * 60_000
    ).toISOString();

    // FIX P1#5: Scope dedup check to account_id to prevent cross-account blocking.
    // notifications.account_id is nullable; when event has no account_id we skip the filter
    // to preserve existing behavior for global events.
    let query = supabaseAdmin
      .from("notifications")
      .select("id")
      .eq("event_id", event.id)
      .eq("rule_id", rule.id)
      .gte("created_at", dedupCutoff)
      .limit(1);

    if (event.account_id) {
      query = query.eq("account_id", event.account_id);
    }

    const { data: existing, error: dedupError } = await query;

    if (dedupError) {
      console.error("[RuleEngine] Dedup check failed:", dedupError.message);
      continue;
    }

    if (existing && existing.length > 0) {
      // Already notified within dedup window — skip
      continue;
    }

    actions.push({
      ruleId: rule.id,
      channel: rule.channel,
      templateKey: rule.template_key,
      severity: rule.severity,
      audience: rule.audience,
      maxRetries: rule.max_retries,
    });
  }

  return actions;
}

/**
 * Resolves recipients for a given audience and account context.
 * Returns user IDs that should receive the notification.
 * Server-side only — never trusts client-provided recipient lists.
 */
export async function resolveRecipients(
  audience: string,
  accountId: string,
  userId?: string | null,
): Promise<string[]> {
  switch (audience) {
    case "ACCOUNT_OWNER": {
      const { data } = await supabaseAdmin
        .from("account_members")
        .select("user_id")
        .eq("account_id", accountId)
        .eq("role", "owner");
      return (data ?? []).map((r: { user_id: string }) => r.user_id);
    }

    case "ACCOUNT_ADMIN": {
      const { data } = await supabaseAdmin
        .from("account_members")
        .select("user_id")
        .eq("account_id", accountId)
        .in("role", ["owner", "admin"]);
      return (data ?? []).map((r: { user_id: string }) => r.user_id);
    }

    case "SPECIFIC_USER": {
      if (!userId) return [];
      // Verify user belongs to account
      const { data } = await supabaseAdmin
        .from("account_members")
        .select("user_id")
        .eq("account_id", accountId)
        .eq("user_id", userId)
        .limit(1);
      return data && data.length > 0 ? [userId] : [];
    }

    case "PLATFORM_ADMIN": {
      const { data } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("is_platform_admin", true);
      return (data ?? []).map((r: { id: string }) => r.id);
    }

    case "PLATFORM_OPERATIONS": {
      // Same as platform admin for now; can be refined later
      const { data } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("is_platform_admin", true);
      return (data ?? []).map((r: { id: string }) => r.id);
    }

    default:
      console.warn("[RuleEngine] Unknown audience:", audience);
      return [];
  }
}

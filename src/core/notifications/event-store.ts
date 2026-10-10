import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type NotificationEventType =
  | "BETA_STARTED" | "BETA_ENDING" | "BETA_ENDED" | "BETA_CONVERTED"
  | "TRIAL_STARTED" | "TRIAL_ENDING" | "TRIAL_ENDED" | "TRIAL_CONVERTED"
  | "SUBSCRIPTION_ACTIVATED" | "SUBSCRIPTION_PAST_DUE"
  | "GRACE_PERIOD_STARTED" | "GRACE_PERIOD_ENDING"
  | "SUBSCRIPTION_SUSPENDED" | "SUBSCRIPTION_REACTIVATED"
  | "CANCELLATION_SCHEDULED" | "SUBSCRIPTION_CANCELED" | "SUBSCRIPTION_RECONTRACTED"
  | "PAYMENT_DUE_SOON" | "PAYMENT_DUE_TODAY" | "PAYMENT_OVERDUE"
  | "PAYMENT_CONFIRMED" | "PAYMENT_FAILED" | "MANUAL_PAYMENT_RECORDED"
  | "ONBOARDING_STARTED" | "ONBOARDING_ABANDONED" | "ONBOARDING_COMPLETED"
  | "ONBOARDING_BLOCKED" | "ONBOARDING_FAILED"
  | "PROVISIONING_STARTED" | "PROVISIONING_COMPLETED"
  | "PROVISIONING_FAILED" | "PROVISIONING_RETRY_REQUIRED"
  | "INVITE_CREATED" | "INVITE_EXPIRING" | "INVITE_EXPIRED" | "INVITE_ACCEPTED"
  | "DELIVERY_FAILED" | "AUTOMATION_FAILED" | "REPEATED_FAILURE" | "INTERNAL_ATTENTION_REQUIRED";

export interface CreateEventInput {
  eventType: NotificationEventType;
  accountId: string;
  productId?: string | null;
  subscriptionId?: string | null;
  userId?: string | null;
  source: string;
  sourceId: string;
  payload?: Record<string, unknown>;
  occurredAt?: string;
}

export interface CreatedEvent {
  id: string;
  event_type: string;
  account_id: string;
  created_at: string;
  deduplicated: boolean;
}

const SENSITIVE_KEYS = new Set([
  "password", "token", "secret", "api_key", "apiKey", "apikey",
  "service_role", "access_token", "refresh_token", "authorization",
  "credit_card", "card_number", "cvv", "ssn",
]);

function sanitizePayload(payload: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) continue;
    if (typeof value === "string" && /^re_[A-Za-z0-9_]{20,}$/.test(value)) continue;
    if (typeof value === "string" && /^ey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) continue;
    result[key] = value;
  }
  return result;
}

/**
 * Creates a notification event with idempotent deduplication.
 * FIX P1#7: Removed non-existent RPC call. Uses direct insert with
 * unique constraint violation handling as the authoritative atomic path.
 * Dedup key: event_type + source + source_id.
 */
export async function createNotificationEvent(input: CreateEventInput): Promise<CreatedEvent> {
  const sanitized = input.payload ? sanitizePayload(input.payload) : {};
  const occurredAt = input.occurredAt ?? new Date().toISOString();

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("notification_events")
    .insert({
      event_type: input.eventType,
      account_id: input.accountId,
      product_id: input.productId ?? null,
      subscription_id: input.subscriptionId ?? null,
      user_id: input.userId ?? null,
      source: input.source,
      source_id: input.sourceId,
      payload: sanitized,
      occurred_at: occurredAt,
    })
    .select("id, event_type, account_id, created_at")
    .single();

  if (!insertError && inserted) {
    return { ...inserted, deduplicated: false };
  }

  // Unique violation (23505) = duplicate event
  if (insertError?.code === "23505") {
    const { data: existing, error: selectError } = await supabaseAdmin
      .from("notification_events")
      .select("id, event_type, account_id, created_at")
      .eq("event_type", input.eventType)
      .eq("source", input.source)
      .eq("source_id", input.sourceId)
      .maybeSingle();

    if (selectError) {
      throw new Error("Failed to fetch duplicate event: " + selectError.message);
    }

    if (existing) {
      return { ...existing, deduplicated: true };
    }

    throw new Error("Duplicate detected but event no longer exists");
  }

  throw new Error("Failed to create notification event: " + (insertError?.message ?? "unknown error"));
}

export async function getAccountEvents(
  accountId: string,
  options?: { eventType?: NotificationEventType; limit?: number; offset?: number },
) {
  let query = supabaseAdmin
    .from("notification_events")
    .select("*")
    .eq("account_id", accountId)
    .order("occurred_at", { ascending: false });

  if (options?.eventType) {
    query = query.eq("event_type", options.eventType);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit ?? 50) - 1);
  }

  const { data, error } = await query;
  if (error) throw new Error("Failed to fetch events: " + error.message);
  return data ?? [];
}

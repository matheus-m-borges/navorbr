import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createNotificationEvent, type NotificationEventType } from "./event-store";

export interface SchedulerResult {
  jobName: string;
  runId: string;
  eventsGenerated: number;
  status: "success" | "partial" | "failed";
  errors: string[];
}

/**
 * Generates a unique run key for idempotent scheduler execution.
 * Format: job_name:YYYY-MM-DD-HH (hourly granularity)
 */
function generateRunKey(jobName: string, now: Date): string {
  const iso = now.toISOString();
  const datePart = iso.slice(0, 13).replace(/[-T]/g, "-");
  return `${jobName}:${datePart}`;
}

/**
 * Checks if a scheduler run already executed for this time window.
 * Returns true if the run was already completed (idempotent guard).
 */
async function hasRunCompleted(runKey: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("automation_runs")
    .select("id, status")
    .eq("run_key", runKey)
    .maybeSingle();

  if (error) {
    console.error("[Scheduler] Failed to check run completion:", error.message);
    return false;
  }

  return data !== null && data.status === "success";
}

/**
 * Records a scheduler run in automation_runs table.
 */
async function recordRun(params: {
  jobName: string;
  runKey: string;
  status: "success" | "partial" | "failed";
  eventsGenerated: number;
  notificationsCreated: number;
  errors: string[];
}): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("automation_runs")
    .insert({
      job_name: params.jobName,
      run_key: params.runKey,
      status: params.status,
      events_generated: params.eventsGenerated,
      notifications_created: params.notificationsCreated,
      errors: params.errors,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to record automation run: ${error?.message}`);
  }

  return data.id;
}

interface SubscriptionWithProduct {
  id: string;
  account_id: string;
  plan_id: string | null;
  status: string;
  trial_ends_at: string | null;
  beta_ends_at: string | null;
  next_billing_at: string | null;
  grace_period_ends_at: string | null;
  product_id: string | null;
}

/**
 * Scans subscriptions for trial/beta/payment deadlines and generates
 * time-based notification events. Idempotent via automation_runs.
 *
 * FIX P0#1+#2: subscriptions table does NOT have product_id column.
 * Product is resolved via join to accounts (authoritative source).
 */
export async function processTimeBasedEvents(): Promise<SchedulerResult> {
  const jobName = "time_based_notifications";
  const now = new Date();
  const runKey = generateRunKey(jobName, now);
  const errors: string[] = [];
  let eventsGenerated = 0;

  // Idempotency check
  const alreadyRan = await hasRunCompleted(runKey);
  if (alreadyRan) {
    return {
      jobName,
      runId: "",
      eventsGenerated: 0,
      status: "success",
      errors: [],
    };
  }

  try {
    // Fetch active subscriptions with relevant deadlines.
    // Resolve product_id via accounts join since subscriptions lacks this column.
    const { data: subscriptions, error: fetchError } = await supabaseAdmin
      .from("subscriptions")
      .select("id, account_id, plan_id, status, trial_ends_at, beta_ends_at, next_billing_at, grace_period_ends_at, accounts!inner(product_id)")
      .in("status", ["active", "trial", "beta", "past_due", "grace_period"]);

    if (fetchError) {
      throw new Error(`Failed to fetch subscriptions: ${fetchError.message}`);
    }

    // Normalize joined result into flat records with resolved product_id
    const subs: SubscriptionWithProduct[] = (subscriptions ?? []).map((s: any) => ({
      id: s.id,
      account_id: s.account_id,
      plan_id: s.plan_id,
      status: s.status,
      trial_ends_at: s.trial_ends_at,
      beta_ends_at: s.beta_ends_at,
      next_billing_at: s.next_billing_at,
      grace_period_ends_at: s.grace_period_ends_at,
      product_id: s.accounts?.product_id ?? null,
    }));

    const nowMs = now.getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const threeDaysMs = 3 * oneDayMs;
    const sevenDaysMs = 7 * oneDayMs;

    for (const sub of subs) {
      // TRIAL_ENDING (3 days before)
      if (sub.trial_ends_at && sub.status === "trial") {
        const trialEndMs = new Date(sub.trial_ends_at).getTime();
        const diff = trialEndMs - nowMs;
        if (diff > 0 && diff <= threeDaysMs) {
          try {
            await createNotificationEvent({
              eventType: "TRIAL_ENDING",
              accountId: sub.account_id,
              productId: sub.product_id,
              subscriptionId: sub.id,
              source: "scheduler",
              sourceId: `trial_ending_${sub.id}_${runKey}`,
              payload: { trial_ends_at: sub.trial_ends_at, days_remaining: Math.ceil(diff / oneDayMs) },
            });
            eventsGenerated++;
          } catch (e) {
            errors.push(`TRIAL_ENDING ${sub.id}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
      }

      // BETA_ENDING (7 days before)
      if (sub.beta_ends_at && sub.status === "beta") {
        const betaEndMs = new Date(sub.beta_ends_at).getTime();
        const diff = betaEndMs - nowMs;
        if (diff > 0 && diff <= sevenDaysMs) {
          try {
            await createNotificationEvent({
              eventType: "BETA_ENDING",
              accountId: sub.account_id,
              productId: sub.product_id,
              subscriptionId: sub.id,
              source: "scheduler",
              sourceId: `beta_ending_${sub.id}_${runKey}`,
              payload: { beta_ends_at: sub.beta_ends_at, days_remaining: Math.ceil(diff / oneDayMs) },
            });
            eventsGenerated++;
          } catch (e) {
            errors.push(`BETA_ENDING ${sub.id}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
      }

      // PAYMENT_DUE_SOON (7 days before next billing)
      if (sub.next_billing_at && sub.status === "active") {
        const billingMs = new Date(sub.next_billing_at).getTime();
        const diff = billingMs - nowMs;
        if (diff > 0 && diff <= sevenDaysMs) {
          try {
            await createNotificationEvent({
              eventType: "PAYMENT_DUE_SOON",
              accountId: sub.account_id,
              productId: sub.product_id,
              subscriptionId: sub.id,
              source: "scheduler",
              sourceId: `payment_due_soon_${sub.id}_${runKey}`,
              payload: { next_billing_at: sub.next_billing_at, days_remaining: Math.ceil(diff / oneDayMs) },
            });
            eventsGenerated++;
          } catch (e) {
            errors.push(`PAYMENT_DUE_SOON ${sub.id}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
      }

      // GRACE_PERIOD_ENDING (3 days before grace ends)
      if (sub.grace_period_ends_at && sub.status === "grace_period") {
        const graceEndMs = new Date(sub.grace_period_ends_at).getTime();
        const diff = graceEndMs - nowMs;
        if (diff > 0 && diff <= threeDaysMs) {
          try {
            await createNotificationEvent({
              eventType: "GRACE_PERIOD_ENDING",
              accountId: sub.account_id,
              productId: sub.product_id,
              subscriptionId: sub.id,
              source: "scheduler",
              sourceId: `grace_ending_${sub.id}_${runKey}`,
              payload: { grace_period_ends_at: sub.grace_period_ends_at, days_remaining: Math.ceil(diff / oneDayMs) },
            });
            eventsGenerated++;
          } catch (e) {
            errors.push(`GRACE_PERIOD_ENDING ${sub.id}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
      }
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  const status = errors.length === 0 ? "success" : eventsGenerated > 0 ? "partial" : "failed";

  let runId = "";
  try {
    runId = await recordRun({
      jobName,
      runKey,
      status,
      eventsGenerated,
      notificationsCreated: 0, // Notifications created asynchronously by rule engine
      errors: errors.slice(0, 50), // Limit stored errors
    });
  } catch (e) {
    console.error("[Scheduler] Failed to record run:", e);
  }

  return { jobName, runId, eventsGenerated, status, errors };
}

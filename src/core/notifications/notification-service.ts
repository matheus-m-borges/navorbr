 import { supabaseAdmin } from "@/integrations/supabase/client.server";
 import type { NotificationEventType, CreatedEvent } from "./event-store";
 import type { NotificationAction } from "./rule-engine";

 export interface CreateNotificationInput {
   eventId: string;
   ruleId: string;
   accountId: string;
   userId: string;
   productId?: string | null;
   title: string;
   body: string;
   severity: "info" | "warning" | "error" | "critical";
   routeKey?: string | null;
   entityId?: string | null;
 }

 export interface CreatedNotification {
   id: string;
   title: string;
   body: string;
   severity: string;
   created_at: string;
   read_at: string | null;
 }

 const ALLOWED_ROUTE_KEYS = new Set([
   "minha-conta/assinatura",
   "minha-conta/notificacoes",
   "minha-conta/onboarding",
   "admin/onboarding",
   "admin/notifications",
   "admin/commercial",
 ]);

 function sanitizeRouteKey(routeKey?: string | null): string | null {
   if (!routeKey) return null;
   const cleaned = routeKey.replace(/^\//, "").replace(/\.\./g, "");
   if (ALLOWED_ROUTE_KEYS.has(cleaned)) return cleaned;
   // Check prefix match for parameterized routes
   for (const allowed of ALLOWED_ROUTE_KEYS) {
     if (cleaned.startsWith(allowed + "/")) return cleaned;
   }
   console.warn("[NotificationService] Blocked unsafe route_key:", routeKey);
   return null;
 }

 /**
 * Creates an in-app notification for a specific user.
 */
 export async function createNotification(input: CreateNotificationInput): Promise<CreatedNotification> {
   const safeRouteKey = sanitizeRouteKey(input.routeKey);

   const { data, error } = await supabaseAdmin
     .from("notifications")
     .insert({
       event_id: input.eventId,
       rule_id: input.ruleId,
       account_id: input.accountId,
       user_id: input.userId,
       product_id: input.productId ?? null,
       title: input.title,
       body: input.body,
       severity: input.severity,
       route_key: safeRouteKey,
       entity_id: input.entityId ?? null,
     })
     .select("id, title, body, severity, created_at, read_at")
     .single();

   if (error) {
     throw new Error(`Failed to create notification: ${error.message}`);
   }

   return data as CreatedNotification;
 }

 /**
 * Marks a notification as read with ownership validation (IDOR-safe).
 * Returns true if the notification was found and marked.
 */
 export async function markNotificationRead(
   notificationId: string,
   userId: string,
 ): Promise<boolean> {
   const { data, error } = await supabaseAdmin
     .from("notifications")
     .update({ read_at: new Date().toISOString() })
     .eq("id", notificationId)
     .eq("user_id", userId)
     .is("read_at", null)
     .select("id");

   if (error) {
     console.error("[NotificationService] markRead failed:", error.message);
     return false;
   }

   return Array.isArray(data) && data.length > 0;
 }

 /**
 * Gets unread notification count for a user.
 */
 export async function getUnreadCount(userId: string): Promise<number> {
   const { count, error } = await supabaseAdmin
     .from("notifications")
     .select("*", { count: "exact", head: true })
     .eq("user_id", userId)
     .is("read_at", null)
     .is("archived_at", null);

   if (error) {
     console.error("[NotificationService] getUnreadCount failed:", error.message);
     return 0;
   }

   return count ?? 0;
 }

 /**
 * Lists notifications for a user with pagination.
 */
 export async function listUserNotifications(
   userId: string,
   options?: { limit?: number; offset?: number; unreadOnly?: boolean },
) {
   let query = supabaseAdmin
     .from("notifications")
     .select("id, title, body, severity, route_key, entity_id, product_id, created_at, read_at, archived_at")
     .eq("user_id", userId)
     .order("created_at", { ascending: false });

   if (options?.unreadOnly) {
     query = query.is("read_at", null).is("archived_at", null);
   }

   const limit = options?.limit ?? 20;
   const offset = options?.offset ?? 0;
   query = query.range(offset, offset + limit - 1);

   const { data, error } = await query;
   if (error) throw new Error(`Failed to list notifications: ${error.message}`);
   return data ?? [];
 }

 /**
 * Archives a notification (soft delete) with ownership validation.
 */
 export async function archiveNotification(
   notificationId: string,
   userId: string,
 ): Promise<boolean> {
   const { data, error } = await supabaseAdmin
     .from("notifications")
     .update({ archived_at: new Date().toISOString() })
     .eq("id", notificationId)
     .eq("user_id", userId)
     .is("archived_at", null)
     .select("id");

   if (error) {
     console.error("[NotificationService] archive failed:", error.message);
     return false;
   }

   return Array.isArray(data) && data.length > 0;
 }

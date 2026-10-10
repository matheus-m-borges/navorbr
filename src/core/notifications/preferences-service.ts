 import { supabaseAdmin } from "@/integrations/supabase/client.server";

 export type PreferenceCategory = "transactional" | "marketing" | "operational";
 export type NotificationChannel = "in_app" | "email";

 export interface UserPreference {
   category: PreferenceCategory;
   channel: NotificationChannel;
   enabled: boolean;
 }

 /**
 * Essential/transactional communications cannot be disabled by user preference.
 * This ensures critical alerts (billing, security, suspension) always reach the user.
 */
 const ESSENTIAL_CATEGORIES: Set<PreferenceCategory> = new Set(["transactional"]);

 /**
 * Gets user notification preferences. Returns defaults for missing entries.
 */
 export async function getUserPreferences(userId: string): Promise<UserPreference[]> {
   const { data, error } = await supabaseAdmin
     .from("notification_preferences")
     .select("category, channel, enabled")
     .eq("user_id", userId);

   if (error) {
     console.error("[PreferencesService] Failed to fetch preferences:", error.message);
     return getDefaultPreferences();
   }

   if (!data || data.length === 0) {
     return getDefaultPreferences();
   }

   return data.map((row) => ({
     category: row.category as PreferenceCategory,
     channel: row.channel as NotificationChannel,
     enabled: row.enabled,
   }));
 }

 /**
 * Checks if a user should receive a notification based on their preferences.
 * Essential/transactional notifications always pass regardless of preference.
 */
 export async function shouldDeliver(
   userId: string,
   category: PreferenceCategory,
   channel: NotificationChannel,
 ): Promise<boolean> {
   // Essential communications bypass user preferences
   if (ESSENTIAL_CATEGORIES.has(category)) return true;

   const prefs = await getUserPreferences(userId);
   const match = prefs.find((p) => p.category === category && p.channel === channel);

   // Default to enabled if no preference set
   return match ? match.enabled : true;
 }

 /**
 * Updates a user preference. Cannot disable essential categories.
 */
 export async function updatePreference(
   userId: string,
   category: PreferenceCategory,
   channel: NotificationChannel,
   enabled: boolean,
 ): Promise<boolean> {
   // Block disabling essential categories
   if (ESSENTIAL_CATEGORIES.has(category) && !enabled) {
     console.warn("[PreferencesService] Cannot disable essential category:", category);
     return false;
   }

   const { error } = await supabaseAdmin
     .from("notification_preferences")
     .upsert({
       user_id: userId,
       category,
       channel,
       enabled,
       updated_at: new Date().toISOString(),
     }, { onConflict: "user_id,category,channel" });

   if (error) {
     console.error("[PreferencesService] Failed to update preference:", error.message);
     return false;
   }

   return true;
 }

 function getDefaultPreferences(): UserPreference[] {
   const categories: PreferenceCategory[] = ["transactional", "marketing", "operational"];
   const channels: NotificationChannel[] = ["in_app", "email"];
   const prefs: UserPreference[] = [];

   for (const cat of categories) {
     for (const ch of channels) {
       prefs.push({ category: cat, channel: ch, enabled: true });
     }
   }

   return prefs;
 }

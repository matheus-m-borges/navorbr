 import { supabaseAdmin } from "@/integrations/supabase/client.server";

 export interface ResolvedTemplate {
   key: string;
   channel: "in_app" | "email";
   subject: string | null;
   body: string;
   version: number;
 }

 const ALLOWED_VARIABLES = new Set([
   "recipientName", "productName", "accountName",
   "trialDays", "betaDays", "graceDays",
   "amount", "dueDate", "planName",
   "actionUrl", "supportUrl", "daysRemaining",
   "subscriptionStatus", "commercialStage",
 ]);

 function sanitizeVariables(data: Record<string, unknown>): Record<string, string | number | boolean> {
   const result: Record<string, string | number | boolean> = {};
   for (const [key, value] of Object.entries(data)) {
     if (!ALLOWED_VARIABLES.has(key)) continue;
     if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
       result[key] = value;
     }
   }
   return result;
 }

 function renderBody(body: string, vars: Record<string, string | number | boolean>): string {
   let rendered = body;
   for (const [key, value] of Object.entries(vars)) {
     const placeholder = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
     rendered = rendered.replace(placeholder, String(value));
   }
   // Remove any remaining unresolved placeholders to avoid leaking template syntax
   rendered = rendered.replace(/\{\{[^}]*\}\}/g, "");
   return rendered;
 }

 /**
 * Resolves a notification template by key and renders it with whitelisted variables.
 * No eval, no arbitrary code execution.
 */
 export async function resolveTemplate(
   templateKey: string,
   channel: "in_app" | "email",
   data: Record<string, unknown>,
 ): Promise<ResolvedTemplate | null> {
   const { data: template, error } = await supabaseAdmin
     .from("notification_templates")
     .select("key, channel, subject, body, version")
     .eq("key", templateKey)
     .eq("channel", channel)
     .eq("enabled", true)
     .maybeSingle();

   if (error || !template) {
     console.error(`[TemplateResolver] Template not found: ${templateKey}/${channel}`, error?.message);
     return null;
   }

   const safeVars = sanitizeVariables(data);
   const renderedBody = renderBody(template.body, safeVars);
   const renderedSubject = template.subject ? renderBody(template.subject, safeVars) : null;

   return {
     key: template.key,
     channel: template.channel as "in_app" | "email",
     subject: renderedSubject,
     body: renderedBody,
     version: template.version,
   };
 }

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { issueLawHubSsoTicket } from "@/core/contracts/sso-service.server";

export const createLawHubSsoTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { returnPath?: string; accountId?: string | null }) => data ?? {})
  .handler(async ({ data, context }) => {
    const result = await issueLawHubSsoTicket({
      user: {
        id: (context as any).userId,
        email: (context as any).claims?.email ?? null,
        name: (context as any).claims?.user_metadata?.full_name ?? null,
      },
      requestedAccountId: data.accountId ?? null,
      returnPath: data.returnPath ?? "/lawhub/dashboard",
    });
    return result;
  });

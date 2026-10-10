import { supabase } from "@/integrations/supabase/client";
import { createLawHubSsoTicket } from "@/api/lawhub-sso";

export type LaunchLawHubSsoResult =
  | { success: true }
  | { success: false; error: string; requiresAccountSelection?: boolean; message?: string };

export async function launchLawHubSso(
  returnPath = "/lawhub/dashboard",
  accountId?: string | null
): Promise<LaunchLawHubSsoResult> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    window.location.assign(`/auth?product=lawhub&next=${encodeURIComponent(returnPath)}`);
    return { success: false, error: "UNAUTHENTICATED" };
  }

  try {
    const handoff = await createLawHubSsoTicket({ data: { returnPath, accountId } });
    if (!handoff || !handoff.ok || !handoff.ticket || !handoff.targetOrigin) {
      const errHandoff = handoff as any;
      return {
        success: false,
        error: errHandoff?.error || "ACCESS_DENIED",
        requiresAccountSelection: Boolean(errHandoff?.requiresAccountSelection),
        message: errHandoff?.message || "Não foi possível autorizar o acesso ao LawHub.",
      };
    }

    const form = document.createElement("form");
    form.method = "POST";
    form.action = `${handoff.targetOrigin}/auth/sso/callback`;
    form.style.display = "none";

    const fields = {
      ticket: handoff.ticket,
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      return_path: handoff.returnPath,
    };
    for (const [name, value] of Object.entries(fields)) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.appendChild(input);
    }
    document.body.appendChild(form);
    form.submit();
    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: "UNEXPECTED_ERROR",
      message: err?.message || "Erro inesperado ao iniciar sessão do LawHub.",
    };
  }
}

import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getPortalSession } from "@/lib/portal.functions";
import { PortalPasswordGate } from "@/components/portal/PortalPasswordGate";

export const Route = createFileRoute("/cliente/_area")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/cliente/login" });
    try {
      // O vínculo usuário → cliente é validado no servidor.
      await getPortalSession();
    } catch {
      throw redirect({ to: "/cliente/login" });
    }
    return {};
  },
  component: () => (
    <PortalPasswordGate>
      <Outlet />
    </PortalPasswordGate>
  ),
});

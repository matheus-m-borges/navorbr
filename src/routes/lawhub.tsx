import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { launchLawHubSso } from "@/lib/lawhub-sso";

export const Route = createFileRoute("/lawhub")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth?product=lawhub&next=/lawhub/dashboard" as any });
  },
  component: () => {
    void launchLawHubSso();
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white font-sans">
        <div className="text-center space-y-3">
          <div className="size-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-300 font-medium">Acessando Navor LawHub...</p>
        </div>
      </div>
    );
  },
});

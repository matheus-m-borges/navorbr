import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

const getTickets = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: { user } } = await supabaseAdmin.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Resolve account_id via membership — strict tenant isolation
  const { data: membership } = await supabaseAdmin
    .from("account_members")
    .select("account_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) return [];

  const { listAccountTickets } = await import("@/lib/support/support-service.server");
  return listAccountTickets(membership.account_id);
});

export const Route = createFileRoute("/_authenticated/(saas)/suporte/")({
  loader: () => getTickets(),
  component: SupportPage,
});

function SupportPage() {
  const tickets = Route.useLoaderData();
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Central de Suporte</h1>
        <Link
          to="/_authenticated/(saas)/suporte/novo"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 transition-colors"
        >
          Novo Ticket
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link
          to="/_authenticated/(saas)/suporte/kb"
          className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 hover:border-emerald-500/50 transition-colors"
        >
          <h3 className="mb-2 text-lg font-semibold text-emerald-400">Base de Conhecimento</h3>
          <p className="text-sm text-slate-400">Artigos, tutoriais e perguntas frequentes.</p>
        </Link>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-100">Meus Tickets</h2>
        {tickets.length === 0 ? (
          <p className="text-slate-500">Nenhum ticket encontrado.</p>
        ) : (
          <div className="space-y-3">
            {tickets.map((t: any) => (
              <div key={t.id} className="rounded-lg border border-slate-800 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-200">{t.subject}</span>
                  <span className="text-xs uppercase tracking-wide text-slate-500">{t.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

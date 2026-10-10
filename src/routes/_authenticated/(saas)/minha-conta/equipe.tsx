import { createFileRoute } from "@tanstack/react-router";
import { GlassCard } from "@/components/navor-rephub/ui";
import { Users, Mail, Shield, UserPlus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/_authenticated/(saas)/minha-conta/equipe")({
  component: MinhaEquipe,
});

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  status: string;
  invited_at: string | null;
  profiles: { full_name: string | null; email: string | null } | null;
}

const fetchMyTeam = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const supabase = supabaseAdmin;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: membership } = await supabase
    .from("account_members")
    .select("account_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) return [];

  const { data, error } = await supabase
    .from("account_members")
    .select("id, user_id, role, status, invited_at, profiles(full_name, email)")
    .eq("account_id", membership.account_id)
    .order("invited_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as TeamMember[];
});

function MinhaEquipe() {
  const { data: members, isLoading } = useQuery({
    queryKey: ["my_team"],
    queryFn: () => fetchMyTeam(),
  });

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Carregando equipe...</div>;
  }

  if (!members || members.length === 0) {
    return (
      <GlassCard className="p-8 text-center">
        <Users className="mx-auto mb-3 size-10 text-muted-foreground" />
        <h3 className="text-lg font-semibold text-card-foreground">Nenhum membro encontrado</h3>
        <p className="mt-1 text-sm text-muted-foreground">Sua equipe aparecerá aqui quando membros forem adicionados à conta.</p>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-card-foreground">Minha Equipe</h2>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-bold text-blue-600 border border-blue-500/20">
          <Users className="size-3" />
          {members.length} {members.length === 1 ? "membro" : "membros"}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {members.map((member) => (
          <GlassCard key={member.id} className="p-4">
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-full bg-blue-600/10 text-blue-600">
                <Shield className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-card-foreground">
                  {member.profiles?.full_name ?? member.profiles?.email ?? "Usuário"}
                </p>
                {member.profiles?.email && (
                  <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <Mail className="size-3" />
                    {member.profiles.email}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-2">
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase text-accent-foreground">
                    {member.role}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    member.status === "active"
                      ? "bg-emerald-500/10 text-emerald-600"
                      : "bg-amber-500/10 text-amber-600"
                  }`}>
                    {member.status}
                  </span>
                </div>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}




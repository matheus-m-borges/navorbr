import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/navor-rephub/AppShell";
import { Chip, EmptyState, GhostButton, GlassCard, PrimaryButton } from "@/components/navor-rephub/ui";
import { formatDateTime } from "@/lib/crm";
import { crmDb, useNotifications } from "@/hooks/useCrm";

export const Route = createFileRoute("/_authenticated/(navor-rephub)/notificacoes")({
  head: () => ({
    meta: [
      { title: "Notificações | CRM Representação" },
      {
        name: "description",
        content:
          "Central de alertas do CRM: leads sem retorno, follow-ups vencidos, positivações e novos leads recebidos.",
      },
      { property: "og:title", content: "Notificações | CRM Representação" },
      {
        property: "og:description",
        content: "Todos os alertas comerciais em um só lugar.",
      },
    ],
  }),
  component: NotificacoesPage,
});

function NotificacoesPage() {
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useNotifications();
  const unread = items.filter((n) => !n.read);

  async function markAll() {
    await crmDb.from("notifications").update({ read: true }).eq("read", false);
    void qc.invalidateQueries({ queryKey: ["notifications"] });
    toast.success("Notificações marcadas como lidas.");
  }

  async function markOne(id: string) {
    await crmDb.from("notifications").update({ read: true }).eq("id", id);
    void qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <AppShell
      title="Notificações"
      subtitle={`${unread.length} não lidas`}
      actions={
        unread.length > 0 ? (
          <PrimaryButton onClick={() => void markAll()}>Marcar todas como lidas</PrimaryButton>
        ) : null
      }
    >
      {isLoading ? (
        <GlassCard className="p-6 text-sm text-muted-foreground">Carregando notificações...</GlassCard>
      ) : items.length === 0 ? (
        <EmptyState title="Nenhuma notificação" hint="Os alertas aparecem aqui automaticamente." />
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <GlassCard key={n.id} className={`p-4 ${n.read ? "opacity-70" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-card-foreground">{n.title}</p>
                    <Chip
                      tone={
                        n.kind === "sem_retorno" || n.kind === "perdido"
                          ? "rose"
                          : n.kind === "positivado"
                            ? "brand"
                            : "cyan"
                      }
                    >
                      {n.kind}
                    </Chip>
                    {!n.read ? <Chip tone="amber">Nova</Chip> : null}
                  </div>
                  {n.body ? <p className="mt-1 text-xs text-muted-foreground">{n.body}</p> : null}
                  <p className="mt-1 text-[11px] text-muted-foreground">{formatDateTime(n.created_at)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {n.lead_id ? (
                    <Link to="/leads/$leadId" params={{ leadId: n.lead_id }}>
                      <GhostButton>Abrir lead</GhostButton>
                    </Link>
                  ) : null}
                  {!n.read ? (
                    <GhostButton onClick={() => void markOne(n.id)}>Marcar como lida</GhostButton>
                  ) : null}
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </AppShell>
  );
}

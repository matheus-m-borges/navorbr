import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/navor-rephub/AppShell";
import { Chip, EmptyState, GhostButton, GlassCard, SectionTitle } from "@/components/navor-rephub/ui";
import { formatDateTime } from "@/lib/crm";
import { crmDb, useLeads, useTasks, type Task } from "@/hooks/useCrm";

export const Route = createFileRoute("/_authenticated/(navor-rephub)/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda comercial | CRM Representação" },
      {
        name: "description",
        content:
          "Agenda de follow-ups, ligações, visitas e reuniões organizada por dia, com vínculo direto aos leads.",
      },
      { property: "og:title", content: "Agenda comercial | CRM Representação" },
      {
        property: "og:description",
        content: "Seu dia comercial organizado: follow-ups, visitas e reuniões.",
      },
    ],
  }),
  component: AgendaPage,
});

function dayKey(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}

function AgendaPage() {
  const qc = useQueryClient();
  const { data: tasks = [], isLoading } = useTasks();
  const { data: leads = [] } = useLeads();

  const groups = useMemo(() => {
    const pending = tasks.filter((t) => t.status !== "Concluída");
    const map = new Map<string, Task[]>();
    for (const t of pending) {
      const k = dayKey(t.due_at);
      map.set(k, [...(map.get(k) ?? []), t]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [tasks]);

  const todayKey = new Date().toISOString().slice(0, 10);

  async function complete(id: string) {
    await crmDb
      .from("tasks")
      .update({ status: "Concluída", completed_at: new Date().toISOString() })
      .eq("id", id);
    void qc.invalidateQueries({ queryKey: ["tasks"] });
    toast.success("Compromisso concluído.");
  }

  return (
    <AppShell title="Agenda" subtitle="Compromissos e follow-ups programados">
      {isLoading ? (
        <GlassCard className="p-6 text-sm text-muted-foreground">Carregando agenda...</GlassCard>
      ) : groups.length === 0 ? (
        <EmptyState title="Agenda livre" hint="Nenhum compromisso pendente no momento." />
      ) : (
        <div className="space-y-4">
          {groups.map(([day, items]) => {
            const label =
              day === todayKey
                ? "Hoje"
                : new Date(`${day}T12:00:00`).toLocaleDateString("pt-BR", {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                  });
            const late = day < todayKey;
            return (
              <GlassCard key={day} className="p-5">
                <SectionTitle
                  title={label.charAt(0).toUpperCase() + label.slice(1)}
                  hint={`${items.length} compromisso(s)`}
                  action={late ? <Chip tone="rose">Atrasado</Chip> : null}
                />
                <div className="space-y-2">
                  {items
                    .slice()
                    .sort((a, b) => a.due_at.localeCompare(b.due_at))
                    .map((t) => {
                      const lead = leads.find((l) => l.id === t.lead_id);
                      return (
                        <div
                          key={t.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-ink-2/40 p-3"
                        >
                          <div className="min-w-0">
                            <p className="text-sm text-card-foreground">{t.title}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {formatDateTime(t.due_at)} · {t.task_type} · {t.priority}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {lead ? (
                              <Link to="/leads/$leadId" params={{ leadId: lead.id }}>
                                <GhostButton>Abrir lead</GhostButton>
                              </Link>
                            ) : null}
                            <GhostButton onClick={() => void complete(t.id)}>Concluir</GhostButton>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

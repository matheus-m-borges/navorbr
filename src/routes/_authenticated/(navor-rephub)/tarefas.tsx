import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/navor-rephub/AppShell";
import {
  Chip,
  EmptyState,
  Field,
  GhostButton,
  GlassCard,
  Modal,
  PrimaryButton,
  SelectInput,
  TextArea,
  TextInput,
} from "@/components/navor-rephub/ui";
import { formatDateTime, TASK_PRIORITIES, TASK_TYPES } from "@/lib/crm";
import { crmDb, useLeads, useTasks } from "@/hooks/useCrm";
import { useCurrentUser } from "@/hooks/useSession";

export const Route = createFileRoute("/_authenticated/(navor-rephub)/tarefas")({
  head: () => ({
    meta: [
      { title: "Tarefas e follow-ups | CRM Representação" },
      {
        name: "description",
        content:
          "Lista de tarefas comerciais, lembretes de follow-up, ligações e visitas com prioridade e prazo.",
      },
      { property: "og:title", content: "Tarefas e follow-ups | CRM Representação" },
      {
        property: "og:description",
        content: "Organize follow-ups, ligações e visitas por prioridade e vencimento.",
      },
    ],
  }),
  component: TarefasPage,
});

function TarefasPage() {
  const qc = useQueryClient();
  const { data: tasks = [], isLoading } = useTasks();
  const { data: leads = [] } = useLeads();
  const { user } = useCurrentUser();
  const [filter, setFilter] = useState("pendentes");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    task_type: "Follow-up",
    priority: "Normal",
    due_at: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
    lead_id: "",
    description: "",
  });

  const now = Date.now();
  const list = useMemo(() => {
    return tasks.filter((t) => {
      if (filter === "pendentes") return t.status !== "Concluída";
      if (filter === "vencidas") return t.status !== "Concluída" && new Date(t.due_at).getTime() < now;
      if (filter === "hoje") {
        const d = new Date(t.due_at);
        const today = new Date();
        return t.status !== "Concluída" && d.toDateString() === today.toDateString();
      }
      if (filter === "concluidas") return t.status === "Concluída";
      return true;
    });
  }, [tasks, filter, now]);

  async function complete(id: string) {
    await crmDb
      .from("tasks")
      .update({ status: "Concluída", completed_at: new Date().toISOString() })
      .eq("id", id);
    void qc.invalidateQueries({ queryKey: ["tasks"] });
    toast.success("Tarefa concluída.");
  }

  async function create() {
    if (!form.title.trim()) {
      toast.error("Informe o título");
      return;
    }
    const { error } = await crmDb.from("tasks").insert({
      title: form.title.trim(),
      description: form.description || null,
      task_type: form.task_type,
      priority: form.priority,
      due_at: new Date(form.due_at).toISOString(),
      lead_id: form.lead_id || null,
      owner_name: user?.name ?? null,
      owner_id: user?.id ?? null,
      created_by: user?.id ?? null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setOpen(false);
    setForm({ ...form, title: "", description: "", lead_id: "" });
    void qc.invalidateQueries({ queryKey: ["tasks"] });
    toast.success("Tarefa criada.");
  }

  return (
    <AppShell
      title="Tarefas"
      subtitle={`${tasks.filter((t) => t.status !== "Concluída").length} tarefas em aberto`}
      actions={<PrimaryButton onClick={() => setOpen(true)}>+ Nova tarefa</PrimaryButton>}
    >
      <GlassCard className="p-3">
        <div className="flex flex-wrap gap-2">
          {[
            ["pendentes", "Pendentes"],
            ["hoje", "Hoje"],
            ["vencidas", "Vencidas"],
            ["concluidas", "Concluídas"],
            ["todas", "Todas"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key as string)}
              className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                filter === key
                  ? "border-brand/40 bg-brand/15 text-brand"
                  : "border-border text-muted-foreground hover:bg-accent/60"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </GlassCard>

      {isLoading ? (
        <GlassCard className="p-6 text-sm text-muted-foreground">Carregando tarefas...</GlassCard>
      ) : list.length === 0 ? (
        <EmptyState title="Nenhuma tarefa neste filtro" hint="Crie uma nova tarefa ou mude o filtro." />
      ) : (
        <div className="space-y-2">
          {list.map((t) => {
            const late = t.status !== "Concluída" && new Date(t.due_at).getTime() < now;
            const lead = leads.find((l) => l.id === t.lead_id);
            return (
              <GlassCard key={t.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-card-foreground">{t.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {t.task_type} · {formatDateTime(t.due_at)} · {t.owner_name ?? "—"}
                    </p>
                    {t.description ? (
                      <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
                    ) : null}
                    {lead ? (
                      <Link to="/leads/$leadId" params={{ leadId: lead.id }}>
                        <GhostButton className="mt-2">Abrir lead: {lead.company_name}</GhostButton>
                      </Link>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Chip tone={t.priority === "Urgente" || t.priority === "Alta" ? "rose" : "amber"}>
                      {t.priority}
                    </Chip>
                    {late ? <Chip tone="rose">Vencida</Chip> : null}
                    {t.status === "Concluída" ? (
                      <Chip tone="brand">Concluída</Chip>
                    ) : (
                      <GhostButton onClick={() => void complete(t.id)}>Concluir</GhostButton>
                    )}
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Nova tarefa" wide>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Título *" className="sm:col-span-2">
            <TextInput
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              maxLength={140}
            />
          </Field>
          <Field label="Tipo">
            <SelectInput
              value={form.task_type}
              onChange={(e) => setForm({ ...form, task_type: e.target.value })}
            >
              {TASK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Prioridade">
            <SelectInput
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            >
              {TASK_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Data e hora">
            <TextInput
              type="datetime-local"
              value={form.due_at}
              onChange={(e) => setForm({ ...form, due_at: e.target.value })}
            />
          </Field>
          <Field label="Lead vinculado">
            <SelectInput
              value={form.lead_id}
              onChange={(e) => setForm({ ...form, lead_id: e.target.value })}
            >
              <option value="">Nenhum</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.company_name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Observação" className="sm:col-span-2">
            <TextArea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              maxLength={500}
            />
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <GhostButton onClick={() => setOpen(false)}>Cancelar</GhostButton>
          <PrimaryButton onClick={() => void create()}>Salvar tarefa</PrimaryButton>
        </div>
      </Modal>
    </AppShell>
  );
}

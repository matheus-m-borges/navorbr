import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Mail, MessageCircle, MessageSquare, Phone } from "lucide-react";
import { AppShell } from "@/components/navor-rephub/AppShell";
import {
  Chip,
  DataRow,
  EmptyState,
  Field,
  GhostButton,
  GlassCard,
  MoneyInput,
  Modal,
  PrimaryButton,
  SectionTitle,
  SelectInput,
  StatusBadge,
  TextArea,
  TextInput,
} from "@/components/navor-rephub/ui";
import {
  CATALOG_CHANNELS,
  CONTACT_TYPES,
  currency,
  daysSince,
  DEFAULT_WHATSAPP_TEMPLATE,
  fillTemplate,
  formatDate,
  formatDateTime,
  LEAD_STATUSES,
  POSITIVADO_OPTIONS,
  smsLink,
  TASK_PRIORITIES,
  TASK_TYPES,
  whatsappLink,
} from "@/lib/crm";
import {
  crmDb,
  useInteractions,
  useLead,
  useLeadTasks,
  useLossReasons,
  useSettings,
  useStatusHistory,
} from "@/hooks/useCrm";
import { useCurrentUser } from "@/hooks/useSession";
import { changeLeadStatus, convertLeadToClient } from "@/lib/leadActions";

export const Route = createFileRoute("/_authenticated/leads_/$leadId")({
  head: () => ({
    meta: [
      { title: "Detalhes do lead | CRM Representação" },
      {
        name: "description",
        content:
          "Ficha completa do lead: dados da empresa, contato, marcas, catálogo, histórico de atendimento e follow-ups.",
      },
      { property: "og:title", content: "Detalhes do lead | CRM Representação" },
      {
        property: "og:description",
        content: "Histórico de atendimento, tarefas e ações de contato do lead.",
      },
    ],
  }),
  component: LeadDetail,
});

function LeadDetail() {
  const { leadId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: lead, isLoading } = useLead(leadId);
  const { data: interactions = [] } = useInteractions(leadId);
  const { data: history = [] } = useStatusHistory(leadId);
  const { data: tasks = [] } = useLeadTasks(leadId);
  const { data: reasons = [] } = useLossReasons();
  const { data: settings } = useSettings();
  const { user } = useCurrentUser();

  const [interactionOpen, setInteractionOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [positivarOpen, setPositivarOpen] = useState(false);
  const [lossOpen, setLossOpen] = useState(false);

  const [interaction, setInteraction] = useState({
    occurred_at: new Date().toISOString().slice(0, 16),
    contact_type: "WhatsApp",
    description: "",
    result: "",
    next_action: "",
    next_action_at: "",
  });
  const [task, setTask] = useState({
    title: "",
    task_type: "Follow-up",
    priority: "Normal",
    due_at: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
    description: "",
  });
  const [catalog, setCatalog] = useState({
    catalog_sent_at: new Date().toISOString().slice(0, 10),
    catalog_channel: "WhatsApp",
    catalog_name: "",
    catalog_notes: "",
  });
  const [positivar, setPositivar] = useState({
    positivado: "Sim",
    positivado_at: new Date().toISOString().slice(0, 10),
    positivado_brand: "",
    estimated_value: "",
    effective_value: "",
    order_number: "",
    positivado_notes: "",
  });
  const [loss, setLoss] = useState({ reason: "", notes: "", to: "Não quis" });
  const [newStatus, setNewStatus] = useState("");

  if (isLoading) {
    return (
      <AppShell title="Lead" subtitle="Carregando...">
        <GlassCard className="p-6 text-sm text-muted-foreground">Carregando lead...</GlassCard>
      </AppShell>
    );
  }
  if (!lead) {
    return (
      <AppShell title="Lead" subtitle="Não encontrado">
        <EmptyState title="Lead não encontrado" hint="Ele pode ter sido removido." />
      </AppShell>
    );
  }

  const leadRow = lead;
  const template = (settings?.["whatsapp_template"] as string) ?? DEFAULT_WHATSAPP_TEMPLATE;
  const brandNames = (lead.lead_brands ?? []).map((lb) => lb.brands?.brand).filter(Boolean) as string[];
  const message = fillTemplate(template, {
    NOME: lead.contact_name,
    MARCA: brandNames[0] ?? null,
    EMPRESA: lead.company_name,
  });
  const wa = whatsappLink(lead.whatsapp ?? lead.phone, message);
  const sms = smsLink(lead.whatsapp ?? lead.phone, message);
  const idleDays = daysSince(lead.last_interaction_at ?? lead.entry_at) ?? 0;
  const noReturnDays = Number(settings?.["no_return_days"] ?? 3);
  const stale =
    idleDays >= noReturnDays &&
    !["Positivado", "Não quis", "Perdido", "Sem retorno"].includes(lead.status);

  function refresh() {
    void qc.invalidateQueries({ queryKey: ["lead", leadId] });
    void qc.invalidateQueries({ queryKey: ["leads"] });
    void qc.invalidateQueries({ queryKey: ["interactions", leadId] });
    void qc.invalidateQueries({ queryKey: ["status-history", leadId] });
    void qc.invalidateQueries({ queryKey: ["lead-tasks", leadId] });
    void qc.invalidateQueries({ queryKey: ["tasks"] });
    void qc.invalidateQueries({ queryKey: ["notifications"] });
    void qc.invalidateQueries({ queryKey: ["clients"] });
  }

  async function saveInteraction() {
    const lead = leadRow;
    if (!interaction.description.trim()) {
      toast.error("Descreva o atendimento");
      return;
    }
    const occurred = new Date(interaction.occurred_at).toISOString();
    const { error } = await crmDb.from("lead_interactions").insert({
      lead_id: lead.id,
      occurred_at: occurred,
      contact_type: interaction.contact_type,
      responsible_name: user?.name ?? null,
      description: interaction.description.trim(),
      result: interaction.result || null,
      next_action: interaction.next_action || null,
      next_action_at: interaction.next_action_at
        ? new Date(interaction.next_action_at).toISOString()
        : null,
      created_by: user?.id ?? null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    await crmDb
      .from("leads")
      .update({
        last_interaction_at: occurred,
        next_followup_at: interaction.next_action_at
          ? new Date(interaction.next_action_at).toISOString()
          : lead.next_followup_at,
      })
      .eq("id", lead.id);
    setInteractionOpen(false);
    setInteraction({ ...interaction, description: "", result: "", next_action: "", next_action_at: "" });
    refresh();
    toast.success("Atendimento registrado.");
  }

  async function saveTask() {
    const lead = leadRow;
    if (!task.title.trim()) {
      toast.error("Informe o título da tarefa");
      return;
    }
    const { error } = await crmDb.from("tasks").insert({
      title: task.title.trim(),
      description: task.description || null,
      task_type: task.task_type,
      priority: task.priority,
      due_at: new Date(task.due_at).toISOString(),
      lead_id: lead.id,
      owner_name: user?.name ?? null,
      owner_id: user?.id ?? null,
      created_by: user?.id ?? null,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    await crmDb
      .from("leads")
      .update({ next_followup_at: new Date(task.due_at).toISOString() })
      .eq("id", lead.id);
    setTaskOpen(false);
    setTask({ ...task, title: "", description: "" });
    refresh();
    toast.success("Tarefa criada.");
  }

  async function saveCatalog() {
    const lead = leadRow;
    const { error } = await crmDb
      .from("leads")
      .update({
        catalog_sent: true,
        catalog_sent_at: catalog.catalog_sent_at,
        catalog_channel: catalog.catalog_channel,
        catalog_name: catalog.catalog_name || null,
        catalog_notes: catalog.catalog_notes || null,
      })
      .eq("id", lead.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await changeLeadStatus({
      lead,
      to: "Catálogo enviado",
      userName: user?.name ?? null,
      userId: user?.id ?? null,
      followupDays: Number(settings?.["followup_days_after_catalog"] ?? 2),
    });
    await crmDb.from("lead_interactions").insert({
      lead_id: lead.id,
      contact_type: catalog.catalog_channel === "E-mail" ? "E-mail" : "WhatsApp",
      responsible_name: user?.name ?? null,
      description: `Catálogo ${catalog.catalog_name || ""} enviado por ${catalog.catalog_channel}.`,
      result: "Catálogo entregue",
      next_action: "Follow-up de retorno",
    });
    setCatalogOpen(false);
    refresh();
    toast.success("Catálogo registrado e follow-up agendado.");
  }

  async function savePositivacao() {
    const lead = leadRow;
    const { error } = await crmDb
      .from("leads")
      .update({
        positivado: positivar.positivado,
        positivado_at: positivar.positivado_at,
        positivado_brand: positivar.positivado_brand || brandNames[0] || null,
        estimated_value: positivar.estimated_value ? Number(positivar.estimated_value) : lead.estimated_value,
        effective_value: positivar.effective_value ? Number(positivar.effective_value) : null,
        order_number: positivar.order_number || null,
        positivado_notes: positivar.positivado_notes || null,
      })
      .eq("id", lead.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (positivar.positivado === "Sim" && lead.status !== "Positivado") {
      await changeLeadStatus({
        lead,
        to: "Positivado",
        userName: user?.name ?? null,
        userId: user?.id ?? null,
      });
    }
    setPositivarOpen(false);
    refresh();
    toast.success("Positivação registrada.");
  }

  async function applyStatus(to: string) {
    const lead = leadRow;
    if (to === "Não quis" || to === "Perdido") {
      setLoss({ reason: "", notes: "", to });
      setStatusOpen(false);
      setLossOpen(true);
      return;
    }
    try {
      await changeLeadStatus({
        lead,
        to,
        userName: user?.name ?? null,
        userId: user?.id ?? null,
        followupDays: Number(settings?.["followup_days_after_catalog"] ?? 2),
      });
      setStatusOpen(false);
      refresh();
      toast.success(`Etapa alterada para "${to}".`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function saveLoss() {
    const lead = leadRow;
    if (!loss.reason) {
      toast.error("Selecione o motivo da recusa");
      return;
    }
    await changeLeadStatus({
      lead,
      to: loss.to,
      userName: user?.name ?? null,
      userId: user?.id ?? null,
      lossReason: loss.reason,
      lossNotes: loss.notes,
    });
    setLossOpen(false);
    refresh();
    toast.success("Recusa registrada.");
  }

  async function convert() {
    const lead = leadRow;
    try {
      const clientId = await convertLeadToClient(lead, user?.name ?? null);
      refresh();
      toast.success("Lead convertido em cliente. O histórico do lead foi preservado.");
      void navigate({ to: "/clientes", search: { c: clientId } });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <AppShell
      title={lead.company_name}
      subtitle={`${lead.city ?? "—"}/${lead.state ?? "—"} · origem ${lead.source} · responsável ${lead.owner_name ?? "—"}`}
      actions={
        <Link to="/leads">
          <GhostButton>← Voltar</GhostButton>
        </Link>
      }
    >
      <GlassCard className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={lead.status} />
          {brandNames.map((b) => (
            <Chip key={b} tone="violet">
              {b}
            </Chip>
          ))}
          <Chip tone="cyan">{lead.source}</Chip>
          <Chip tone={lead.catalog_sent ? "brand" : "muted"}>
            Catálogo: {lead.catalog_sent ? "enviado" : "não enviado"}
          </Chip>
          <Chip tone={lead.positivado === "Sim" ? "brand" : "muted"}>
            Positivado: {lead.positivado}
          </Chip>
          <span className="ml-auto text-[11px] text-muted-foreground">
            Entrada {formatDateTime(lead.entry_at)}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {wa ? (
            <a href={wa} target="_blank" rel="noreferrer">
              <GhostButton className="border-brand/30 text-brand">
                <MessageCircle className="size-3.5" /> WhatsApp
              </GhostButton>
            </a>
          ) : null}
          {lead.phone ? (
            <a href={`tel:${lead.phone}`}>
              <GhostButton>
                <Phone className="size-3.5" /> Ligar
              </GhostButton>
            </a>
          ) : null}
          {lead.email ? (
            <a href={`mailto:${lead.email}`}>
              <GhostButton>
                <Mail className="size-3.5" /> E-mail
              </GhostButton>
            </a>
          ) : null}
          {sms ? (
            <a href={sms}>
              <GhostButton>
                <MessageSquare className="size-3.5" /> SMS
              </GhostButton>
            </a>
          ) : null}
          <GhostButton onClick={() => setInteractionOpen(true)}>+ Adicionar interação</GhostButton>
          <GhostButton onClick={() => setTaskOpen(true)}>+ Adicionar tarefa</GhostButton>
          <GhostButton onClick={() => setCatalogOpen(true)}>Enviar catálogo</GhostButton>
          <GhostButton onClick={() => setStatusOpen(true)}>Alterar status</GhostButton>
          <GhostButton onClick={() => setPositivarOpen(true)}>Positivação</GhostButton>
          {lead.converted_client_id ? (
            <Chip tone="brand">Já convertido em cliente</Chip>
          ) : (
            <PrimaryButton className="px-3 py-2 text-xs" onClick={() => void convert()}>
              Converter em cliente
            </PrimaryButton>
          )}
        </div>
      </GlassCard>

      {stale ? (
        <div className="rounded-2xl border border-rose/30 bg-rose/[0.07] p-4">
          <p className="text-sm font-semibold text-card-foreground">
            🔴 ATENÇÃO — cliente sem retorno há {idleDays} dias
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Último contato em {formatDate(lead.last_interaction_at ?? lead.entry_at)}.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {wa ? (
              <a href={wa} target="_blank" rel="noreferrer">
                <GhostButton className="border-brand/30 text-brand">Entrar em contato</GhostButton>
              </a>
            ) : null}
            <GhostButton onClick={() => setTaskOpen(true)}>Agendar follow-up</GhostButton>
            <GhostButton
              className="border-rose/30 text-rose"
              onClick={() => {
                setLoss({ reason: "", notes: "", to: "Perdido" });
                setLossOpen(true);
              }}
            >
              Marcar como perdido
            </GhostButton>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <GlassCard className="p-5">
          <SectionTitle title="Dados da empresa" />
          <DataRow label="CNPJ" value={lead.cnpj} />
          <DataRow label="Razão social" value={lead.legal_name} />
          <DataRow label="Nome fantasia" value={lead.trade_name} />
          <DataRow label="Cidade / UF" value={`${lead.city ?? "—"} / ${lead.state ?? "—"}`} />
          <DataRow label="Site" value={lead.website} />
        </GlassCard>

        <GlassCard className="p-5">
          <SectionTitle title="Dados do contato" />
          <DataRow label="Responsável" value={lead.contact_name} />
          <DataRow label="Cargo" value={lead.contact_role} />
          <DataRow label="Telefone" value={lead.phone} />
          <DataRow label="WhatsApp" value={lead.whatsapp} />
          <DataRow label="E-mail" value={lead.email} />
          <DataRow label="Instagram" value={lead.instagram} />
        </GlassCard>

        <GlassCard className="p-5">
          <SectionTitle title="Catálogo e comercial" />
          <DataRow label="Catálogo enviado" value={lead.catalog_sent ? "Sim" : "Não"} />
          <DataRow label="Data do envio" value={formatDate(lead.catalog_sent_at)} />
          <DataRow label="Forma de envio" value={lead.catalog_channel} />
          <DataRow label="Coleção" value={lead.catalog_name} />
          <DataRow label="Valor estimado" value={currency(lead.estimated_value)} />
          <DataRow label="Valor efetivo" value={currency(lead.effective_value)} />
          <DataRow label="Nº do pedido" value={lead.order_number} />
          {lead.loss_reason ? <DataRow label="Motivo da recusa" value={lead.loss_reason} /> : null}
          {lead.loss_notes ? <DataRow label="Obs. da recusa" value={lead.loss_notes} /> : null}
          <DataRow label="Próximo follow-up" value={formatDateTime(lead.next_followup_at)} />
        </GlassCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <GlassCard className="p-5 lg:col-span-2">
          <SectionTitle
            title="Histórico de atendimento"
            hint="toda interação registrada fica salva"
            action={<GhostButton onClick={() => setInteractionOpen(true)}>+ Interação</GhostButton>}
          />
          {interactions.length === 0 ? (
            <EmptyState title="Nenhum atendimento registrado" hint="Registre o primeiro contato." />
          ) : (
            <ol className="relative space-y-4 border-l border-border pl-4">
              {interactions.map((it) => (
                <li key={it.id}>
                  <span className="absolute -left-[5px] mt-1.5 size-2 rounded-full bg-brand" />
                  <p className="text-[11px] text-muted-foreground">
                    {formatDateTime(it.occurred_at)} · {it.contact_type} ·{" "}
                    {it.responsible_name ?? "—"}
                  </p>
                  <p className="text-sm text-card-foreground">{it.description}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {it.result ? `Resultado: ${it.result}` : null}
                    {it.next_action ? ` · Próxima ação: ${it.next_action}` : null}
                    {it.next_action_at ? ` (${formatDate(it.next_action_at)})` : null}
                  </p>
                </li>
              ))}
            </ol>
          )}

          <div className="mt-6">
            <SectionTitle title="Histórico de etapas" />
            <div className="space-y-1.5">
              {history.map((h) => (
                <p key={h.id} className="text-[11px] text-muted-foreground">
                  {formatDateTime(h.changed_at)} —{" "}
                  <span className="text-card-foreground">
                    {h.from_status ? `${h.from_status} → ` : ""}
                    {h.to_status}
                  </span>{" "}
                  · {h.changed_by_name ?? "—"}
                </p>
              ))}
              {history.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">Sem alterações registradas.</p>
              ) : null}
            </div>
          </div>
        </GlassCard>

        <div className="space-y-4">
          <GlassCard className="p-5">
            <SectionTitle
              title="Tarefas e follow-up"
              action={<GhostButton onClick={() => setTaskOpen(true)}>+ Tarefa</GhostButton>}
            />
            <div className="space-y-2">
              {tasks.map((t) => (
                <div key={t.id} className="rounded-xl border border-border bg-ink-2/40 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-card-foreground">{t.title}</p>
                    <Chip tone={t.status === "Concluída" ? "brand" : t.priority === "Urgente" ? "rose" : "amber"}>
                      {t.status === "Concluída" ? "Concluída" : t.priority}
                    </Chip>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {t.task_type} · {formatDateTime(t.due_at)}
                  </p>
                  {t.status !== "Concluída" ? (
                    <GhostButton
                      className="mt-2"
                      onClick={async () => {
                        await crmDb
                          .from("tasks")
                          .update({ status: "Concluída", completed_at: new Date().toISOString() })
                          .eq("id", t.id);
                        refresh();
                      }}
                    >
                      Concluir
                    </GhostButton>
                  ) : null}
                </div>
              ))}
              {tasks.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma tarefa para este lead.</p>
              ) : null}
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <SectionTitle title="Observações" />
            <p className="text-xs whitespace-pre-line text-card-foreground">
              {lead.notes || "Sem observações."}
            </p>
          </GlassCard>
        </div>
      </div>

      {/* Modais */}
      <Modal
        open={interactionOpen}
        onClose={() => setInteractionOpen(false)}
        title="Registrar atendimento"
        wide
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Data e hora">
            <TextInput
              type="datetime-local"
              value={interaction.occurred_at}
              onChange={(e) => setInteraction({ ...interaction, occurred_at: e.target.value })}
            />
          </Field>
          <Field label="Tipo de contato">
            <SelectInput
              value={interaction.contact_type}
              onChange={(e) => setInteraction({ ...interaction, contact_type: e.target.value })}
            >
              {CONTACT_TYPES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Descrição *" className="sm:col-span-2">
            <TextArea
              value={interaction.description}
              onChange={(e) => setInteraction({ ...interaction, description: e.target.value })}
              maxLength={1000}
            />
          </Field>
          <Field label="Resultado">
            <TextInput
              value={interaction.result}
              onChange={(e) => setInteraction({ ...interaction, result: e.target.value })}
              maxLength={140}
            />
          </Field>
          <Field label="Próxima ação">
            <TextInput
              value={interaction.next_action}
              onChange={(e) => setInteraction({ ...interaction, next_action: e.target.value })}
              maxLength={140}
            />
          </Field>
          <Field label="Data do próximo contato">
            <TextInput
              type="datetime-local"
              value={interaction.next_action_at}
              onChange={(e) => setInteraction({ ...interaction, next_action_at: e.target.value })}
            />
          </Field>
        </div>
        <div className="mt-5 flex justify-end">
          <PrimaryButton onClick={() => void saveInteraction()}>Salvar atendimento</PrimaryButton>
        </div>
      </Modal>

      <Modal open={taskOpen} onClose={() => setTaskOpen(false)} title="Nova tarefa / lembrete" wide>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Título *" className="sm:col-span-2">
            <TextInput
              value={task.title}
              onChange={(e) => setTask({ ...task, title: e.target.value })}
              maxLength={140}
            />
          </Field>
          <Field label="Tipo">
            <SelectInput
              value={task.task_type}
              onChange={(e) => setTask({ ...task, task_type: e.target.value })}
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
              value={task.priority}
              onChange={(e) => setTask({ ...task, priority: e.target.value })}
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
              value={task.due_at}
              onChange={(e) => setTask({ ...task, due_at: e.target.value })}
            />
          </Field>
          <Field label="Observação" className="sm:col-span-2">
            <TextArea
              value={task.description}
              onChange={(e) => setTask({ ...task, description: e.target.value })}
              maxLength={500}
            />
          </Field>
        </div>
        <div className="mt-5 flex justify-end">
          <PrimaryButton onClick={() => void saveTask()}>Salvar tarefa</PrimaryButton>
        </div>
      </Modal>

      <Modal open={catalogOpen} onClose={() => setCatalogOpen(false)} title="Registrar envio de catálogo">
        <div className="space-y-3">
          <Field label="Data do envio">
            <TextInput
              type="date"
              value={catalog.catalog_sent_at}
              onChange={(e) => setCatalog({ ...catalog, catalog_sent_at: e.target.value })}
            />
          </Field>
          <Field label="Forma de envio">
            <SelectInput
              value={catalog.catalog_channel}
              onChange={(e) => setCatalog({ ...catalog, catalog_channel: e.target.value })}
            >
              {CATALOG_CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Catálogo / coleção">
            <TextInput
              value={catalog.catalog_name}
              onChange={(e) => setCatalog({ ...catalog, catalog_name: e.target.value })}
              maxLength={120}
            />
          </Field>
          <Field label="Observação">
            <TextArea
              value={catalog.catalog_notes}
              onChange={(e) => setCatalog({ ...catalog, catalog_notes: e.target.value })}
              maxLength={500}
            />
          </Field>
        </div>
        <div className="mt-5 flex justify-end">
          <PrimaryButton onClick={() => void saveCatalog()}>Salvar e agendar follow-up</PrimaryButton>
        </div>
      </Modal>

      <Modal open={statusOpen} onClose={() => setStatusOpen(false)} title="Alterar status do lead">
        <Field label="Nova etapa">
          <SelectInput value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
            <option value="">Selecione</option>
            {LEAD_STATUSES.filter((s) => s !== lead.status).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </SelectInput>
        </Field>
        <div className="mt-5 flex justify-end">
          <PrimaryButton
            onClick={() => {
              if (!newStatus) {
                toast.error("Selecione a nova etapa");
                return;
              }
              void applyStatus(newStatus);
            }}
          >
            Alterar
          </PrimaryButton>
        </div>
      </Modal>

      <Modal
        open={positivarOpen}
        onClose={() => setPositivarOpen(false)}
        title="Positivação do lead"
        wide
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Lead positivado?">
            <SelectInput
              value={positivar.positivado}
              onChange={(e) => setPositivar({ ...positivar, positivado: e.target.value })}
            >
              {POSITIVADO_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Data da positivação">
            <TextInput
              type="date"
              value={positivar.positivado_at}
              onChange={(e) => setPositivar({ ...positivar, positivado_at: e.target.value })}
            />
          </Field>
          <Field label="Marca">
            <TextInput
              value={positivar.positivado_brand}
              onChange={(e) => setPositivar({ ...positivar, positivado_brand: e.target.value })}
              placeholder={brandNames[0] ?? ""}
              maxLength={80}
            />
          </Field>
          <Field label="Nº do pedido">
            <TextInput
              value={positivar.order_number}
              onChange={(e) => setPositivar({ ...positivar, order_number: e.target.value })}
              maxLength={40}
            />
          </Field>
          <Field label="Valor estimado">
            <MoneyInput
              value={positivar.estimated_value}
              onValueChange={(val) => setPositivar({ ...positivar, estimated_value: val })}
            />
          </Field>
          <Field label="Valor efetivo">
            <MoneyInput
              value={positivar.effective_value}
              onValueChange={(val) => setPositivar({ ...positivar, effective_value: val })}
            />
          </Field>
          <Field label="Observações" className="sm:col-span-2">
            <TextArea
              value={positivar.positivado_notes}
              onChange={(e) => setPositivar({ ...positivar, positivado_notes: e.target.value })}
              maxLength={500}
            />
          </Field>
        </div>
        <div className="mt-5 flex justify-end">
          <PrimaryButton onClick={() => void savePositivacao()}>Salvar positivação</PrimaryButton>
        </div>
      </Modal>

      <Modal
        open={lossOpen}
        onClose={() => setLossOpen(false)}
        title={loss.to === "Não quis" ? "Cliente não quis" : "Marcar como perdido"}
      >
        <div className="space-y-3">
          <Field label="Motivo da recusa *">
            <SelectInput
              value={loss.reason}
              onChange={(e) => setLoss({ ...loss, reason: e.target.value })}
            >
              <option value="">Selecione</option>
              {reasons.map((r) => (
                <option key={r.id} value={r.name}>
                  {r.name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Observação da recusa">
            <TextArea
              value={loss.notes}
              onChange={(e) => setLoss({ ...loss, notes: e.target.value })}
              maxLength={1000}
            />
          </Field>
        </div>
        <div className="mt-5 flex justify-end">
          <PrimaryButton onClick={() => void saveLoss()}>Salvar</PrimaryButton>
        </div>
      </Modal>
    </AppShell>
  );
}

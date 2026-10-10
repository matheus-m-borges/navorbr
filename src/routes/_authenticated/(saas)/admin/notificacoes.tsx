import { createFileRoute } from "@tanstack/react-router";
import { GlassCard } from "@/components/navor-rephub/ui";
import { Bell, Mail, AlertCircle, CheckCircle2, Clock, RefreshCw, FileText } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/(saas)/admin/notificacoes")({
  component: AdminNotificacoes,
});

const getOutboxStatsFn = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count: pending } = await supabaseAdmin
    .from("notification_outbox")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");
  const { count: failed } = await supabaseAdmin
    .from("notification_outbox")
    .select("*", { count: "exact", head: true })
    .eq("status", "failed");
  const { count: sent } = await supabaseAdmin
    .from("notification_outbox")
    .select("*", { count: "exact", head: true })
    .eq("status", "sent");
  return {
    pending: pending ?? 0,
    failed: failed ?? 0,
    sent: sent ?? 0,
  };
});

const listTemplatesFn = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("notification_templates")
    .select("*")
    .order("category", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
});

const retryFailedFn = createServerFn({ method: "POST" })
  .validator(z.object({ outboxId: z.string() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("notification_outbox")
      .update({ status: "pending", retry_count: 0, last_error: null })
      .eq("id", data.outboxId);
    if (error) throw new Error(error.message);
    return { success: true };
  });

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; icon: typeof CheckCircle2; className: string }> = {
    pending: { label: "Pendente", icon: Clock, className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
    processing: { label: "Processando", icon: RefreshCw, className: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
    sent: { label: "Enviado", icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
    failed: { label: "Falha", icon: AlertCircle, className: "bg-red-500/10 text-red-600 border-red-500/20" },
    dead_letter: { label: "Dead Letter", icon: AlertCircle, className: "bg-slate-500/10 text-slate-500 border-slate-500/20" },
  };
  const config = map[status] ?? map.pending;
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${config.className}`}>
      <Icon className="size-3" />
      {config.label}
    </span>
  );
}

function AdminNotificacoes() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"overview" | "templates">("overview");

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ["admin_notification_stats"],
    queryFn: () => getOutboxStatsFn(),
    refetchInterval: 30000,
  });

  const { data: templates, isLoading: loadingTemplates } = useQuery({
    queryKey: ["admin_notification_templates"],
    queryFn: () => listTemplatesFn(),
  });

  const retryMutation = useMutation({
    mutationFn: (outboxId: string) => retryFailedFn({ data: { outboxId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_notification_stats"] });
      toast.success("Notificação reenviada para fila");
    },
    onError: () => toast.error("Erro ao reenviar notificação"),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-card-foreground flex items-center gap-2">
            <Bell className="size-6 text-blue-500" />
            Central de Notificações
          </h2>
          <p className="text-sm text-muted-foreground">
            Gerencie templates, filas de entrega e monitore comunicações transacionais.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("overview")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === "overview"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-muted-foreground hover:bg-accent"
            }`}
          >
            Visão Geral
          </button>
          <button
            onClick={() => setActiveTab("templates")}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              activeTab === "templates"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-muted-foreground hover:bg-accent"
            }`}
          >
            Templates
          </button>
        </div>
      </div>

      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <GlassCard className="p-5 border-amber-500/20">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-amber-500/10 p-2.5 text-amber-600">
                  <Clock className="size-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Pendentes</p>
                  <p className="text-2xl font-bold text-card-foreground">
                    {loadingStats ? "..." : stats?.pending ?? 0}
                  </p>
                </div>
              </div>
            </GlassCard>
            <GlassCard className="p-5 border-emerald-500/20">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-emerald-500/10 p-2.5 text-emerald-600">
                  <CheckCircle2 className="size-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Enviados</p>
                  <p className="text-2xl font-bold text-card-foreground">
                    {loadingStats ? "..." : stats?.sent ?? 0}
                  </p>
                </div>
              </div>
            </GlassCard>
            <GlassCard className="p-5 border-red-500/20">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-red-500/10 p-2.5 text-red-600">
                  <AlertCircle className="size-5" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Com Falha</p>
                  <p className="text-2xl font-bold text-card-foreground">
                    {loadingStats ? "..." : stats?.failed ?? 0}
                  </p>
                </div>
              </div>
            </GlassCard>
          </div>

          <GlassCard className="p-6">
            <h3 className="mb-4 text-lg font-semibold text-card-foreground flex items-center gap-2">
              <Mail className="size-5 text-blue-500" />
              Fila Transacional (Outbox)
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              O padrão Transactional Outbox garante que notificações sejam persistidas atomicamente
              com eventos de negócio. Mensagens pendentes são processadas automaticamente pelo worker
              com retry exponencial e dead-letter após 5 tentativas.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              <div className="rounded-lg border border-border p-3">
                <p className="font-semibold text-card-foreground">Canais Suportados</p>
                <p className="text-muted-foreground mt-1">E-mail, In-App, SMS, WhatsApp</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="font-semibold text-card-foreground">Política de Retry</p>
                <p className="text-muted-foreground mt-1">Backoff exponencial, máx. 5 tentativas</p>
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      {activeTab === "templates" && (
        <div className="space-y-4">
          {loadingTemplates ? (
            <div className="p-8 text-center text-muted-foreground">Carregando templates...</div>
          ) : !templates || templates.length === 0 ? (
            <GlassCard className="p-8 text-center">
              <FileText className="mx-auto mb-3 size-10 text-muted-foreground" />
              <h3 className="text-lg font-semibold text-card-foreground">Nenhum template encontrado</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Templates serão criados via migration ou interface administrativa.
              </p>
            </GlassCard>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {templates.map((template: any) => (
                <GlassCard key={template.id} className="p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-card-foreground">{template.name}</h3>
                      <p className="text-xs font-mono text-muted-foreground">{template.slug}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                      template.channel === "email"
                        ? "bg-blue-500/10 text-blue-600"
                        : template.channel === "in_app"
                        ? "bg-purple-500/10 text-purple-600"
                        : "bg-slate-500/10 text-slate-600"
                    }`}>
                      {template.channel}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <span className={`rounded px-1.5 py-0.5 text-[9px] font-medium ${
                      template.category === "transactional"
                        ? "bg-emerald-500/10 text-emerald-600"
                        : template.category === "alert"
                        ? "bg-amber-500/10 text-amber-600"
                        : template.category === "system"
                        ? "bg-slate-500/10 text-slate-600"
                        : "bg-purple-500/10 text-purple-600"
                    }`}>
                      {template.category}
                    </span>
                    <span className="rounded bg-accent px-1.5 py-0.5 text-[9px] font-medium text-accent-foreground">
                      v{template.version}
                    </span>
                  </div>
                  {(template.variables as string[])?.length > 0 && (
                    <div className="pt-2 border-t border-border">
                      <p className="text-[10px] text-muted-foreground mb-1">Variáveis:</p>
                      <div className="flex flex-wrap gap-1">
                        {(template.variables as string[]).slice(0, 5).map((v: string) => (
                          <code key={v} className="rounded bg-muted px-1 py-0.5 text-[9px] text-muted-foreground">
                            {`{{${v}}}`}
                          </code>
                        ))}
                        {(template.variables as string[]).length > 5 && (
                          <span className="text-[9px] text-muted-foreground">
                            +{(template.variables as string[]).length - 5}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </GlassCard>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


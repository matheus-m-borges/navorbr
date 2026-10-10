import { createFileRoute } from "@tanstack/react-router";
import { GlassCard } from "@/components/navor-rephub/ui";
import { Key, ShieldCheck, AlertCircle, CheckCircle2, RefreshCw, Settings } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/(saas)/admin/integracoes")({
  component: AdminIntegracoes,
});

const listProvidersFn = createServerFn({ method: "GET" }).handler(async () => {
  const { listProviders } = await import("@/lib/integrations/integration-service");
  return listProviders();
});

const listConfigsFn = createServerFn({ method: "GET" }).handler(async () => {
  const { listConfigs } = await import("@/lib/integrations/integration-service");
  return listConfigs({ isAdmin: true });
});

const verifyIntegrationFn = createServerFn({ method: "POST" })
  .validator(z.object({ configId: z.string() }))
  .handler(async ({ data }) => {
    const { verifyIntegration } = await import("@/lib/integrations/integration-service");
    return verifyIntegration(data.configId);
  });

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; icon: typeof CheckCircle2; className: string }> = {
    CONNECTED: { label: "Conectado", icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
    CONFIGURED: { label: "Configurado", icon: Settings, className: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
    NOT_CONFIGURED: { label: "Não Configurado", icon: AlertCircle, className: "bg-slate-500/10 text-slate-500 border-slate-500/20" },
    ERROR: { label: "Erro", icon: AlertCircle, className: "bg-red-500/10 text-red-600 border-red-500/20" },
    DEGRADED: { label: "Degradado", icon: AlertCircle, className: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
    DISABLED: { label: "Desabilitado", icon: AlertCircle, className: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
  };
  const config = map[status] ?? map.NOT_CONFIGURED;
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${config.className}`}>
      <Icon className="size-3" />
      {config.label}
    </span>
  );
}

function AdminIntegracoes() {
  const queryClient = useQueryClient();
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const { data: providers, isLoading: loadingProviders } = useQuery({
    queryKey: ["admin_integration_providers"],
    queryFn: () => listProvidersFn(),
  });

  const { data: configs, isLoading: loadingConfigs } = useQuery({
    queryKey: ["admin_integration_configs"],
    queryFn: () => listConfigsFn(),
  });

  const verifyMutation = useMutation({
    mutationFn: (configId: string) => verifyIntegrationFn({ data: { configId } }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["admin_integration_configs"] });
      if (result.success) {
        toast.success("Integração verificada com sucesso");
      } else {
        toast.error(result.error ?? "Falha na verificação");
      }
    },
    onError: () => toast.error("Erro ao verificar integração"),
    onSettled: () => setVerifyingId(null),
  });

  const configsByProvider = new Map<string, typeof configs>();
  configs?.forEach((c) => {
    const key = c.providers?.slug ?? c.provider_id;
    if (!configsByProvider.has(key)) configsByProvider.set(key, []);
    configsByProvider.get(key)!.push(c);
  });

  if (loadingProviders || loadingConfigs) {
    return <div className="p-8 text-center text-muted-foreground">Carregando integrações...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-card-foreground flex items-center gap-2">
          <Key className="size-6 text-blue-500" />
          Central de Integrações
        </h2>
        <p className="text-sm text-muted-foreground">
          Gerencie provedores de pagamento, e-mail, WhatsApp e outras integrações da plataforma.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {providers?.map((provider) => {
          const providerConfigs = configsByProvider.get(provider.slug) ?? [];
          const activeConfig = providerConfigs.find((c) => c.is_enabled) ?? providerConfigs[0];

          return (
            <GlassCard key={provider.id} className="p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-card-foreground">{provider.name}</h3>
                  <p className="text-xs text-muted-foreground capitalize">{provider.category}</p>
                </div>
                {activeConfig && <StatusBadge status={activeConfig.status} />}
              </div>

              <p className="text-xs text-muted-foreground line-clamp-2">
                {provider.description ?? "Sem descrição"}
              </p>

              <div className="flex flex-wrap gap-1 pt-1">
                {provider.capabilities.slice(0, 4).map((cap) => (
                  <span key={cap} className="rounded bg-accent px-1.5 py-0.5 text-[9px] font-medium text-accent-foreground">
                    {cap}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-border">
                {activeConfig ? (
                  <button
                    onClick={() => {
                      setVerifyingId(activeConfig.id);
                      verifyMutation.mutate(activeConfig.id);
                    }}
                    disabled={verifyingId === activeConfig.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent transition disabled:opacity-50"
                  >
                    <RefreshCw className={`size-3 ${verifyingId === activeConfig.id ? "animate-spin" : ""}`} />
                    {verifyingId === activeConfig.id ? "Verificando..." : "Testar Conexão"}
                  </button>
                ) : (
                  <span className="text-xs text-muted-foreground italic">Não configurado</span>
                )}
                <ShieldCheck className="ml-auto size-3.5 text-emerald-500" title="Segredos protegidos via Vault" />
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}


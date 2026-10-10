import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type DashboardData = {
  active: number;
  beta: number;
  trial: number;
  past_due: number;
  suspended: number;
  provisioning_failed: number;
  onboarding_incomplete: number;
};

export const Route = createFileRoute("/_authenticated/(saas)/admin/dashboard-comercial")({
  component: DashboardComercialPage,
});

function DashboardComercialPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data: result, error } = await (supabase as any).rpc("get_provisioning_dashboard");
        if (error) throw error;
        setData(result as DashboardData);
      } catch (e: any) {
        toast.error("Falha ao carregar dashboard comercial");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Carregando indicadores...</div>;
  if (!data) return <div className="p-6 text-sm text-destructive">Não foi possível carregar os dados.</div>;

  const cards = [
    { label: "Ativos", value: data.active, color: "text-emerald-600" },
    { label: "Em Beta", value: data.beta, color: "text-blue-600" },
    { label: "Em Trial", value: data.trial, color: "text-cyan-600" },
    { label: "Vencidos", value: data.past_due, color: "text-amber-600" },
    { label: "Suspensos", value: data.suspended, color: "text-red-600" },
    { label: "Provisioning Falhou", value: data.provisioning_failed, color: "text-rose-600" },
    { label: "Onboarding Incompleto", value: data.onboarding_incomplete, color: "text-orange-600" },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Dashboard Comercial</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border bg-card p-4 space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{c.label}</p>
            <p className={"text-2xl font-bold " + c.color}>{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

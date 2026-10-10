import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { serverGetOnboardingDashboard } from "@/core/onboarding/onboarding-service";

export const Route = createFileRoute("/_authenticated/admin/onboarding")({
  component: AdminOnboardingPage,
});

interface OnboardingMetrics {
  not_started: number;
  in_progress: number;
  completed: number;
  blocked: number;
  failed: number;
  stale: number;
  total_accounts: number;
}

function AdminOnboardingPage() {
  const [metrics, setMetrics] = useState<OnboardingMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const result = await serverGetOnboardingDashboard();
        if (!result.ok) {
          setError(result.message || "Falha ao carregar métricas");
        } else {
          setMetrics(result.metrics as OnboardingMetrics);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro desconhecido");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-slate-500">Carregando métricas de onboarding...</p>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          <h2 className="font-semibold">Acesso negado ou erro</h2>
          <p className="mt-1 text-sm">{error || "Métricas não disponíveis."}</p>
        </div>
      </div>
    );
  }

  const cards = [
    { label: "Não iniciados", value: metrics.not_started, color: "bg-slate-100 text-slate-700" },
    { label: "Em progresso", value: metrics.in_progress, color: "bg-blue-50 text-blue-700" },
    { label: "Concluídos", value: metrics.completed, color: "bg-emerald-50 text-emerald-700" },
    { label: "Bloqueados", value: metrics.blocked, color: "bg-amber-50 text-amber-700" },
    { label: "Com falha", value: metrics.failed, color: "bg-red-50 text-red-700" },
    { label: "Abandonados (7d+)", value: metrics.stale, color: "bg-orange-50 text-orange-700" },
  ];

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Onboarding — Visão Comercial</h1>
        <p className="mt-1 text-sm text-slate-500">
          Métricas factuais de progresso das contas. Total de contas ativas: {metrics.total_accounts}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className={`rounded-xl p-5 ${card.color}`}>
            <p className="text-sm font-medium opacity-80">{card.label}</p>
            <p className="mt-2 text-3xl font-bold">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Notas operacionais</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-600">
          <li>• Contas abandonadas são aquelas em progresso sem atividade há mais de 7 dias.</li>
          <li>• O admin não pode concluir onboarding em nome do cliente (§43).</li>
          <li>• Dados sensíveis do tenant não são expostos nesta visão (§40).</li>
          <li>• Para reenviar acesso ou auxiliar suporte, use os canais oficiais de first-access.</li>
        </ul>
      </div>
    </div>
  );
}


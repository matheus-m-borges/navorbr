import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { serverGetOnboardingState } from "@/core/onboarding/onboarding-service";

export const Route = createFileRoute("/_authenticated/minha-conta/onboarding")({
  component: ClientOnboardingView,
});

function ClientOnboardingView() {
  const navigate = useNavigate();
  const [state, setState] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const result = await serverGetOnboardingState();
        if (!result.ok) {
          setError(result.message || "Falha ao carregar status");
        } else {
          setState(result.state);
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
      <div className="flex min-h-[300px] items-center justify-center">
        <p className="text-slate-500">Carregando status do onboarding...</p>
      </div>
    );
  }

  if (error || !state) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          <h2 className="font-semibold">Erro</h2>
          <p className="mt-1 text-sm">{error || "Status não disponível."}</p>
        </div>
      </div>
    );
  }

  const coreStatus = state.core?.status || "not_started";
  const isCompleted = coreStatus === "completed";
  const isInProgress = coreStatus === "in_progress";
  const currentStep = state.core?.current_step || null;
  const completedAt = state.core?.completed_at || null;

  const statusLabels: Record<string, string> = {
    not_started: "Não iniciado",
    in_progress: "Em progresso",
    completed: "Concluído",
    blocked: "Bloqueado",
    failed: "Com falha",
  };

  const statusColors: Record<string, string> = {
    not_started: "bg-slate-100 text-slate-700",
    in_progress: "bg-blue-50 text-blue-700",
    completed: "bg-emerald-50 text-emerald-700",
    blocked: "bg-amber-50 text-amber-700",
    failed: "bg-red-50 text-red-700",
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Meu Onboarding</h1>
        <p className="mt-1 text-sm text-slate-500">
          Acompanhe o progresso da configuração da sua conta.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Status atual</p>
            <span className={`mt-1 inline-block rounded-full px-3 py-1 text-sm font-semibold ${statusColors[coreStatus] || statusColors.not_started}`}>
              {statusLabels[coreStatus] || coreStatus}
            </span>
          </div>
          {isCompleted && completedAt && (
            <div className="text-right">
              <p className="text-sm font-medium text-slate-500">Concluído em</p>
              <p className="text-sm text-slate-900">
                {new Date(completedAt).toLocaleDateString("pt-BR")}
              </p>
            </div>
          )}
        </div>

        {isInProgress && currentStep && (
          <div className="mt-6 rounded-lg bg-blue-50 p-4">
            <p className="text-sm font-medium text-blue-800">
              Etapa atual: {currentStep.replace(/_/g, " ")}
            </p>
            <p className="mt-1 text-xs text-blue-600">
              Seu progresso é salvo automaticamente. Você pode continuar de onde parou.
            </p>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          {!isCompleted && (
            <button
              onClick={() => navigate({ to: "/onboarding" })}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              {isInProgress ? "Continuar onboarding" : "Iniciar onboarding"}
            </button>
          )}
          {isCompleted && (
            <button
              onClick={() => navigate({ to: "/dashboard" })}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Ir para o dashboard
            </button>
          )}
        </div>
      </div>

      {state.company && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Dados da empresa</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            {state.company.trade_name && (
              <div>
                <dt className="text-xs font-medium text-slate-500">Nome fantasia</dt>
                <dd className="text-sm text-slate-900">{state.company.trade_name}</dd>
              </div>
            )}
            {state.company.timezone && (
              <div>
                <dt className="text-xs font-medium text-slate-500">Fuso horário</dt>
                <dd className="text-sm text-slate-900">{state.company.timezone}</dd>
              </div>
            )}
            {state.company.owner_name && (
              <div>
                <dt className="text-xs font-medium text-slate-500">Responsável</dt>
                <dd className="text-sm text-slate-900">{state.company.owner_name}</dd>
              </div>
            )}
          </dl>
        </div>
      )}
    </div>
  );
}


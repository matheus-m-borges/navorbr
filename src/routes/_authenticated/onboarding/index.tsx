import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { serverGetOnboardingState, type OnboardingStatus } from "@/core/onboarding/onboarding-service";

export const Route = createFileRoute("/_authenticated/onboarding/")({
  component: OnboardingFlow,
});

const STEPS = [
  { id: "welcome", label: "Boas-vindas" },
  { id: "company_profile", label: "Empresa" },
  { id: "owner_confirmation", label: "Responsável" },
  { id: "preferences", label: "Preferências" },
  { id: "team_invites", label: "Equipe" },
  { id: "product", label: "Produto" },
  { id: "review", label: "Revisão" },
  { id: "conclusion", label: "Conclusão" },
] as const;

function OnboardingFlow() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<string>("welcome");
  const [status, setStatus] = useState<OnboardingStatus>("NOT_STARTED");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadState() {
      try {
        const state = await serverGetOnboardingState();
        setStatus(state.status);
        
        if (state.status === "COMPLETED") {
          navigate({ to: "/dashboard" });
          return;
        }
        
        if (state.current_step && STEPS.find(s => s.id === state.current_step)) {
          setCurrentStep(state.current_step);
        }
      } catch (error) {
        console.error("Failed to load onboarding state:", error);
      } finally {
        setLoading(false);
      }
    }
    loadState();
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-slate-600">Carregando...</div>
      </div>
    );
  }

  const currentIndex = STEPS.findIndex(s => s.id === currentStep);
  const progress = Math.round(((currentIndex + 1) / STEPS.length) * 100);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="mb-2 flex justify-between text-sm text-slate-600">
            <span>Passo {currentIndex + 1} de {STEPS.length}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-200">
            <div
              className="h-2 rounded-full bg-emerald-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Step Content Container */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {currentStep === "welcome" && (
            <WelcomeStep onNext={() => setCurrentStep("company_profile")} />
          )}
          {currentStep === "company_profile" && (
            <CompanyStep
              onNext={() => setCurrentStep("owner_confirmation")}
              onBack={() => setCurrentStep("welcome")}
            />
          )}
          {currentStep === "owner_confirmation" && (
            <OwnerStep
              onNext={() => setCurrentStep("preferences")}
              onBack={() => setCurrentStep("company_profile")}
            />
          )}
          {currentStep === "preferences" && (
            <PreferencesStep
              onNext={() => setCurrentStep("team_invites")}
              onBack={() => setCurrentStep("owner_confirmation")}
            />
          )}
          {currentStep === "team_invites" && (
            <TeamStep
              onNext={() => setCurrentStep("product")}
              onBack={() => setCurrentStep("preferences")}
              optional
            />
          )}
          {currentStep === "product" && (
            <ProductStep
              onNext={() => setCurrentStep("review")}
              onBack={() => setCurrentStep("team_invites")}
            />
          )}
          {currentStep === "review" && (
            <ReviewStep
              onNext={() => setCurrentStep("conclusion")}
              onBack={() => setCurrentStep("product")}
            />
          )}
          {currentStep === "conclusion" && (
            <ConclusionStep onComplete={() => navigate({ to: "/dashboard" })} />
          )}
        </div>
      </div>
    </div>
  );
}

// --- STEP COMPONENTS (Placeholders for brevity - full implementation would include forms) ---

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Bem-vindo à NAVOR</h1>
        <p className="mt-2 text-slate-600">
          Vamos configurar sua conta em poucos passos. Isso garante que você tenha
          a melhor experiência desde o início.
        </p>
      </div>
      <button
        onClick={onNext}
        className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
      >
        Começar configuração
      </button>
    </div>
  );
}

function CompanyStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-900">Dados da empresa</h2>
      <div className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-slate-700">Nome fantasia *</span>
          <input type="text" className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-slate-700">CNPJ/CPF (opcional)</span>
          <input type="text" className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
        </label>
      </div>
      <div className="flex gap-3 pt-4">
        <button onClick={onBack} className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Voltar</button>
        <button onClick={onNext} className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Continuar</button>
      </div>
    </div>
  );
}

function OwnerStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-900">Responsável pela conta</h2>
      <p className="text-sm text-slate-600">Confirme os dados do responsável legal.</p>
      <div className="flex gap-3 pt-4">
        <button onClick={onBack} className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Voltar</button>
        <button onClick={onNext} className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Confirmar</button>
      </div>
    </div>
  );
}

function PreferencesStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-900">Preferências gerais</h2>
      <label className="block">
        <span className="text-sm font-medium text-slate-700">Fuso horário *</span>
        <select className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500">
          <option value="America/Sao_Paulo">Brasília (GMT-3)</option>
          <option value="America/Manaus">Manaus (GMT-4)</option>
          <option value="America/Noronha">Fernando de Noronha (GMT-2)</option>
        </select>
      </label>
      <div className="flex gap-3 pt-4">
        <button onClick={onBack} className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Voltar</button>
        <button onClick={onNext} className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Salvar</button>
      </div>
    </div>
  );
}

function TeamStep({ onNext, onBack, optional }: { onNext: () => void; onBack: () => void; optional?: boolean }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">Convidar equipe</h2>
        {optional && <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">Opcional</span>}
      </div>
      <p className="text-sm text-slate-600">Você pode convidar colaboradores agora ou fazer isso depois.</p>
      <div className="flex gap-3 pt-4">
        <button onClick={onBack} className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Voltar</button>
        <button onClick={onNext} className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Pular por enquanto</button>
        <button onClick={onNext} className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Convidar</button>
      </div>
    </div>
  );
}

function ProductStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-900">Configuração do produto</h2>
      <p className="text-sm text-slate-600">Este produto não possui configuração específica obrigatória no momento.</p>
      <div className="flex gap-3 pt-4">
        <button onClick={onBack} className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Voltar</button>
        <button onClick={onNext} className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Continuar</button>
      </div>
    </div>
  );
}

function ReviewStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-slate-900">Revisão final</h2>
      <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
        <p>Revise todas as informações antes de concluir.</p>
      </div>
      <div className="flex gap-3 pt-4">
        <button onClick={onBack} className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Voltar</button>
        <button onClick={onNext} className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Concluir setup</button>
      </div>
    </div>
  );
}

function ConclusionStep({ onComplete }: { onComplete: () => void }) {
  return (
    <div className="space-y-6 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
        <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-slate-900">Tudo pronto!</h2>
      <p className="text-slate-600">Sua conta foi configurada com sucesso. Você será redirecionado para o dashboard.</p>
      <button
        onClick={onComplete}
        className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
      >
        Ir para o dashboard
      </button>
    </div>
  );
}



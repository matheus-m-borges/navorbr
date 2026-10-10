import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  serverGetOnboardingState,
  serverUpdateOnboardingProgress,
  serverUpsertCompanyProfile,
  serverCompleteOnboarding,
} from "@/core/onboarding/onboarding-service";

type OnboardingStatus = "not_started" | "in_progress" | "completed" | "blocked" | "failed";

interface CompanyProfileData {
  trade_name?: string;
  legal_name?: string;
  document?: string;
  commercial_phone?: string;
  commercial_email?: string;
  address_line1?: string;
  address_line2?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  timezone?: string;
  logo_url?: string;
  owner_user_id?: string;
  owner_name?: string;
  owner_email?: string;
  owner_phone?: string;
  preferences?: Record<string, unknown>;
}

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: OnboardingPage,
});

const CORE_STEPS = [
  { id: "welcome", label: "Boas-vindas" },
  { id: "company", label: "Empresa" },
  { id: "owner", label: "Responsável" },
  { id: "preferences", label: "Preferências" },
  { id: "team", label: "Equipe" },
  { id: "product", label: "Produto" },
  { id: "review", label: "Revisão" },
  { id: "conclusion", label: "Conclusão" },
] as const;

type StepId = (typeof CORE_STEPS)[number]["id"];

function OnboardingPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState<StepId>("welcome");
  const [status, setStatus] = useState<OnboardingStatus>("not_started");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [profile, setProfile] = useState<CompanyProfileData>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await serverGetOnboardingState();
        if (!res.ok) throw new Error(res.message || "Falha ao carregar onboarding.");
        if (cancelled) return;
        setCompanyId(res.accountId ?? null);
        const core = (res.state?.core ?? {}) as Record<string, unknown>;
        const company = (res.state?.company ?? {}) as CompanyProfileData;
        const st = (core.status as OnboardingStatus) || "not_started";
        setStatus(st);
        setProfile(company);
        if (st === "completed") {
          navigate({ to: "/dashboard" });
          return;
        }
        const step = (core.current_step as StepId) || "welcome";
        setCurrentStep(step);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Erro inesperado.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function persistStep(nextStep: StepId, nextStatus?: OnboardingStatus) {
    setSaving(true);
    setError(null);
    try {
      const res = await serverUpdateOnboardingProgress({
        current_step: nextStep,
        status: nextStatus ?? (nextStep === "welcome" && status === "not_started" ? "in_progress" : undefined),
      });
      if (!res.ok) throw new Error(res.message || "Não foi possível salvar progresso.");
      setCurrentStep(nextStep);
      if (nextStatus) setStatus(nextStatus);
    } catch (err: any) {
      setError(err?.message || "Erro ao salvar progresso.");
    } finally {
      setSaving(false);
    }
  }

  async function saveCompany(data: CompanyProfileData) {
    setSaving(true);
    setError(null);
    try {
      const res = await serverUpsertCompanyProfile(data);
      if (!res.ok) throw new Error(res.message || "Não foi possível salvar dados da empresa.");
      setProfile((prev) => ({ ...prev, ...data }));
      await persistStep("owner");
    } catch (err: any) {
      setError(err?.message || "Erro ao salvar empresa.");
    } finally {
      setSaving(false);
    }
  }

  async function complete() {
    setSaving(true);
    setError(null);
    try {
      const res = await serverCompleteOnboarding();
      if (!res.ok) throw new Error(res.message || "Não foi possível concluir onboarding.");
      setStatus("completed");
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      setError(err?.message || "Erro ao concluir onboarding.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-sm text-muted-foreground">Carregando onboarding…</div>;
  }

  const stepIndex = CORE_STEPS.findIndex((s) => s.id === currentStep);
  const progress = Math.max(1, stepIndex + 1);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Onboarding NAVOR</h1>
        <p className="text-sm text-muted-foreground">
          Passo {progress} de {CORE_STEPS.length} — {CORE_STEPS[stepIndex]?.label}
        </p>
        <div className="h-2 w-full rounded-full bg-muted">
          <div
            className="h-2 rounded-full bg-primary transition-all"
            style={{ width: `${(progress / CORE_STEPS.length) * 100}%` }}
          />
        </div>
      </header>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <main className="rounded-xl border bg-card p-6 shadow-sm">
        {currentStep === "welcome" && (
          <WelcomeStep onStart={() => persistStep("company", "in_progress")} saving={saving} />
        )}
        {currentStep === "company" && (
          <CompanyStep
            profile={profile}
            saving={saving}
            onSave={saveCompany}
            onBack={() => persistStep("welcome")}
          />
        )}
        {currentStep === "owner" && (
          <OwnerStep
            profile={profile}
            saving={saving}
            onNext={() => persistStep("preferences")}
            onBack={() => persistStep("company")}
          />
        )}
        {currentStep === "preferences" && (
          <PreferencesStep
            profile={profile}
            saving={saving}
            onNext={() => persistStep("team")}
            onBack={() => persistStep("owner")}
          />
        )}
        {currentStep === "team" && (
          <TeamStep
            saving={saving}
            onNext={() => persistStep("product")}
            onBack={() => persistStep("preferences")}
          />
        )}
        {currentStep === "product" && (
          <ProductStep
            saving={saving}
            onNext={() => persistStep("review")}
            onBack={() => persistStep("team")}
          />
        )}
        {currentStep === "review" && (
          <ReviewStep
            profile={profile}
            saving={saving}
            onComplete={complete}
            onBack={() => persistStep("product")}
          />
        )}
      </main>
    </div>
  );
}

function WelcomeStep(props: { onStart: () => void; saving: boolean }) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Bem-vindo à NAVOR</h2>
      <p className="text-sm text-muted-foreground">
        Vamos configurar sua conta em poucos passos. Você pode parar e retomar a qualquer momento.
      </p>
      <button
        type="button"
        onClick={props.onStart}
        disabled={props.saving}
        className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {props.saving ? "Iniciando…" : "Começar"}
      </button>
    </div>
  );
}

function CompanyStep(props: {
  profile: CompanyProfileData;
  saving: boolean;
  onSave: (data: CompanyProfileData) => void;
  onBack: () => void;
}) {
  const [form, setForm] = useState<CompanyProfileData>({
    trade_name: props.profile.trade_name ?? "",
    legal_name: props.profile.legal_name ?? "",
    document: props.profile.document ?? "",
    commercial_email: props.profile.commercial_email ?? "",
    commercial_phone: props.profile.commercial_phone ?? "",
    timezone: props.profile.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Dados da Empresa</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Nome fantasia *</span>
          <input
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={form.trade_name ?? ""}
            onChange={(e) => setForm({ ...form, trade_name: e.target.value })}
            required
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Razão social</span>
          <input
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={form.legal_name ?? ""}
            onChange={(e) => setForm({ ...form, legal_name: e.target.value })}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">CNPJ / CPF</span>
          <input
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={form.document ?? ""}
            onChange={(e) => setForm({ ...form, document: e.target.value })}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Timezone *</span>
          <input
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={form.timezone ?? ""}
            onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            required
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">E-mail comercial</span>
          <input
            type="email"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={form.commercial_email ?? ""}
            onChange={(e) => setForm({ ...form, commercial_email: e.target.value })}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Telefone comercial</span>
          <input
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={form.commercial_phone ?? ""}
            onChange={(e) => setForm({ ...form, commercial_phone: e.target.value })}
          />
        </label>
      </div>
      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={props.onBack}
          disabled={props.saving}
          className="rounded-md border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
        >
          Voltar
        </button>
        <button
          type="button"
          onClick={() => props.onSave(form)}
          disabled={props.saving || !form.trade_name || !form.timezone}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {props.saving ? "Salvando…" : "Continuar"}
        </button>
      </div>
    </div>
  );
}

function OwnerStep(props: {
  profile: CompanyProfileData;
  saving: boolean;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Responsável da Conta</h2>
      <p className="text-sm text-muted-foreground">
        Confirme os dados do responsável. Alterações aqui não mudam o usuário autenticado.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Nome</span>
          <input
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            defaultValue={props.profile.owner_name ?? ""}
            readOnly
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">E-mail</span>
          <input
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            defaultValue={props.profile.owner_email ?? ""}
            readOnly
          />
        </label>
      </div>
      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={props.onBack}
          disabled={props.saving}
          className="rounded-md border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
        >
          Voltar
        </button>
        <button
          type="button"
          onClick={props.onNext}
          disabled={props.saving}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Confirmar
        </button>
      </div>
    </div>
  );
}

function PreferencesStep(props: {
  profile: CompanyProfileData;
  saving: boolean;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Preferências Gerais</h2>
      <p className="text-sm text-muted-foreground">
        Configure idioma, moeda e notificações. Tudo pode ser ajustado depois.
      </p>
      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={props.onBack}
          disabled={props.saving}
          className="rounded-md border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
        >
          Voltar
        </button>
        <button
          type="button"
          onClick={props.onNext}
          disabled={props.saving}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}

function TeamStep(props: { saving: boolean; onNext: () => void; onBack: () => void }) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Equipe</h2>
      <p className="text-sm text-muted-foreground">
        Convide colaboradores agora ou configure depois pelo painel.
      </p>
      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={props.onBack}
          disabled={props.saving}
          className="rounded-md border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
        >
          Voltar
        </button>
        <button
          type="button"
          onClick={props.onNext}
          disabled={props.saving}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Continuar sem convidar
        </button>
      </div>
    </div>
  );
}

function ProductStep(props: { saving: boolean; onNext: () => void; onBack: () => void }) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Configuração do Produto</h2>
      <p className="text-sm text-muted-foreground">
        Produtos específicos podem ter etapas adicionais. Se não houver configuração, este passo é apenas informativo.
      </p>
      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={props.onBack}
          disabled={props.saving}
          className="rounded-md border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
        >
          Voltar
        </button>
        <button
          type="button"
          onClick={props.onNext}
          disabled={props.saving}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}

function ReviewStep(props: {
  profile: CompanyProfileData;
  saving: boolean;
  onComplete: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Revisão Final</h2>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Empresa</dt>
          <dd className="font-medium">{props.profile.trade_name || "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Timezone</dt>
          <dd className="font-medium">{props.profile.timezone || "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Responsável</dt>
          <dd className="font-medium">{props.profile.owner_name || "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Contato</dt>
          <dd className="font-medium">{props.profile.commercial_email || "—"}</dd>
        </div>
      </dl>
      <div className="flex justify-between pt-2">
        <button
          type="button"
          onClick={props.onBack}
          disabled={props.saving}
          className="rounded-md border px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
        >
          Voltar
        </button>
        <button
          type="button"
          onClick={props.onComplete}
          disabled={props.saving}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {props.saving ? "Concluindo…" : "Concluir Onboarding"}
        </button>
      </div>
    </div>
  );
}


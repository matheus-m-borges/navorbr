import { createFileRoute } from "@tanstack/react-router";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { SiteLayout } from "@/components/navor/PublicSite";
import { ProductIcon } from "@/components/navor/PublicSite";
import { getTrialPlanSummary, initiateFreeTrial } from "@/api/trial-signup";
import {
  Check,
  Zap,
  Shield,
  AlertCircle,
  Loader2,
  ChevronRight,
  ArrowLeft,
  Building2,
  User,
  Mail,
  Phone,
  FileText,
} from "lucide-react";
import { z } from "zod";

export const Route = createFileRoute("/teste-gratis")({
  validateSearch: z.object({
    produto: z.string().max(32).optional(),
    plano: z.string().uuid().optional(),
  }),
  head: () => ({
    meta: [
      { title: "Teste Gratuito | NAVOR" },
      {
        name: "description",
        content: "Inicie seu teste gratuito por 7 dias. Sem cartão de crédito. Cancele quando quiser.",
      },
      { name: "robots", content: "noindex" }, // Não indexar formulários de cadastro
    ],
  }),
  component: TesteGratisPage,
});

// ─────────────────────────────────────────────────────────────────────────────
// ETAPAS DO FLUXO
// ─────────────────────────────────────────────────────────────────────────────
type Step = "validating" | "form" | "review" | "success" | "error" | "invalid";

interface FormData {
  companyName: string;
  responsibleName: string;
  cpfCnpj: string;
  email: string;
  phone: string;
  consentTerms: boolean;
  consentPrivacy: boolean;
  consentData: boolean;
}

const INITIAL_FORM: FormData = {
  companyName: "",
  responsibleName: "",
  cpfCnpj: "",
  email: "",
  phone: "",
  consentTerms: false,
  consentPrivacy: false,
  consentData: false,
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
function TesteGratisPage() {
  // Usa URLSearchParams direto pois o routeTree.gen.ts é regenerado automaticamente durante dev
  const params = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  );
  const productSlug = params.get("produto") ?? undefined;
  const planId = params.get("plano") ?? undefined;
  const [step, setStep] = useState<Step>("validating");
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{ productSlug: string; planName: string } | null>(null);

  // BUSCA DADOS DO PLANO NO BACKEND — nunca confia na URL para preço
  const { data: planSummary, isLoading: loadingPlan, isError: planError } = useQuery({
    queryKey: ["trial_plan_summary", productSlug, planId],
    queryFn: () =>
      productSlug && planId
        ? getTrialPlanSummary({ data: { productSlug, planId } })
        : null,
    enabled: Boolean(productSlug && planId),
    staleTime: 1000 * 60 * 5,
  });

  // Atualiza o step quando o planSummary chega
  useEffect(() => {
    if (!loadingPlan && step === "validating") {
      setStep(planSummary ? "form" : "invalid");
    }
  }, [loadingPlan, planSummary, step]);

  // SUBMISSÃO
  const mutation = useMutation({
    mutationFn: () =>
      initiateFreeTrial({
        data: {
          productSlug: productSlug!,
          planId: planId!,
          companyName: form.companyName,
          responsibleName: form.responsibleName,
          cpfCnpj: form.cpfCnpj.replace(/\D/g, ""),
          email: form.email.trim().toLowerCase(),
          phone: form.phone,
          consentGiven: form.consentTerms && form.consentPrivacy && form.consentData,
          consentTimestamp: new Date().toISOString(),
        },
      }),
    onSuccess: (result) => {
      if (result.success) {
        setSuccessData({
          productSlug: result.productSlug ?? productSlug ?? "",
          planName: result.planName ?? "",
        });
        setStep("success");
      } else {
        setSubmitError(result.message);
      }
    },
    onError: () => {
      setSubmitError("Ocorreu um erro inesperado. Tente novamente em instantes.");
    },
  });

  // VALIDAÇÃO DO FORMULÁRIO
  function validateForm(): boolean {
    const errors: Partial<Record<keyof FormData, string>> = {};
    if (!form.companyName.trim()) errors.companyName = "Informe o nome da empresa";
    if (!form.responsibleName.trim()) errors.responsibleName = "Informe o nome do responsável";
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errors.email = "E-mail inválido";
    }
    if (!form.phone.trim()) errors.phone = "Informe o telefone";
    const doc = form.cpfCnpj.replace(/\D/g, "");
    if (doc.length !== 11 && doc.length !== 14) errors.cpfCnpj = "CPF ou CNPJ inválido";
    if (!form.consentTerms) errors.consentTerms = "Necessário aceitar os Termos de Uso";
    if (!form.consentPrivacy) errors.consentPrivacy = "Necessário aceitar a Política de Privacidade";
    if (!form.consentData) errors.consentData = "Necessário autorizar o tratamento de dados";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleFieldChange(field: keyof FormData, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (step === "form") {
      if (validateForm()) setStep("review");
      return;
    }
    if (step === "review") {
      mutation.mutate();
    }
  }

  // ─── RENDER ───────────────────────────────────────────────────────────────

  if (!productSlug || !planId) {
    return (
      <SiteLayout>
        <InvalidTrialPage reason="Produto ou plano não informado. Acesse a vitrine de soluções e selecione um plano." />
      </SiteLayout>
    );
  }

  if (loadingPlan || step === "validating") {
    return (
      <SiteLayout>
        <div className="nv-trial-container">
          <div className="nv-trial-loading">
            <Loader2 size={32} className="nv-spin" />
            <p>Verificando disponibilidade do plano…</p>
          </div>
        </div>
      </SiteLayout>
    );
  }

  if (planError || step === "invalid" || !planSummary) {
    return (
      <SiteLayout>
        <InvalidTrialPage reason="Este plano não está disponível para teste gratuito ou não existe." />
      </SiteLayout>
    );
  }

  if (step === "success" && successData) {
    return (
      <SiteLayout>
        <SuccessPage
          productSlug={successData.productSlug}
          planName={successData.planName}
          email={form.email}
        />
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <div className="nv-trial-container">
        {/* BREADCRUMB */}
        <a href="/produtos" className="nv-back">
          <ArrowLeft size={16} /> Voltar para as soluções
        </a>

        {/* CABEÇALHO */}
        <div className="nv-trial-header">
          <div className="nv-trial-product-icon">
            <ProductIcon slug={planSummary.product.slug} />
          </div>
          <div>
            <h1 className="nv-trial-title">
              Comece grátis com o{" "}
              <span className="nv-trial-highlight">
                {planSummary.product.name.replace("Navor ", "")}
              </span>
            </h1>
            <p className="nv-trial-subtitle">
              {planSummary.plan.trialDays} dias gratuitos — sem cartão de crédito
            </p>
          </div>
        </div>

        {/* STEPS INDICATOR */}
        <div className="nv-trial-steps" aria-label="Progresso do cadastro">
          {["Dados da empresa", "Revisão"].map((label, i) => (
            <div
              key={label}
              className={`nv-trial-step ${
                step === "form" && i === 0
                  ? "nv-trial-step--active"
                  : step === "review" && i === 1
                  ? "nv-trial-step--active"
                  : i < (step === "review" ? 1 : 0)
                  ? "nv-trial-step--done"
                  : ""
              }`}
            >
              <span className="nv-trial-step-num">
                {i < (step === "review" ? 1 : 0) ? <Check size={14} /> : i + 1}
              </span>
              <span>{label}</span>
            </div>
          ))}
        </div>

        <div className="nv-trial-layout">
          {/* FORMULÁRIO / REVISÃO */}
          <form id="form-trial-gratis" onSubmit={handleSubmit} className="nv-trial-form" noValidate>
            {step === "form" && (
              <FormStep
                form={form}
                errors={fieldErrors}
                onChange={handleFieldChange}
              />
            )}
            {step === "review" && (
              <ReviewStep
                form={form}
                planSummary={planSummary}
                onBack={() => setStep("form")}
              />
            )}

            {submitError && (
              <div className="nv-trial-error" role="alert">
                <AlertCircle size={16} />
                {submitError}
              </div>
            )}

            <div className="nv-trial-form-actions">
              {step === "form" && (
                <button
                  type="submit"
                  id="btn-avancar-trial"
                  className="nv-button nv-trial-btn-submit"
                >
                  Avançar — Revisar dados <ChevronRight size={17} />
                </button>
              )}
              {step === "review" && (
                <button
                  type="submit"
                  id="btn-confirmar-trial"
                  className="nv-button nv-trial-btn-submit"
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? (
                    <>
                      <Loader2 size={16} className="nv-spin" /> Criando sua conta…
                    </>
                  ) : (
                    <>
                      <Zap size={16} /> Confirmar e iniciar teste gratuito
                    </>
                  )}
                </button>
              )}
            </div>
          </form>

          {/* SIDEBAR — RESUMO DO PLANO (dados do backend) */}
          <aside className="nv-trial-sidebar">
            <PlanSummaryCard planSummary={planSummary} />
          </aside>
        </div>
      </div>
    </SiteLayout>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1: FORMULÁRIO DE DADOS
// ─────────────────────────────────────────────────────────────────────────────
function FormStep({
  form,
  errors,
  onChange,
}: {
  form: FormData;
  errors: Partial<Record<keyof FormData, string>>;
  onChange: (field: keyof FormData, value: string | boolean) => void;
}) {
  return (
    <div className="nv-trial-form-step">
      <h2 className="nv-trial-form-section-title">Dados da empresa</h2>

      <div className="nv-trial-field-group">
        <TrialField
          id="field-company-name"
          label="Nome da empresa"
          icon={<Building2 size={16} />}
          error={errors.companyName}
        >
          <input
            id="field-company-name"
            type="text"
            value={form.companyName}
            onChange={(e) => onChange("companyName", e.target.value)}
            placeholder="Nome do seu escritório, barbearia ou empresa"
            maxLength={200}
            autoComplete="organization"
            required
          />
        </TrialField>

        <TrialField
          id="field-responsible-name"
          label="Nome do responsável"
          icon={<User size={16} />}
          error={errors.responsibleName}
        >
          <input
            id="field-responsible-name"
            type="text"
            value={form.responsibleName}
            onChange={(e) => onChange("responsibleName", e.target.value)}
            placeholder="Seu nome completo"
            maxLength={200}
            autoComplete="name"
            required
          />
        </TrialField>

        <TrialField
          id="field-cpf-cnpj"
          label="CPF ou CNPJ"
          icon={<FileText size={16} />}
          error={errors.cpfCnpj}
        >
          <input
            id="field-cpf-cnpj"
            type="text"
            value={form.cpfCnpj}
            onChange={(e) => onChange("cpfCnpj", e.target.value)}
            placeholder="000.000.000-00 ou 00.000.000/0001-00"
            maxLength={18}
            autoComplete="off"
            required
          />
        </TrialField>

        <TrialField
          id="field-email"
          label="E-mail de acesso"
          icon={<Mail size={16} />}
          error={errors.email}
        >
          <input
            id="field-email"
            type="email"
            value={form.email}
            onChange={(e) => onChange("email", e.target.value)}
            placeholder="seu@email.com.br"
            maxLength={200}
            autoComplete="email"
            required
          />
        </TrialField>

        <TrialField
          id="field-phone"
          label="WhatsApp / Telefone"
          icon={<Phone size={16} />}
          error={errors.phone}
        >
          <input
            id="field-phone"
            type="tel"
            value={form.phone}
            onChange={(e) => onChange("phone", e.target.value)}
            placeholder="(00) 00000-0000"
            maxLength={20}
            autoComplete="tel"
            required
          />
        </TrialField>
      </div>

      <div className="nv-trial-consent-section">
        <h3 className="nv-trial-consent-title">
          <Shield size={15} /> Consentimento e privacidade
        </h3>

        <ConsentCheckbox
          id="consent-terms"
          checked={form.consentTerms}
          onChange={(v) => onChange("consentTerms", v)}
          error={errors.consentTerms}
        >
          Li e aceito os{" "}
          <a href="/termos" target="_blank" rel="noopener noreferrer">
            Termos de Uso
          </a>{" "}
          da NAVOR.
        </ConsentCheckbox>

        <ConsentCheckbox
          id="consent-privacy"
          checked={form.consentPrivacy}
          onChange={(v) => onChange("consentPrivacy", v)}
          error={errors.consentPrivacy}
        >
          Li e aceito a{" "}
          <a href="/privacidade" target="_blank" rel="noopener noreferrer">
            Política de Privacidade
          </a>
          .
        </ConsentCheckbox>

        <ConsentCheckbox
          id="consent-data"
          checked={form.consentData}
          onChange={(v) => onChange("consentData", v)}
          error={errors.consentData}
        >
          Autorizo o tratamento dos meus dados pessoais conforme a LGPD para prestação dos serviços
          NAVOR.
        </ConsentCheckbox>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2: REVISÃO
// ─────────────────────────────────────────────────────────────────────────────
function ReviewStep({
  form,
  planSummary,
  onBack,
}: {
  form: FormData;
  planSummary: NonNullable<Awaited<ReturnType<typeof getTrialPlanSummary>>>;
  onBack: () => void;
}) {
  return (
    <div className="nv-trial-form-step">
      <h2 className="nv-trial-form-section-title">Revisão dos dados</h2>

      <div className="nv-trial-review-card">
        <div className="nv-trial-review-row">
          <span>Empresa</span>
          <strong>{form.companyName}</strong>
        </div>
        <div className="nv-trial-review-row">
          <span>Responsável</span>
          <strong>{form.responsibleName}</strong>
        </div>
        <div className="nv-trial-review-row">
          <span>E-mail</span>
          <strong>{form.email}</strong>
        </div>
        <div className="nv-trial-review-row">
          <span>Telefone</span>
          <strong>{form.phone}</strong>
        </div>
      </div>

      <div className="nv-trial-review-plan">
        <div className="nv-trial-review-row">
          <span>Produto</span>
          <strong>{planSummary.product.name}</strong>
        </div>
        <div className="nv-trial-review-row">
          <span>Plano</span>
          <strong>{planSummary.plan.name}</strong>
        </div>
        <div className="nv-trial-review-row">
          <span>Período de teste</span>
          <strong>{planSummary.plan.trialDays} dias gratuitos</strong>
        </div>
        <div className="nv-trial-review-row">
          <span>Teste encerra em</span>
          <strong>{planSummary.plan.trialEndsAt}</strong>
        </div>
        <div className="nv-trial-review-row nv-trial-review-row--highlight">
          <span>Valor após o teste</span>
          <strong>
            R$ {planSummary.plan.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            /{planSummary.plan.billingCycle === "monthly" ? "mês" : planSummary.plan.billingCycle}
          </strong>
        </div>
        <div className="nv-trial-review-row">
          <span>Após o teste gratuito</span>
          <strong>Entraremos em contato</strong>
        </div>
      </div>

      <div className="nv-trial-review-policy">
        <Shield size={14} />
        <p>
          Teste gratuito por {planSummary.plan.trialDays} dias sem nenhum custo.
          Ao final do período, você receberá orientações para continuar com o plano ou
          poderá falar diretamente com a NAVOR.
        </p>
      </div>

      <button
        type="button"
        id="btn-editar-dados-trial"
        className="nv-trial-btn-back"
        onClick={onBack}
      >
        <ArrowLeft size={15} /> Editar dados
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SIDEBAR: RESUMO DO PLANO (dados do backend)
// ─────────────────────────────────────────────────────────────────────────────
function PlanSummaryCard({
  planSummary,
}: {
  planSummary: NonNullable<Awaited<ReturnType<typeof getTrialPlanSummary>>>;
}) {
  return (
    <div className="nv-trial-plan-card">
      <div className="nv-trial-plan-header">
        <div className="nv-trial-plan-icon">
          <ProductIcon slug={planSummary.product.slug} />
        </div>
        <div>
          <h3>{planSummary.product.name.replace("Navor ", "")}</h3>
          <p>{planSummary.plan.name}</p>
        </div>
      </div>

      <div className="nv-trial-plan-price">
        <span className="nv-trial-plan-trial-label">
          <Zap size={14} /> {planSummary.plan.trialDays} dias grátis
        </span>
        <div className="nv-trial-plan-amount">
          <strong>
            R$ {planSummary.plan.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </strong>
          <span>
            /{planSummary.plan.billingCycle === "monthly" ? "mês" : planSummary.plan.billingCycle}{" "}
            (tabela de referência)
          </span>
        </div>
      </div>

      <div className="nv-trial-plan-info">
        <div className="nv-trial-plan-info-row">
          <Check size={14} />
          <span>Sem cartão de crédito agora</span>
        </div>
        <div className="nv-trial-plan-info-row">
          <Check size={14} />
          <span>Cancele quando quiser</span>
        </div>
        <div className="nv-trial-plan-info-row">
          <Check size={14} />
          <span>Teste encerra em: {planSummary.plan.trialEndsAt}</span>
        </div>
        <div className="nv-trial-plan-info-row">
          <Check size={14} />
          <span>Sem cobrança durante o período de testes</span>
        </div>
      </div>

      {planSummary.plan.description && (
        <p className="nv-trial-plan-description">{planSummary.plan.description}</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PÁGINA DE SUCESSO
// ─────────────────────────────────────────────────────────────────────────────
function SuccessPage({
  productSlug,
  planName,
  email,
}: {
  productSlug: string;
  planName: string;
  email: string;
}) {
  return (
    <div className="nv-trial-container nv-trial-success">
      <div className="nv-trial-success-icon">
        <Check size={40} />
      </div>
      <h1>Conta criada com sucesso!</h1>
      <p>
        Seu cadastro foi registrado para <strong>{email.replace(/(.{2}).*(@.*)/, "$1***$2")}</strong>.{" "}
        Caso receba um e-mail de acesso, clique no link para ativar sua conta. Se não receber em alguns minutos,
        entre em contato com a NAVOR para ativarmos manualmente.
      </p>
      <div className="nv-trial-success-plan">
        <Zap size={15} />
        Plano <strong>{planName}</strong> — período de teste iniciado
      </div>
      <div className="nv-trial-success-actions">
        <a
          id="btn-acessar-pos-trial"
          href={`/${productSlug}/dashboard`}
          className="nv-button"
        >
          Acessar {productSlug} <ChevronRight size={17} />
        </a>
        <a href="/contato" className="nv-button nv-button-ghost">
          Falar com a NAVOR
        </a>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PÁGINA DE PLANO INVÁLIDO
// ─────────────────────────────────────────────────────────────────────────────
function InvalidTrialPage({ reason }: { reason: string }) {
  return (
    <div className="nv-trial-container nv-trial-invalid">
      <AlertCircle size={40} />
      <h1>Plano não disponível</h1>
      <p>{reason}</p>
      <a id="btn-ver-solucoes" href="/produtos" className="nv-button">
        Ver soluções disponíveis <ChevronRight size={17} />
      </a>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS DE UI
// ─────────────────────────────────────────────────────────────────────────────
function TrialField({
  id,
  label,
  icon,
  error,
  children,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`nv-trial-field ${error ? "nv-trial-field--error" : ""}`}>
      <label htmlFor={id} className="nv-trial-label">
        {icon}
        {label}
      </label>
      {children}
      {error && (
        <span className="nv-trial-field-error" role="alert">
          <AlertCircle size={13} />
          {error}
        </span>
      )}
    </div>
  );
}

function ConsentCheckbox({
  id,
  checked,
  onChange,
  error,
  children,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`nv-trial-consent ${error ? "nv-trial-consent--error" : ""}`}>
      <label className="nv-trial-consent-label">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>{children}</span>
      </label>
      {error && (
        <span className="nv-trial-field-error" role="alert">
          <AlertCircle size={13} />
          {error}
        </span>
      )}
    </div>
  );
}

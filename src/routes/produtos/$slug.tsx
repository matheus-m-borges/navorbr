import { createFileRoute, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  SiteLayout,
  ProductIcon,
  ProductFigure,
  ContactCTA,
  Orbital,
} from "@/components/navor/PublicSite";
import { getPublicProductBySlug } from "@/api/public-products";
import { products as localProducts } from "@/data/products";
import type { PublicProduct, PublicPlan } from "@/api/public-products";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Users,
  MessageSquare,
  HelpCircle,
  Briefcase,
  TrendingUp,
  CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/produtos/$slug")({
  head: ({ params }) => {
    const slug = params.slug;
    const local = localProducts.find((p) => p.slug === slug || (slug === "rephub" && p.slug === "rephup"));
    const name = local?.name.replace(/^Navor(?:BR)?\s+/, "") ?? (slug.charAt(0).toUpperCase() + slug.slice(1));
    return {
      meta: [
        { title: `${name} | Soluções NavorBR` },
        {
          name: "description",
          content: local?.shortDescription ?? `Conheça os recursos, planos e solicite uma demonstração do ${name} da NavorBR.`,
        },
      ],
    };
  },
  component: ProductDetailPage,
});

// Links de acesso operacional por produto
const ACCESS_LINKS: Record<string, string> = {
  rephub:    "/entrar?product=rephub",
  rephup:    "/entrar?product=rephub",
  lawhub:    "/auth?product=lawhub&next=/lawhub/dashboard",
  barberhub: "https://barberhub.navorbr.com",
  pethub:    "https://pethub.navorbr.com",
  enghub:    "/auth?product=enghub",
};

function ProductDetailPage() {
  const { slug } = Route.useParams();

  const { data: product, isLoading, isError } = useQuery({
    queryKey: ["public_product", slug],
    queryFn: () => getPublicProductBySlug({ data: { slug } }),
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  if (isLoading) {
    return (
      <SiteLayout>
        <div className="nv-section nv-page-hero" aria-busy="true">
          <div className="nv-skeleton nv-skeleton-title" style={{ width: "60%" }} />
          <div className="nv-skeleton nv-skeleton-text" style={{ width: "80%" }} />
        </div>
      </SiteLayout>
    );
  }

  if (isError || !product) {
    const local = localProducts.find(
      (p) => p.slug === slug || (slug === "rephub" && p.slug === "rephup"),
    );

    if (local) {
      const fallbackProduct: PublicProduct = {
        id: local.id,
        slug: local.slug,
        name: local.name,
        status: local.status,
        isPublic: true,
        trialEligible: false,
        tagLine: local.officialTagline,
        shortDescription: local.shortDescription,
        targetAudience: local.targetAudience,
        benefits: local.keyBenefits,
        displayOrder: 5,
        plans: [],
      };
      return <ProductDetailContent product={fallbackProduct} />;
    }

    throw notFound();
  }

  return <ProductDetailContent product={product} />;
}

function ProductDetailContent({ product }: { product: PublicProduct }) {
  const isAvailable = product.isPublic && product.status !== "coming_soon";
  const accessLink = ACCESS_LINKS[product.slug];
  const isExternal = accessLink?.startsWith("http");

  // Dados complementares do catálogo local
  const localData = localProducts.find(
    (p) => p.slug === product.slug || (product.slug === "rephub" && p.slug === "rephup"),
  );

  const cleanName = product.name.replace(/^Navor(?:BR)?\s+/, "");
  const segment = localData?.segment ?? "Solução Especializada";

  // Plano em destaque para exibição comercial
  const featuredPlan = product.plans.find((p) => p.isFeatured) ?? product.plans[0];

  // Funcionalidades (módulos do backend ou catálogo local)
  const features =
    localData?.features && localData.features.length > 0
      ? localData.features
      : featuredPlan?.modules.map((m) => ({ title: m.name, description: m.description ?? "" })) ?? [];

  // Benefícios operacionais
  const opBenefits = localData?.operationalBenefits ?? [];

  // Perguntas frequentes
  const faqList = localData?.faq ?? [];

  return (
    <SiteLayout>
      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 1. BREADCRUMB + HERO CURTO DO PRODUTO                               */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="nv-page-hero nv-section" style={{ paddingTop: "40px", paddingBottom: "32px" }}>
        <a href="/produtos" className="nv-back" id="btn-voltar-solucoes">
          ← Todas as soluções
        </a>

        <div className="nv-product-title" style={{ gap: "10px", alignItems: "center" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: localData?.accentColor ?? "#818cf8",
            }}
          >
            <ProductIcon slug={product.slug} />
          </div>
          <span className="nv-eyebrow" style={{ margin: 0 }}>
            {segment.toUpperCase()}
          </span>
          <span className={`nv-badge ${isAvailable ? "" : "nv-badge--soon"}`}>
            {isAvailable ? "Disponível" : "Em breve"}
          </span>
        </div>

        <h1 style={{ fontSize: "clamp(2.4rem, 4.4vw, 3.8rem)", margin: "16px 0 12px" }}>
          {product.name}
        </h1>
        <p style={{ fontSize: "1.1rem", lineHeight: "1.6", maxWidth: "680px" }}>
          {localData?.officialTagline ?? product.tagLine ?? product.shortDescription}
        </p>

        {/* ───────────────────────────────────────────────────────────────── */}
        {/* 2. CTAs PRINCIPAIS NO HERO                                        */}
        {/* ───────────────────────────────────────────────────────────────── */}
        <div className="nv-actions" style={{ marginTop: "24px" }}>
          {isAvailable ? (
            <a
              id={`btn-demonstracao-hero-${product.slug}`}
              className="nv-button nv-button-primary"
              href={`/contato?interesse=${product.slug}&origem=demonstracao`}
              style={{
                background: product.slug === "barberhub" ? "#f97316" : undefined,
                borderColor: product.slug === "barberhub" ? "#f97316" : undefined,
                color: "#fff",
              }}
            >
              Solicitar demonstração <ArrowRight size={17} />
            </a>
          ) : !isAvailable ? (
            <a
              id={`btn-aviso-hero-${product.slug}`}
              className="nv-button nv-button-primary"
              href={`/contato?interesse=${product.slug}`}
            >
              Quero ser avisado no lançamento <ArrowRight size={17} />
            </a>
          ) : null}

          {isAvailable && accessLink && (
            <a
              id={`btn-acessar-${product.slug}`}
              className="nv-button nv-button-ghost"
              href={accessLink}
              target={isExternal ? "_blank" : undefined}
              rel={isExternal ? "noopener noreferrer" : undefined}
            >
              Acessar {cleanName} <ArrowRight size={17} />
            </a>
          )}

          <a
            id={`btn-contato-${product.slug}`}
            className="nv-button nv-button-ghost"
            href="/contato"
          >
            Falar com a NavorBR <ArrowUpRight size={17} />
          </a>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 3. IMAGEM / INTERFACE ILUSTRATIVA                                   */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="nv-section nv-product-detail-image" style={{ paddingTop: "0" }}>
        <ProductFigure slug={product.slug} />
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 4. PARA QUEM É INDICADO                                             */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {localData?.targetAudience && (
        <section className="nv-section" style={{ paddingTop: "20px", paddingBottom: "20px" }}>
          <div className="nv-product-target-box" data-reveal>
            <div className="nv-target-icon">
              <Briefcase size={26} />
            </div>
            <div className="nv-target-content">
              <h4>Para quem é indicado</h4>
              <p>{localData.targetAudience}</p>
            </div>
          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 5. PRINCIPAIS FUNCIONALIDADES                                       */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {features.length > 0 && (
        <section className="nv-section" data-reveal>
          <div className="nv-section-intro">
            <span className="nv-eyebrow">RECURSOS E FERRAMENTAS</span>
            <h2>O que o {cleanName} entrega na prática.</h2>
          </div>
          <div className="nv-feature-list" style={{ marginTop: "36px" }}>
            {features.map((feat, i) => (
              <article key={i}>
                <span>0{i + 1}</span>
                <h3>{feat.title}</h3>
                <p>{feat.description}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 6. BENEFÍCIOS OPERACIONAIS                                          */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {opBenefits.length > 0 && (
        <section className="nv-section" data-reveal>
          <div className="nv-section-intro">
            <span className="nv-eyebrow">EFICIÊNCIA REAL</span>
            <h2>Impacto direto no seu dia a dia.</h2>
          </div>

          <div className="nv-op-benefits-grid">
            {opBenefits.map((b, i) => (
              <div key={i} className="nv-op-benefit-card">
                <h4>
                  <CheckCircle2 size={18} style={{ color: localData?.accentColor ?? "#818cf8" }} />
                  {b.title}
                </h4>
                <p>{b.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 7. ESPAÇO PREPARADO PARA PLANOS                                     */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {isAvailable && product.plans.length > 0 && (
        <section className="nv-section nv-plans-section" data-reveal id="planos">
          <div className="nv-section-intro">
            <span className="nv-eyebrow">PLANOS E CONTRATAÇÃO</span>
            <h2>
              Escolha o plano ideal<br />
              para sua operação.
            </h2>
            {product.trialEligible && (
              <p className="nv-plans-trial-note">
                ✓ Solicite uma demonstração para conhecer o plano ideal para sua operação.
              </p>
            )}
          </div>
          <div className="nv-plans-grid">
            {product.plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                productSlug={product.slug}
                isFeatured={plan.isFeatured}
              />
            ))}
          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 8. FAQ DO PRODUTO                                                   */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {faqList.length > 0 && (
        <section className="nv-section" data-reveal>
          <div className="nv-section-intro">
            <span className="nv-eyebrow">DÚVIDAS FREQUENTES</span>
            <h2>Perguntas frequentes sobre o {cleanName}.</h2>
          </div>

          <div className="nv-product-faq-list">
            {faqList.map((item, i) => (
              <div key={i} className="nv-faq-item">
                <h4 className="nv-faq-question">{item.question}</h4>
                <p className="nv-faq-answer">{item.answer}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 9. CTA FINAL DA PÁGINA DO PRODUTO                                   */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="nv-section" data-reveal>
        <div
          className="nv-product-final-cta"
          style={{
            "--accent": localData?.accentColor ?? "#818cf8",
            "--accent-bg": localData?.accentBg ?? "rgba(99, 102, 241, 0.15)",
          } as React.CSSProperties}
        >
          <h2>Pronto para organizar sua operação?</h2>
          <p>
            {isAvailable
              ? `Solicite uma demonstração do ${cleanName} e conheça a melhor configuração para a rotina do seu negócio.`
              : `O ${cleanName} está em desenvolvimento. Deixe seu contato para receber novidades e acesso prioritário.`}
          </p>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
            {isAvailable ? (
              <a
                href={`/contato?interesse=${product.slug}&origem=demonstracao`}
                className="nv-button nv-button-primary"
                id={`btn-demonstracao-final-${product.slug}`}
                style={{
                  background: product.slug === "barberhub" ? "#f97316" : undefined,
                  borderColor: product.slug === "barberhub" ? "#f97316" : undefined,
                  color: "#fff",
                }}
              >
                Solicitar demonstração <ArrowRight size={16} />
              </a>
            ) : (
              <a
                href={`/contato?interesse=${product.slug}`}
                className="nv-button nv-button-primary"
                id={`btn-contato-final-${product.slug}`}
              >
                Falar com a NavorBR <ArrowUpRight size={16} />
              </a>
            )}

            <a
              href="/produtos"
              className="nv-button nv-button-ghost"
              id="btn-ver-outras-solucoes"
            >
              Ver todas as soluções
            </a>
          </div>
        </div>
      </section>

      <ContactCTA />
    </SiteLayout>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CARD DE PLANO
// ─────────────────────────────────────────────────────────────────────────────
function PlanCard({
  plan,
  productSlug,
  isFeatured,
}: {
  plan: PublicPlan;
  productSlug: string;
  isFeatured: boolean;
}) {
  const cycleLabel =
    plan.billingCycle === "yearly"
      ? "/ano"
      : plan.billingCycle === "quarterly"
      ? "/trimestre"
      : "/mês";

  return (
    <article
      id={`plano-${plan.id}`}
      className={`nv-plan-card ${isFeatured ? "nv-plan-card--featured" : ""}`}
    >
      {isFeatured && (
        <div className="nv-plan-badge-featured">⭐ Mais popular</div>
      )}

      <div className="nv-plan-header">
        <h3 className="nv-plan-name">{plan.name}</h3>
        {plan.description && (
          <p className="nv-plan-description">{plan.description}</p>
        )}
      </div>

      <div className="nv-plan-price">
        <strong className="nv-plan-amount">
          R$ {plan.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
        </strong>
        <span className="nv-plan-cycle">{cycleLabel}</span>
      </div>

      {plan.trialEligible && (
        <div className="nv-plan-trial-info">
          <HelpCircle size={13} />
          Demonstração personalizada com a NavorBR
        </div>
      )}

      <div className="nv-plan-limits">
        {plan.userLimit && (
          <span className="nv-plan-limit">
            <Users size={13} />
            Até {plan.userLimit} usuário{plan.userLimit > 1 ? "s" : ""}
          </span>
        )}
        {plan.whatsappNumberLimit && (
          <span className="nv-plan-limit">
            <MessageSquare size={13} />
            {plan.whatsappNumberLimit} número{plan.whatsappNumberLimit > 1 ? "s" : ""} WhatsApp
          </span>
        )}
      </div>

      {plan.modules.length > 0 && (
        <ul className="nv-plan-modules">
          {plan.modules.map((mod) => (
            <li key={mod.key}>
              <Check size={13} />
              {mod.name}
            </li>
          ))}
        </ul>
      )}

      <div className="nv-plan-actions">
        <a
          id={`btn-demonstracao-plano-${plan.id}`}
          href={`/contato?interesse=${productSlug}&plano=${plan.id}&origem=demonstracao`}
          className="nv-button nv-plan-cta"
          style={{
            background: productSlug === "barberhub" ? "#f97316" : undefined,
            borderColor: productSlug === "barberhub" ? "#f97316" : undefined,
            color: "#fff",
          }}
        >
          Solicitar demonstração <ArrowUpRight size={15} />
        </a>
      </div>

      <p className="nv-plan-policy">
        Valores e condições apresentados na demonstração, conforme a necessidade da sua operação.
      </p>
    </article>
  );
}

import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteLayout, ProductIcon, ContactCTA, Orbital } from "@/components/navor/PublicSite";
import { getPublicProducts } from "@/api/public-products";
import { products as localCatalog } from "@/data/products";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Scissors,
  Scale,
  Layers3,
  HardHat,
  PawPrint,
  Star,
  Check,
} from "lucide-react";
import type { PublicProduct } from "@/api/public-products";

export const Route = createFileRoute("/produtos/")({
  head: () => ({
    meta: [
      { title: "Soluções Especializadas | NavorBR" },
      {
        name: "description",
        content:
          "Sistemas especializados para barbearias (BarberHub), escritórios jurídicos (LawHub), representação comercial (RepHub) e pet shops (PetHub). Conheça as soluções NavorBR.",
      },
    ],
  }),
  component: ProdutosPage,
});

// ─────────────────────────────────────────────────────────────────────────────
// METADADOS INSTITUCIONAIS E COMERCIAIS
// Textos e identidade oficiais conforme diretriz comercial NAVOR
// ─────────────────────────────────────────────────────────────────────────────
type SegmentKey = "all" | "barbearia" | "advocacia" | "comercial" | "engenharia" | "pet";

interface ProductCommercialCopy {
  category: string;
  tagline: string;
  benefits: [string, string, string];
  accentColor: string;
  accentBg: string;
  segmentKey: SegmentKey;
  targetTag?: string;
}

const COMMERCIAL_COPY: Record<string, ProductCommercialCopy> = {
  barberhub: {
    category: "Barbearias & Estética",
    tagline: "Agenda, equipe, caixa, clientes e fidelidade para sua barbearia.",
    benefits: [
      "Agenda e profissionais",
      "PDV, comandas e financeiro",
      "Clientes, fidelidade e retorno",
    ],
    accentColor: "#fb923c",
    accentBg: "rgba(249, 115, 22, 0.08)",
    segmentKey: "barbearia",
    targetTag: "Ideal para barbearias",
  },
  lawhub: {
    category: "Advocacia",
    tagline: "Gestão jurídica, processos, prazos e atendimento em um só lugar.",
    benefits: [
      "Processos, prazos e publicações",
      "Clientes, casos e documentos",
      "Financeiro, atendimento e IA jurídica",
    ],
    accentColor: "#818cf8",
    accentBg: "rgba(99, 102, 241, 0.08)",
    segmentKey: "advocacia",
  },
  rephub: {
    category: "Representação Comercial",
    tagline: "Clientes, pedidos, comissões e operação comercial conectados.",
    benefits: [
      "Leads e carteira de clientes",
      "Pedidos, vendas e faturamento",
      "Comissões, marcas e representação",
    ],
    accentColor: "#22d3ee",
    accentBg: "rgba(6, 182, 212, 0.08)",
    segmentKey: "comercial",
  },
  rephup: {
    category: "Representação Comercial",
    tagline: "Clientes, pedidos, comissões e operação comercial conectados.",
    benefits: [
      "Leads e carteira de clientes",
      "Pedidos, vendas e faturamento",
      "Comissões, marcas e representação",
    ],
    accentColor: "#22d3ee",
    accentBg: "rgba(6, 182, 212, 0.08)",
    segmentKey: "comercial",
  },
  enghub: {
    category: "Engenharia & Obras",
    tagline: "Controle de obras, equipes, custos e planejamento.",
    benefits: [
      "Gestão de obras",
      "Custos e planejamento",
      "Equipes, insumos e cronogramas",
    ],
    accentColor: "#fbbf24",
    accentBg: "rgba(245, 158, 11, 0.08)",
    segmentKey: "engenharia",
  },
  pethub: {
    category: "Pet Shops & Veterinária",
    tagline: "Gestão integrada para pet shops, do caixa ao e-commerce.",
    benefits: [
      "PDV, caixa e operação offline",
      "Agenda, banho e tosa e prontuário",
      "Estoque, XML e e-commerce integrado",
    ],
    accentColor: "#14b8a6",
    accentBg: "rgba(20, 184, 166, 0.08)",
    segmentKey: "pet",
    targetTag: "Pet Shops & Estética Animal",
  },
};

const ORDER_PRIORITY: Record<string, number> = {
  barberhub: 1,
  lawhub: 2,
  rephub: 3,
  rephup: 3,
  enghub: 4,
  pethub: 5,
};

export function ProdutosPage() {
  const [activeSegment, setActiveSegment] = useState<SegmentKey>("all");

  const { data: dbProducts, isLoading } = useQuery({
    queryKey: ["public_products"],
    queryFn: () => getPublicProducts(),
    staleTime: 1000 * 60 * 5,
  });

  // Ordenação comercial obrigatória: BarberHub=1, LawHub=2, RepHub=3, EngHub=4
  const sortProducts = (list: PublicProduct[]) => {
    return [...list].sort((a, b) => {
      const orderA = ORDER_PRIORITY[a.slug] ?? a.displayOrder ?? 99;
      const orderB = ORDER_PRIORITY[b.slug] ?? b.displayOrder ?? 99;
      return orderA - orderB;
    });
  };

  // Produtos disponíveis (ativos para comercialização)
  const availableProducts = sortProducts(
    (dbProducts ?? []).filter((p) => p.isPublic && p.status === "active"),
  );

  // Produtos em breve (EngHub e outros roadmap)
  const comingSoonProducts = sortProducts(
    (dbProducts ?? []).filter((p) => p.isPublic && p.status === "coming_soon"),
  );

  // Filtro por segmento
  const filteredAvailable = availableProducts.filter((product) => {
    if (activeSegment === "all") return true;
    const copy = COMMERCIAL_COPY[product.slug];
    return copy?.segmentKey === activeSegment;
  });

  // EngHub deve aparecer quando o filtro for 'all' ou 'engenharia'
  const isEnghubFiltered = activeSegment === "engenharia";
  const enghubData =
    comingSoonProducts.find((p) => p.slug === "enghub") ||
    dbProducts?.find((p) => p.slug === "enghub");

  // PetHub deve aparecer quando o filtro for 'all' ou 'pet'
  const isPethubFiltered = activeSegment === "pet";
  const pethubData =
    comingSoonProducts.find((p) => p.slug === "pethub") ||
    dbProducts?.find((p) => p.slug === "pethub");

  return (
    <SiteLayout>
      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 1. HERO COMPACTO (não esconde os produtos abaixo da dobra)           */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section
        className="nv-section nv-page-hero nv-page-hero--compact"
        style={{ paddingTop: "40px", paddingBottom: "24px" }}
      >
        <span className="nv-eyebrow">ECOSSISTEMA NAVORBR</span>
        <h1 style={{ fontSize: "clamp(2.4rem, 4.4vw, 3.8rem)", marginBottom: "16px" }}>
          Tecnologia para a operação<br />
          <em>que move o seu negócio.</em>
        </h1>
        <p style={{ fontSize: "1.05rem", lineHeight: "1.6", maxWidth: "680px" }}>
          Escolha uma solução especializada para organizar a rotina da sua barbearia,
          escritório jurídico, operação comercial ou pet shop.
        </p>

        <div style={{ display: "flex", gap: "12px", marginTop: "24px", flexWrap: "wrap" }}>
          <a
            href="#solucoes"
            className="nv-button nv-button-primary"
            id="btn-conhecer-solucoes"
            style={{ scrollBehavior: "smooth" }}
          >
            Conhecer soluções
          </a>
          <a href="/contato" className="nv-button nv-button-ghost" id="btn-falar-navor">
            Falar com a NavorBR
          </a>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 2. SEÇÃO ENCONTRE SUA SOLUÇÃO + FILTROS POR SEGMENTO                */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="nv-section" id="solucoes" style={{ paddingTop: "20px" }}>
        <div style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "clamp(1.6rem, 2.8vw, 2.2rem)", marginBottom: "8px", color: "#fff" }}>
            Encontre a solução ideal para sua operação.
          </h2>
          <p style={{ fontSize: "0.95rem", color: "var(--nv-muted, #a9aebe)", margin: 0 }}>
            Sistemas desenhados exclusivamente para a rotina do seu segmento.
          </p>
        </div>

        {/* BARRA DE FILTROS POR SEGMENTO */}
        <div
          className="nv-segment-filter"
          role="tablist"
          aria-label="Filtro de soluções por segmento"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeSegment === "all"}
            className={`nv-filter-pill ${activeSegment === "all" ? "nv-filter-pill--active" : ""}`}
            onClick={() => setActiveSegment("all")}
            id="filter-all"
          >
            Todas as soluções
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeSegment === "barbearia"}
            className={`nv-filter-pill ${activeSegment === "barbearia" ? "nv-filter-pill--active" : ""}`}
            onClick={() => setActiveSegment("barbearia")}
            id="filter-barbearia"
          >
            <Scissors size={14} style={{ color: "#fb923c" }} />
            Barbearias
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeSegment === "advocacia"}
            className={`nv-filter-pill ${activeSegment === "advocacia" ? "nv-filter-pill--active" : ""}`}
            onClick={() => setActiveSegment("advocacia")}
            id="filter-advocacia"
          >
            <Scale size={14} style={{ color: "#818cf8" }} />
            Advocacia
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeSegment === "comercial"}
            className={`nv-filter-pill ${activeSegment === "comercial" ? "nv-filter-pill--active" : ""}`}
            onClick={() => setActiveSegment("comercial")}
            id="filter-comercial"
          >
            <Layers3 size={14} style={{ color: "#22d3ee" }} />
            Comercial
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeSegment === "engenharia"}
            className={`nv-filter-pill ${activeSegment === "engenharia" ? "nv-filter-pill--active" : ""}`}
            onClick={() => setActiveSegment("engenharia")}
            id="filter-engenharia"
          >
            <HardHat size={14} style={{ color: "#fbbf24" }} />
            Engenharia <span style={{ fontSize: "10px", opacity: 0.8 }}>(Em breve)</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeSegment === "pet"}
            className={`nv-filter-pill ${activeSegment === "pet" ? "nv-filter-pill--active" : ""}`}
            onClick={() => setActiveSegment("pet")}
            id="filter-pet"
          >
            <PawPrint size={14} style={{ color: "#14b8a6" }} />
            Pet Shops <span style={{ fontSize: "10px", opacity: 0.8 }}>(Em breve)</span>
          </button>
        </div>

        {/* GRID DOS CARDS DE PRODUTOS */}
        {isLoading ? (
          <ProductCardsLoading />
        ) : isEnghubFiltered ? (
          /* Quando seleciona 'Engenharia', exibe o EngHub com aviso de Em breve */
          <div style={{ maxWidth: "680px" }}>
            <EngHubFeaturedCard enghub={enghubData} />
          </div>
        ) : isPethubFiltered ? (
          /* Quando seleciona 'Pet Shops', exibe o PetHub com aviso de Em breve */
          <div style={{ maxWidth: "680px" }}>
            <PetHubFeaturedCard pethub={pethubData} />
          </div>
        ) : (
          <div className="nv-product-cards-grid">
            {filteredAvailable.map((product) => (
              <ProductCard
                key={product.slug}
                product={product}
                isFeatured={product.slug === "barberhub"}
              />
            ))}
          </div>
        )}
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 3. SEÇÃO COMO A NAVOR AJUDA (4 BLOCOS OBJETIVOS)                     */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <section className="nv-section nv-impact-section" data-reveal>
        <div className="nv-impact-header">
          <span className="nv-eyebrow">RESULTADO OPERACIONAL</span>
          <h2>Cada negócio tem seu ritmo. A NavorBR acompanha o seu.</h2>
        </div>

        <div className="nv-impact-grid">
          {/* BLOCO 1: BarberHub */}
          <div className="nv-impact-card">
            <div className="nv-impact-card-top">
              <div
                className="nv-impact-card-icon"
                style={{ background: "rgba(249, 115, 22, 0.12)", color: "#fb923c" }}
              >
                <Scissors size={20} />
              </div>
              <h3 className="nv-impact-card-name">BarberHub</h3>
            </div>
            <p className="nv-impact-card-result">
              Mais organização na agenda, equipe, caixa e relacionamento com clientes.
            </p>
          </div>

          {/* BLOCO 2: LawHub */}
          <div className="nv-impact-card">
            <div className="nv-impact-card-top">
              <div
                className="nv-impact-card-icon"
                style={{ background: "rgba(99, 102, 241, 0.12)", color: "#818cf8" }}
              >
                <Scale size={20} />
              </div>
              <h3 className="nv-impact-card-name">LawHub</h3>
            </div>
            <p className="nv-impact-card-result">
              Mais controle sobre processos, prazos, atendimento e operação jurídica.
            </p>
          </div>

          {/* BLOCO 3: RepHub */}
          <div className="nv-impact-card">
            <div className="nv-impact-card-top">
              <div
                className="nv-impact-card-icon"
                style={{ background: "rgba(6, 182, 212, 0.12)", color: "#22d3ee" }}
              >
                <Layers3 size={20} />
              </div>
              <h3 className="nv-impact-card-name">RepHub</h3>
            </div>
            <p className="nv-impact-card-result">
              Mais visibilidade sobre carteira, pedidos, comissões e vendas.
            </p>
          </div>

          {/* BLOCO 4: EngHub */}
          <div className="nv-impact-card">
            <div className="nv-impact-card-top">
              <div
                className="nv-impact-card-icon"
                style={{ background: "rgba(245, 158, 11, 0.12)", color: "#fbbf24" }}
              >
                <HardHat size={20} />
              </div>
              <h3 className="nv-impact-card-name">EngHub</h3>
            </div>
            <p className="nv-impact-card-result">
              Mais clareza para acompanhar obras, custos, equipes e planejamento.
            </p>
          </div>
        </div>

        {/* CTA FINAL DA SEÇÃO DE IMPACTO */}
        <div className="nv-impact-cta-bar">
          <p className="nv-impact-cta-text">
            Ainda não sabe qual solução escolher?
          </p>
          <a
            href="/contato"
            className="nv-button nv-button-ghost"
            id="btn-duvida-solucao"
            style={{ padding: "10px 22px" }}
          >
            Fale com a NavorBR <ArrowUpRight size={16} />
          </a>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 4. SEÇÃO EM DESENVOLVIMENTO (PRÓXIMOS LANÇAMENTOS: PETHUB & ENGHUB)  */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeSegment !== "engenharia" && activeSegment !== "pet" && (
        <section className="nv-section nv-coming-section" data-reveal>
          <div className="nv-section-intro">
            <span className="nv-eyebrow">PRÓXIMOS LANÇAMENTOS</span>
            <h2>Soluções especializadas em desenvolvimento.</h2>
          </div>

          <div style={{ display: "grid", gap: "24px", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
            {/* CARD PETHUB */}
            <div className="nv-enghub-card" style={{ borderColor: "rgba(20, 184, 166, 0.3)" }}>
              <div className="nv-enghub-info">
                <div className="nv-enghub-icon" style={{ background: "rgba(20, 184, 166, 0.12)", color: "#14b8a6" }}>
                  <PawPrint size={28} />
                </div>
                <div className="nv-enghub-details">
                  <h3>
                    NavorBR PetHub
                    <span className="nv-pc-badge nv-pc-badge--soon">
                      <Clock size={12} />
                      Em breve
                    </span>
                  </h3>
                  <p>
                    Gestão integrada para pet shops, do caixa ao e-commerce.
                  </p>
                  <ul className="nv-enghub-benefits">
                    <li>
                      <Check size={14} />
                      PDV e frente de caixa com modo offline
                    </li>
                    <li>
                      <Check size={14} />
                      Agenda, banho e tosa e prontuário
                    </li>
                    <li>
                      <Check size={14} />
                      Estoque, XML e e-commerce integrado
                    </li>
                  </ul>
                </div>
              </div>

              <div className="nv-enghub-actions">
                <a
                  href="/contato?interesse=pethub"
                  className="nv-button nv-button-ghost"
                  id="btn-aviso-pethub"
                >
                  Quero ser avisado
                </a>
                <a
                  href="/produtos/pethub"
                  className="nv-button nv-button-ghost"
                  id="btn-conhecer-pethub"
                >
                  Conhecer a solução <ArrowUpRight size={15} />
                </a>
              </div>
            </div>

            {/* CARD ENGHUB */}
            <div className="nv-enghub-card">
              <div className="nv-enghub-info">
                <div className="nv-enghub-icon">
                  <HardHat size={28} />
                </div>
                <div className="nv-enghub-details">
                  <h3>
                    NavorBR EngHub
                    <span className="nv-pc-badge nv-pc-badge--soon">
                      <Clock size={12} />
                      Em breve
                    </span>
                  </h3>
                  <p>
                    Controle de obras, equipes, custos e planejamento.
                  </p>
                  <ul className="nv-enghub-benefits">
                    <li>
                      <Check size={14} />
                      Gestão de obras
                    </li>
                    <li>
                      <Check size={14} />
                      Custos e planejamento
                    </li>
                    <li>
                      <Check size={14} />
                      Equipes, insumos e cronogramas
                    </li>
                  </ul>
                </div>
              </div>

              <div className="nv-enghub-actions">
                <a
                  href="/contato?interesse=enghub"
                  className="nv-button nv-button-ghost"
                  id="btn-aviso-enghub"
                >
                  Quero ser avisado
                </a>
                <a
                  href="/produtos/enghub"
                  className="nv-button nv-button-ghost"
                  id="btn-conhecer-enghub"
                >
                  Conhecer a solução <ArrowUpRight size={15} />
                </a>
              </div>
            </div>
          </div>
        </section>
      )}

      <ContactCTA />
    </SiteLayout>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CARD DE PRODUTO INDIVIDUAL NA VITRINE
// ─────────────────────────────────────────────────────────────────────────────
function ProductCard({
  product,
  isFeatured,
}: {
  product: PublicProduct;
  isFeatured?: boolean;
}) {
  const copy = COMMERCIAL_COPY[product.slug];
  const isAvailable = product.isPublic && product.status === "active";

  const lowestPlan = product.plans[0];

  const cleanName = product.name.replace(/^Navor(?:BR)?\s+/, "");

  return (
    <article
      className={`nv-product-card ${isFeatured ? "nv-product-card--featured" : ""}`}
      id={`card-${product.slug}`}
      data-reveal
      style={{
        "--accent": copy?.accentColor ?? "#818cf8",
        "--accent-bg": copy?.accentBg ?? "rgba(99,102,241,0.08)",
      } as React.CSSProperties}
    >
      {/* HEADER DO CARD */}
      <div className="nv-pc-header">
        <div className="nv-pc-icon">
          <ProductIcon slug={product.slug} />
        </div>
        <div className="nv-pc-status-group">
          {isFeatured && (
            <span className="nv-pc-featured-badge">
              <Star size={11} fill="currentColor" /> Destaque
            </span>
          )}
          {isAvailable ? (
            <span className="nv-pc-badge nv-pc-badge--available">
              <CheckCircle2 size={12} />
              Disponível
            </span>
          ) : (
            <span className="nv-pc-badge nv-pc-badge--soon">
              <Clock size={12} />
              Em breve
            </span>
          )}
        </div>
      </div>

      {/* CORPO DO CARD */}
      <div className="nv-pc-body">
        {copy && <span className="nv-pc-category">{copy.category}</span>}
        <h3 className="nv-pc-name">{cleanName}</h3>
        <p className="nv-pc-tagline">{copy?.tagline ?? product.tagLine ?? product.shortDescription}</p>

        {/* ETIQUETA DE DESTAQUE PARA BARBEARIAS */}
        {copy?.targetTag && (
          <span className="nv-pc-audience">
            ⭐ {copy.targetTag}
          </span>
        )}

        {/* TRÊS BENEFÍCIOS OFICIAIS */}
        {copy?.benefits && (
          <ul className="nv-pc-benefits">
            {copy.benefits.map((benefit, i) => (
              <li key={i}>
                <CheckCircle2 size={15} />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        )}

        {/* PREÇO DE REFERÊNCIA (vindo do backend se disponível) */}
        {isAvailable && lowestPlan && (
          <div className="nv-pc-price">
            <span className="nv-pc-price-from">A partir de</span>
            <strong className="nv-pc-price-value">
              R$ {lowestPlan.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </strong>
            <span className="nv-pc-price-period">/mês</span>
          </div>
        )}
      </div>

      {/* AÇÕES FIXAS NO RODAPÉ */}
      <div className="nv-pc-actions">
        <a
          href={`/produtos/${product.slug}`}
          className="nv-button nv-button-ghost nv-pc-btn-detail"
          id={`btn-saiba-mais-${product.slug}`}
        >
          Saiba mais <ArrowUpRight size={16} />
        </a>

        {isAvailable && (
          <a
            href={`/contato?interesse=${product.slug}&origem=demonstracao`}
            className={`nv-button nv-pc-btn-trial ${isFeatured ? "nv-pc-btn-trial--barber" : ""}`}
            id={`btn-demonstracao-${product.slug}`}
          >
            Solicitar demonstração <ArrowRight size={15} />
          </a>
        )}
      </div>
    </article>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CARD ENGHUB EM DESTAQUE (QUANDO FILTRADO)
// ─────────────────────────────────────────────────────────────────────────────
function EngHubFeaturedCard({ enghub }: { enghub?: PublicProduct }) {
  return (
    <article
      className="nv-product-card"
      style={{
        "--accent": "#fbbf24",
        "--accent-bg": "rgba(245, 158, 11, 0.08)",
        borderColor: "rgba(245, 158, 11, 0.3)",
      } as React.CSSProperties}
    >
      <div className="nv-pc-header">
        <div className="nv-pc-icon">
          <HardHat size={26} />
        </div>
        <span className="nv-pc-badge nv-pc-badge--soon">
          <Clock size={12} />
          Em breve
        </span>
      </div>

      <div className="nv-pc-body">
        <span className="nv-pc-category">Engenharia & Obras</span>
        <h3 className="nv-pc-name">EngHub</h3>
        <p className="nv-pc-tagline">Controle de obras, equipes, custos e planejamento.</p>

        <ul className="nv-pc-benefits">
          <li>
            <CheckCircle2 size={15} />
            <span>Gestão de obras</span>
          </li>
          <li>
            <CheckCircle2 size={15} />
            <span>Custos e planejamento</span>
          </li>
          <li>
            <CheckCircle2 size={15} />
            <span>Equipes, insumos e cronogramas</span>
          </li>
        </ul>
      </div>

      <div className="nv-pc-actions">
        <a
          href="/contato?interesse=enghub"
          className="nv-button nv-button-ghost nv-pc-btn-detail"
          id="btn-aviso-enghub-filter"
        >
          Quero ser avisado no lançamento
        </a>
        <a
          href="/produtos/enghub"
          className="nv-button nv-button-ghost nv-pc-btn-detail"
          id="btn-conhecer-enghub-filter"
        >
          Conhecer a solução <ArrowUpRight size={15} />
        </a>
      </div>
    </article>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CARD PETHUB EM DESTAQUE (QUANDO FILTRADO)
// ─────────────────────────────────────────────────────────────────────────────
function PetHubFeaturedCard({ pethub }: { pethub?: PublicProduct }) {
  return (
    <article
      className="nv-product-card"
      style={{
        "--accent": "#14b8a6",
        "--accent-bg": "rgba(20, 184, 166, 0.08)",
        borderColor: "rgba(20, 184, 166, 0.3)",
      } as React.CSSProperties}
    >
      <div className="nv-pc-header">
        <div className="nv-pc-icon" style={{ color: "#14b8a6" }}>
          <PawPrint size={26} />
        </div>
        <span className="nv-pc-badge nv-pc-badge--soon">
          <Clock size={12} />
          Em breve
        </span>
      </div>

      <div className="nv-pc-body">
        <span className="nv-pc-category">Pet Shops & Veterinária</span>
        <h3 className="nv-pc-name">PetHub</h3>
        <p className="nv-pc-tagline">Gestão integrada para pet shops, do caixa ao e-commerce.</p>

        <ul className="nv-pc-benefits">
          <li>
            <CheckCircle2 size={15} />
            <span>PDV e caixa com modo offline</span>
          </li>
          <li>
            <CheckCircle2 size={15} />
            <span>Agenda, banho e tosa e prontuário</span>
          </li>
          <li>
            <CheckCircle2 size={15} />
            <span>Estoque, XML e e-commerce integrado</span>
          </li>
        </ul>
      </div>

      <div className="nv-pc-actions">
        <a
          href="/contato?interesse=pethub"
          className="nv-button nv-button-ghost nv-pc-btn-detail"
          id="btn-aviso-pethub-filter"
        >
          Quero ser avisado no lançamento
        </a>
        <a
          href="/produtos/pethub"
          className="nv-button nv-button-ghost nv-pc-btn-detail"
          id="btn-conhecer-pethub-filter"
        >
          Conhecer a solução <ArrowUpRight size={15} />
        </a>
      </div>
    </article>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON DE LOADING
// ─────────────────────────────────────────────────────────────────────────────
function ProductCardsLoading() {
  return (
    <div className="nv-product-cards-grid">
      {[1, 2, 3].map((i) => (
        <div key={i} className="nv-product-card nv-product-card--skeleton" aria-hidden="true">
          <div className="nv-skeleton nv-skeleton-icon" />
          <div className="nv-skeleton nv-skeleton-title" />
          <div className="nv-skeleton nv-skeleton-text" />
          <div className="nv-skeleton nv-skeleton-text nv-skeleton-text--short" />
        </div>
      ))}
    </div>
  );
}

export { Orbital };

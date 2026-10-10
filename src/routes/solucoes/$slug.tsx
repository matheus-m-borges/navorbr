import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, CheckCircle2, Clock } from "lucide-react";
import { products, getProductAccessUrl } from "@/data/products";
import { SiteLayout, ProductIcon } from "@/components/navor/PublicSite";

export const Route = createFileRoute("/solucoes/$slug")({
  loader: ({ params }) => {
    const product = products.find((p) => p.slug === params.slug);
    if (!product) throw new Error("Produto não encontrado");
    return { product };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.product?.name || "Solução"} | NAVOR BR` },
      { name: "description", content: loaderData?.product?.shortDescription || "" },
    ],
  }),
  component: SolutionPage,
});

function SolutionPage() {
  const { product } = Route.useLoaderData();
  const accessUrl = getProductAccessUrl(product.slug);
  const isAvailable = product.status === "available";
  const cleanName = product.name.replace(/^Navor(?:BR)?\s+/, "");

  return (
    <SiteLayout>
      <section className="nv-section" style={{ paddingTop: "140px", paddingBottom: "80px" }}>
        <div className="nv-container">
          <Link to="/solucoes" className="nv-back-link" style={{ color: "var(--nv-text-muted)", textDecoration: "none", fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "6px", marginBottom: "32px" }}>
            ← Todas as soluções
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
            <div className="nv-pc-icon"><ProductIcon slug={product.slug} /></div>
            <span className="nv-eyebrow" style={{ margin: 0 }}>{product.segment.toUpperCase()}</span>
            <span style={{ padding: "4px 12px", borderRadius: "999px", border: "1px solid var(--nv-border)", fontSize: "11px", letterSpacing: "0.05em", color: isAvailable ? "#4ade80" : "#fbbf24" }}>
              {isAvailable ? "Disponível" : "Em breve"}
            </span>
          </div>
          <h1 className="nv-display" style={{ fontSize: "clamp(36px, 5vw, 64px)", marginBottom: "24px" }}>{cleanName}</h1>
          <p style={{ fontSize: "20px", lineHeight: "1.6", color: "var(--nv-text-secondary)", maxWidth: "720px", marginBottom: "40px" }}>{product.fullDescription}</p>
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
            {isAvailable && (
              <a href={accessUrl} target={accessUrl.startsWith("http") ? "_blank" : undefined} rel={accessUrl.startsWith("http") ? "noopener noreferrer" : undefined} className="nv-btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "14px 28px", background: "var(--nv-accent-gold)", color: "#000", fontWeight: 600, borderRadius: "999px", textDecoration: "none", fontSize: "14px" }}>
                Acessar {cleanName} <ArrowUpRight size={16} />
              </a>
            )}
            <a href={`/contato?interesse=${product.slug}`} className="nv-btn-ghost" style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "14px 28px", border: "1px solid var(--nv-border)", color: "var(--nv-text-primary)", borderRadius: "999px", textDecoration: "none", fontSize: "14px" }}>
              Falar com especialista
            </a>
          </div>
        </div>
      </section>

      <section className="nv-section">
        <div className="nv-container">
          <span className="nv-eyebrow">PARA QUEM É</span>
          <h2 className="nv-display" style={{ fontSize: "clamp(28px, 3vw, 42px)", marginBottom: "24px" }}>{product.targetAudience}</h2>
        </div>
      </section>

      <section className="nv-section">
        <div className="nv-container">
          <span className="nv-eyebrow">BENEFÍCIOS OPERACIONAIS</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "32px", marginTop: "40px" }}>
            {product.operationalBenefits.map((benefit, i) => (
              <div key={i} style={{ padding: "32px", background: "var(--nv-surface)", border: "1px solid var(--nv-border)", borderRadius: "16px" }}>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: "20px", marginBottom: "12px", color: "var(--nv-text-primary)" }}>{benefit.title}</h3>
                <p style={{ fontSize: "14px", lineHeight: "1.6", color: "var(--nv-text-secondary)" }}>{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {product.features && product.features.length > 0 && (
        <section className="nv-section">
          <div className="nv-container">
            <span className="nv-eyebrow">FUNCIONALIDADES</span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px", marginTop: "40px" }}>
              {product.features.map((feature, i) => (
                <div key={i} style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                  <CheckCircle2 size={20} style={{ color: "var(--nv-accent-gold)", flexShrink: 0, marginTop: "2px" }} />
                  <div>
                    <h4 style={{ fontFamily: "var(--font-display)", fontSize: "16px", marginBottom: "6px", color: "var(--nv-text-primary)" }}>{feature.title}</h4>
                    <p style={{ fontSize: "13px", lineHeight: "1.5", color: "var(--nv-text-secondary)" }}>{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="nv-section" style={{ textAlign: "center" }}>
        <div className="nv-container">
          <h2 className="nv-display" style={{ fontSize: "clamp(28px, 4vw, 48px)", marginBottom: "24px" }}>Pronto para evoluir?</h2>
          <p style={{ fontSize: "18px", color: "var(--nv-text-secondary)", maxWidth: "600px", margin: "0 auto 40px" }}>Conheça os planos e condições especiais para o {cleanName}.</p>
          <a href={`/contato?interesse=${product.slug}`} className="nv-btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "16px 32px", background: "var(--nv-accent-gold)", color: "#000", fontWeight: 600, borderRadius: "999px", textDecoration: "none", fontSize: "15px" }}>
            Solicitar proposta <ArrowUpRight size={16} />
          </a>
        </div>
      </section>
    </SiteLayout>
  );
}

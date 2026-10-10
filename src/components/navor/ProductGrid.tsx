import { ArrowUpRight } from "lucide-react";
import { products } from "@/data/products";
import { ProductIcon } from "./PublicSite";

export function ProductGrid() {
  const showcaseProducts = products.slice(0, 6);

  return (
    <section id="solucoes" className="nv-section">
      <div className="nv-container">
        <span className="nv-eyebrow">NOSSO ECOSSISTEMA</span>
        <h2 className="nv-display" style={{ fontSize: "clamp(32px, 4vw, 56px)", marginBottom: "16px" }}>
          Seis soluções especializadas.
          <br />
          Uma visão integrada.
        </h2>
        <p style={{ color: "var(--nv-text-secondary)", maxWidth: "600px", fontSize: "17px", lineHeight: "1.6" }}>
          Cada produto foi desenhado para resolver desafios reais de um segmento específico,
          mantendo a conexão com todo o ecossistema NAVOR.
        </p>

        <div className="nv-products-grid">
          {showcaseProducts.map((product) => (
            <a
              key={product.slug}
              href={`/solucoes/${product.slug}`}
              className="nv-product-card"
              data-reveal
            >
              <div className="nv-pc-icon">
                <ProductIcon slug={product.slug} />
              </div>
              <h3 className="nv-pc-name">{product.name.replace(/^Navor(?:BR)?\s+/, "")}</h3>
              <p className="nv-pc-desc">{product.shortDescription}</p>
              <span className="nv-pc-link">
                Conhecer solução <ArrowUpRight size={14} />
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

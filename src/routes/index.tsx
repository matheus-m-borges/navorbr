import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { SiteLayout } from "@/components/navor/PublicSite";
import { HeroSection } from "@/components/navor/HeroSection";
import { ProductGrid } from "@/components/navor/ProductGrid";
import "@/components/navor/premium-site.css";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NAVOR BR | Tecnologia para Evoluir" },
      {
        name: "description",
        content:
          "Ecossistema de soluções inteligentes para simplificar operações, conectar equipes e impulsionar negócios.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <SiteLayout>
      <HeroSection />
      <ProductGrid />

      {/* SEÇÃO EMPRESA */}
      <section className="nv-section" id="empresa">
        <div className="nv-container" style={{ maxWidth: "900px", textAlign: "center" }}>
          <span className="nv-eyebrow">QUEM SOMOS</span>
          <h2 className="nv-display" style={{ fontSize: "clamp(32px, 4vw, 52px)", marginBottom: "32px" }}>
            Tecnologia criada para transformar
            <br />
            a maneira como empresas trabalham.
          </h2>
          <p style={{ fontSize: "18px", lineHeight: "1.7", color: "var(--nv-text-secondary)", marginBottom: "24px" }}>
            A NAVOR Sistemas desenvolve soluções digitais para organizar operações, automatizar processos e impulsionar negócios em diferentes segmentos.
          </p>
          <p style={{ fontSize: "18px", lineHeight: "1.7", color: "var(--nv-text-secondary)" }}>
            Nosso ecossistema reúne plataformas especializadas, com foco em produtividade, integração e experiências de gestão mais eficientes.
          </p>
        </div>
      </section>

      {/* SEÇÃO ECOSSISTEMA */}
      <section className="nv-section" id="ecossistema">
        <div className="nv-container" style={{ textAlign: "center" }}>
          <span className="nv-eyebrow">ECOSSISTEMA NAVOR</span>
          <h2 className="nv-display" style={{ fontSize: "clamp(32px, 4vw, 52px)", marginBottom: "64px" }}>
            Uma empresa. Múltiplas soluções.
            <br />
            Novas possibilidades.
          </h2>
          <div className="nv-ecosystem-viz">
            <div className="nv-eco-center">
              <img src="/navorbr-logo-light.svg" alt="NAVOR" width={48} height={48} style={{ filter: "brightness(0) invert(1)" }} />
            </div>
            {/* Satélites representam os 6 produtos conceitualmente */}
            <div className="nv-eco-satellite" aria-label="RepHub">R</div>
            <div className="nv-eco-satellite" aria-label="LawHub">L</div>
            <div className="nv-eco-satellite" aria-label="BarberHub">B</div>
            <div className="nv-eco-satellite" aria-label="EngHub">E</div>
            <div className="nv-eco-satellite" aria-label="PetHub">P</div>
            <div className="nv-eco-satellite" aria-label="LetterHub">3D</div>
          </div>
        </div>
      </section>

      {/* CONTATO CTA */}
      <section className="nv-section" id="contato" style={{ textAlign: "center" }}>
        <div className="nv-container">
          <span className="nv-eyebrow">VAMOS CONVERSAR</span>
          <h2 className="nv-display" style={{ fontSize: "clamp(32px, 5vw, 56px)", marginBottom: "24px" }}>
            Seu próximo movimento começa aqui.
          </h2>
          <p style={{ fontSize: "18px", color: "var(--nv-text-secondary)", maxWidth: "600px", margin: "0 auto 40px" }}>
            Conte o que sua operação precisa. Vamos encontrar o próximo passo juntos.
          </p>
          <a href="/contato" className="nv-btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "16px 32px", background: "var(--nv-accent-gold)", color: "#000", fontWeight: 600, borderRadius: "999px", textDecoration: "none", fontSize: "15px" }}>
            Fale com a NAVOR <ArrowUpRight size={16} />
          </a>
        </div>
      </section>
    </SiteLayout>
  );
}

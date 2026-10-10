import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout, ProductFigure } from "@/components/navor/PublicSite";
import {
  Clock,
  ArrowRight,
  ArrowUpRight,
  Check,
  Briefcase,
  Store,
  Calendar,
  Package,
  Layers,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/pethub")({
  head: () => ({
    meta: [
      { title: "PetHub — Gestão inteligente para pet shops | NavorBR" },
      {
        name: "description",
        content:
          "Do caixa ao e-commerce, o PetHub conecta vendas, estoque, agenda, atendimento e gestão em uma única plataforma.",
      },
    ],
  }),
  component: PetHubPublicPage,
});

function PetHubPublicPage() {
  return (
    <SiteLayout>
      {/* 1. Hero do Produto */}
      <section className="nv-page-hero nv-section" style={{ paddingTop: "48px", paddingBottom: "36px" }}>
        <a href="/produtos" className="nv-back" id="btn-voltar-produtos">
          ← Todas as soluções
        </a>

        <div className="nv-product-title" style={{ gap: "10px", alignItems: "center", marginTop: "16px" }}>
          <span className="nv-pc-tag">Gestão para Pet Shops</span>
          <span className="nv-pc-badge nv-pc-badge--soon">
            <Clock size={12} />
            Em breve
          </span>
        </div>

        <h1 style={{ fontSize: "clamp(2.4rem, 4.4vw, 3.8rem)", margin: "16px 0 16px" }}>
          Gestão inteligente para pet shops.
        </h1>
        <p style={{ fontSize: "1.15rem", lineHeight: "1.6", maxWidth: "680px", color: "var(--nv-muted, #94a3b8)" }}>
          Do caixa ao e-commerce, o PetHub conecta vendas, estoque, agenda, atendimento e gestão em uma única plataforma.
        </p>

        {/* CTA Principal */}
        <div className="nv-actions" style={{ marginTop: "28px" }}>
          <a
            id="btn-aviso-hero-pethub"
            className="nv-button nv-button-primary"
            href="/contato?interesse=pethub"
          >
            Quero ser avisado no lançamento <ArrowRight size={17} />
          </a>
          <a
            id="btn-contato-pethub"
            className="nv-button nv-button-ghost"
            href="/contato"
          >
            Falar com a NavorBR <ArrowUpRight size={17} />
          </a>
        </div>
      </section>

      {/* 2. Demonstração Visual Ilustrativa */}
      <section className="nv-section nv-product-detail-image" style={{ paddingTop: "0" }}>
        <ProductFigure slug="pethub" />
      </section>

      {/* 3. Para Quem é Indicado */}
      <section className="nv-section" style={{ paddingTop: "20px", paddingBottom: "20px" }}>
        <div className="nv-product-target-box" data-reveal>
          <div className="nv-target-icon">
            <Briefcase size={26} />
          </div>
          <div className="nv-target-content">
            <h4>Para quem é indicado</h4>
            <p>
              Pet shops independentes, redes e franquias, clínicas veterinárias, centros de estética animal (banho e tosa), daycare e hotéis para pets.
            </p>
          </div>
        </div>
      </section>

      {/* 4. Recursos e Pilares Operacionais */}
      <section className="nv-section" data-reveal>
        <div className="nv-section-intro">
          <span className="nv-eyebrow">RECURSOS E FERRAMENTAS</span>
          <h2>O que o PetHub entrega na prática.</h2>
        </div>

        <div className="nv-feature-list" style={{ marginTop: "36px" }}>
          <article>
            <div className="nv-feature-icon" style={{ background: "rgba(20, 184, 166, 0.12)", color: "#14b8a6" }}>
              <Store size={20} />
            </div>
            <h4>PDV e Frente de Caixa com Modo Offline</h4>
            <p>
              Frente de caixa rápida com leitura de código de barras, NFC-e e maquininhas, operando mesmo em contingência local sem internet.
            </p>
          </article>

          <article>
            <div className="nv-feature-icon" style={{ background: "rgba(16, 185, 129, 0.12)", color: "#10b981" }}>
              <Calendar size={20} />
            </div>
            <h4>Fila de Banho e Tosa em Tempo Real</h4>
            <p>
              Controle de status do atendimento ao vivo (aguardando, em banho, tosa, pet pronto) com disparo de notificações por WhatsApp.
            </p>
          </article>

          <article>
            <div className="nv-feature-icon" style={{ background: "rgba(59, 130, 246, 0.12)", color: "#3b82f6" }}>
              <Package size={20} />
            </div>
            <h4>Estoque por Lote e Entrada por XML</h4>
            <p>
              Importação de NF-e de fornecedores sem digitação, reconciliação tributária e controle de validade de rações e medicamentos.
            </p>
          </article>

          <article>
            <div className="nv-feature-icon" style={{ background: "rgba(168, 85, 247, 0.12)", color: "#a855f7" }}>
              <Sparkles size={20} />
            </div>
            <h4>Site e E-commerce Integrado</h4>
            <p>
              Loja virtual e site institucional próprio para cada pet shop com reserva de estoque em tempo real e agendamento online.
            </p>
          </article>

          <article>
            <div className="nv-feature-icon" style={{ background: "rgba(245, 158, 11, 0.12)", color: "#f59e0b" }}>
              <Layers size={20} />
            </div>
            <h4>Multilojas e Franquias</h4>
            <p>
              Gestão centralizada de estoques, funcionários, transferências de produtos e relatórios financeiros consolidados.
            </p>
          </article>
        </div>
      </section>

      {/* 5. CTA Final - Lista de Espera */}
      <section className="nv-section" data-reveal>
        <div
          className="nv-product-final-cta"
          style={{
            borderColor: "rgba(20, 184, 166, 0.3)",
            background: "radial-gradient(ellipse at center, rgba(20, 184, 166, 0.1) 0%, rgba(13, 13, 18, 0.95) 100%)",
          }}
        >
          <h2>O PetHub está em desenvolvimento.</h2>
          <p>
            Deixe seu contato para receber novidades, atualizações de desenvolvimento e acesso prioritário no lançamento oficial.
          </p>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
            <a
              href="/contato?interesse=pethub"
              className="nv-button nv-button-primary"
              id="btn-aviso-final-pethub"
            >
              Quero ser avisado no lançamento <ArrowRight size={16} />
            </a>
            <a
              href="/contato"
              className="nv-button nv-button-ghost"
              id="btn-duvidas-final-pethub"
            >
              Falar com a NavorBR <ArrowUpRight size={16} />
            </a>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}

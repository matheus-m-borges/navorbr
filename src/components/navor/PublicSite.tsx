import { useEffect, useRef, type ReactNode } from "react";
import { ArrowRight, Scale, Layers3, HardHat, Box, Scissors, ArrowUpRight, PawPrint } from "lucide-react";
import { NavorHeader } from "./NavorHeader";
import { NavorFooter } from "./NavorFooter";
import { products, type Product } from "@/data/products";
import lawDemo from "@/assets/lawhub-processos-demo.png";
import repDemo from "@/assets/rephub-dashboard-demo.png";
import "./public-site.css";
import "./saas-commercial.css";


const accessLinks: Record<string, string> = {
  rephup: "/entrar?product=rephub",
  rephub: "/entrar?product=rephub",
  lawhub: "/auth?product=lawhub&next=/lawhub/dashboard",
  barberhub: "https://barberhub.navorbr.com",
  pethub: "/pethub",
};

export function SiteLayout({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (
      !root.current ||
      !("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08 },
    );
    root.current.querySelectorAll("[data-reveal]").forEach((element) => {
      element.classList.add("will-reveal");
      observer.observe(element);
    });
    return () => observer.disconnect();
  }, []);
  return (
    <div className="nv-site" ref={root}>
      <a className="nv-skip" href="#conteudo">
        Pular para o conteúdo
      </a>
      <NavorHeader />
      <main id="conteudo">{children}</main>
      <NavorFooter />
    </div>
  );
}

export function Orbital() {
  return (
    <div className="nv-network" aria-hidden="true">
      <svg viewBox="0 0 640 560" fill="none" role="presentation">
        <defs>
          <linearGradient id="navorbr-route" x1="48" y1="490" x2="586" y2="71" gradientUnits="userSpaceOnUse">
            <stop stopColor="#2457F5" stopOpacity="0.25" />
            <stop offset="0.44" stopColor="#2457F5" />
            <stop offset="1" stopColor="#00B88A" />
          </linearGradient>
          <filter id="navorbr-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <path d="M16 443H150C183 443 194 413 220 387L360 247C386 221 411 214 448 214H628" stroke="#2457F5" strokeOpacity="0.24" strokeWidth="2" />
        <path d="M45 504C90 504 129 504 158 473L318 309C347 278 370 259 408 259H607" stroke="url(#navorbr-route)" strokeWidth="11" strokeLinecap="round" />
        <path d="M194 60V132C194 169 209 186 240 208L412 328C442 349 470 352 502 352H627" stroke="#2457F5" strokeOpacity="0.68" strokeWidth="4" strokeLinecap="round" />
        <path d="M55 193H134C171 193 187 177 211 153L290 74C314 50 337 38 371 38H494" stroke="#2457F5" strokeOpacity="0.42" strokeWidth="3" strokeLinecap="round" />
        <path d="M268 497V429C268 394 283 376 313 354L452 251C480 230 501 209 501 176V84" stroke="#00B88A" strokeOpacity="0.72" strokeWidth="3" strokeLinecap="round" />
        <g fill="#00B88A" filter="url(#navorbr-glow)">
          <circle cx="158" cy="473" r="8" /><circle cx="408" cy="259" r="11" /><circle cx="502" cy="352" r="7" /><circle cx="452" cy="251" r="7" /><circle cx="240" cy="208" r="6" />
        </g>
        <g fill="#F5F8FC"><circle cx="194" cy="60" r="4" /><circle cx="494" cy="38" r="4" /><circle cx="55" cy="193" r="4" /></g>
      </svg>
      <span>NAVORBR / SISTEMAS CONECTADOS</span>
    </div>
  );
}

export function ProductIcon({ slug }: { slug: string }) {
  const Icon =
    slug === "lawhub"
      ? Scale
      : slug === "barberhub"
      ? Scissors
      : slug === "rephup" || slug === "rephub"
      ? Layers3
      : slug === "enghub"
      ? HardHat
      : slug === "pethub"
      ? PawPrint
      : Box;
  return <Icon aria-hidden="true" size={26} strokeWidth={1.5} />;
}

export function ProductFigure({ slug }: { slug: string }) {
  const isLaw = slug === "lawhub";
  const isBarber = slug === "barberhub";
  const isEng = slug === "enghub";
  const isPet = slug === "pethub";

  if (isPet) {
    return (
      <figure className="nv-product-figure nv-pet-figure">
        <div className="nv-window-bar">
          <span />
          <span />
          <span />
          <small>PetHub / Gestão & PDV</small>
        </div>
        <div className="nv-image-wrap" style={{ padding: "32px 24px", background: "radial-gradient(ellipse at top, #062420 0%, #0d0d12 100%)", minHeight: "340px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ width: "64px", height: "64px", borderRadius: "18px", background: "rgba(20, 184, 166, 0.12)", border: "1px solid rgba(20, 184, 166, 0.3)", display: "flex", alignItems: "center", justifyContent: "center", color: "#14b8a6", marginBottom: "16px", boxShadow: "0 8px 24px rgba(20,184,166,0.15)" }}>
            <PawPrint size={32} />
          </div>
          <h4 style={{ fontSize: "20px", fontWeight: "700", color: "#ffffff", letterSpacing: "-0.01em", margin: "0 0 6px 0" }}>NavorBR PetHub</h4>
          <p style={{ fontSize: "12px", color: "#a1a1aa", maxWidth: "340px", textAlign: "center", lineHeight: "1.6", margin: "0 0 20px 0" }}>
            Gestão integrada para pet shops, do caixa ao e-commerce. PDV offline, banho e tosa e prontuários.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", width: "100%", maxWidth: "360px" }}>
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", padding: "10px", borderRadius: "10px", textAlign: "center" }}>
              <span style={{ color: "#14b8a6", fontWeight: "700", fontSize: "14px", display: "block" }}>PDV</span>
              <span style={{ color: "#71717a", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Offline</span>
            </div>
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", padding: "10px", borderRadius: "10px", textAlign: "center" }}>
              <span style={{ color: "#10b981", fontWeight: "700", fontSize: "14px", display: "block" }}>Banho & Tosa</span>
              <span style={{ color: "#71717a", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Agenda</span>
            </div>
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", padding: "10px", borderRadius: "10px", textAlign: "center" }}>
              <span style={{ color: "#06b6d4", fontWeight: "700", fontSize: "14px", display: "block" }}>E-commerce</span>
              <span style={{ color: "#71717a", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Integrado</span>
            </div>
          </div>
        </div>
        <figcaption>Interface ilustrativa — ecossistema NavorBR</figcaption>
      </figure>
    );
  }

  if (isEng) {
    return (
      <figure className="nv-product-figure nv-eng-figure">
        <div className="nv-window-bar">
          <span />
          <span />
          <span />
          <small>EngHub / Canteiro & Planejamento</small>
        </div>
        <div className="nv-image-wrap" style={{ padding: "32px 24px", background: "radial-gradient(ellipse at top, #1a1712 0%, #0d0d12 100%)", minHeight: "340px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ width: "64px", height: "64px", borderRadius: "18px", background: "rgba(245, 158, 11, 0.12)", border: "1px solid rgba(245, 158, 11, 0.3)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fbbf24", marginBottom: "16px", boxShadow: "0 8px 24px rgba(245,158,11,0.15)" }}>
            <HardHat size={32} />
          </div>
          <h4 style={{ fontSize: "20px", fontWeight: "700", color: "#ffffff", letterSpacing: "-0.01em", margin: "0 0 6px 0" }}>NavorBR EngHub</h4>
          <p style={{ fontSize: "12px", color: "#a1a1aa", maxWidth: "340px", textAlign: "center", lineHeight: "1.6", margin: "0 0 20px 0" }}>
            Diário de obra digital (RDO), boletins de medição, cotação de suprimentos e controle físico-financeiro.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", width: "100%", maxWidth: "360px" }}>
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", padding: "10px", borderRadius: "10px", textAlign: "center" }}>
              <span style={{ color: "#fbbf24", fontWeight: "700", fontSize: "14px", display: "block" }}>RDO</span>
              <span style={{ color: "#71717a", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Digital</span>
            </div>
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", padding: "10px", borderRadius: "10px", textAlign: "center" }}>
              <span style={{ color: "#10b981", fontWeight: "700", fontSize: "14px", display: "block" }}>Custos</span>
              <span style={{ color: "#71717a", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Centros</span>
            </div>
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", padding: "10px", borderRadius: "10px", textAlign: "center" }}>
              <span style={{ color: "#38bdf8", fontWeight: "700", fontSize: "14px", display: "block" }}>Medição</span>
              <span style={{ color: "#71717a", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Boletins</span>
            </div>
          </div>
        </div>
        <figcaption>Interface ilustrativa — ecossistema NavorBR em desenvolvimento</figcaption>
      </figure>
    );
  }

  if (isBarber) {
    return (
      <figure className="nv-product-figure nv-barber-figure">
        <div className="nv-window-bar">
          <span />
          <span />
          <span />
          <small>BarberHub / Agenda & PDV</small>
        </div>
        <div className="nv-image-wrap" style={{ padding: "32px 24px", background: "radial-gradient(ellipse at top, #1c1c24 0%, #0d0d12 100%)", minHeight: "340px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ width: "64px", height: "64px", borderRadius: "18px", background: "rgba(245, 158, 11, 0.12)", border: "1px solid rgba(245, 158, 11, 0.3)", display: "flex", alignItems: "center", justifyContent: "center", color: "#f59e0b", marginBottom: "16px", boxShadow: "0 8px 24px rgba(245,158,11,0.15)" }}>
            <Scissors size={32} />
          </div>
          <h4 style={{ fontSize: "20px", fontWeight: "700", color: "#ffffff", letterSpacing: "-0.01em", margin: "0 0 6px 0" }}>NavorBR BarberHub Pro</h4>
          <p style={{ fontSize: "12px", color: "#a1a1aa", maxWidth: "340px", textAlign: "center", lineHeight: "1.6", margin: "0 0 20px 0" }}>
            Agenda inteligente por barbeiro, comissões em tempo real, controle de comandas, caixa e fidelidade WhatsApp.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", width: "100%", maxWidth: "360px" }}>
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", padding: "10px", borderRadius: "10px", textAlign: "center" }}>
              <span style={{ color: "#f59e0b", fontWeight: "700", fontSize: "14px", display: "block" }}>100%</span>
              <span style={{ color: "#71717a", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Em Nuvem</span>
            </div>
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", padding: "10px", borderRadius: "10px", textAlign: "center" }}>
              <span style={{ color: "#10b981", fontWeight: "700", fontSize: "14px", display: "block" }}>WhatsApp</span>
              <span style={{ color: "#71717a", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Lembretes</span>
            </div>
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", padding: "10px", borderRadius: "10px", textAlign: "center" }}>
              <span style={{ color: "#06b6d4", fontWeight: "700", fontSize: "14px", display: "block" }}>PDV</span>
              <span style={{ color: "#71717a", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em" }}>Comandas</span>
            </div>
          </div>
        </div>
        <figcaption>Interface ilustrativa — ecossistema NavorBR</figcaption>
      </figure>
    );
  }

  return (
    <figure className={`nv-product-figure ${isLaw ? "nv-law-figure" : "nv-rep-figure"}`}>
      <div className="nv-window-bar">
        <span />
        <span />
        <span />
        <small>{isLaw ? "LawHub / Processos" : "RepHub / Visão comercial"}</small>
      </div>
      <div className="nv-image-wrap">
        <img
          src={isLaw ? lawDemo : repDemo}
          alt={
            isLaw
              ? "Interface ilustrativa do LawHub com detalhes de um processo fictício."
              : "Interface ilustrativa do RepHub com indicadores comerciais fictícios."
          }
          loading="lazy"
          width={isLaw ? 1825 : 843}
          height={isLaw ? 862 : 1864}
        />
      </div>
      <figcaption>Interface ilustrativa — dados fictícios</figcaption>
    </figure>
  );
}

export function ProductRows() {
  return (
    <div className="nv-product-rows">
      {products
        .filter((p) => p.status === "available")
        .map((product, index) => (
          <article
            className={`nv-product-row ${index % 2 ? "nv-reverse" : ""}`}
            key={product.slug}
            data-reveal
          >
            <div className="nv-product-copy">
              <span className="nv-eyebrow">
                0{index + 1} /{" "}
                {product.slug === "lawhub"
                  ? "GESTÃO JURÍDICA"
                  : product.slug === "barberhub"
                  ? "BARBEARIAS & ESTÉTICA"
                  : "REPRESENTAÇÃO COMERCIAL"}
              </span>
              <div className="nv-product-title">
                <ProductIcon slug={product.slug} />
                <h3>{product.name.replace(/^Navor(?:BR)?\s+/, "")}</h3>
              </div>
              <p>{product.fullDescription}</p>
              <ul className="nv-tags">
                {product.features?.slice(0, 3).map((f) => (
                  <li key={f.title}>{f.title}</li>
                ))}
              </ul>
              <a className="nv-text-link" href={`/produtos/${product.slug}`}>
                Explore o {product.name.replace(/^Navor(?:BR)?\s+/, "")} <ArrowUpRight size={19} />
              </a>
            </div>
            <ProductFigure slug={product.slug} />
          </article>
        ))}
    </div>
  );
}

export function Roadmap() {
  return (
    <section className="nv-section nv-roadmap" data-reveal>
      <div className="nv-section-intro">
        <span className="nv-eyebrow">O PRÓXIMO CAPÍTULO</span>
        <h2>
          O futuro já está
          <br />
          em desenvolvimento.
        </h2>
      </div>
      <div className="nv-roadmap-list">
        {products
          .filter((p) => p.status === "coming_soon")
          .map((p) => (
            <a key={p.slug} href={`/produtos/${p.slug}`}>
              <ProductIcon slug={p.slug} />
              <div>
                <h3>{p.name.replace(/^Navor(?:BR)?\s+/, "")}</h3>
                <p>{p.shortDescription}</p>
              </div>
              <span className="nv-badge">Em breve</span>
              <ArrowUpRight size={20} />
            </a>
          ))}
      </div>
    </section>
  );
}

export function ContactCTA() {
  return (
    <section className="nv-contact-cta nv-section" id="contato" data-reveal>
      <span className="nv-eyebrow">VAMOS CONVERSAR</span>
      <h2>
        Seu próximo movimento
        <br />
        começa aqui.
      </h2>
      <p>Conte o que sua operação precisa. Vamos encontrar o próximo passo juntos.</p>
      <a className="nv-button" href="/contato">
        Fale com a NavorBR <ArrowUpRight size={18} />
      </a>
    </section>
  );
}

export function ProductPage({ product }: { product: Product }) {
  const live = product.status === "available";
  const access = accessLinks[product.slug] || accessLinks[product.slug.replace("rephup", "rephub")];
  const isExternal = access?.startsWith("http");

  return (
    <SiteLayout>
      <section className="nv-page-hero nv-section">
        <a href="/produtos" className="nv-back">
          ← Todas as soluções
        </a>
        <div className="nv-product-title">
          <ProductIcon slug={product.slug} />
          <span className="nv-eyebrow">{product.name}</span>
          <span className="nv-badge">{live ? "Disponível" : "Em breve"}</span>
        </div>
        <h1>{product.shortDescription}</h1>
        <p>{product.fullDescription}</p>
        <div className="nv-actions">
          {live && access && (
            <a
              className="nv-button"
              href={access}
              target={isExternal ? "_blank" : undefined}
              rel={isExternal ? "noopener noreferrer" : undefined}
            >
              Acessar {product.name.replace(/^Navor(?:BR)?\s+/, "")} <ArrowRight size={18} />
            </a>
          )}
          <a className="nv-button nv-button-ghost" href="/contato">
            Falar com a NavorBR <ArrowUpRight size={18} />
          </a>
        </div>
      </section>
      {live ? (
        <>
          <section className="nv-section nv-product-detail-image">
            <ProductFigure slug={product.slug} />
          </section>
          <section className="nv-section" data-reveal>
            <span className="nv-eyebrow">NO DIA A DIA</span>
            <h2>
              Mais contexto.
              <br />
              Mais controle.
            </h2>
            <div className="nv-feature-list">
              {product.features?.map((f, i) => (
                <article key={f.title}>
                  <span>0{i + 1}</span>
                  <h3>{f.title}</h3>
                  <p>{f.description}</p>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : (
        <section className="nv-section nv-coming" data-reveal>
          <Orbital />
          <div>
            <span className="nv-eyebrow">EM DESENVOLVIMENTO</span>
            <h2>
              Uma nova conexão
              <br />
              no ecossistema.
            </h2>
            <p>
              Estamos preparando o próximo capítulo. Conheça as soluções já disponíveis enquanto
              este produto ganha forma.
            </p>
            <a href="/produtos" className="nv-text-link">
              Conhecer as soluções NavorBR <ArrowRight size={18} />
            </a>
          </div>
        </section>
      )}
      <ContactCTA />
    </SiteLayout>
  );
}

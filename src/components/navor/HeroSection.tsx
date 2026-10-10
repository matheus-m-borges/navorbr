import { useEffect, useRef } from "react";
import { ArrowUpRight } from "lucide-react";
import gsap from "gsap";
import { products } from "@/data/products";
import { ProductIcon } from "./PublicSite";

export function HeroSection() {
  const heroRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const visualRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      
      tl.from(".nv-hero-eyebrow", { y: 20, opacity: 0, duration: 0.8 })
        .from(".nv-hero-title span", { y: 40, opacity: 0, stagger: 0.15, duration: 1 }, "-=0.4")
        .from(".nv-hero-subtitle", { y: 20, opacity: 0, duration: 0.8 }, "-=0.6")
        .from(".nv-hero-signature", { opacity: 0, duration: 1 }, "-=0.4")
        .from(".nv-orbital-ring", { scale: 0.8, opacity: 0, stagger: 0.1, duration: 1.2 }, "-=1")
        .from(".nv-orbital-node", { scale: 0, duration: 0.6, stagger: 0.05 }, "-=0.8");

      const handleMouseMove = (e: MouseEvent) => {
        const x = (e.clientX / window.innerWidth - 0.5) * 20;
        const y = (e.clientY / window.innerHeight - 0.5) * 20;
        
        gsap.to(".nv-orbital-composition", {
          rotateX: -y * 0.5,
          rotateY: x * 0.5,
          duration: 1,
          ease: "power2.out"
        });
      };

      window.addEventListener("mousemove", handleMouseMove);
      return () => window.removeEventListener("mousemove", handleMouseMove);
    }, heroRef);

    return () => ctx.revert();
  }, []);

  const heroProducts = products.slice(0, 6);

  return (
    <section className="nv-hero nv-section" ref={heroRef}>
      <div className="nv-container nv-hero-inner">
        <div className="nv-hero-content" ref={contentRef}>
          <span className="nv-eyebrow nv-hero-eyebrow">NAVOR SISTEMAS</span>
          <h1 className="nv-display nv-hero-title">
            <span>O futuro da gest\u00e3o</span>
            <br />
            <span>come\u00e7a </span>
            <span style={{ color: "var(--nv-accent-gold)" }}>aqui.</span>
          </h1>
          <p className="nv-hero-subtitle">
            Um ecossistema de solu\u00e7\u00f5es inteligentes para simplificar opera\u00e7\u00f5es,
            conectar equipes e impulsionar neg\u00f3cios.
          </p>
          <div className="nv-hero-actions">
            <a href="#solucoes" className="nv-btn-primary">
              Explorar solu\u00e7\u00f5es <ArrowUpRight size={16} />
            </a>
            <a href="/contato" className="nv-btn-ghost">
              Fale conosco
            </a>
          </div>
          <span className="nv-hero-signature">TECNOLOGIA PARA EVOLUIR</span>
        </div>

        <div className="nv-hero-visual" ref={visualRef}>
          <div className="nv-orbital-composition">
            <div className="nv-orbital-ring" />
            <div className="nv-orbital-ring" />
            <div className="nv-orbital-ring" />
            
            {heroProducts.map((product, i) => {
              const angle = (i / heroProducts.length) * Math.PI * 2 - Math.PI / 2;
              const radius = 42;
              const top = 50 + Math.sin(angle) * radius;
              const left = 50 + Math.cos(angle) * radius;
              
              return (
                <a
                  key={product.slug}
                  href={`/solucoes/${product.slug}`}
                  className="nv-orbital-node"
                  style={{ top: `${top}%`, left: `${left}%` }}
                  aria-label={`Conhecer ${product.name}`}
                >
                  <ProductIcon slug={product.slug} />
                  <span className="nv-orbital-tooltip">{product.name.replace(/^Navor(?:BR)?\s+/, "")}</span>
                </a>
              );
            })}

            <div className="nv-orbital-center">
              <img 
                src="/navorbr-logo-light.svg" 
                alt="NAVOR" 
                width={48} 
                height={48}
                style={{ filter: "brightness(0) invert(1)" }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}


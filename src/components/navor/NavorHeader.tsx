import { ArrowUpRight, ChevronDown, Menu } from "lucide-react";
import { useRouterState } from "@tanstack/react-router";
import { products, getProductAccessUrl } from "@/data/products";

export function NavorHeader() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const nav = [
    { name: "Empresa", href: "/empresa" },
    { name: "Soluções", href: "/produtos" },
    { name: "Contato", href: "/contato" },
  ];

  // Sistemas disponíveis para login direto
  const availableSystems = products
    .filter((p) => p.status === "available")
    .map((p) => ({
      name: p.name.replace(/^Navor(?:BR)?\s+/, ""),
      fullName: p.name,
      slug: p.slug,
      description:
        p.slug === "barberhub"
          ? "Barbearias & estética"
          : p.slug === "lawhub"
          ? "Gestão jurídica"
          : p.slug === "rephup" || p.slug === "rephub"
          ? "Representação comercial"
          : p.shortDescription,
      href: getProductAccessUrl(p.slug),
    }));

  return (
    <header className="nv-header">
      <a href="/" className="nv-logo" aria-label="NavorBR — página inicial">
        <img
          src="/navorbr-logo-light.svg"
          alt="NavorBR"
          width={164}
          height={40}
        />
      </a>

      <nav aria-label="Navegação principal" className="nv-desktop-nav">
        {nav.map((n) => (
          <a key={n.href} href={n.href} aria-current={path.startsWith(n.href) ? "page" : undefined}>
            {n.name}
          </a>
        ))}
      </nav>

      <div className="nv-access">
        <div className="nv-access-buttons">
          <a href="/entrar">
            Login / Acessar sistemas <ArrowUpRight size={15} />
          </a>
          <details className="nv-access-details">
            <summary aria-label="Mostrar sistemas disponíveis">
              <ChevronDown size={16} />
            </summary>
            <nav id="nv-systems" aria-label="Sistemas disponíveis" className="nv-access-dropdown">
              <p>SEU AMBIENTE DE TRABALHO</p>
              {availableSystems.map((s) => (
                <a key={s.name} href={s.href} target={s.href.startsWith("http") ? "_blank" : undefined} rel={s.href.startsWith("http") ? "noopener noreferrer" : undefined}>
                  <span>
                    <strong>{s.name}</strong>
                    <small>{s.description}</small>
                  </span>
                  <ArrowUpRight size={18} />
                </a>
              ))}
            </nav>
          </details>
        </div>
      </div>

      <details className="nv-mobile-details">
        <summary aria-label="Abrir navegação">
          <Menu size={22} />
        </summary>
        <nav id="nv-mobile-nav" aria-label="Navegação móvel" className="nv-mobile-nav">
          {nav.map((n) => (
            <a key={n.href} href={n.href}>
              {n.name}
            </a>
          ))}
          <a href="/entrar" className="nv-mobile-action">Login / Escolher sistema</a>
          {availableSystems.map((s) => (
            <a key={s.name} href={s.href} target={s.href.startsWith("http") ? "_blank" : undefined} rel={s.href.startsWith("http") ? "noopener noreferrer" : undefined}>
              Acessar {s.name} <ArrowUpRight size={16} />
            </a>
          ))}
        </nav>
      </details>
    </header>
  );
}

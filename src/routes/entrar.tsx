import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, Store, BriefcaseBusiness } from "lucide-react";
import { SiteLayout, ProductIcon } from "@/components/navor/PublicSite";
import { products, getProductAccessUrl } from "@/data/products";

export const Route = createFileRoute("/entrar")({
  validateSearch: (search: Record<string, unknown>): { product?: string } => ({
    product: typeof search.product === "string" ? search.product : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Acessar sistemas | NavorBR" },
      {
        name: "description",
        content: "Acesse RepHub, LawHub ou BarberHub para entrar no seu ambiente de trabalho NavorBR.",
      },
    ],
  }),
  component: EntryPage,
});

function EntryPage() {
  const { product } = Route.useSearch();
  const rep = product === "rephub";

  const choices = rep
    ? [
        {
          name: "Sou cliente",
          text: "Consulte coleções, materiais e pedidos no portal do cliente.",
          href: "/cliente/login",
          icon: <Store size={30} />,
        },
        {
          name: "Sou representante",
          text: "Acesse clientes, pedidos, comissões e sua operação comercial.",
          href: "/auth?product=rephub",
          icon: <BriefcaseBusiness size={30} />,
        },
      ]
    : products
        .filter((p) => p.status === "available")
        .map((p) => ({
          name: p.name.replace(/^Navor(?:BR)?\s+/, ""),
          text:
            p.slug === "barberhub"
              ? "Seu ambiente de gestão completa para barbearias e estética."
              : p.slug === "lawhub"
              ? "Seu ambiente de gestão jurídica e processos."
              : p.slug === "rephup" || p.slug === "rephub"
              ? "Seu ambiente de representação comercial."
              : p.shortDescription,
          href: getProductAccessUrl(p.slug),
          icon: <ProductIcon slug={p.slug} />,
          isExternal: p.slug === "barberhub",
        }));

  return (
    <SiteLayout>
      <section className="nv-section nv-page-hero nv-entry-heading">
        {rep && (
          <a href="/entrar" className="nv-back">
            ← Voltar aos sistemas
          </a>
        )}
        <span className="nv-eyebrow">{rep ? "REPHUB / ACESSO" : "SEU AMBIENTE DE TRABALHO"}</span>
        <h1>{rep ? "Como você quer entrar?" : "Escolha seu sistema."}</h1>
        <p>
          {rep
            ? "Selecione seu perfil para continuar."
            : "Tudo pronto para o seu próximo movimento no ecossistema NavorBR."}
        </p>
      </section>
      <section
        className="nv-section nv-entry-options"
        aria-label={rep ? "Perfis do RepHub" : "Sistemas disponíveis"}
      >
        {choices.map((c) => (
          <a
            href={c.href}
            key={c.name}
            target={(c as any).isExternal ? "_blank" : undefined}
            rel={(c as any).isExternal ? "noopener noreferrer" : undefined}
          >
            <span className="nv-entry-icon">{c.icon}</span>
            <h2>{c.name}</h2>
            <p>{c.text}</p>
            <span className="nv-text-link">
              Acessar <ArrowUpRight size={19} />
            </span>
          </a>
        ))}
      </section>
    </SiteLayout>
  );
}

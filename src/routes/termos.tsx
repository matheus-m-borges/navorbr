import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Shield, CheckCircle2 } from "lucide-react";
import { NAVOR_TERMS_V1_1 } from "@/core/legal/terms-and-privacy";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso e Prestação de Serviços | NAVOR" },
      {
        name: "description",
        content:
          "Termos de Uso e Prestação de Serviços da Plataforma SaaS NAVOR (Versão 1.1 — 07/10/2026). Regras contratuais, segurança, LGPD e governança.",
      },
    ],
  }),
  component: TermosPage,
});

function TermosPage() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-brand/20">
      {/* Barra superior de navegação limpa */}
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
          <Link
            to="/cadastro"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Voltar ao cadastro
          </Link>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-[11px] font-semibold text-brand">
              Versão {NAVOR_TERMS_V1_1.version}
            </span>
            <span className="text-[11px] text-muted-foreground">{NAVOR_TERMS_V1_1.date}</span>
          </div>
        </div>
      </header>

      {/* Conteúdo centralizado para alta legibilidade (760px - 860px) */}
      <main className="mx-auto max-w-[820px] px-4 py-10 sm:px-6 sm:py-14">
        {/* Cabeçalho do Documento */}
        <div className="mb-10 border-b border-border pb-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
            <Shield className="size-3.5 text-brand" />
            Documento Jurídico Oficial NAVOR
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-card-foreground sm:text-3xl">
            {NAVOR_TERMS_V1_1.title}
          </h1>
          <p className="mt-1 text-sm font-medium text-brand">{NAVOR_TERMS_V1_1.subtitle}</p>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span>Versão oficial: <strong>{NAVOR_TERMS_V1_1.version}</strong></span>
            <span>Data de publicação: <strong>{NAVOR_TERMS_V1_1.date}</strong></span>
            <span>Status: <strong>Vigente</strong></span>
          </div>

          <div className="mt-6 rounded-xl border border-border/80 bg-card/40 p-4 text-xs leading-relaxed text-muted-foreground">
            {NAVOR_TERMS_V1_1.preamble}
          </div>
        </div>

        {/* Índice Rápido */}
        <nav aria-label="Sumário dos termos" className="mb-10 rounded-xl border border-border bg-card/30 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Sumário dos Termos
          </h2>
          <ul className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2 text-xs">
            {NAVOR_TERMS_V1_1.sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="text-muted-foreground transition hover:text-brand"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Seções dos Termos */}
        <article className="space-y-10 text-sm leading-relaxed text-card-foreground">
          {NAVOR_TERMS_V1_1.sections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-20">
              <h2 className="border-b border-border/60 pb-2 text-base font-semibold text-card-foreground sm:text-lg">
                {section.title}
              </h2>
              <div className="mt-3 space-y-2.5 text-xs sm:text-sm text-muted-foreground">
                {section.content.map((paragraph, idx) => (
                  <p key={idx} className="leading-relaxed">
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </article>

        {/* Rodapé do documento com confirmação de aceite */}
        <div className="mt-14 border-t border-border pt-8 text-center">
          <div className="mx-auto flex max-w-md flex-col items-center gap-3">
            <CheckCircle2 className="size-8 text-brand" />
            <h3 className="text-sm font-semibold text-card-foreground">
              Adesão aos Termos de Uso
            </h3>
            <p className="text-xs text-muted-foreground">
              O aceite deste instrumento é formalizado digitalmente no ato de criação de conta ou atualização cadastral, com registro imutável de data, hora e versão.
            </p>
            <div className="mt-2 flex gap-3">
              <Link
                to="/cadastro"
                className="rounded-lg bg-brand px-4 py-2 text-xs font-medium text-white transition hover:bg-brand/90"
              >
                Prosseguir para o cadastro
              </Link>
              <Link
                to="/privacidade"
                className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-card-foreground transition hover:bg-card"
              >
                Ver Política de Privacidade
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

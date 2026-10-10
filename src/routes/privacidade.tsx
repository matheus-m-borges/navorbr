import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Lock, CheckCircle2 } from "lucide-react";
import { NAVOR_PRIVACY_V1_0 } from "@/core/legal/terms-and-privacy";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade | NAVOR" },
      {
        name: "description",
        content:
          "Política de Privacidade e Proteção de Dados da NAVOR Sistemas (Versão 1.0 — 07/10/2026). Conformidade com a LGPD, segurança da informação e direitos dos titulares.",
      },
    ],
  }),
  component: PrivacidadePage,
});

function PrivacidadePage() {
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
              Versão {NAVOR_PRIVACY_V1_0.version}
            </span>
            <span className="text-[11px] text-muted-foreground">{NAVOR_PRIVACY_V1_0.date}</span>
          </div>
        </div>
      </header>

      {/* Conteúdo centralizado para alta legibilidade (760px - 860px) */}
      <main className="mx-auto max-w-[820px] px-4 py-10 sm:px-6 sm:py-14">
        {/* Cabeçalho do Documento */}
        <div className="mb-10 border-b border-border pb-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
            <Lock className="size-3.5 text-brand" />
            Conformidade LGPD — NAVOR Sistemas
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-card-foreground sm:text-3xl">
            {NAVOR_PRIVACY_V1_0.title}
          </h1>
          <p className="mt-1 text-sm font-medium text-brand">{NAVOR_PRIVACY_V1_0.subtitle}</p>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span>Versão oficial: <strong>{NAVOR_PRIVACY_V1_0.version}</strong></span>
            <span>Data de publicação: <strong>{NAVOR_PRIVACY_V1_0.date}</strong></span>
            <span>Canal do DPO: <strong>privacidade@navorbr.com</strong></span>
          </div>

          <div className="mt-6 rounded-xl border border-border/80 bg-card/40 p-4 text-xs leading-relaxed text-muted-foreground">
            {NAVOR_PRIVACY_V1_0.preamble}
          </div>
        </div>

        {/* Índice Rápido */}
        <nav aria-label="Sumário da política" className="mb-10 rounded-xl border border-border bg-card/30 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Sumário da Política
          </h2>
          <ul className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2 text-xs">
            {NAVOR_PRIVACY_V1_0.sections.map((section) => (
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

        {/* Seções da Política */}
        <article className="space-y-10 text-sm leading-relaxed text-card-foreground">
          {NAVOR_PRIVACY_V1_0.sections.map((section) => (
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

        {/* Rodapé da Política */}
        <div className="mt-14 border-t border-border pt-8 text-center">
          <div className="mx-auto flex max-w-md flex-col items-center gap-3">
            <CheckCircle2 className="size-8 text-brand" />
            <h3 className="text-sm font-semibold text-card-foreground">
              Transparência e Governança
            </h3>
            <p className="text-xs text-muted-foreground">
              A manifestação de ciência desta Política ocorre conjuntamente com o aceite dos Termos de Uso no momento do cadastro.
            </p>
            <div className="mt-2 flex gap-3">
              <Link
                to="/cadastro"
                className="rounded-lg bg-brand px-4 py-2 text-xs font-medium text-white transition hover:bg-brand/90"
              >
                Ir para o Cadastro
              </Link>
              <Link
                to="/termos"
                className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-card-foreground transition hover:bg-card"
              >
                Ver Termos de Uso
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

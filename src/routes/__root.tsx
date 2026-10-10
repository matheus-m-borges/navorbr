import type { ErrorComponentProps } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { writeAuditLog } from "@/lib/audit.functions";

import appCss from "../styles.css?url";
import { ThemeProvider } from "@/components/ThemeProvider";

function NotFoundComponent() {
  const isClient = typeof window !== "undefined";
  const path = isClient ? window.location.pathname : "";
  const isLawHub = isClient && (path.startsWith("/lawhub") || path.includes("lawhub"));

  useEffect(() => {
    if (typeof window === "undefined") return;
    const currentPath = window.location.pathname;
    const search = window.location.search || "";
    
    // Auto-redirecionamentos inteligentes para login/primeiro acesso e rotas LawHub para nunca exibir 404
    if (currentPath === "/login" || currentPath === "/login/") {
      window.location.replace("/auth" + search);
      return;
    }
    if (currentPath === "/lawhub" || currentPath === "/lawhub/") {
      window.location.replace("/lawhub/dashboard" + search);
      return;
    }
    if (currentPath === "/lawhub/kanban" || currentPath === "/lawhub/kanban/") {
      window.location.replace("/lawhub/tarefas" + search);
      return;
    }
    if (currentPath === "/lawhub/contatos" || currentPath === "/lawhub/contatos/") {
      window.location.replace("/lawhub/clientes" + search);
      return;
    }
    if (currentPath === "/lawhub/workflows" || currentPath === "/lawhub/workflows/") {
      window.location.replace("/lawhub/casos" + search);
      return;
    }
    if (currentPath === "/lawhub/criacao-pecas" || currentPath === "/lawhub/criacao-pecas/") {
      window.location.replace("/lawhub/modelos" + search);
      return;
    }
    if (currentPath === "/lawhub/jurisprudencia" || currentPath === "/lawhub/jurisprudencia/") {
      window.location.replace("/lawhub/ia" + search);
      return;
    }
    if (currentPath.startsWith("/lawhub")) {
      window.location.replace("/lawhub/dashboard" + search);
      return;
    }
  }, []);

  if (isLawHub) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white px-4">
        <div className="max-w-md text-center space-y-4">
          <div className="size-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <h2 className="text-xl font-bold text-white">Carregando Navor LawHub...</h2>
          <p className="text-sm text-slate-400">
            Conectando ao ecossistema jurídico e acervo de processos.
          </p>
          <a
            href="/lawhub/dashboard"
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500"
          >
            Acessar Área de Trabalho LawHub
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold text-card-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-card-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A página que você procura não existe ou foi movida.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link
            to="/lawhub/dashboard"
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Acessar LawHub
          </Link>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Ir para o início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error("[RootError]", error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-card-foreground">
          Não foi possível carregar esta página
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Algo deu errado. Tente novamente ou volte ao início.
        </p>
        {(error as Error)?.message && (
          <div className="mt-4 text-left">
            <details className="rounded-lg border border-border/60 bg-muted/30 p-2.5 text-xs text-muted-foreground">
              <summary className="cursor-pointer font-medium hover:text-card-foreground">
                Ver detalhes técnicos do erro
              </summary>
              <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-destructive break-all">
                {(error as Error).message}
              </pre>
            </details>
          </div>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset?.();
            }}
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-brand to-cyan px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-border bg-secondary px-4 py-2 text-sm font-medium text-card-foreground"
          >
            Ir para o início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "NavorBR | Sistemas conectados. Decisões mais simples." },
      {
        name: "description",
        content:
          "A NavorBR cria produtos digitais que simplificam operações, conectam informações e ajudam empresas a crescer.",
      },
      { property: "og:title", content: "NavorBR | Sistemas conectados. Decisões mais simples." },
      {
        property: "og:description",
        content: "A NavorBR cria produtos digitais que simplificam operações, conectam informações e ajudam empresas a crescer.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap",
      },
      { rel: "icon", href: "/navorbr-icon.svg", type: "image/svg+xml" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                let theme = localStorage.getItem('rephub-theme') || 'system';
                if (theme === 'system') {
                  theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                }
                if (theme === 'dark') {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.add('light');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  const location = router.state.location;
  useEffect(() => {
    let cancelled = false;
    // Só registra o acesso quando existe sessão ativa; sem login não há o que auditar.
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled || !data.session) return;
      try {
        await writeAuditLog({
          data: {
            entityType: "page_view",
            action: "view",
            description: location.pathname,
          },
        });
      } catch {
        // falha silenciosa: histórico de navegação não deve interromper a página
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  return (
    <ThemeProvider defaultTheme="system" storageKey="rephub-theme">
      <QueryClientProvider client={queryClient}>
        <Outlet />
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

const getSiteContent = createServerFn({ method: "GET" }).handler(async () => {
  const { getPublicCatalog } = await import("@/lib/site/site-checkout-service.server");
  return getPublicCatalog();
});

export const Route = createFileRoute("/site/")({
  loader: () => getSiteContent(),
  component: SiteHome,
});

function SiteHome() {
  const catalog = Route.useLoaderData();
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <h1 className="text-2xl font-bold tracking-tight text-emerald-400">NAVOR</h1>
          <nav className="flex gap-6 text-sm font-medium">
            <Link to="/site/planos" className="hover:text-emerald-400 transition-colors">Planos</Link>
            <Link to="/site/checkout" className="hover:text-emerald-400 transition-colors">Assinar</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-16">
        <section className="mb-16 text-center">
          <h2 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Plataforma SaaS para Barbearias
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-slate-400">
            Gestão completa de agenda, clientes, financeiro e estoque com isolamento multi-tenant e segurança enterprise.
          </p>
        </section>
        <section className="grid gap-8 md:grid-cols-3">
          {catalog?.map((product: any) => (
            <div key={product.id} className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
              <h3 className="mb-2 text-xl font-semibold text-emerald-400">{product.name}</h3>
              <p className="mb-4 text-sm text-slate-400">{product.description}</p>
              <Link
                to="/site/planos"
                className="inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 transition-colors"
              >
                Ver Planos
              </Link>
            </div>
          )) ?? (
            <p className="col-span-3 text-center text-slate-500">Carregando catálogo...</p>
          )}
        </section>
      </main>
    </div>
  );
}

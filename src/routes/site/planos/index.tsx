import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

const getPlans = createServerFn({ method: "GET" }).handler(async () => {
  const { getPublicCatalog } = await import("@/lib/site/site-checkout-service.server");
  return getPublicCatalog();
});

export const Route = createFileRoute("/site/planos/")({
  loader: () => getPlans(),
  component: PlansPage,
});

function PlansPage() {
  const catalog = Route.useLoaderData();
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/site" className="text-2xl font-bold tracking-tight text-emerald-400">NAVOR</Link>
          <nav className="flex gap-6 text-sm font-medium">
            <Link to="/site/planos" className="text-emerald-400">Planos</Link>
            <Link to="/site/checkout" className="hover:text-emerald-400 transition-colors">Assinar</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-16">
        <h1 className="mb-8 text-center text-3xl font-bold tracking-tight">Escolha seu Plano</h1>
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {catalog?.flatMap((product: any) => product.plans?.map((plan: any) => (
            <div key={plan.id} className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/50 p-6">
              <h3 className="mb-2 text-xl font-semibold text-emerald-400">{plan.name}</h3>
              <p className="mb-4 text-sm text-slate-400">{product.name}</p>
              <div className="mb-6 text-3xl font-bold">
                R$ {plan.price_cents ? (plan.price_cents / 100).toFixed(2) : "0,00"}
                <span className="text-base font-normal text-slate-500">/{plan.billing_cycle === "yearly" ? "ano" : "mês"}</span>
              </div>
              <ul className="mb-6 flex-1 space-y-2 text-sm text-slate-300">
                {plan.features?.map((feature: string, i: number) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-emerald-500">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
              <Link
                to="/site/checkout"
                search={{ plan_id: plan.id, product_id: product.id, billing_cycle: plan.billing_cycle }}
                className="mt-auto inline-block rounded-lg bg-emerald-600 px-4 py-3 text-center text-sm font-medium hover:bg-emerald-500 transition-colors"
              >
                Assinar Agora
              </Link>
            </div>
          )) ?? []) ?? (
            <p className="col-span-3 text-center text-slate-500">Carregando planos...</p>
          )}
        </div>
      </main>
    </div>
  );
}

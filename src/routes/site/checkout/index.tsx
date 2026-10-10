import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";

const getCheckoutData = createServerFn({ method: "GET" }).handler(async ({ data }) => {
  const { getCheckoutSession } = await import("@/lib/site/site-checkout-service.server");
  return getCheckoutSession(data.token);
});

const submitCheckout = createServerFn({ method: "POST" }).handler(async ({ data }) => {
  const { createCheckoutSession } = await import("@/lib/site/site-checkout-service.server");
  return createCheckoutSession(data);
});

export const Route = createFileRoute("/site/checkout/")({
  validateSearch: (search) => ({
    plan_id: String(search.plan_id || ""),
    product_id: String(search.product_id || ""),
    billing_cycle: String(search.billing_cycle || "monthly"),
  }),
  loader: async ({ deps }) => {
    if (!deps.plan_id || !deps.product_id) return null;
    try {
      const session = await submitCheckout({
        data: {
          productId: deps.product_id,
          planId: deps.plan_id,
          billingCycle: deps.billing_cycle as "monthly" | "yearly",
        },
      });
      if (session?.session_token) {
        return getCheckoutData({ data: { token: session.session_token } });
      }
    } catch {
      return null;
    }
    return null;
  },
  component: CheckoutPage,
});

function CheckoutPage() {
  const checkoutData = Route.useLoaderData();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setIsSubmitting(true);
    setError(null);
    try {
      await new Promise((r) => setTimeout(r, 500));
    } catch {
      setError("Falha na conexão. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link to="/site" className="text-2xl font-bold tracking-tight text-emerald-400">NAVOR</Link>
          <Link to="/site/planos" className="text-sm font-medium hover:text-emerald-400 transition-colors">
            ← Voltar aos Planos
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="mb-8 text-3xl font-bold tracking-tight">Finalizar Assinatura</h1>
        {checkoutData ? (
          <div className="mb-8 rounded-xl border border-slate-800 bg-slate-900/50 p-6">
            <h2 className="mb-2 text-xl font-semibold text-emerald-400">Sessão de Checkout</h2>
            <p className="text-sm text-slate-400">Token: {checkoutData.session_token?.slice(0, 8)}...</p>
            <p className="text-sm text-slate-400">Status: {checkoutData.status}</p>
          </div>
        ) : (
          <p className="mb-8 text-slate-500">Iniciando sessão de checkout...</p>
        )}
        <form action={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-300">
              E-mail Administrativo
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="admin@barbearia.com"
            />
          </div>
          <div>
            <label htmlFor="business_name" className="mb-2 block text-sm font-medium text-slate-300">
              Nome da Barbearia
            </label>
            <input
              id="business_name"
              name="business_name"
              type="text"
              required
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="Barbearia Exemplo"
            />
          </div>
          <label className="flex items-start gap-3">
            <input
              name="terms_accepted"
              type="checkbox"
              required
              className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-800 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-sm text-slate-300">
              Li e aceito os <Link to="/site/terms" className="text-emerald-400 underline">Termos de Uso</Link> e a{" "}
              <Link to="/site/privacy" className="text-emerald-400 underline">Política de Privacidade</Link>.
            </span>
          </label>
          {error && (
            <div className="rounded-lg border border-red-800 bg-red-900/30 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-emerald-600 px-4 py-4 text-lg font-bold hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? "Processando..." : "Confirmar Assinatura"}
          </button>
        </form>
      </main>
    </div>
  );
}

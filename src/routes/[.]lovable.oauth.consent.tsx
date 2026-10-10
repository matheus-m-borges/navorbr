import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GlassCard, PrimaryButton } from "@/components/navor-rephub/ui";
import { RepHubAccessLayout } from "@/components/navor/RepHubAccessLayout";

type OAuthClient = { name?: string | null };
type AuthorizationDetails = {
  client?: OAuthClient | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
};
type OAuthResult = { data: AuthorizationDetails | null; error: { message: string } | null };
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
  approveAuthorization: (id: string) => Promise<OAuthResult>;
  denyAuthorization: (id: string) => Promise<OAuthResult>;
};

function oauthApi(): OAuthApi {
  return (supabase.auth as unknown as { oauth: OAuthApi }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Autorizar acesso | NAVOR" },
      {
        name: "description",
        content: "Autorize um aplicativo a acessar o RepHub em seu nome.",
      },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s['authorization_id'] === "string" ? s['authorization_id'] : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Pedido de autorização inválido.");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/auth", search: { next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <RepHubAccessLayout
      eyebrow="RepHub by NAVOR"
      title="Autorização indisponível"
      description="Não foi possível carregar este pedido de autorização."
    >
      <GlassCard className="p-6 text-sm text-muted-foreground">
        {String((error as Error)?.message ?? error)}
      </GlassCard>
    </RepHubAccessLayout>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientName = details?.client?.name ?? "o aplicativo";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const api = oauthApi();
    const { data, error: err } = approve
      ? await api.approveAuthorization(authorization_id)
      : await api.denyAuthorization(authorization_id);
    if (err) {
      setBusy(false);
      setError(err.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("O servidor de autorização não retornou um endereço de retorno.");
      return;
    }
    window.location.href = target;
  }

  return (
    <RepHubAccessLayout
      eyebrow="RepHub by NAVOR"
      title="Autorizar acesso"
      description="Confirme se este aplicativo pode usar o RepHub em seu nome."
    >
      <GlassCard className="p-6 sm:p-7">
        <h2 className="font-display text-base font-semibold text-card-foreground">
          Conectar {clientName} à sua conta
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {clientName} poderá consultar clientes, pedidos, resultados e leads e criar novos leads,
          sempre com as mesmas permissões que você tem no sistema.
        </p>
        {error ? (
          <p role="alert" className="mt-4 text-sm text-rose-500">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <PrimaryButton className="w-full" disabled={busy} onClick={() => void decide(true)}>
            {busy ? "Aguarde..." : "Autorizar"}
          </PrimaryButton>
          <button
            className="w-full rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground transition hover:text-foreground disabled:opacity-60"
            disabled={busy}
            onClick={() => void decide(false)}
          >
            Recusar
          </button>
        </div>
      </GlassCard>
    </RepHubAccessLayout>
  );
}

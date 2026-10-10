import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // A administração do SaaS é totalmente independente dos sistemas e contas de clientes
    if (location.pathname.startsWith("/admin")) {
      return { user: null };
    }

    let user = null;
    try {
      const result = await supabase.auth.getUser();
      user = result.error ? null : result.data.user;
    } catch {
      user = null;
    }
    if (!user) {
      const isLawHub = location.pathname.startsWith("/lawhub");
      const isEngHub = location.pathname.startsWith("/enghub");
      const product = isLawHub ? "lawhub" : isEngHub ? "enghub" : undefined;
      throw redirect({
        to: "/auth",
        search: {
          product,
          next: location.href,
        },
      });
    }
    // Usuários do Portal do Cliente não acessam o CRM interno.
    if (user.user_metadata?.["portal_client_id"]) {
      throw redirect({ to: "/cliente/resumo" });
    }

    const product = location.pathname.startsWith("/lawhub")
      ? "lawhub"
      : location.pathname.startsWith("/enghub")
        ? "enghub"
        : "rephub";
    const { verifyProductRouteAccess } = await import("@/api/route-access");
    // FASE 20 & 21: A autoridade da conta vem EXCLUSIVAMENTE do Core.
    // Não passamos selectedAccountId do localStorage para sobrescrever a decisão do Core.
    const access: {
      allowed: boolean;
      reason?: string;
      accountId?: string | null;
      platformAdmin?: boolean;
      productRole?: string;
      routeAllowed?: boolean;
      redirectRoute?: string;
      subscriptionStatus?: string | null;
    } = await verifyProductRouteAccess({ data: { product, pathname: location.pathname } }).catch(() => ({
      allowed: false,
      reason: "Não foi possível validar a assinatura.",
    }));
    if (!access.allowed) {
      if (access.reason === "ACCOUNT_SELECTION_REQUIRED" || access.reason === "ACCOUNT_ACCESS_DENIED") {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem("navor.active_account_id");
        }
        throw redirect({
          to: "/acesso-bloqueado",
          search: {
            status: "account_selection",
            produto: product,
            next: `${location.pathname}${location.search}${location.hash}`,
          } as any,
        });
      }
      if (access.subscriptionStatus) {
        throw redirect({
          to: "/acesso-bloqueado",
          search: {
            status: access.subscriptionStatus,
            produto: product,
          } as any,
        });
      }
      throw redirect({
        to: "/acesso-bloqueado",
        search: {
          status: "suspended",
          produto: product,
        } as any,
      });
    }

    if (typeof window !== "undefined" && access.accountId) {
      window.localStorage.setItem("navor.active_account_id", access.accountId);
    }

    if (!access.routeAllowed && access.redirectRoute && location.pathname !== access.redirectRoute) {
      throw redirect({ to: access.redirectRoute as "/lawhub/dashboard" });
    }

    return {
      user,
      accountId: access.accountId ?? null,
      productRole: access.productRole ?? "colaborador",
      isPlatformAdmin: access.platformAdmin ?? false,
    };
  },
  component: () => <Outlet />,
});

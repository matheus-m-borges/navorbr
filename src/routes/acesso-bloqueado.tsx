import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { listAccountSelectionOptions } from "@/api/route-access";
import { SiteLayout } from "@/components/navor/PublicSite";
import { AlertTriangle, Clock, XCircle, ShieldOff, CheckCircle2, ArrowRight, MessageCircle } from "lucide-react";
import { z as zod } from "zod";
import { BLOCKED_STATUS_MESSAGES } from "@/api/route-access";


export const Route = createFileRoute("/acesso-bloqueado")({
  validateSearch: zod.object({
    status: zod.string().optional(),
    produto: zod.string().optional(),
    next: zod.string().optional(),
  }),
  head: () => ({
    meta: [
      { title: "Acesso Indisponível | NAVOR" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AcessoBloqueadoPage,
});

type BlockedStatus = keyof typeof BLOCKED_STATUS_MESSAGES;

const STATUS_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  pending_checkout: Clock,
  past_due:         AlertTriangle,
  suspended:        ShieldOff,
  canceled:         XCircle,
  expired:          Clock,
};

const STATUS_COLORS: Record<string, string> = {
  pending_checkout: "nv-blocked--warning",
  past_due:         "nv-blocked--danger",
  suspended:        "nv-blocked--danger",
  canceled:         "nv-blocked--neutral",
  expired:          "nv-blocked--warning",
};

function AcessoBloqueadoPage() {
  const search = Route.useSearch();
  const status = search.status;
  const produto = search.produto;

  if (status === "account_selection") {
    const requestedNext = search.next ?? "/";
    const safeNext = requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/";
    return <AccountSelection next={safeNext} product={produto ?? undefined} />;
  }

  const info = (status && BLOCKED_STATUS_MESSAGES[status])
    ? BLOCKED_STATUS_MESSAGES[status]
    : {
        title: "Acesso indisponível",
        description: "Não foi possível validar sua assinatura para este produto.",
        action: "Entre em contato com o suporte NAVOR.",
      };

  const Icon = STATUS_ICONS[status ?? ""] ?? ShieldOff;
  const colorClass = STATUS_COLORS[status ?? ""] ?? "nv-blocked--neutral";

  return (
    <SiteLayout>
      <div className={`nv-blocked-container ${colorClass}`}>
        <div className="nv-blocked-icon">
          <Icon size={48} />
        </div>

        <h1 className="nv-blocked-title">{info.title}</h1>
        <p className="nv-blocked-description">{info.description}</p>

        <div className="nv-blocked-action-box">
          <p>{info.action}</p>
        </div>

        {/* PRÓXIMAS AÇÕES — por status */}
        <div className="nv-blocked-next-steps">
          {status === "expired" || status === "canceled" ? (
            <>
              <a
                id="btn-assinar-bloqueado"
                href={produto ? `/produtos/${produto}` : "/produtos"}
                className="nv-button"
              >
                Ver planos disponíveis <ArrowRight size={17} />
              </a>
              {produto && (
                <a
                  id="btn-trial-bloqueado"
                  href={`/produtos/${produto}`}
                  className="nv-button nv-button-ghost"
                >
                  Iniciar novo teste <ArrowRight size={17} />
                </a>
              )}
            </>
          ) : status === "past_due" || status === "suspended" || status === "grace_period" ? (
            <a
              id="btn-suporte-bloqueado"
              href="/contato"
              className="nv-button"
            >
              <MessageCircle size={17} /> Falar com o suporte
            </a>
          ) : (
            <a
              id="btn-solucoes-bloqueado"
              href="/produtos"
              className="nv-button"
            >
              Ver soluções NAVOR <ArrowRight size={17} />
            </a>
          )}
        </div>

        {/* CANAL DE SUPORTE SEMPRE VISÍVEL */}
        <div className="nv-blocked-support">
          <p>
            Precisa de ajuda?{" "}
            <a href="/contato" id="link-suporte-bloqueado">
              Fale com a NAVOR
            </a>{" "}
            ou envie um e-mail para{" "}
            <a href="mailto:suporte@navorbr.com">suporte@navorbr.com</a>.
          </p>
        </div>

        {/* STATUS DETALHADO — apenas informativo */}
        {status && (
          <div className="nv-blocked-status-tag">
            <CheckCircle2 size={13} />
            Status atual: <code>{status}</code>
          </div>
        )}
      </div>
    </SiteLayout>
  );
}

function AccountSelection({ next, product }: { next: string; product?: string }) {
  const queryClient = useQueryClient();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    listAccountSelectionOptions({ data: { product: product as any } })
      .then((data) => {
        setAccounts(data);
        setLoading(false);
      })
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : "Não foi possível carregar as contas.");
        setLoading(false);
      });
  }, [product]);

  async function selectAccount(accountId: string) {
    setSaving(accountId);
    setError(null);
    const { error: rpcError } = await (supabase as any).rpc("set_current_account_id", { p_account_id: accountId });
    if (rpcError) {
      setError("A conta não está mais disponível. Atualize a página e tente novamente.");
      setSaving(null);
      return;
    }
    localStorage.setItem("navor.active_account_id", accountId);
    await queryClient.cancelQueries();
    queryClient.clear();
    window.location.assign(next);
  }

  return (
    <SiteLayout>
      <div className="nv-blocked-container">
        <div className="nv-blocked-icon"><ShieldOff size={48} /></div>
        <h1 className="nv-blocked-title">
          {accounts.length === 0 && !loading ? "Acesso não disponível" : "Selecione uma conta"}
        </h1>
        <p className="nv-blocked-description">
          {accounts.length === 0 && !loading
            ? `Seu usuário não possui um escritório ou assinatura ativa para ${product ? product.toUpperCase() : "este produto"}.`
            : "Escolha o contexto que será usado nesta sessão."}
        </p>
        {error ? <p className="nv-blocked-action-box">{error}</p> : null}
        {loading ? (
          <p className="nv-blocked-description">Carregando contas disponíveis...</p>
        ) : accounts.length === 0 && !error ? (
          <div className="nv-blocked-next-steps">
            <a href="/dashboard" className="nv-button">
              Voltar ao Início <ArrowRight size={17} />
            </a>
            <a href="/contato" className="nv-button nv-button-ghost">
              Falar com Suporte
            </a>
          </div>
        ) : (
          <div className="nv-blocked-next-steps">
            {accounts.map((account) => (
              <button
                key={account.accountId}
                className="nv-button"
                disabled={Boolean(saving)}
                onClick={() => selectAccount(account.accountId)}
              >
                {saving === account.accountId ? "Selecionando..." : account.accountName}
              </button>
            ))}
          </div>
        )}
      </div>
    </SiteLayout>
  );
}

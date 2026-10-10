import { createFileRoute, Link } from "@tanstack/react-router";
import { Layers, ShoppingBag, Sparkles, Tag } from "lucide-react";
import { PortalShell } from "@/components/portal/PortalShell";
import { EmptyState, GlassCard, KpiCard } from "@/components/navor-rephub/ui";
import { usePortalHome } from "@/hooks/usePortal";
import { currency, formatDate } from "@/lib/crm";

export const Route = createFileRoute("/cliente/_area/resumo")({
  head: () => ({
    meta: [
      { title: "Meu painel | Portal do Cliente" },
      {
        name: "description",
        content: "Resumo das suas marcas, coleções, catálogos e pedidos com a representação.",
      },
      { property: "og:title", content: "Meu painel | Portal do Cliente" },
      { property: "og:description", content: "Acompanhe marcas, coleções, catálogos e pedidos." },
    ],
  }),
  component: PortalDashboard,
});

function PortalDashboard() {
  const { data, isLoading } = usePortalHome();
  const name = data?.session.tradeName || data?.session.legalName || "cliente";

  return (
    <PortalShell
      title={`Olá, ${name}`}
      subtitle="Tenha acesso às suas marcas, coleções, catálogos, pedidos e materiais em um único lugar."
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Minhas marcas" value={String(data?.brands ?? 0)} />
            <KpiCard label="Coleções disponíveis" value={String(data?.collections ?? 0)} tone="cyan" />
            <KpiCard label="Catálogos disponíveis" value={String(data?.catalogs ?? 0)} tone="violet" />
            <KpiCard
              label="Meus pedidos"
              value={String(data?.orders ?? 0)}
              tone="brand"
              hint={`${currency(data?.totalValue ?? 0)} · ${data?.pieces ?? 0} peças`}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Link to="/cliente/minhas-marcas">
              <GlassCard className="flex items-center gap-3 p-4 transition hover:bg-accent/40">
                <Tag className="size-5 text-brand" />
                <span className="text-sm font-medium text-card-foreground">Minhas marcas</span>
              </GlassCard>
            </Link>
            <Link to="/cliente/minhas-colecoes">
              <GlassCard className="flex items-center gap-3 p-4 transition hover:bg-accent/40">
                <Layers className="size-5 text-cyan" />
                <span className="text-sm font-medium text-card-foreground">Coleções e catálogos</span>
              </GlassCard>
            </Link>
            <Link to="/cliente/meus-pedidos">
              <GlassCard className="flex items-center gap-3 p-4 transition hover:bg-accent/40">
                <ShoppingBag className="size-5 text-violet" />
                <span className="text-sm font-medium text-card-foreground">Meus pedidos</span>
              </GlassCard>
            </Link>
          </div>

          <GlassCard className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="size-4 text-gold" />
              <h2 className="text-sm font-semibold text-card-foreground">Novidades</h2>
            </div>
            {(data?.news ?? []).length === 0 ? (
              <EmptyState
                title="Nenhuma novidade por enquanto"
                hint="Assim que a representação publicar coleções ou catálogos, eles aparecem aqui."
              />
            ) : (
              <ul className="space-y-2">
                {(data?.news ?? []).map((n) => (
                  <li
                    key={n.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-ink-2/40 p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-card-foreground">{n.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {n.hasCatalog ? "Catálogo disponível" : "Coleção disponível"} ·{" "}
                        {formatDate(n.createdAt)}
                      </p>
                    </div>
                    <Link
                      to="/cliente/minhas-colecoes"
                      className="rounded-lg border border-border px-3 py-1.5 text-xs text-card-foreground hover:bg-accent"
                    >
                      Ver coleção
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>

          <p className="text-[11px] text-muted-foreground">
            Última compra: {data?.lastOrderDate ? formatDate(data.lastOrderDate) : "—"} ·{" "}
            {data?.documents ?? 0} documentos disponíveis
          </p>
        </>
      )}
    </PortalShell>
  );
}

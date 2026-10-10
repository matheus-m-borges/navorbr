import { createFileRoute } from "@tanstack/react-router";
import { PortalShell } from "@/components/portal/PortalShell";
import { EmptyState, GlassCard } from "@/components/navor-rephub/ui";
import { BrandTag } from "@/components/navor-rephub/BrandTag";
import { usePortalBrands } from "@/hooks/usePortal";
import { currency, formatDate } from "@/lib/crm";

export const Route = createFileRoute("/cliente/_area/minhas-marcas")({
  head: () => ({
    meta: [
      { title: "Minhas marcas | Portal do Cliente" },
      { name: "description", content: "Marcas liberadas para a sua loja pela representação." },
      { property: "og:title", content: "Minhas marcas | Portal do Cliente" },
      { property: "og:description", content: "Veja as marcas que você compra e o histórico com cada uma." },
    ],
  }),
  component: PortalBrands,
});

function PortalBrands() {
  const { data: brands = [], isLoading } = usePortalBrands();

  return (
    <PortalShell title="Minhas marcas" subtitle="Somente as marcas liberadas para a sua loja">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : brands.length === 0 ? (
        <EmptyState
          title="Nenhuma marca liberada ainda"
          hint="Fale com a representação para liberar as marcas que você compra."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {brands.map((b) => (
            <GlassCard key={b.id} className="p-4">
              <BrandTag brand={b.brand} logoUrl={b.logo_url} hint={b.company_name} size="lg" />
              <p className="mt-3 text-[11px] text-muted-foreground">
                {b.segment ?? "—"} · liberada em {formatDate(b.authorized_at)}
              </p>
              {b.information ? (
                <div className="mt-3 rounded-xl border border-border bg-ink-2/40 p-3">
                  <p className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                    {b.brand} — Informações
                  </p>
                  <p className="mt-1 text-xs whitespace-pre-line text-card-foreground">
                    {b.information}
                  </p>
                </div>
              ) : null}

              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border border-border bg-ink-2/40 p-2">
                  <p className="text-[10px] text-muted-foreground">Coleções</p>
                  <p className="text-sm font-semibold text-card-foreground">{b.collections}</p>
                </div>
                <div className="rounded-lg border border-border bg-ink-2/40 p-2">
                  <p className="text-[10px] text-muted-foreground">Pedidos</p>
                  <p className="text-sm font-semibold text-card-foreground">{b.orders}</p>
                </div>
                <div className="rounded-lg border border-border bg-ink-2/40 p-2">
                  <p className="text-[10px] text-muted-foreground">Comprado</p>
                  <p className="text-sm font-semibold text-card-foreground">{currency(b.total_value)}</p>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </PortalShell>
  );
}

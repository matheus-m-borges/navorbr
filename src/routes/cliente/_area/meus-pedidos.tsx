import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { ChevronDown, FileText } from "lucide-react";
import { PortalShell } from "@/components/portal/PortalShell";
import { EmptyState, GhostButton, GlassCard, SelectInput, StatusBadge, TextInput } from "@/components/navor-rephub/ui";
import { BrandTag } from "@/components/navor-rephub/BrandTag";
import { usePortalOrders } from "@/hooks/usePortal";
import { getPortalFileUrl } from "@/lib/portal.functions";
import { currency, formatDate } from "@/lib/crm";

export const Route = createFileRoute("/cliente/_area/meus-pedidos")({
  head: () => ({
    meta: [
      { title: "Meus pedidos | Portal do Cliente" },
      { name: "description", content: "Histórico dos seus pedidos, itens, valores e documentos." },
      { property: "og:title", content: "Meus pedidos | Portal do Cliente" },
      { property: "og:description", content: "Consulte pedidos, valores, peças e documentos anexados." },
    ],
  }),
  component: PortalOrders,
});

function PortalOrders() {
  const { data: orders = [], isLoading } = usePortalOrders();
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [collectionFilter, setCollectionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState<string | null>(null);

  const brandOptions = Array.from(new Set(orders.map((o) => o.brand).filter(Boolean))).sort();
  const collectionOptions = Array.from(
    new Set(orders.map((o) => o.collection).filter((c): c is string => Boolean(c))),
  ).sort();
  const statusOptions = Array.from(new Set(orders.map((o) => o.status).filter(Boolean))).sort();

  const filtered = orders.filter((o) => {
    if (brandFilter !== "all" && o.brand !== brandFilter) return false;
    if (collectionFilter !== "all" && (o.collection ?? "") !== collectionFilter) return false;
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return [o.internal_number, o.factory_order_number ?? "", o.brand, o.collection ?? ""]
      .join(" ")
      .toLowerCase()
      .includes(term);
  });

  const hasFilters =
    brandFilter !== "all" || collectionFilter !== "all" || statusFilter !== "all" || search !== "";

  async function openDoc(id: string) {
    try {
      const { url } = await getPortalFileUrl({ data: { kind: "order-document", id, download: false } });
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <PortalShell title="Meus pedidos" subtitle="Somente os pedidos da sua loja">
      <GlassCard className="p-3">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <TextInput
            placeholder="Pesquisar por número, marca ou coleção..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <SelectInput value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}>
            <option value="all">Todas as marcas</option>
            {brandOptions.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </SelectInput>
          <SelectInput
            value={collectionFilter}
            onChange={(e) => setCollectionFilter(e.target.value)}
          >
            <option value="all">Todas as coleções</option>
            {collectionOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </SelectInput>
          <SelectInput value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">Todas as situações</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </SelectInput>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="text-[11px] text-muted-foreground">
            {filtered.length} de {orders.length} pedidos
          </p>
          {hasFilters ? (
            <GhostButton
              onClick={() => {
                setSearch("");
                setBrandFilter("all");
                setCollectionFilter("all");
                setStatusFilter("all");
              }}
            >
              Limpar filtros
            </GhostButton>
          ) : null}
        </div>
      </GlassCard>


      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <EmptyState title="Nenhum pedido encontrado" hint="Seus pedidos aparecem aqui após o lançamento." />
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => (
            <GlassCard key={o.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-sm font-semibold text-card-foreground">
                      Pedido {o.internal_number}
                    </p>
                    <StatusBadge status={o.status} />
                  </div>
                  <div className="mt-2">
                    <BrandTag brand={o.brand} logoUrl={o.brand_logo} hint={o.collection} />
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-display text-base font-semibold text-card-foreground tabular-nums">
                    {currency(o.total_value)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {o.total_pieces} peças · {formatDate(o.order_date)}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <GhostButton onClick={() => setOpen(open === o.id ? null : o.id)}>
                  <ChevronDown className="mr-1 inline size-3.5" />
                  {open === o.id ? "Ocultar detalhes" : "Ver detalhes"}
                </GhostButton>
              </div>

              {open === o.id ? (
                <div className="mt-3 space-y-3 border-t border-border pt-3">
                  {o.items.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sem itens detalhados.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="text-muted-foreground">
                          <tr>
                            <th className="py-1 pr-3">Descrição</th>
                            <th className="py-1 pr-3">Ref.</th>
                            <th className="py-1 pr-3 text-right">Qtd.</th>
                            <th className="py-1 pr-3 text-right">Unit.</th>
                            <th className="py-1 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="text-card-foreground">
                          {o.items.map((it) => (
                            <tr key={it.id} className="border-t border-border/60">
                              <td className="py-1.5 pr-3">{it.description}</td>
                              <td className="py-1.5 pr-3 text-muted-foreground">{it.reference ?? "—"}</td>
                              <td className="py-1.5 pr-3 text-right tabular-nums">{it.quantity}</td>
                              <td className="py-1.5 pr-3 text-right tabular-nums">
                                {currency(it.unit_price)}
                              </td>
                              <td className="py-1.5 text-right tabular-nums">{currency(it.total_value)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div>
                    <p className="mb-2 text-xs font-medium text-card-foreground">Documentos do pedido</p>
                    {o.documents.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhum documento disponível.</p>
                    ) : (
                      <ul className="space-y-1">
                        {o.documents.map((d) => (
                          <li key={d.id}>
                            <button
                              onClick={() => void openDoc(d.id)}
                              className="flex w-full items-center gap-2 rounded-lg border border-border bg-ink-2/40 px-3 py-2 text-left text-xs text-card-foreground hover:bg-accent"
                            >
                              <FileText className="size-3.5 text-brand" />
                              <span className="truncate">{d.file_name}</span>
                              <span className="ml-auto text-[10px] text-muted-foreground">
                                {formatDate(d.created_at)}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ) : null}
            </GlassCard>
          ))}
        </div>
      )}
    </PortalShell>
  );
}

import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { PortalShell } from "@/components/portal/PortalShell";
import {
  EmptyState,
  GhostButton,
  GlassCard,
  SelectInput,
  TextInput,
} from "@/components/navor-rephub/ui";
import { BrandTag } from "@/components/navor-rephub/BrandTag";
import { CatalogBook } from "@/components/portal/CatalogBook";
import { usePortalCollections } from "@/hooks/usePortal";
import { getPortalFileUrl } from "@/lib/portal.functions";
import { formatDate } from "@/lib/crm";

export const Route = createFileRoute("/cliente/_area/minhas-colecoes")({
  head: () => ({
    meta: [
      { title: "Coleções e catálogos | Portal do Cliente" },
      { name: "description", content: "Coleções liberadas, catálogos em PDF e álbuns de fotos das fábricas." },
      { property: "og:title", content: "Coleções e catálogos | Portal do Cliente" },
      { property: "og:description", content: "Abra catálogos e veja as fotos enviadas pelas fábricas." },
    ],
  }),
  component: PortalCollections,
});

function PortalCollections() {
  const { data: collections = [], isLoading } = usePortalCollections();
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [book, setBook] = useState<{ url: string; title: string; subtitle?: string } | null>(null);

  const brands = useMemo(
    () => Array.from(new Set(collections.map((c) => c.brand))).sort(),
    [collections],
  );

  const filtered = collections.filter((c) => {
    const term = search.trim().toLowerCase();
    const matches =
      !term ||
      [c.name, c.brand, c.code ?? "", c.season ?? "", String(c.year ?? "")]
        .join(" ")
        .toLowerCase()
        .includes(term);
    return matches && (brandFilter === "all" || c.brand === brandFilter);
  });

  async function openCatalog(id: string, download: boolean) {
    try {
      const { url } = await getPortalFileUrl({ data: { kind: "brand-collection-catalog", id, download } });
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  /** Abre o catálogo em formato livro, folheando página por página. */
  async function openBook(c: { id: string; name: string; brand: string; season?: string | null }, catalogId: string) {
    try {
      const { url } = await getPortalFileUrl({
        data: { kind: "brand-collection-catalog", id: catalogId, download: false },
      });
      setBook({ url, title: c.name, subtitle: [c.brand, c.season].filter(Boolean).join(" · ") });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <PortalShell title="Coleções e catálogos" subtitle="Materiais liberados para a sua loja">
      <GlassCard className="flex flex-wrap gap-2 p-3">
        <TextInput
          className="max-w-64"
          placeholder="Pesquisar coleção, marca, temporada..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <SelectInput
          className="max-w-48"
          value={brandFilter}
          onChange={(e) => setBrandFilter(e.target.value)}
        >
          <option value="all">Todas as marcas</option>
          {brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </SelectInput>
      </GlassCard>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nenhuma coleção disponível"
          hint="Assim que a representação publicar uma coleção para você, ela aparece aqui."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => (
            <GlassCard key={c.id} className="overflow-hidden">
              {c.cover_url ? (
                <img src={c.cover_url} alt={c.name} loading="lazy" className="h-40 w-full object-cover" />
              ) : (
                <div className="h-40 w-full bg-gradient-to-br from-ink-2 to-ink" />
              )}
              <div className="p-4">
                <BrandTag brand={c.brand} logoUrl={c.brand_logo} className="text-xs" />
                <p className="mt-2 font-display text-sm font-semibold text-card-foreground">{c.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {[c.season, c.year ? String(c.year) : null, c.code].filter(Boolean).join(" · ") || "—"}
                </p>
                {c.description ? (
                  <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">{c.description}</p>
                ) : null}
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Vendas: {formatDate(c.sales_start)} → {formatDate(c.sales_end)} · {c.status}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 items-center">
                  {c.catalogs && c.catalogs.length > 0 ? (
                    <div className="flex flex-col gap-1.5 w-full">
                      {c.catalogs.map(cat => (
                        <div key={cat.id} className="flex flex-wrap items-center gap-2 border-l-2 border-brand/20 pl-2">
                          <span className="text-xs text-card-foreground font-medium truncate max-w-[150px] mr-1" title={cat.name}>{cat.name}</span>
                          <GhostButton className="px-2 py-1 text-[11px]" onClick={() => void openBook(c, cat.id)}>Folhear</GhostButton>
                          {c.allow_download ? (
                            <GhostButton className="px-2 py-1 text-[11px]" onClick={() => void openCatalog(cat.id, true)}>Baixar PDF</GhostButton>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[11px] text-muted-foreground mr-2">Sem catálogo publicado</span>
                  )}
                  {c.photos_link ? (
                    <a
                      href={c.photos_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center rounded-lg border border-border bg-secondary px-3 py-2 text-xs font-medium text-card-foreground hover:bg-accent"
                    >
                      Ver fotos
                    </a>
                  ) : null}
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}

      {book ? (
        <CatalogBook
          url={book.url}
          title={book.title}
          subtitle={book.subtitle}
          onClose={() => setBook(null)}
        />
      ) : null}
    </PortalShell>
  );
}

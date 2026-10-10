import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/navor-rephub/AppShell";
import { Chip, EmptyState, GhostButton, GlassCard, PrimaryButton, SelectInput, ShowAllToggle, SectionTitle } from "@/components/navor-rephub/ui";
import { whatsappLink } from "@/lib/crm";
import { describeRule } from "@/lib/rep";
import { useRemoveRecord } from "@/lib/registro";
import { FabricasPanel } from "@/components/navor-rephub/FabricasPanel";
import { BrandFormModal } from "@/components/navor-rephub/BrandFormModal";
import { BrandTag } from "@/components/navor-rephub/BrandTag";
import { useFactories } from "@/hooks/useRep";
import { useBrands, useLeads, type Brand } from "@/hooks/useCrm";
import { useCurrentUser } from "@/hooks/useSession";

export const Route = createFileRoute("/_authenticated/(navor-rephub)/marcas")({
  head: () => ({
    meta: [
      { title: "Fábricas e marcas | CRM Representação" },
      {
        name: "description",
        content:
          "Cadastro de fábricas representadas, marcas com logomarca, segmentos, contatos comerciais e leads vinculados.",
      },
      { property: "og:title", content: "Fábricas e marcas | CRM Representação" },
      {
        property: "og:description",
        content: "Gestão das fábricas representadas e desempenho por marca.",
      },
    ],
  }),
  component: MarcasPage,
});

function MarcasPage() {
  const { data: brands = [], isLoading } = useBrands();
  const { data: leads = [] } = useLeads();
  const { data: factories = [] } = useFactories();
  const { user } = useCurrentUser();
  const remove = useRemoveRecord();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [factoryFilter, setFactoryFilter] = useState("hide_all");

  const isAdmin = user?.role === "admin";

  const filtered = useMemo(
    () =>
      brands.filter((b) => {
        if (factoryFilter === "all") return true;
        if (factoryFilter === "none") return !b.factory_id;
        return b.factory_id === factoryFilter;
      }),
    [brands, factoryFilter],
  );

  function leadsOf(brandId: string) {
    return leads.filter((l) => (l.lead_brands ?? []).some((lb) => lb.brand_id === brandId));
  }

  return (
    <AppShell
      title="Fábricas e marcas"
      subtitle={`${brands.length} marcas representadas — cadastre as marcas dentro de cada fábrica`}
    >

      <GlassCard className="p-4">
        <FabricasPanel />
      </GlassCard>

      <GlassCard className="p-4">
        <div className="mb-3 flex flex-col gap-3">
          <SectionTitle 
            title="Todas as marcas"
            hint="As marcas também podem ser cadastradas dentro de cada fábrica"
            action={
              <ShowAllToggle 
                showAll={factoryFilter !== "hide_all"} 
                onToggle={(v) => setFactoryFilter(v ? "all" : "hide_all")} 
              />
            }
          />
          <SelectInput
            value={factoryFilter === "hide_all" ? "all" : factoryFilter}
            onChange={(e) => setFactoryFilter(e.target.value)}
            className="max-w-xs"
          >
            <option value="all">Todas as fábricas</option>
            {factories.map((f) => (
              <option key={f.id} value={f.id}>
                {f.trade_name ?? f.legal_name}
              </option>
            ))}
            <option value="none">Sem fábrica vinculada</option>
          </SelectInput>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : factoryFilter === "hide_all" ? (
          <EmptyState
            title="Selecione uma fábrica"
            hint="Escolha uma fábrica no filtro acima para carregar suas marcas."
          />
        ) : filtered.length === 0 ? (
          <EmptyState title="Nenhuma marca cadastrada" hint="Cadastre as marcas das fábricas que você representa." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((b) => {
              const ls = leadsOf(b.id);
              const positivados = ls.filter((l) => l.status === "Positivado").length;
              const wa = whatsappLink(b.whatsapp ?? b.phone, `Olá ${b.commercial_contact ?? ""}!`);
              return (
                <div key={b.id} className="rounded-2xl border border-border bg-ink-2/40 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <BrandTag brand={b.brand} logoUrl={b.logo_url} hint={b.company_name} size="lg" />
                    <Chip tone={b.status === "Ativa" ? "brand" : "muted"}>{b.status}</Chip>
                  </div>
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    <p>Segmento: {b.segment ?? "—"}</p>
                    <p>Contato: {b.commercial_contact ?? "—"}</p>
                    <p>
                      {b.city ?? "—"}/{b.state ?? "—"} · {b.phone ?? "sem telefone"}
                    </p>
                    <p>
                      Comissão:{" "}
                      {b.commission_mode
                        ? describeRule(
                            b.commission_mode,
                            Number(b.commission_pct_invoice ?? 0),
                            Number(b.commission_pct_settlement ?? 0),
                          )
                        : "herda a regra da fábrica"}
                    </p>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Chip tone="cyan">{ls.length} leads</Chip>
                    <Chip tone="brand">{positivados} positivados</Chip>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <GhostButton
                      onClick={() => {
                        setEditing(b);
                        setOpen(true);
                      }}
                    >
                      Editar
                    </GhostButton>
                    {wa ? (
                      <a href={wa} target="_blank" rel="noreferrer">
                        <GhostButton className="border-brand/30 text-brand">WhatsApp</GhostButton>
                      </a>
                    ) : null}
                    {b.website ? (
                      <a href={b.website} target="_blank" rel="noreferrer">
                        <GhostButton>Site</GhostButton>
                      </a>
                    ) : null}
                    {isAdmin ? (
                      <GhostButton
                        className="border-rose/30 text-rose"
                        onClick={() =>
                          void remove({
                            table: "brands",
                            id: b.id,
                            label: `a marca ${b.brand}`,
                            keys: ["brands", "collections", "orders"],
                          })
                        }
                      >
                        Excluir
                      </GhostButton>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      <BrandFormModal open={open} onClose={() => setOpen(false)} brand={editing} />
    </AppShell>
  );
}

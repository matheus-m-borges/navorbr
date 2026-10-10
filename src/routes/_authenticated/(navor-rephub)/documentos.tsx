import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, FileText, Trash2 } from "lucide-react";
import { AppShell } from "@/components/navor-rephub/AppShell";
import {
  EmptyState,
  GhostButton,
  GlassCard,
  KpiCard,
  SectionTitle,
  SelectInput,
  TextInput,
} from "@/components/navor-rephub/ui";
import { supabase } from "@/integrations/supabase/client";
import { crmDb, useBrands, useClients, useLeads } from "@/hooks/useCrm";
import {
  useDocuments,
  useFactories,
  useInvoices,
  useOrders,
  type DocumentRow,
} from "@/hooks/useRep";
import { DOCUMENT_CATEGORIES } from "@/lib/rep";
import { formatDateTime } from "@/lib/crm";

export const Route = createFileRoute("/_authenticated/(navor-rephub)/documentos")({
  head: () => ({
    meta: [
      { title: "Documentos | CRM Representação" },
      {
        name: "description",
        content:
          "Central de documentos da representação: espelhos de pedido, notas fiscais, contratos, cadastros e comprovantes em armazenamento privado.",
      },
      { property: "og:title", content: "Documentos | CRM Representação" },
      {
        property: "og:description",
        content: "Todos os arquivos anexados a pedidos, clientes, fábricas e comissões em um só lugar.",
      },
    ],
  }),
  component: DocumentosPage,
});

const ENTITY_LABELS: Record<string, string> = {
  order: "Pedido",
  client: "Cliente",
  factory: "Fábrica",
  brand: "Marca",
  lead: "Lead",
  commission: "Comissão",
  invoice: "Nota fiscal",
};

function DocumentosPage() {
  const qc = useQueryClient();
  const { data: docs = [], isLoading } = useDocuments();
  const { data: orders = [] } = useOrders();
  const { data: clients = [] } = useClients();
  const { data: factories = [] } = useFactories();
  const { data: brands = [] } = useBrands();
  const { data: leads = [] } = useLeads();
  const { data: invoices = [] } = useInvoices();

  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [entity, setEntity] = useState("all");

  const ordersMap = useMemo(() => new Map(orders.map((o) => [o.id, o])), [orders]);
  const clientsMap = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);
  const factoriesMap = useMemo(() => new Map(factories.map((f) => [f.id, f])), [factories]);
  const brandsMap = useMemo(() => new Map(brands.map((b) => [b.id, b])), [brands]);
  const leadsMap = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);
  const invoicesMap = useMemo(() => new Map(invoices.map((i) => [i.id, i])), [invoices]);

  function getDocContext(d: DocumentRow) {
    if (d.entity_type === "order") {
      const order = ordersMap.get(d.entity_id);
      if (!order) {
        return {
          type: "Pedido",
          title: "Pedido",
          details: `ID: ${d.entity_id.slice(0, 8)}`,
          search: "",
        };
      }
      const num = order.factory_order_number
        ? `Nº ${order.factory_order_number} (Int. ${order.internal_number})`
        : `Nº ${order.internal_number}`;
      const client = order.clients?.trade_name || order.clients?.legal_name;
      const factory = order.factories?.trade_name || order.factories?.legal_name;
      const brand = order.brands?.brand;
      const parts = [
        client ? `Cliente: ${client}` : null,
        factory ? `Fábrica: ${factory}` : null,
        brand ? `Marca: ${brand}` : null,
      ].filter(Boolean);
      return {
        type: "Pedido",
        title: `Pedido ${num}`,
        details: parts.join(" · "),
        search: `${num} ${client ?? ""} ${factory ?? ""} ${brand ?? ""}`,
      };
    }

    if (d.entity_type === "client") {
      const client = clientsMap.get(d.entity_id);
      const name = client?.trade_name || client?.legal_name || "Cliente";
      const parts = [
        client?.cnpj ? `CNPJ ${client.cnpj}` : null,
        client?.city && client?.state ? `${client.city}/${client.state}` : null,
      ].filter(Boolean);
      return {
        type: "Cliente",
        title: name,
        details: parts.join(" · "),
        search: `${name} ${client?.cnpj ?? ""} ${client?.city ?? ""}`,
      };
    }

    if (d.entity_type === "factory") {
      const factory = factoriesMap.get(d.entity_id);
      const name = factory?.trade_name || factory?.legal_name || "Fábrica";
      return {
        type: "Fábrica",
        title: name,
        details: factory?.cnpj ? `CNPJ ${factory.cnpj}` : "",
        search: `${name} ${factory?.cnpj ?? ""}`,
      };
    }

    if (d.entity_type === "brand") {
      const brand = brandsMap.get(d.entity_id);
      const name = brand?.brand || "Marca";
      return {
        type: "Marca",
        title: name,
        details: brand?.segment ? `Segmento: ${brand.segment}` : "",
        search: name,
      };
    }

    if (d.entity_type === "lead") {
      const lead = leadsMap.get(d.entity_id);
      const name = lead?.company_name || "Lead";
      return {
        type: "Lead",
        title: name,
        details: lead?.city && lead?.state ? `${lead.city}/${lead.state}` : "",
        search: `${name} ${lead?.city ?? ""}`,
      };
    }

    if (d.entity_type === "invoice") {
      const inv = invoicesMap.get(d.entity_id);
      const num = inv?.nf_number ? `NF ${inv.nf_number}` : "Nota fiscal";
      const client = inv?.clients?.trade_name || inv?.clients?.legal_name;
      return {
        type: "Nota fiscal",
        title: num,
        details: client ? `Cliente: ${client}` : "",
        search: `${num} ${client ?? ""}`,
      };
    }

    return {
      type: ENTITY_LABELS[d.entity_type] ?? d.entity_type,
      title: ENTITY_LABELS[d.entity_type] ?? d.entity_type,
      details: "",
      search: "",
    };
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return docs.filter((d) => {
      if (category !== "all" && d.category !== category) return false;
      if (entity !== "all" && d.entity_type !== entity) return false;
      if (!term) return true;
      const ctx = getDocContext(d);
      return [
        d.file_name,
        d.category,
        d.uploaded_by_name,
        ctx.type,
        ctx.title,
        ctx.details,
        ctx.search,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [
    docs,
    q,
    category,
    entity,
    ordersMap,
    clientsMap,
    factoriesMap,
    brandsMap,
    leadsMap,
    invoicesMap,
  ]);

  const totalMb = docs.reduce((a, d) => a + (d.size_bytes ?? 0), 0) / (1024 * 1024);

  async function open(path: string) {
    const { data, error } = await supabase.storage.from("documentos").createSignedUrl(path, 300);
    if (error || !data) {
      toast.error(error?.message ?? "Não foi possível abrir o arquivo.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  async function remove(id: string, path: string) {
    if (!window.confirm("Deseja realmente excluir este documento? Esta ação não pode ser desfeita.")) {
      return;
    }
    const { error: stErr } = await supabase.storage.from("documentos").remove([path]);
    if (stErr) {
      toast.error(`Falha no armazenamento: ${stErr.message}`);
      return;
    }
    const { error } = await crmDb.from("documents").delete().eq("id", id);
    if (error) {
      toast.error(`Falha ao excluir registro: ${error.message}`);
      return;
    }
    void qc.invalidateQueries({ queryKey: ["documents"] });
    toast.success("Documento excluído.");
  }

  return (
    <AppShell title="Documentos" subtitle="Central unificada com identificação de pedidos, clientes e fábricas">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard label="Documentos armazenados" value={String(docs.length)} />
        <KpiCard label="Espaço usado" value={`${totalMb.toFixed(1)} MB`} tone="cyan" />
        <KpiCard
          label="Categorias em uso"
          value={String(new Set(docs.map((d) => d.category)).size)}
          tone="violet"
        />
      </div>

      <GlassCard className="p-4">
        <SectionTitle
          title="Central de documentos"
          hint="Os arquivos ficam em armazenamento privado e mostram o vínculo com pedido, cliente ou fábrica"
        />
        <div className="mb-3 grid gap-2 sm:grid-cols-3">
          <TextInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por arquivo, cliente, pedido, fábrica..."
          />
          <SelectInput value={entity} onChange={(e) => setEntity(e.target.value)}>
            <option value="all">Todos os vínculos</option>
            {Object.entries(ENTITY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </SelectInput>
          <SelectInput value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">Todas as categorias</option>
            {DOCUMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </SelectInput>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Nenhum documento encontrado"
            hint="Anexe arquivos na ficha do pedido, do cliente ou da fábrica."
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((d) => {
              const ctx = getDocContext(d);
              return (
                <div
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-ink-2/40 p-3.5 transition hover:border-brand/40"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                      <FileText className="size-4" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-card-foreground">
                          {d.file_name}
                        </p>
                        <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {d.category}
                        </span>
                      </div>

                      {/* Vínculo com pedido / cliente / fábrica */}
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="rounded bg-brand/15 px-1.5 py-0.5 font-medium text-brand">
                          {ctx.type}
                        </span>
                        <span className="font-semibold text-card-foreground">
                          {ctx.title}
                        </span>
                        {ctx.details ? (
                          <span className="text-muted-foreground">· {ctx.details}</span>
                        ) : null}
                      </div>

                      <p className="text-[11px] text-muted-foreground">
                        {((d.size_bytes ?? 0) / 1024).toFixed(0)} KB · {formatDateTime(d.created_at)} · Enviado por {d.uploaded_by_name ?? "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <GhostButton onClick={() => void open(d.file_path)}>
                      <Download className="size-3.5" /> Abrir
                    </GhostButton>
                    <GhostButton
                      className="border-rose/30 text-rose hover:bg-rose/10"
                      onClick={() => void remove(d.id, d.file_path)}
                    >
                      <Trash2 className="size-3.5" />
                    </GhostButton>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>
    </AppShell>
  );
}

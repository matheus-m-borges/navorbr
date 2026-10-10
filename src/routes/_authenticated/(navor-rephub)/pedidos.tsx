import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell } from "@/components/navor-rephub/AppShell";
import {
  EmptyState,
  Field,
  GhostButton,
  GlassCard,
  KpiCard,
  MoneyInput,
  Modal,
  PrimaryButton,
  SectionTitle,
  SelectInput,
  ShowAllToggle,
  TextArea,
  TextInput,
} from "@/components/navor-rephub/ui";
import { RepBadge, TableShell, Td, Tr } from "@/components/navor-rephub/repui";
import { BrandTag } from "@/components/navor-rephub/BrandTag";
import { OrderDetailsPanel } from "@/components/navor-rephub/OrderDetailsPanel";
import { ClientPicker } from "@/components/navor-rephub/ClientPicker";
import { currency, formatDate } from "@/lib/crm";
import { ORDER_STATUSES, orderTone, sumMoney } from "@/lib/rep";
import { Download, FileText, Paperclip, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { crmDb, useBrands, useSettings } from "@/hooks/useCrm";
import {
  useCollections,
  useDocuments,
  useInvoices,
  useFactories,
  useOrders,
  type DocumentRow,
  type Order,
} from "@/hooks/useRep";
import { logAudit } from "@/hooks/useRep";
import { useCurrentUser } from "@/hooks/useSession";
import { useRemoveRecord } from "@/lib/registro";

export const Route = createFileRoute("/_authenticated/(navor-rephub)/pedidos")({
  validateSearch: (search: Record<string, unknown>) => {
    const out: { q?: string | undefined; edit?: string | undefined; client?: string | undefined; o?: string | undefined } = {};
    if (typeof search["q"] === "string") out.q = search["q"];
    if (typeof search["edit"] === "string") out.edit = search["edit"];
    if (typeof search["client"] === "string") out.client = search["client"];
    if (typeof search["o"] === "string") out.o = search["o"];
    return out;
  },
  head: () => ({
    meta: [
      { title: "Pedidos | CRM Representação" },
      {
        name: "description",
        content:
          "Lançamento e acompanhamento de pedidos por cliente, marca, fábrica e coleção, com cópia do pedido da fábrica arquivada.",
      },
      { property: "og:title", content: "Pedidos | CRM Representação" },
      {
        property: "og:description",
        content: "Controle completo dos pedidos da representação, do lançamento ao faturamento.",
      },
    ],
  }),
  component: PedidosPage,
});

const emptyForm = {
  client_id: "",
  brand_id: "",
  factory_id: "",
  collection_id: "",
  brand_collection_id: "",
  order_date: new Date().toISOString().slice(0, 10),
  total_value: "",
  total_pieces: "",
  factory_order_number: "",
  payment_method: "",
  payment_terms: "",
  status: "Pedido lançado",
  notes: "",
};

const BUCKET = "documentos";

function PedidosPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { user } = useCurrentUser();
  const removeRecord = useRemoveRecord();
  const { data: orders = [], isLoading } = useOrders();
  const { data: allOrderDocs = [] } = useDocuments("order");
  const { data: invoices = [] } = useInvoices();
  const { data: settings } = useSettings();
  const { data: brands = [] } = useBrands();
  const { data: factories = [] } = useFactories();
  const { data: collections = [] } = useCollections();
  
  const hideClosed = settings?.["active_collections_only"] === "true";
  const visibleOrders = useMemo(() => {
    if (!hideClosed) return orders;
    const activeCols = new Set(collections.filter((c) => c.status !== "Encerrada").map((c) => c.id));
    return orders.filter((o) => o.collection_id && activeCols.has(o.collection_id));
  }, [orders, collections, hideClosed]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(search.o ?? null);
  
  useEffect(() => {
    if (search.o) setSelectedOrderId(search.o);
  }, [search.o]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !open) setSelectedOrderId(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const [form, setForm] = useState({ ...emptyForm });
  const [copyFiles, setCopyFiles] = useState<File[]>([]);
  const copyRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
  const [refCodeFilter, setRefCodeFilter] = useState("");
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"todos" | "problemas">("todos");
  const [statusFilter, setStatusFilter] = useState("hide_all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [collectionFilter, setCollectionFilter] = useState("all");
  const [brandCollectionFilter, setBrandCollectionFilter] = useState("all");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");

  const docsByOrderId = useMemo(() => {
    const map = new Map<string, DocumentRow[]>();
    for (const d of allOrderDocs) {
      const arr = map.get(d.entity_id) ?? [];
      arr.push(d);
      map.set(d.entity_id, arr);
    }
    return map;
  }, [allOrderDocs]);

  useEffect(() => {
    if (search.edit && orders.length > 0) {
      const o = orders.find((x) => x.id === search.edit);
      if (o) {
        openEdit(o);
        void navigate({ to: "/pedidos", search: ({ edit: _edit, ...rest }) => rest, replace: true });
      }
    }
  }, [search.edit, orders]);

  const editingDocs = useMemo(() => {
    return editing ? docsByOrderId.get(editing.id) ?? [] : [];
  }, [editing, docsByOrderId]);

  async function openDoc(path: string) {
    const { data, error } = await supabase.storage.from("documentos").createSignedUrl(path, 300);
    if (error || !data) {
      toast.error(error?.message ?? "Não foi possível abrir o arquivo.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  async function deleteDoc(docId: string, path: string) {
    if (!window.confirm("Deseja realmente excluir a cópia do pedido? Esta ação não pode ser desfeita.")) {
      return;
    }
    const { error: stErr } = await supabase.storage.from("documentos").remove([path]);
    if (stErr) {
      toast.error(`Falha no armazenamento: ${stErr.message}`);
      return;
    }
    const { error } = await crmDb.from("documents").delete().eq("id", docId);
    if (error) {
      toast.error(`Falha ao excluir registro: ${error.message}`);
      return;
    }
    void qc.invalidateQueries({ queryKey: ["documents"] });
    toast.success("Cópia do pedido excluída.");
  }

  const isAdmin = user?.role === "admin";
  const brandById = useMemo(() => new Map(brands.map((b) => [b.id, b])), [brands]);

  const filterBrandCollections = useMemo(() => {
    let bcs: any[] = [];
    if (collectionFilter !== "all") {
      const col = collections.find((c) => c.id === collectionFilter);
      if (col && col.brand_collections) bcs = col.brand_collections;
    } else {
      collections.forEach((c) => {
        if (!hideClosed || c.status !== "Encerrada") {
          if (c.brand_collections) bcs.push(...c.brand_collections);
        }
      });
    }
    if (brandFilter !== "all") {
      bcs = bcs.filter((bc) => bc.brand_id === brandFilter);
    }
    return bcs;
  }, [collections, collectionFilter, brandFilter, hideClosed]);

  const availableBrandCollections = useMemo(() => {
    const col = collections.find(c => c.id === form.collection_id);
    if (!col) return [];
    return col.brand_collections?.filter(bc => bc.brand_id === form.brand_id) || [];
  }, [collections, form.collection_id, form.brand_id]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return visibleOrders.filter((o) => {
      if (statusFilter !== "hide_all" && statusFilter !== "all" && o.status !== statusFilter) return false;
      if (brandFilter !== "all" && o.brand_id !== brandFilter) return false;
      if (collectionFilter !== "all" && o.collection_id !== collectionFilter) return false;
      if (brandCollectionFilter !== "all" && o.brand_collection_id !== brandCollectionFilter) return false;
      if (dateStart && o.order_date && o.order_date < dateStart) return false;
      if (dateEnd && o.order_date && o.order_date > dateEnd) return false;
      if (refCodeFilter && !o.brand_collections?.brand_code?.toLowerCase().includes(refCodeFilter.trim().toLowerCase())) return false;
      if (!term) return true;
      return [
        o.internal_number,
        o.factory_order_number,
        o.clients?.legal_name,
        o.clients?.trade_name,
        o.clients?.cnpj,
        o.brands?.brand,
        o.collections?.name,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(term));
    });
  }, [orders, q, statusFilter, brandFilter, collectionFilter, brandCollectionFilter, dateStart, dateEnd, refCodeFilter]);

  const sorted = useMemo(() => {
    let sortableItems = [...filtered];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue: any = a[sortConfig.key as keyof typeof a];
        let bValue: any = b[sortConfig.key as keyof typeof b];
        
        if (sortConfig.key === 'internal_number') {
          aValue = a.internal_number || '';
          bValue = b.internal_number || '';
        } else if (sortConfig.key === 'client') {
          aValue = a.clients?.legal_name || '';
          bValue = b.clients?.legal_name || '';
        } else if (sortConfig.key === 'brand') {
          aValue = a.brands?.brand || '';
          bValue = b.brands?.brand || '';
        } else if (sortConfig.key === 'total_pieces') {
          aValue = Number(aValue || 0);
          bValue = Number(bValue || 0);
        } else if (sortConfig.key === 'total_value') {
          aValue = Number(aValue || 0);
          bValue = Number(bValue || 0);
        } else if (sortConfig.key === 'order_date') {
          aValue = a.order_date || '';
          bValue = b.order_date || '';
        } else if (sortConfig.key === 'status') {
          aValue = a.status || '';
          bValue = b.status || '';
        }

        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filtered, sortConfig]);

  const kpiOrders = useMemo(() => {
    const hasFilter =
      (statusFilter !== "hide_all" && statusFilter !== "all") ||
      brandFilter !== "all" ||
      collectionFilter !== "all" ||
      brandCollectionFilter !== "all" ||
      dateStart ||
      dateEnd ||
      refCodeFilter ||
      q.trim().length > 0;

    return hasFilter ? filtered : visibleOrders;
  }, [visibleOrders, filtered, statusFilter, brandFilter, collectionFilter, brandCollectionFilter, dateStart, dateEnd, refCodeFilter, q]);

  const valid = kpiOrders.filter((o) => o.status !== "Cancelado");
  const totalValue = sumMoney(valid, (o) => o.total_value);
  const totalPieces = valid.reduce((a, o) => a + Number(o.total_pieces ?? 0), 0);
  const openOrders = valid.filter((o) => !["Faturado", "Finalizado"].includes(o.status));

  function SortButton({ label, sortKey }: { label: string, sortKey: string }) {
    return (
      <button 
        onClick={() => {
          let direction: "asc" | "desc" = "asc";
          if (sortConfig && sortConfig.key === sortKey && sortConfig.direction === "asc") {
            direction = "desc";
          }
          setSortConfig({ key: sortKey, direction });
        }}
        className="flex items-center gap-1 hover:text-brand transition-colors select-none"
      >
        {label}
        <span className="text-[10px] opacity-70 w-3 inline-block">
          {sortConfig?.key === sortKey ? (sortConfig.direction === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    );
  }

  function openNew() {
    setEditing(null);
    setForm({ ...emptyForm });
    setCopyFiles([]);
    setOpen(true);
  }

  function openEdit(o: Order) {
    setEditing(o);
    setForm({
      client_id: o.client_id,
      brand_id: o.brand_id,
      factory_id: o.factory_id ?? "",
      collection_id: o.collection_id,
      brand_collection_id: o.brand_collection_id,
      order_date: o.order_date?.slice(0, 10) ?? "",
      total_value: String(o.total_value ?? ""),
      total_pieces: String(o.total_pieces ?? ""),
      factory_order_number: o.factory_order_number ?? "",
      payment_method: o.payment_method ?? "",
      payment_terms: o.payment_terms ?? "",
      status: o.status,
      notes: o.notes ?? "",
    });
    setCopyFiles([]);
    setOpen(true);
  }

  /** Arquiva a cópia do pedido enviado pela fábrica junto ao pedido lançado. */
  async function uploadCopy(orderId: string, file: File) {
    const safe = file.name.replace(/[^\w.\-() ]/g, "_").slice(0, 120);
    const path = `order/${orderId}/${Date.now()}-${safe}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (upErr) {
      toast.error(`Pedido salvo, mas a cópia não subiu: ${upErr.message}`);
      return;
    }
    await crmDb.from("documents").insert({
      entity_type: "order",
      entity_id: orderId,
      category: "Espelho do pedido",
      file_name: file.name,
      file_path: path,
      mime_type: file.type || null,
      size_bytes: file.size,
      notes: "Cópia do pedido da fábrica",
      uploaded_by: user?.id ?? null,
      uploaded_by_name: user?.name ?? null,
    });
    void qc.invalidateQueries({ queryKey: ["documents"] });
  }

  async function save() {
    if (!form.client_id) {
      toast.error("Selecione o cliente.");
      return;
    }
    if (!form.brand_id) {
      toast.error("Selecione a marca.");
      return;
    }
    if (!form.factory_id) {
      toast.error("Selecione a fábrica.");
      return;
    }
    if (!form.collection_id) {
      toast.error("Selecione a coleção geral.");
      return;
    }
    if (!form.brand_collection_id) {
      toast.error("Selecione a coleção da marca.");
      return;
    }
    if (!form.order_date) {
      toast.error("Informe a data do pedido.");
      return;
    }
    if (!form.total_value || Number(form.total_value) <= 0) {
      toast.error("Informe o valor total do pedido.");
      return;
    }
    if (!form.total_pieces || Number(form.total_pieces) <= 0) {
      toast.error("Informe a quantidade de peças.");
      return;
    }
    setSaving(true);
    const payload = {
      client_id: form.client_id,
      brand_id: form.brand_id,
      factory_id: form.factory_id,
      collection_id: form.collection_id,
      brand_collection_id: form.brand_collection_id,
      order_date: form.order_date,
      total_value: Number(form.total_value),
      total_pieces: Number(form.total_pieces),
      factory_order_number: form.factory_order_number.trim() || null,
      payment_method: form.payment_method.trim() || null,
      payment_terms: form.payment_terms.trim() || null,
      status: form.status,
      notes: form.notes.trim() || null,
    };

    if (editing) {
      const { error } = await crmDb.from("orders").update(payload).eq("id", editing.id);
      if (error) {
        setSaving(false);
        toast.error(error.message);
        return;
      }
      if (copyFiles.length > 0) {
         for (const f of copyFiles) await uploadCopy(editing.id, f);
      }
      setSaving(false);
      void qc.invalidateQueries({ queryKey: ["orders"] });
      void qc.invalidateQueries({ queryKey: ["order"] });
      setOpen(false);
      toast.success("Pedido atualizado.");
      return;
    }

    const { data, error } = await crmDb
      .from("orders")
      .insert({ ...payload, rep_name: user?.name ?? null, created_by: user?.id ?? null })
      .select("id, internal_number")
      .maybeSingle();
    if (error || !data) {
      setSaving(false);
      toast.error(error?.message ?? "Não foi possível lançar o pedido.");
      return;
    }
    const created = data as { id: string; internal_number?: string };
    if (copyFiles.length > 0) {
       for (const f of copyFiles) await uploadCopy(created.id, f);
    }
    setSaving(false);
    await logAudit({
      entityType: "order",
      entityId: created.id,
      action: "Criação",
      description: `Pedido ${created.internal_number ?? ""} lançado`,
      userName: user?.name ?? null,
      userId: user?.id ?? null,
    });
    void qc.invalidateQueries({ queryKey: ["orders"] });
    setOpen(false);
    toast.success("Pedido lançado.");
  }

  return (
    <AppShell
      title="Pedidos"
      subtitle="Cliente, marca, fábrica e coleção em um único fluxo"
      actions={<PrimaryButton onClick={openNew}>+ Novo pedido</PrimaryButton>}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 mb-4">
        <KpiCard label="Pedidos válidos" value={String(valid.length)} />
        <KpiCard label="Valor total" value={currency(totalValue)} tone="brand" />
        <KpiCard label="Peças vendidas" value={totalPieces.toLocaleString("pt-BR")} tone="cyan" />
        <KpiCard
          label="Em aberto"
          value={String(openOrders.length)}
          tone="amber"
          hint={currency(sumMoney(openOrders, (o) => o.total_value))}
        />
      </div>

      <div className={`grid gap-4 items-start ${selectedOrderId ? "lg:grid-cols-[minmax(320px,400px)_1fr] xl:grid-cols-[minmax(380px,450px)_1fr]" : "grid-cols-1"}`}>
        <GlassCard className="p-4 flex flex-col min-w-0">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-semibold text-card-foreground">Filtros</span>
          <ShowAllToggle 
            showAll={statusFilter !== "hide_all"} 
            onToggle={(v) => setStatusFilter(v ? "all" : "hide_all")} 
          />
        </div>
        <div className="mb-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <TextInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nº pedido, cliente, CNPJ..."
          />
          <SelectInput value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}>
            <option value="all">Todas as marcas</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.brand}
              </option>
            ))}
          </SelectInput>
          <SelectInput value={collectionFilter} onChange={(e) => {
            setCollectionFilter(e.target.value);
            setBrandCollectionFilter("all");
          }}>
            <option value="all">Todas as coleções gerais</option>
            {collections.filter(c => !hideClosed || c.status !== "Encerrada").map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectInput>
          <SelectInput value={brandCollectionFilter} onChange={(e) => setBrandCollectionFilter(e.target.value)}>
            <option value="all">Todas as coleções da marca</option>
            {filterBrandCollections.map((bc) => (
              <option key={bc.id} value={bc.id}>
                {bc.name} ({bc.brands?.brand})
              </option>
            ))}
          </SelectInput>
          <SelectInput
              value={statusFilter === "hide_all" ? "all" : statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-40"
            >
              <option value="all">Todos os status</option>
              {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </SelectInput>
          <TextInput
            value={refCodeFilter}
            onChange={(e) => setRefCodeFilter(e.target.value)}
            placeholder="Cód. de Referência"
          />
        </div>
        
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-medium text-muted-foreground shrink-0">Período:</p>
            <TextInput
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              className="w-36"
            />
            <span className="text-muted-foreground text-xs">até</span>
            <TextInput
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              className="w-36"
            />
            {(dateStart || dateEnd) && (
              <GhostButton className="text-xs" onClick={() => { setDateStart(""); setDateEnd(""); }}>Limpar</GhostButton>
            )}
          </div>
          <div className="flex bg-muted/30 p-1 rounded-lg border border-border self-end">
            <button
              onClick={() => setViewMode("list")}
              className={`px-4 rounded-md text-xs font-semibold py-1.5 transition-colors ${viewMode === "list" ? "bg-card shadow-sm text-card-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              Lista
            </button>
            <button
              onClick={() => setViewMode("kanban")}
              className={`px-4 rounded-md text-xs font-semibold py-1.5 transition-colors ${viewMode === "kanban" ? "bg-card shadow-sm text-card-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              Kanban
            </button>
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando pedidos...</p>
        ) : statusFilter === "hide_all" && brandFilter === "all" && collectionFilter === "all" && !q && !dateStart && !dateEnd ? (
          <EmptyState
            title="Pesquise para listar"
            hint="Selecione um status ou filtro acima para carregar os pedidos."
          />
        ) : filtered.length === 0 ? (
          <EmptyState title="Nenhum pedido encontrado" hint="Lance o primeiro pedido da coleção." />
        ) : viewMode === "list" ? (
          <TableShell
            head={[
              <SortButton key="1" label="Nº" sortKey="internal_number" />,
              <SortButton key="2" label="Cliente" sortKey="client" />,
              <SortButton key="3" label="Marca / Coleção" sortKey="brand" />,
              <SortButton key="4" label="Data" sortKey="order_date" />,
              <SortButton key="5" label="Peças" sortKey="total_pieces" />,
              <SortButton key="6" label="Valor" sortKey="total_value" />,
              <SortButton key="7" label="Status" sortKey="status" />,
              ""
            ]}
          >
            {sorted.map((o) => (
              <Tr
                key={o.id}
                onClick={() => setSelectedOrderId(o.id)}
                className={selectedOrderId === o.id ? "bg-accent/50" : ""}
              >
                <Td>
                  <p className="font-medium text-card-foreground">{o.internal_number}</p>
                  <p className="text-[11px] text-muted-foreground">{o.factory_order_number ?? "—"}</p>
                  {docsByOrderId.has(o.id) ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const doc = docsByOrderId.get(o.id)?.[0];
                        if (doc) void openDoc(doc.file_path);
                      }}
                      className="mt-1 inline-flex items-center gap-1 rounded-md bg-brand/15 px-1.5 py-0.5 text-[10px] font-medium text-brand transition hover:bg-brand/25"
                      title="Clique para abrir a cópia do pedido"
                    >
                      <Paperclip className="size-2.5" /> Ver cópia
                    </button>
                  ) : null}
                </Td>
                <Td>
                  <p className="text-card-foreground font-medium">
                    {o.clients?.legal_name ?? "—"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {o.clients?.trade_name ? `${o.clients.trade_name} · ` : ""}{o.clients?.city ?? "—"}/{o.clients?.state ?? "—"}
                  </p>
                </Td>
                <Td>
                  <BrandTag
                    brand={o.brands?.brand}
                    logoUrl={brandById.get(o.brand_id)?.logo_url}
                    hint={o.brand_collections?.name || o.collections?.name}
                  />
                </Td>
                <Td className="text-muted-foreground">{formatDate(o.order_date)}</Td>
                <Td className="tabular-nums text-muted-foreground">{o.total_pieces}</Td>
                <Td className="font-medium tabular-nums text-card-foreground">
                  {currency(Number(o.total_value ?? 0))}
                </Td>
                <Td>
                  <RepBadge status={o.status} tones={orderTone} />
                </Td>
                <Td>
                  <span className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <GhostButton
                      className="px-2 py-1"
                      onClick={() => setSelectedOrderId(o.id)}
                    >
                      Ver
                    </GhostButton>
                    <GhostButton className="px-2 py-1" onClick={() => openEdit(o)}>
                      Editar
                    </GhostButton>
                    {isAdmin ? (
                      <GhostButton
                        className="border-rose/30 px-2 py-1 text-rose"
                        onClick={() =>
                          void removeRecord({
                            table: "orders",
                            id: o.id,
                            label: `o pedido ${o.internal_number}`,
                            keys: ["orders", "invoices", "commissions", "documents"],
                          })
                        }
                      >
                        Excluir
                      </GhostButton>
                    ) : null}
                  </span>
                </Td>
              </Tr>
            ))}
          </TableShell>
        ) : (
          <div className="p-4 flex gap-4 overflow-x-auto h-full items-start">
            {ORDER_STATUSES.map((statusGroup) => {
              const groupOrders = sorted.filter(o => o.status === statusGroup);
              if (statusGroup !== "Pedido lançado" && groupOrders.length === 0 && statusFilter !== statusGroup) return null;
              
              return (
                <div key={statusGroup} className="w-72 shrink-0 flex flex-col gap-3">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-sm font-bold text-card-foreground">{statusGroup}</h3>
                    <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-xs font-semibold">{groupOrders.length}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {groupOrders.map((o) => (
                      <div
                        key={o.id}
                        onClick={() => setSelectedOrderId(o.id)}
                        className={`cursor-pointer text-left rounded-xl border p-3 transition shadow-sm hover:border-primary/30 ${selectedOrderId === o.id ? "ring-2 ring-primary ring-offset-1 bg-card border-primary" : "border-border bg-card"}`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-semibold text-sm text-card-foreground truncate">{o.internal_number}</p>
                            {o.factory_order_number && <p className="text-[10px] text-muted-foreground truncate">{o.factory_order_number}</p>}
                          </div>
                          <span className="font-medium text-xs text-brand">{currency(Number(o.total_value ?? 0))}</span>
                        </div>
                        <p className="text-xs font-medium text-card-foreground truncate">{o.clients?.legal_name ?? "—"}</p>
                        <p className="text-[10px] text-muted-foreground truncate mb-1">
                          {o.clients?.trade_name ? `${o.clients.trade_name} · ` : ""}{o.clients?.city || "—"}/{o.clients?.state || "—"}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                          <span className="bg-muted px-1.5 py-0.5 rounded truncate">{o.brands?.brand}</span>
                          <span className="bg-muted px-1.5 py-0.5 rounded">{formatDate(o.order_date)}</span>
                        </div>
                        {docsByOrderId.has(o.id) && (
                          <div className="mt-2 text-[10px] text-brand flex items-center gap-1">
                            <Paperclip className="size-3" /> Contém anexos
                          </div>
                        )}
                      </div>
                    ))}
                    {groupOrders.length === 0 && (
                      <div className="border border-dashed border-border rounded-xl p-4 text-center text-xs text-muted-foreground bg-muted/10">
                        Nenhum pedido
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      {selectedOrderId && (
        <div className="flex flex-col gap-4 max-h-[calc(100vh-140px)] overflow-y-auto pr-1">
          <OrderDetailsPanel
            orderId={selectedOrderId}
            onClose={() => setSelectedOrderId(null)}
            onEdit={() => {
              const o = orders.find(x => x.id === selectedOrderId);
              if (o) openEdit(o);
            }}
          />
        </div>
      )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Editar pedido ${editing.internal_number}` : "Novo pedido"}
        subtitle="Anexe a cópia do pedido enviado pela fábrica para conferência futura"
        wide
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Cliente *" className="sm:col-span-2">
            <ClientPicker
              value={form.client_id}
              onChange={(clientId) => setForm({ ...form, client_id: clientId })}
            />
          </Field>
          <Field label="Marca *">
            <SelectInput
              value={form.brand_id}
              onChange={(e) => {
                const brand = brandById.get(e.target.value);
                const factoryId = brand?.factory_id ?? form.factory_id;
                setForm({ ...form, brand_id: e.target.value, factory_id: factoryId, collection_id: "", brand_collection_id: "" });
              }}
            >
              <option value="">Selecione</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.brand}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Fábrica *">
            <SelectInput
              value={form.factory_id}
              onChange={(e) => setForm({ ...form, factory_id: e.target.value })}
            >
              <option value="">Selecione</option>
              {factories.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.trade_name ?? f.legal_name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Coleção Geral *">
            <SelectInput
              value={form.collection_id}
              onChange={(e) => setForm({ ...form, collection_id: e.target.value, brand_collection_id: "" })}
            >
              <option value="">Selecione</option>
              {collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Coleção da Marca *">
            <SelectInput
              value={form.brand_collection_id}
              onChange={(e) => setForm({ ...form, brand_collection_id: e.target.value })}
              disabled={!form.collection_id || !form.brand_id}
            >
              <option value="">Selecione a coleção da marca</option>
              {availableBrandCollections.map((bc) => (
                <option key={bc.id} value={bc.id}>
                  {bc.name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Data do pedido *">
            <TextInput
              type="date"
              value={form.order_date}
              onChange={(e) => setForm({ ...form, order_date: e.target.value })}
            />
          </Field>
          <Field label="Valor total (R$) *">
            <MoneyInput
              value={form.total_value}
              onValueChange={(v) => setForm({ ...form, total_value: v })}
            />
          </Field>
          <Field label="Quantidade de peças *">
            <TextInput
              type="number"
              value={form.total_pieces}
              onChange={(e) => setForm({ ...form, total_pieces: e.target.value })}
            />
          </Field>
          <Field label="Nº do pedido na fábrica">
            <TextInput
              value={form.factory_order_number}
              onChange={(e) => setForm({ ...form, factory_order_number: e.target.value })}
            />
          </Field>
          <Field label="Forma de Pagamento">
            <TextInput
              value={form.payment_method}
              onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
              placeholder="Ex: Cartão, À vista..."
            />
          </Field>
          <Field label="Prazo">
            <TextInput
              value={form.payment_terms}
              onChange={(e) => setForm({ ...form, payment_terms: e.target.value })}
              placeholder="Ex: 30/60/90, 2x..."
            />
          </Field>
          <Field label="Status">
            <SelectInput value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Cópia do pedido da fábrica" className="sm:col-span-2">
            <div className="space-y-2">
              {editingDocs.length > 0 ? (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    Cópia anexada ao pedido:
                  </p>
                  {editingDocs.map((d) => (
                    <div
                      key={d.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-ink-2/40 p-3"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <FileText className="size-4 shrink-0 text-brand" />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-card-foreground">{d.file_name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {((d.size_bytes ?? 0) / 1024).toFixed(0)} KB · {formatDate(d.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <GhostButton
                          className="px-2.5 py-1 text-xs"
                          onClick={() => void openDoc(d.file_path)}
                        >
                          <Download className="size-3" /> Abrir / Baixar
                        </GhostButton>
                        <GhostButton
                          className="border-rose/30 px-2.5 py-1 text-xs text-rose hover:bg-rose/10"
                          onClick={() => void deleteDoc(d.id, d.file_path)}
                        >
                          <Trash2 className="size-3" /> Excluir cópia
                        </GhostButton>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <input
                  ref={copyRef}
                  type="file"
                  multiple
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.xls,.xlsx,.csv,.doc,.docx"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    if (files.length > 0) {
                       setCopyFiles(prev => [...prev, ...files]);
                    }
                  }}
                />
                <GhostButton onClick={() => copyRef.current?.click()}>
                  {copyFiles.length > 0
                    ? "+ Adicionar mais arquivos"
                    : editingDocs.length > 0
                      ? "+ Substituir ou adicionar outra cópia"
                      : "+ Anexar cópias do pedido"}
                </GhostButton>
                <span className="text-xs text-muted-foreground">
                  {copyFiles.length > 0 ? (
                    <span className="font-medium text-emerald-400">Prontos para enviar: {copyFiles.map(f => f.name).join(", ")}</span>
                  ) : editingDocs.length === 0 ? (
                    "PDF ou imagem do pedido enviado pela fábrica"
                  ) : null}
                </span>
                {copyFiles.length > 0 ? (
                  <GhostButton
                    className="border-rose/30 px-2 py-1 text-xs text-rose"
                    onClick={() => setCopyFiles([])}
                  >
                    Descartar novos
                  </GhostButton>
                ) : null}
              </div>
            </div>
          </Field>
          <Field label="Observações" className="sm:col-span-2">
            <TextArea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <GhostButton onClick={() => setOpen(false)}>Cancelar</GhostButton>
          <PrimaryButton disabled={saving} onClick={() => void save()}>
            {saving ? "Salvando..." : editing ? "Salvar pedido" : "Lançar pedido"}
          </PrimaryButton>
        </div>
      </Modal>
    </AppShell>
  );
}

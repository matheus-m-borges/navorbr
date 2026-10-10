import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
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
  SelectInput,
  ShowAllToggle,
  TextArea,
  TextInput,
} from "@/components/navor-rephub/ui";
import { RepBadge, TableShell, Td, Tr } from "@/components/navor-rephub/repui";
import { currency, formatDate } from "@/lib/crm";
import { COLLECTION_STATUSES, collectionTone, daysUntil, pct, sumMoney } from "@/lib/rep";
import { useRemoveRecord } from "@/lib/registro";
import { Download, FileText, Trash2, Plus, Tag, Pencil } from "lucide-react";
import { crmDb, useBrands } from "@/hooks/useCrm";
import { useCollections, useDocuments, useOrders, type Collection, type BrandCollection } from "@/hooks/useRep";
import { useCurrentUser } from "@/hooks/useSession";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/(navor-rephub)/colecoes")({
  head: () => ({
    meta: [
      { title: "Coleções | CRM Representação" },
      {
        name: "description",
        content:
          "Controle de coleções por marca e fábrica: período de vendas, dias restantes, meta e desempenho de pedidos.",
      },
      { property: "og:title", content: "Coleções | CRM Representação" },
      {
        property: "og:description",
        content: "Acompanhe abertura, encerramento e resultado de cada coleção da representação.",
      },
    ],
  }),
  component: ColecoesPage,
});

function friendly(message: string) {
  if (/row-level security|permission denied|violates/i.test(message))
    return "Somente o administrador pode criar ou alterar coleções.";
  return message;
}

const emptyForm = {
  name: "",
  year: "",
  collection_type: "",
  sales_start: "",
  sales_end: "",
  launch_date: "",
  status: "Planejada",
  notes: "",
  description: "",
  portal_scope: "marca",
};

const emptyBrandForm = {
  brand_id: "",
  name: "",
  brand_code: "",
  start_date: "",
  end_date: "",
  status: "Planejada",
  description: "",
  photos_link: "",
  allow_download: true,
};

function ColecoesPage() {
  const qc = useQueryClient();
  const { data: collections = [], isLoading } = useCollections();
  const { data: brands = [] } = useBrands();
  const { data: orders = [] } = useOrders();
  const { user } = useCurrentUser();
  const removeRecord = useRemoveRecord();
  const isAdmin = user?.role === "admin";
  const { data: allBrandColDocs = [] } = useDocuments("brand_collection");
  
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Collection | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  
  const [addingBrand, setAddingBrand] = useState(false);
  const [brandForm, setBrandForm] = useState({ ...emptyBrandForm });
  const [pendingBrands, setPendingBrands] = useState<string[]>([]);
  
  const [editingBrand, setEditingBrand] = useState<BrandCollection | null>(null);
  
  const [statusFilter, setStatusFilter] = useState("hide_all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [refCodeFilter, setRefCodeFilter] = useState("");
  
  const [catalogFiles, setCatalogFiles] = useState<File[]>([]);
  const catalogRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const salesByCollection = useMemo(() => {
    const map = new Map<string, { value: number; pieces: number; count: number }>();
    for (const o of orders) {
      if (o.status === "Cancelado") continue;
      const cur = map.get(o.collection_id) ?? { value: 0, pieces: 0, count: 0 };
      cur.value += Number(o.total_value ?? 0);
      cur.pieces += Number(o.total_pieces ?? 0);
      cur.count += 1;
      map.set(o.collection_id, cur);
    }
    return map;
  }, [orders]);

  const docsByBrandColId = useMemo(() => {
    const map = new Map<string, typeof allBrandColDocs>();
    for (const d of allBrandColDocs) {
      const arr = map.get(d.entity_id) ?? [];
      arr.push(d);
      map.set(d.entity_id, arr);
    }
    return map;
  }, [allBrandColDocs]);

  const editingBrandDocs = useMemo(() => {
    return editingBrand ? docsByBrandColId.get(editingBrand.id) ?? [] : [];
  }, [editingBrand, docsByBrandColId]);

  // Mantém a coleção aberta em edição sincronizada com a lista recarregada,
  // para que marcas vinculadas/removidas apareçam sem fechar o formulário.
  useEffect(() => {
    if (!editing) return;
    const fresh = collections.find((c) => c.id === editing.id);
    if (fresh && fresh !== editing) setEditing(fresh);
  }, [collections, editing]);

  const filtered = collections.filter(
    (c) =>
      (statusFilter === "hide_all" || statusFilter === "all" || c.status === statusFilter) &&
      (brandFilter === "all" || c.brand_collections?.some(bc => bc.brand_id === brandFilter)) &&
      (!refCodeFilter || c.brand_collections?.some(bc => bc.brand_code?.toLowerCase().includes(refCodeFilter.toLowerCase())))
  );

  const active = collections.filter((c) => c.status === "Em vendas" || c.status === "Aberta para vendas");
  const closingSoon = active.filter((c) => {
    const d = daysUntil(c.sales_end);
    return d !== null && d >= 0 && d <= 15;
  });
  
  // Total target sum from collections? General collection might not have target_value anymore, 
  // but if it does we sum it. If it moved to brand_collections, we sum there. We'll sum from collections for now.
  const totalTarget = sumMoney(collections, (c) => c.target_value ?? 0);
  const totalSold = sumMoney(orders.filter((o) => o.status !== "Cancelado"), (o) => o.total_value);

  function openNew() {
    setEditing(null);
    setForm({ ...emptyForm });
    setPendingBrands([]);
    setAddingBrand(false);
    setOpen(true);
  }

  function openEdit(c: Collection) {
    setEditing(c);
    setForm({
      name: c.name,
      year: c.year ? String(c.year) : "",
      collection_type: c.collection_type ?? "",
      sales_start: c.sales_start?.slice(0, 10) ?? "",
      sales_end: c.sales_end?.slice(0, 10) ?? "",
      launch_date: c.launch_date?.slice(0, 10) ?? "",
      status: c.status,
      notes: c.notes ?? "",
      description: c.description ?? "",
      portal_scope: c.portal_scope ?? "marca",
    });
    setAddingBrand(false);
    setOpen(true);
  }

  function openBrandEdit(bc: BrandCollection) {
    setEditingBrand(bc);
    setCatalogFiles([]);
    setBrandForm({
      brand_id: bc.brand_id,
      name: bc.name,
      brand_code: bc.brand_code ?? "",
      start_date: bc.start_date?.slice(0, 10) ?? "",
      end_date: bc.end_date?.slice(0, 10) ?? "",
      status: bc.status,
      description: bc.description ?? "",
      photos_link: bc.photos_link ?? "",
      allow_download: bc.allow_download ?? true,
    });
  }

  async function uploadCatalog(brandColId: string, file: File) {
    if (file.size > 400 * 1024 * 1024) throw new Error("Um arquivo deve ter até 400 MB.");
    const safe = file.name.replace(/[^\w.\-() ]/g, "_").slice(0, 120);
    const path = `brand_collection/${brandColId}/${Date.now()}-${safe}`;
    const { error: upErr } = await supabase.storage.from("documentos").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (upErr) throw new Error(`Falha no armazenamento: ${upErr.message}`);
    await crmDb.from("documents").insert({
      entity_type: "brand_collection",
      entity_id: brandColId,
      category: "Catálogo",
      file_name: file.name,
      file_path: path,
      mime_type: file.type || null,
      size_bytes: file.size,
      uploaded_by: user?.id ?? null,
      uploaded_by_name: user?.name ?? null,
    });
    void qc.invalidateQueries({ queryKey: ["documents"] });
  }

  async function openDoc(path: string) {
    const { data, error } = await supabase.storage.from("documentos").createSignedUrl(path, 300);
    if (error || !data) {
      toast.error(error?.message ?? "Não foi possível abrir o arquivo.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  async function deleteDoc(docId: string, path: string) {
    if (!window.confirm("Deseja realmente excluir este anexo?")) return;
    const { error: stErr } = await supabase.storage.from("documentos").remove([path]);
    if (stErr) {
      toast.error(`Falha no armazenamento: ${stErr.message}`);
      return;
    }
    await crmDb.from("documents").delete().eq("id", docId);
    void qc.invalidateQueries({ queryKey: ["documents"] });
    toast.success("Anexo excluído.");
  }

  async function save() {
    if (!form.name.trim()) {
      toast.error("Informe o nome da coleção.");
      return;
    }
    if (form.sales_start && form.sales_end && form.sales_end < form.sales_start) {
      toast.error("O fim das vendas não pode ser anterior ao início.");
      return;
    }
    
    const payload = {
      name: form.name.trim(),
      year: form.year ? Number(form.year) : null,
      collection_type: form.collection_type.trim() || null,
      sales_start: form.sales_start || null,
      sales_end: form.sales_end || null,
      launch_date: form.launch_date || null,
      status: form.status,
      notes: form.notes.trim() || null,
      description: form.description.trim() || null,
      portal_scope: form.portal_scope,
    };
    
    setBusy(true);
    try {
      let id = editing?.id ?? "";
      if (editing) {
        const { error } = await crmDb.from("collections").update(payload).eq("id", editing.id);
        if (error) throw new Error(friendly(error.message));
      } else {
        const { data, error } = await crmDb
          .from("collections")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw new Error(friendly(error.message));
        id = (data as { id: string }).id;
        
        if (pendingBrands.length > 0) {
          const bcs = pendingBrands.map(bId => {
            const b = brands.find(x => x.id === bId);
            return {
              collection_id: id,
              brand_id: bId,
              factory_id: (b as any)?.factory_id ?? null,
              name: `${payload.name} - ${b?.brand || ""}`,
              status: payload.status,
            };
          });
          const { error: bcErr } = await crmDb.from("brand_collections").insert(bcs);
          if (bcErr) throw new Error(friendly(bcErr.message));
        }
      }

      void qc.invalidateQueries({ queryKey: ["collections"] });
      setOpen(false);
      toast.success(editing ? "Coleção geral atualizada." : "Coleção geral criada.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  
  async function saveBrandSpecific() {
    if (!editingBrand) return;
    if (!brandForm.name.trim()) {
      toast.error("Informe o nome da coleção da marca.");
      return;
    }
    setBusy(true);
    let fieldsUpdated = false;
    try {
      const { error } = await crmDb.from("brand_collections").update({
        name: brandForm.name.trim(),
        brand_code: brandForm.brand_code.trim() || null,
        start_date: brandForm.start_date || null,
        end_date: brandForm.end_date || null,
        status: brandForm.status,
        description: brandForm.description.trim() || null,
        photos_link: brandForm.photos_link.trim() || null,
        allow_download: brandForm.allow_download,
      }).eq("id", editingBrand.id);
      if (error) throw new Error(friendly(error.message));
      fieldsUpdated = true;
    } catch (e) {
      toast.error(`Erro ao salvar informações: ${(e as Error).message}`);
    }

    if (!fieldsUpdated && catalogFiles.length === 0) {
      setBusy(false);
      return;
    }

    let successes = 0;
    const errors: string[] = [];
    
    if (catalogFiles.length > 0) {
      for (const f of catalogFiles) {
        try {
          await uploadCatalog(editingBrand.id, f);
          successes++;
        } catch (err) {
          errors.push(`${f.name}: ${(err as Error).message}`);
        }
      }
    }

    if (fieldsUpdated && catalogFiles.length === 0) {
      toast.success("Coleção da marca atualizada.");
    } else if (catalogFiles.length > 0) {
      if (successes > 0) {
        toast.success(`${successes} arquivo(s) enviado(s) com sucesso.`);
      }
      if (errors.length > 0) {
        toast.error(`Falhas de envio:\n${errors.join("\n")}`, { duration: 8000 });
      }
    }

    // Só limpa o form e fecha o modal se não houve erros de upload
    // ou se o usuário não estava tentando enviar arquivos.
    if (errors.length === 0) {
      setEditingBrand(null);
      setCatalogFiles([]);
    }
    
    void qc.invalidateQueries({ queryKey: ["collections"] });
    if (editing) void qc.invalidateQueries({ queryKey: ["collection", editing.id] });
    setBusy(false);
  }
  
  async function saveBrandCollection() {
    if (!editing) return;
    if (!brandForm.brand_id) {
      toast.error("Selecione a marca.");
      return;
    }
    if (!brandForm.name.trim()) {
      toast.error("Informe o nome da coleção da marca.");
      return;
    }
    
    const brand = brands.find((b) => b.id === brandForm.brand_id);
    
    setBusy(true);
    try {
      const { error } = await crmDb.from("brand_collections").insert({
        collection_id: editing.id,
        brand_id: brandForm.brand_id,
        factory_id: (brand as any)?.factory_id ?? null,
        name: brandForm.name.trim(),
        brand_code: brandForm.brand_code.trim() || null,
        start_date: brandForm.start_date || null,
        end_date: brandForm.end_date || null,
        status: brandForm.status,
      });
      if (error) throw new Error(friendly(error.message));
      
      toast.success("Marca vinculada à coleção.");
      setAddingBrand(false);
      setBrandForm({ ...emptyBrandForm });
      void qc.invalidateQueries({ queryKey: ["collections"] });
      void qc.invalidateQueries({ queryKey: ["collection", editing.id] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  
  async function removeBrandCollection(bcId: string) {
    if (!window.confirm("Remover esta marca da coleção? Os pedidos vinculados perderão a referência!")) return;
    const { error } = await crmDb.from("brand_collections").delete().eq("id", bcId);
    if (error) {
      toast.error(friendly(error.message));
      return;
    }
    toast.success("Marca removida da coleção.");
    void qc.invalidateQueries({ queryKey: ["collections"] });
    if (editing) void qc.invalidateQueries({ queryKey: ["collection", editing.id] });
  }

  return (
    <AppShell
      title="Coleções Comerciais"
      subtitle="Períodos de venda, lançamento e versões por marca"
      actions={<PrimaryButton onClick={openNew}>+ Nova coleção geral</PrimaryButton>}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Coleções gerais cadastradas" value={String(collections.length)} />
        <KpiCard label="Em vendas" value={String(active.length)} tone="cyan" hint="abertas no momento" />
        <KpiCard
          label="Encerrando em 15 dias"
          value={String(closingSoon.length)}
          tone={closingSoon.length ? "rose" : "muted"}
          hint="atenção nos follow-ups"
        />
        <KpiCard
          label="Vendido"
          value={currency(totalSold)}
          tone="brand"
          hint="Pedidos não cancelados"
        />
      </div>

      <GlassCard className="p-4">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-semibold text-card-foreground">Filtros</span>
          <ShowAllToggle 
            showAll={statusFilter !== "hide_all"} 
            onToggle={(v) => setStatusFilter(v ? "all" : "hide_all")} 
          />
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          <SelectInput
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            className="max-w-52"
          >
            <option value="all">Todas as marcas</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.brand}
              </option>
            ))}
          </SelectInput>
          <SelectInput
            value={statusFilter === "hide_all" ? "all" : statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="max-w-52"
          >
            <option value="all">Todos os status</option>
            {COLLECTION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </SelectInput>
          <TextInput
            value={refCodeFilter}
            onChange={(e) => setRefCodeFilter(e.target.value)}
            placeholder="Buscar por Cód. de Ref."
          />
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : statusFilter === "hide_all" && brandFilter === "all" ? (
          <EmptyState
            title="Pesquise para listar"
            hint="Selecione um status ou filtro acima para exibir as coleções."
          />
        ) : filtered.length === 0 ? (
          <EmptyState title="Nenhuma coleção encontrada" hint="Cadastre a primeira coleção comercial." />
        ) : (
          <TableShell
            head={["Coleção Geral", "Marcas Vinculadas", "Período", "Restam", "Pedidos", "Vendido", "Status", ""]}
          >
            {filtered.map((c) => {
              const sales = salesByCollection.get(c.id) ?? { value: 0, pieces: 0, count: 0 };
              const remaining = daysUntil(c.sales_end);
              const brandNames = c.brand_collections?.map(bc => bc.brands?.brand).filter(Boolean).join(", ");
              
              return (
                <Tr key={c.id}>
                  <Td>
                    <p className="font-medium text-card-foreground">{c.name}</p>
                    <p className="text-[11px] text-muted-foreground">{c.year ? c.year : "—"}</p>
                  </Td>
                  <Td className="text-muted-foreground max-w-[200px] truncate">
                    {brandNames || "Nenhuma"}
                  </Td>
                  <Td className="text-muted-foreground">
                    {formatDate(c.sales_start)} → {formatDate(c.sales_end)}
                  </Td>
                  <Td>
                    {remaining === null ? (
                      "—"
                    ) : remaining < 0 ? (
                      <span className="text-muted-foreground">encerrada</span>
                    ) : (
                      <span className={remaining <= 15 ? "font-semibold text-rose" : "text-card-foreground"}>
                        {remaining} d
                      </span>
                    )}
                  </Td>
                  <Td className="text-muted-foreground">
                    {sales.count} · {sales.pieces} pçs
                  </Td>
                  <Td>
                    <p className="font-medium text-card-foreground tabular-nums">{currency(sales.value)}</p>
                  </Td>
                  <Td>
                    <RepBadge status={c.status} tones={collectionTone} />
                  </Td>
                  <Td>
                    <span className="flex gap-1">
                      <GhostButton className="px-2 py-1" onClick={() => openEdit(c)}>
                        Abrir
                      </GhostButton>
                      {isAdmin ? (
                        <GhostButton
                          className="border-rose/30 px-2 py-1 text-rose"
                          onClick={() =>
                            void removeRecord({
                              table: "collections",
                              id: c.id,
                              label: `a coleção ${c.name}`,
                              keys: ["collections", "orders"],
                            })
                          }
                        >
                          Excluir
                        </GhostButton>
                      ) : null}
                    </span>
                  </Td>

                </Tr>
              );
            })}
          </TableShell>
        )}
      </GlassCard>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Coleção: ${editing.name}` : "Nova Coleção Geral"}
        subtitle="O período comercial abriga as coleções específicas de cada marca"
        wide
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome da coleção geral *">
            <TextInput
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="VERÃO 2027"
            />
          </Field>
          <Field label="Ano">
            <TextInput
              type="number"
              value={form.year}
              onChange={(e) => setForm({ ...form, year: e.target.value })}
              placeholder="2027"
            />
          </Field>
          
          <Field label="Tipo / Temporada">
            <TextInput
              value={form.collection_type}
              onChange={(e) => setForm({ ...form, collection_type: e.target.value })}
              placeholder="Ex: Verão, Inverno..."
            />
          </Field>
          <Field label="Status">
            <SelectInput
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {COLLECTION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </SelectInput>
          </Field>
          
          <Field label="Início das vendas">
            <TextInput
              type="date"
              value={form.sales_start}
              onChange={(e) => setForm({ ...form, sales_start: e.target.value })}
            />
          </Field>
          <Field label="Fim das vendas">
            <TextInput
              type="date"
              value={form.sales_end}
              onChange={(e) => setForm({ ...form, sales_end: e.target.value })}
            />
          </Field>
          
          <div className="rounded-xl border border-border bg-ink-2/40 p-3 sm:col-span-2 mt-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-card-foreground">Coleções das Marcas</p>
                <p className="text-xs text-muted-foreground">Quais marcas fazem parte deste período comercial</p>
              </div>
              {editing && !addingBrand && (
                <PrimaryButton className="py-1 px-3 text-xs" onClick={() => setAddingBrand(true)}>
                  <Plus className="size-3 mr-1" /> Adicionar Marca
                </PrimaryButton>
              )}
            </div>
            
            {!editing && (
              <div className="space-y-3 p-4 bg-muted/20 border border-dashed border-border rounded-lg mt-2">
                <p className="text-sm font-semibold text-card-foreground">Vincular marcas automaticamente</p>
                <p className="text-xs text-muted-foreground mb-2">Clique nas marcas abaixo para já incluí-las nesta coleção (os nomes serão gerados no padrão: Nome da Coleção Geral - Nome da Marca).</p>
                
                <div className="flex flex-wrap gap-2">
                  {brands.map(b => {
                    const isSelected = pendingBrands.includes(b.id);
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) setPendingBrands(prev => prev.filter(x => x !== b.id));
                          else setPendingBrands(prev => [...prev, b.id]);
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${isSelected ? "bg-brand text-brand-foreground border-brand" : "bg-card text-muted-foreground border-border hover:border-brand/50"}`}
                      >
                        <Tag className="size-3" />
                        {b.brand}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            
            {editing && addingBrand && (
              <div className="grid gap-3 sm:grid-cols-2 p-3 bg-card border border-border rounded-lg mb-4">
                <Field label="Marca *">
                  <SelectInput
                    value={brandForm.brand_id}
                    onChange={(e) => {
                      const brandName = brands.find((b) => b.id === e.target.value)?.brand ?? "";
                      setBrandForm({
                        ...brandForm,
                        brand_id: e.target.value,
                        name: brandName ? `${form.name} - ${brandName}` : form.name,
                      });
                    }}
                  >
                    <option value="">Selecione a marca...</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.brand}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="Nome específico *">
                  <TextInput
                    value={brandForm.name}
                    onChange={(e) => setBrandForm({ ...brandForm, name: e.target.value })}
                    placeholder="VERÃO 2027 - Alphabeto"
                  />
                </Field>
                <Field label="Código/Ref. da Marca">
                  <TextInput
                    value={brandForm.brand_code}
                    onChange={(e) => setBrandForm({ ...brandForm, brand_code: e.target.value })}
                  />
                </Field>
                <Field label="Status">
                  <SelectInput
                    value={brandForm.status}
                    onChange={(e) => setBrandForm({ ...brandForm, status: e.target.value })}
                  >
                    {COLLECTION_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </SelectInput>
                </Field>
                <div className="sm:col-span-2 flex justify-end gap-2 mt-2">
                  <GhostButton onClick={() => setAddingBrand(false)}>Cancelar</GhostButton>
                  <PrimaryButton disabled={busy} onClick={() => void saveBrandCollection()}>
                    Salvar Marca
                  </PrimaryButton>
                </div>
              </div>
            )}
            
            {editing && (
              <div className="space-y-2">
                {editing.brand_collections?.length === 0 && !addingBrand ? (
                  <p className="text-xs text-muted-foreground p-2">Nenhuma marca vinculada ainda.</p>
                ) : (
                  editing.brand_collections?.map(bc => (
                    <div key={bc.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-2.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <Tag className="size-4 shrink-0 text-brand" />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-card-foreground">
                            <span className="font-bold">{bc.brands?.brand}</span> — {bc.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground">Código: {bc.brand_code || "N/A"}</p>
                        </div>
                      </div>
                        <div className="flex items-center gap-1">
                          <GhostButton
                            className="px-2 py-1 text-xs"
                            onClick={() => openBrandEdit(bc)}
                          >
                            <Pencil className="size-3" />
                          </GhostButton>
                          <GhostButton
                            className="border-rose/30 px-2 py-1 text-xs text-rose"
                            onClick={() => void removeBrandCollection(bc.id)}
                          >
                            <Trash2 className="size-3" />
                          </GhostButton>
                        </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <Field label="Descrição" className="sm:col-span-2 mt-2">
            <TextArea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Resumo que o cliente verá no portal"
            />
          </Field>

        </div>
        <div className="mt-4 flex justify-between gap-2 border-t border-border pt-4">
          <GhostButton onClick={() => setOpen(false)}>Fechar</GhostButton>
          <PrimaryButton disabled={busy} onClick={() => void save()}>
            {busy ? "Salvando..." : "Salvar Coleção Geral"}
          </PrimaryButton>
        </div>
      </Modal>

      <Modal
        open={Boolean(editingBrand)}
        onClose={() => setEditingBrand(null)}
        title={editingBrand ? `Coleção Específica: ${editingBrand.brands?.brand}` : "Editar Coleção"}
        subtitle="Informações exclusivas desta marca"
        wide
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome da coleção na marca *">
            <TextInput
              value={brandForm.name}
              onChange={(e) => setBrandForm({ ...brandForm, name: e.target.value })}
              placeholder="VERÃO 2027 - Alphabeto"
            />
          </Field>
          <Field label="Código / Referência">
            <TextInput
              value={brandForm.brand_code}
              onChange={(e) => setBrandForm({ ...brandForm, brand_code: e.target.value })}
              placeholder="XYZ123"
            />
          </Field>
          <Field label="Início de vendas específico">
            <TextInput
              type="date"
              value={brandForm.start_date}
              onChange={(e) => setBrandForm({ ...brandForm, start_date: e.target.value })}
            />
          </Field>
          <Field label="Fim de vendas específico">
            <TextInput
              type="date"
              value={brandForm.end_date}
              onChange={(e) => setBrandForm({ ...brandForm, end_date: e.target.value })}
            />
          </Field>
          <Field label="Status">
            <SelectInput
              value={brandForm.status}
              onChange={(e) => setBrandForm({ ...brandForm, status: e.target.value })}
            >
              {COLLECTION_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Permitir download">
            <SelectInput
              value={brandForm.allow_download ? "sim" : "nao"}
              onChange={(e) => setBrandForm({ ...brandForm, allow_download: e.target.value === "sim" })}
            >
              <option value="sim">Sim, o cliente pode baixar o PDF</option>
              <option value="nao">Não, apenas leitura no leitor online</option>
            </SelectInput>
          </Field>
          <Field label="Link de Fotos">
            <TextInput
              value={brandForm.photos_link}
              onChange={(e) => setBrandForm({ ...brandForm, photos_link: e.target.value })}
              placeholder="https://drive.google.com/..."
            />
          </Field>
          <Field label="Descrição" className="sm:col-span-2 mt-2">
            <TextArea
              value={brandForm.description}
              onChange={(e) => setBrandForm({ ...brandForm, description: e.target.value })}
              placeholder="Apresentação que o cliente verá no portal"
            />
          </Field>

          <div className="rounded-xl border border-border bg-ink-2/40 p-3 sm:col-span-2 mt-4">
            <p className="text-sm font-semibold text-card-foreground">Catálogos em PDF</p>
            <p className="mb-4 text-xs text-muted-foreground">
              Envie um ou mais PDFs de catálogos para o cliente folhear no portal. (Máx. 400 MB)
            </p>

            <div className="space-y-3">
              {editingBrandDocs.length > 0 && (
                <ul className="mb-4 space-y-2">
                  {editingBrandDocs.map((doc) => (
                    <li
                      key={doc.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <FileText className="size-4 text-brand shrink-0" />
                        <span className="truncate text-card-foreground font-medium" title={doc.file_name}>
                          {doc.file_name}
                        </span>
                        {doc.size_bytes ? (
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            ({(doc.size_bytes / 1024 / 1024).toFixed(1)} MB)
                          </span>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <GhostButton onClick={() => void openDoc(doc.file_path)} className="px-2 py-1 text-xs">
                          Visualizar
                        </GhostButton>
                        <GhostButton
                          onClick={() => void deleteDoc(doc.id, doc.file_path)}
                          className="px-2 py-1 text-xs text-rose border-rose/20"
                        >
                          Excluir
                        </GhostButton>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <input
                type="file"
                multiple
                accept="application/pdf"
                className="hidden"
                ref={catalogRef}
                onChange={(e) => {
                  if (e.target.files) setCatalogFiles(Array.from(e.target.files));
                }}
              />
              <div className="flex items-center gap-3">
                <PrimaryButton type="button" onClick={() => catalogRef.current?.click()}>
                  Selecionar PDFs
                </PrimaryButton>
                {catalogFiles.length > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {catalogFiles.length} arquivo(s) selecionado(s) para envio
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-between gap-2 border-t border-border pt-4">
          <GhostButton onClick={() => { setEditingBrand(null); setCatalogFiles([]); }}>Cancelar</GhostButton>
          <PrimaryButton disabled={busy} onClick={() => void saveBrandSpecific()}>
            {busy ? "Salvando..." : "Salvar Coleção da Marca"}
          </PrimaryButton>
        </div>
      </Modal>
    </AppShell>
  );
}

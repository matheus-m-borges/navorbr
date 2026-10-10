import { createFileRoute } from "@tanstack/react-router";
import { GlassCard, Button, Input, Label } from "@/components/navor-rephub/ui";
import { Plus, Pencil, Trash2, Sparkles, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listCapabilities, upsertCapability, deleteCapability } from "@/api/admin-actions";

export const Route = createFileRoute("/_authenticated/(saas)/admin/capabilities")({
  component: AdminCapabilitiesPage,
});

function AdminCapabilitiesPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCap, setEditingCap] = useState<any | null>(null);
  const [formData, setFormData] = useState({ productId: "", key: "", name: "", description: "" });

  const { data: caps, isLoading } = useQuery({
    queryKey: ["admin_capabilities"],
    queryFn: () => listCapabilities({}),
  });

  const upsertMut = useMutation({
    mutationFn: (d: any) => upsertCapability(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin_capabilities"] }); toast.success("Capability salva"); setIsModalOpen(false); resetForm(); },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar capability"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteCapability({ id }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin_capabilities"] }); toast.success("Capability removida"); },
    onError: (e: any) => toast.error(e?.message || "Erro ao remover capability"),
  });

  function resetForm() {
    setFormData({ productId: "", key: "", name: "", description: "" });
    setEditingCap(null);
  }

  function openEdit(cap: any) {
    setEditingCap(cap);
    setFormData({
      productId: cap.product_id, key: cap.key, name: cap.name,
      description: cap.description || "",
    });
    setIsModalOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    upsertMut.mutate(editingCap ? { id: editingCap.id, ...formData } : formData);
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-amber-400" /> Capabilities
          </h1>
          <p className="text-zinc-400 mt-1">Gerencie capabilities canônicas por produto</p>
        </div>
        <Button onClick={() => { resetForm(); setIsModalOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Nova Capability
        </Button>
      </div>

      {isLoading ? (
        <div className="text-zinc-400 py-12 text-center">Carregando...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(caps as any[])?.map((cap: any) => (
            <GlassCard key={cap.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-white">{cap.name}</h3>
                  <span className="text-xs text-zinc-400 font-mono">{cap.key}</span>
                  <div className="text-xs text-zinc-500 mt-1">Produto: {cap.products?.name || cap.product_id}</div>
                </div>
                {cap.is_active ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-zinc-500" />
                )}
              </div>
              {cap.description && <p className="text-sm text-zinc-300">{cap.description}</p>}
              <div className="flex gap-2 pt-2 border-t border-white/5">
                <Button variant="outline" size="sm" onClick={() => openEdit(cap)}>
                  <Pencil className="w-3 h-3 mr-1" /> Editar
                </Button>
                <Button variant="outline" size="sm" className="text-red-400 hover:text-red-300" onClick={() => { if (confirm("Remover esta capability?")) deleteMut.mutate(cap.id); }}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </GlassCard>
          ))}
          {(!caps || (caps as any[]).length === 0) && (
            <div className="col-span-full text-center py-12 text-zinc-500">Nenhuma capability cadastrada</div>
          )}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <GlassCard className="w-full max-w-lg p-6 space-y-4">
            <h2 className="text-xl font-bold text-white">{editingCap ? "Editar Capability" : "Nova Capability"}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <Label>Product ID</Label>
                <Input value={formData.productId} onChange={(e) => setFormData({ ...formData, productId: e.target.value })} required disabled={!!editingCap} placeholder="UUID do produto" />
              </div>
              <div>
                <Label>Chave (key)</Label>
                <Input value={formData.key} onChange={(e) => setFormData({ ...formData, key: e.target.value })} required disabled={!!editingCap} placeholder="ex: crm.clients.view" />
              </div>
              <div>
                <Label>Nome</Label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required placeholder="Visualizar Clientes" />
              </div>
              <div>
                <Label>Descrição</Label>
                <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Descrição opcional" />
              </div>
              <div className="flex gap-3 pt-4">
                <Button type="submit" disabled={upsertMut.isPending}>
                  {upsertMut.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                  {editingCap ? "Salvar" : "Criar"}
                </Button>
                <Button type="button" variant="outline" onClick={() => { setIsModalOpen(false); resetForm(); }}>Cancelar</Button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}
    </div>
  );
}

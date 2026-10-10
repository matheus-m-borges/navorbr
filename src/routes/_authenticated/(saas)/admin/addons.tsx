import { createFileRoute } from "@tanstack/react-router";
import { GlassCard, Button, Input, Label } from "@/components/navor-rephub/ui";
import { Plus, Pencil, Trash2, Package, CheckCircle2, XCircle, DollarSign, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listAddons, createAddon, updateAddon, deleteAddon } from "@/api/admin-actions";

export const Route = createFileRoute("/_authenticated/(saas)/admin/addons")({
  component: AdminAddonsPage,
});

function AdminAddonsPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAddon, setEditingAddon] = useState<any | null>(null);
  const [formData, setFormData] = useState({ key: "", name: "", description: "", amount: 0, billingCycle: "monthly", productId: "" });

  const { data: addons, isLoading } = useQuery({
    queryKey: ["admin_addons"],
    queryFn: () => listAddons(),
  });

  const createMut = useMutation({
    mutationFn: (d: any) => createAddon(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin_addons"] }); toast.success("Addon criado"); setIsModalOpen(false); resetForm(); },
    onError: (e: any) => toast.error(e?.message || "Erro ao criar addon"),
  });

  const updateMut = useMutation({
    mutationFn: (d: any) => updateAddon(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin_addons"] }); toast.success("Addon atualizado"); setIsModalOpen(false); resetForm(); },
    onError: (e: any) => toast.error(e?.message || "Erro ao atualizar addon"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteAddon({ id }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin_addons"] }); toast.success("Addon removido"); },
    onError: (e: any) => toast.error(e?.message || "Erro ao remover addon"),
  });

  function resetForm() {
    setFormData({ key: "", name: "", description: "", amount: 0, billingCycle: "monthly", productId: "" });
    setEditingAddon(null);
  }

  function openEdit(addon: any) {
    setEditingAddon(addon);
    setFormData({
      key: addon.key, name: addon.name, description: addon.description || "",
      amount: addon.amount, billingCycle: addon.billing_cycle, productId: addon.product_id,
    });
    setIsModalOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingAddon) {
      updateMut.mutate({ id: editingAddon.id, ...formData });
    } else {
      createMut.mutate(formData);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Package className="w-6 h-6 text-emerald-400" /> Adicionais (Add-ons)
          </h1>
          <p className="text-zinc-400 mt-1">Gerencie add-ons comerciais por produto</p>
        </div>
        <Button onClick={() => { resetForm(); setIsModalOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Novo Add-on
        </Button>
      </div>

      {isLoading ? (
        <div className="text-zinc-400 py-12 text-center">Carregando...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(addons as any[])?.map((addon: any) => (
            <GlassCard key={addon.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-white">{addon.name}</h3>
                  <span className="text-xs text-zinc-400 font-mono">{addon.key}</span>
                </div>
                {addon.is_active ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-zinc-500" />
                )}
              </div>
              {addon.description && <p className="text-sm text-zinc-300">{addon.description}</p>}
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span className="text-white font-medium">R$ {Number(addon.amount).toFixed(2)}</span>
                <span className="text-zinc-500">/ {addon.billing_cycle}</span>
              </div>
              <div className="text-xs text-zinc-500">Produto: {addon.products?.name || addon.product_id}</div>
              <div className="flex gap-2 pt-2 border-t border-white/5">
                <Button variant="outline" size="sm" onClick={() => openEdit(addon)}>
                  <Pencil className="w-3 h-3 mr-1" /> Editar
                </Button>
                <Button variant="outline" size="sm" onClick={() => updateAddon({ id: addon.id, isActive: !addon.is_active }).then(() => queryClient.invalidateQueries({ queryKey: ["admin_addons"] }))}>
                  {addon.is_active ? "Desativar" : "Ativar"}
                </Button>
                <Button variant="outline" size="sm" className="text-red-400 hover:text-red-300" onClick={() => { if (confirm("Remover este addon?")) deleteMut.mutate(addon.id); }}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </GlassCard>
          ))}
          {(!addons || (addons as any[]).length === 0) && (
            <div className="col-span-full text-center py-12 text-zinc-500">Nenhum addon cadastrado</div>
          )}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <GlassCard className="w-full max-w-lg p-6 space-y-4">
            <h2 className="text-xl font-bold text-white">{editingAddon ? "Editar Add-on" : "Novo Add-on"}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <Label>Chave (key)</Label>
                <Input value={formData.key} onChange={(e) => setFormData({ ...formData, key: e.target.value })} required disabled={!!editingAddon} placeholder="ex: whatsapp_extra" />
              </div>
              <div>
                <Label>Nome</Label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required placeholder="WhatsApp Extra" />
              </div>
              <div>
                <Label>Descrição</Label>
                <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Descrição opcional" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Valor (R$)</Label>
                  <Input type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })} required />
                </div>
                <div>
                  <Label>Ciclo</Label>
                  <select className="w-full h-10 rounded-md border border-white/10 bg-white/5 px-3 text-white" value={formData.billingCycle} onChange={(e) => setFormData({ ...formData, billingCycle: e.target.value })}>
                    <option value="monthly">Mensal</option>
                    <option value="yearly">Anual</option>
                    <option value="one_time">Única vez</option>
                  </select>
                </div>
              </div>
              {!editingAddon && (
                <div>
                  <Label>Product ID</Label>
                  <Input value={formData.productId} onChange={(e) => setFormData({ ...formData, productId: e.target.value })} required placeholder="UUID do produto" />
                </div>
              )}
              <div className="flex gap-3 pt-4">
                <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
                  {(createMut.isPending || updateMut.isPending) ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                  {editingAddon ? "Salvar" : "Criar"}
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

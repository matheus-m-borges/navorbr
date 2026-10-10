import { createFileRoute } from "@tanstack/react-router";
import { GlassCard, Button, Input, Label } from "@/components/navor-rephub/ui";
import { Plus, Pencil, Trash2, LayoutGrid, RefreshCw, CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listBlocks, upsertBlock, deleteBlock } from "@/api/admin-actions";

export const Route = createFileRoute("/_authenticated/(saas)/admin/blocos")({
  component: AdminBlocosPage,
});

function AdminBlocosPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<any | null>(null);
  const [formData, setFormData] = useState({ moduleId: "", key: "", name: "", description: "", displayOrder: 0 });

  const { data: blocks, isLoading } = useQuery({
    queryKey: ["admin_blocks"],
    queryFn: () => listBlocks({}),
  });

  const upsertMut = useMutation({
    mutationFn: (d: any) => upsertBlock(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin_blocks"] }); toast.success("Bloco salvo"); setIsModalOpen(false); resetForm(); },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar bloco"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteBlock({ id }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin_blocks"] }); toast.success("Bloco removido"); },
    onError: (e: any) => toast.error(e?.message || "Erro ao remover bloco"),
  });

  function resetForm() {
    setFormData({ moduleId: "", key: "", name: "", description: "", displayOrder: 0 });
    setEditingBlock(null);
  }

  function openEdit(block: any) {
    setEditingBlock(block);
    setFormData({
      moduleId: block.module_id, key: block.key, name: block.name,
      description: block.description || "", displayOrder: block.display_order || 0,
    });
    setIsModalOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    upsertMut.mutate(editingBlock ? { id: editingBlock.id, ...formData } : formData);
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <LayoutGrid className="w-6 h-6 text-blue-400" /> Blocos Funcionais
          </h1>
          <p className="text-zinc-400 mt-1">Gerencie blocos por módulo e vincule capabilities</p>
        </div>
        <Button onClick={() => { resetForm(); setIsModalOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Novo Bloco
        </Button>
      </div>

      {isLoading ? (
        <div className="text-zinc-400 py-12 text-center">Carregando...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(blocks as any[])?.map((block: any) => (
            <GlassCard key={block.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-white">{block.name}</h3>
                  <span className="text-xs text-zinc-400 font-mono">{block.key}</span>
                  <div className="text-xs text-zinc-500 mt-1">Módulo: {block.system_modules?.name || block.module_id}</div>
                </div>
                {block.is_active ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-zinc-500" />
                )}
              </div>
              {block.description && <p className="text-sm text-zinc-300">{block.description}</p>}
              <div className="text-xs text-zinc-500">Ordem: {block.display_order}</div>
              <div className="flex gap-2 pt-2 border-t border-white/5">
                <Button variant="outline" size="sm" onClick={() => openEdit(block)}>
                  <Pencil className="w-3 h-3 mr-1" /> Editar
                </Button>
                <Button variant="outline" size="sm" className="text-red-400 hover:text-red-300" onClick={() => { if (confirm("Remover este bloco?")) deleteMut.mutate(block.id); }}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </GlassCard>
          ))}
          {(!blocks || (blocks as any[]).length === 0) && (
            <div className="col-span-full text-center py-12 text-zinc-500">Nenhum bloco cadastrado</div>
          )}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <GlassCard className="w-full max-w-lg p-6 space-y-4">
            <h2 className="text-xl font-bold text-white">{editingBlock ? "Editar Bloco" : "Novo Bloco"}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <Label>Module ID</Label>
                <Input value={formData.moduleId} onChange={(e) => setFormData({ ...formData, moduleId: e.target.value })} required disabled={!!editingBlock} placeholder="UUID do módulo" />
              </div>
              <div>
                <Label>Chave (key)</Label>
                <Input value={formData.key} onChange={(e) => setFormData({ ...formData, key: e.target.value })} required disabled={!!editingBlock} placeholder="ex: pet_cadastro_basico" />
              </div>
              <div>
                <Label>Nome</Label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required placeholder="Cadastro Básico" />
              </div>
              <div>
                <Label>Descrição</Label>
                <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Descrição opcional" />
              </div>
              <div>
                <Label>Ordem de Exibição</Label>
                <Input type="number" value={formData.displayOrder} onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="flex gap-3 pt-4">
                <Button type="submit" disabled={upsertMut.isPending}>
                  {upsertMut.isPending ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                  {editingBlock ? "Salvar" : "Criar"}
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

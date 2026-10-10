// Exclusão padronizada de cadastros: confirmação, mensagem amigável e
// atualização das listas afetadas. A permissão é validada no banco (RLS),
// aqui apenas traduzimos os erros mais comuns.
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { crmDb } from "@/hooks/useCrm";

function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("violates foreign key") || m.includes("still referenced"))
    return "Não é possível excluir: existem registros vinculados (pedidos, notas ou histórico).";
  if (m.includes("row-level security") || m.includes("permission denied"))
    return "Somente administradores podem excluir cadastros.";
  return message;
}

export interface RemoveOptions {
  table: string;
  id: string;
  label: string;
  keys?: string[];
  extra?: () => Promise<void>;
}

/** Retorna uma função de exclusão com confirmação para usar nas telas. */
export function useRemoveRecord() {
  const qc = useQueryClient();

  return async function remove(opts: RemoveOptions): Promise<boolean> {
    const ok = window.confirm(`Excluir ${opts.label}? Esta ação não pode ser desfeita.`);
    if (!ok) return false;
    if (opts.extra) await opts.extra();
    const { error } = await crmDb.from(opts.table).delete().eq("id", opts.id);
    if (error) {
      toast.error(friendly(error.message));
      return false;
    }
    for (const key of opts.keys ?? []) void qc.invalidateQueries({ queryKey: [key] });
    toast.success("Cadastro excluído.");
    return true;
  };
}

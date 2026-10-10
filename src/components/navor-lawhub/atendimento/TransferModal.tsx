import { useState } from "react";
import { ArrowRightLeft, X, Building, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LawConversation, LawDepartment } from "@/lib/lawhub/atendimento-types";

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: LawConversation | null;
  departments: LawDepartment[];
  onConfirmTransfer: (targetDeptId: string, reason: string, note: string) => void;
}

export function TransferModal({
  isOpen,
  onClose,
  conversation,
  departments,
  onConfirmTransfer,
}: TransferModalProps) {
  const [targetDeptId, setTargetDeptId] = useState<string>(() => {
    return departments.find((d) => d.id !== conversation?.department_id)?.id || departments[0]?.id || "";
  });
  const [reason, setReason] = useState<string>("Redirecionamento para equipe especializada");
  const [note, setNote] = useState<string>("");

  const availableDepts = departments.filter((d) => d.id !== conversation?.department_id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDeptId) return;
    onConfirmTransfer(targetDeptId, reason, note);
    onClose();
  };

  if (!isOpen || !conversation) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-card border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border/60 flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-foreground">Transferir Atendimento</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded-md">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div>
            <span className="text-muted-foreground block mb-1">Cliente:</span>
            <p className="font-bold text-foreground text-sm">{conversation.contact_name}</p>
            <p className="text-[11px] text-muted-foreground">{conversation.contact_phone}</p>
          </div>

          <div>
            <label className="font-semibold text-foreground block mb-1.5">
              Setor de Destino *
            </label>
            <select
              value={targetDeptId}
              onChange={(e) => setTargetDeptId(e.target.value)}
              className="w-full text-xs py-2 px-3 rounded-lg bg-background border border-border text-foreground focus:ring-1 focus:ring-primary cursor-pointer font-medium"
              required
            >
              {availableDepts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="font-semibold text-foreground block mb-1.5">
              Motivo da Transferência *
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full text-xs py-2 px-3 rounded-lg bg-background border border-border text-foreground focus:ring-1 focus:ring-primary cursor-pointer"
            >
              <option value="Redirecionamento para equipe especializada">Redirecionamento para equipe especializada</option>
              <option value="Demanda Trabalhista identificada">Demanda Trabalhista identificada</option>
              <option value="Demanda Cível ou Contratos">Demanda Cível ou Contratos</option>
              <option value="Solicitação de Segunda Via / Financeiro">Solicitação de Segunda Via / Financeiro</option>
              <option value="Dúvida processual complexa">Dúvida processual complexa</option>
              <option value="Outro motivo">Outro motivo</option>
            </select>
          </div>

          <div>
            <label className="font-semibold text-foreground block mb-1.5">
              Observação Interna Confidencial (Opcional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex: O cliente já enviou a CTPS por foto; cálculo rescisório pendente de análise."
              rows={3}
              className="w-full text-xs p-2.5 rounded-lg bg-background border border-border text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary resize-none leading-relaxed"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-border/60">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
              Confirmar Transferência
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

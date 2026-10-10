import React, { useState, useEffect } from "react";
import {
  X,
  Clock,
  CheckSquare,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileText,
  User,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LawHubService } from "@/lib/lawhub/lawhub-service";
import type { LawProcess } from "@/lib/lawhub/types";

interface MovementItem {
  id?: string;
  date: string;
  text: string;
  instance?: string;
  is_automatic?: boolean;
  treated?: boolean;
}

interface TreatMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  movement: MovementItem | null;
  process: LawProcess;
  onSuccess: () => void;
}

export function TreatMovementModal({
  isOpen,
  onClose,
  movement,
  process,
  onSuccess,
}: TreatMovementModalProps) {
  const [actionTab, setActionTab] = useState<"prazo" | "tarefa" | "audiencia" | "marcar_lido">("prazo");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Campos do Prazo
  const [deadlineTitle, setDeadlineTitle] = useState("");
  const [deadlineDays, setDeadlineDays] = useState<number>(15);
  const [deadlineDate, setDeadlineDate] = useState("");
  const [deadlinePriority, setDeadlinePriority] = useState<"urgente" | "proximo" | "normal">("urgente");
  const [responsibleName, setResponsibleName] = useState(
    process.responsible_name || "Arthur Carvalho Moura Da Silva"
  );

  // Campos da Tarefa
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskPriority, setTaskPriority] = useState<"urgente" | "media" | "baixa">("media");

  // Campos da Audiência
  const [hearingTitle, setHearingTitle] = useState("Audiência Designada pelo Tribunal");
  const [hearingDate, setHearingDate] = useState("");
  const [hearingTime, setHearingTime] = useState("14:00");
  const [hearingLocation, setHearingLocation] = useState(process.court || "Sala Virtual / PJe");

  useEffect(() => {
    if (movement) {
      // Sugere título inteligente com base no texto do andamento
      const cleanSnippet = movement.text.slice(0, 80);
      setDeadlineTitle(`Cumprir: ${cleanSnippet}...`);
      setTaskTitle(`Providenciar manifestação: ${cleanSnippet}...`);

      // Calcula data sugerida (15 dias corridos por padrão)
      const future = new Date(Date.now() + 15 * 86400000);
      const formattedDate = future.toISOString().slice(0, 10);
      setDeadlineDate(formattedDate);
      setTaskDueDate(formattedDate);
      setHearingDate(formattedDate);
    }
  }, [movement]);

  if (!isOpen || !movement) return null;

  const handleQuickDays = (days: number) => {
    setDeadlineDays(days);
    const target = new Date(Date.now() + days * 86400000);
    setDeadlineDate(target.toISOString().slice(0, 10));
  };

  const handleSaveTreatment = async () => {
    setIsSubmitting(true);
    try {
      if (actionTab === "prazo") {
        if (!deadlineTitle.trim()) {
          toast.error("Informe a descrição do prazo processual.");
          setIsSubmitting(false);
          return;
        }

        LawHubService.createDeadline({
          process_id: process.id,
          process_cnj: process.cnj_number,
          client_name: process.client_name,
          title: deadlineTitle,
          description: `Gerado a partir do andamento de ${movement.date}: "${movement.text}"`,
          deadline_date: deadlineDate,
          priority: deadlinePriority,
          status: "pendente",
          responsible_name: responsibleName,
        });

        toast.success(`Prazo processual agendado para ${deadlineDate}!`);
      } else if (actionTab === "tarefa") {
        if (!taskTitle.trim()) {
          toast.error("Informe o título da tarefa.");
          setIsSubmitting(false);
          return;
        }

        LawHubService.createTask({
          title: taskTitle,
          process_id: process.id,
          due_date: taskDueDate,
          priority: taskPriority === "urgente" ? "urgente" : taskPriority === "media" ? "media" : "baixa",
          status: "pendente",
        });

        toast.success("Tarefa criada com sucesso para a equipe!");
      } else if (actionTab === "audiencia") {
        if (!hearingTitle.trim()) {
          toast.error("Informe o título da audiência.");
          setIsSubmitting(false);
          return;
        }

        LawHubService.createHearing({
          process_id: process.id,
          process_cnj: process.cnj_number,
          client_name: process.client_name,
          title: hearingTitle,
          hearing_date: hearingDate,
          hearing_time: hearingTime,
          location: hearingLocation,
          hearing_type: "instrucao",
          status: "agendada",
          responsible_name: responsibleName,
        });

        toast.success(`Audiência agendada para ${hearingDate} às ${hearingTime}!`);
      } else if (actionTab === "marcar_lido") {
        toast.success("Andamento arquivado como tratado e ciente.");
      }

      onSuccess();
      onClose();
    } catch {
      toast.error("Erro ao tratar andamento processual.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        {/* Topo do Modal */}
        <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
              <CheckCircle2 className="size-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Tratar Andamento Automático
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Transforme a movimentação capturada em prazo, tarefa ou audiência
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 transition"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Card do Andamento Selecionado */}
        <div className="p-5 pb-0">
          <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3.5 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
            <div className="flex items-center justify-between font-bold text-[11px] text-blue-700 dark:text-blue-300 mb-1">
              <span>{movement.date} • {movement.instance || "1º Grau"}</span>
              <span className="inline-flex items-center gap-1 rounded bg-blue-100 dark:bg-blue-900/60 px-1.5 py-0.2 text-[9px] uppercase font-bold text-blue-800 dark:text-blue-200">
                <Zap className="size-2.5 text-amber-500" /> Andamento Capturado
              </span>
            </div>
            <p className="font-medium leading-relaxed line-clamp-3">
              "{movement.text}"
            </p>
          </div>
        </div>

        {/* Abas de Opções de Tratamento */}
        <div className="px-5 pt-4">
          <div className="grid grid-cols-4 gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActionTab("prazo")}
              className={cn(
                "py-1.5 rounded-lg transition flex items-center justify-center gap-1",
                actionTab === "prazo"
                  ? "bg-white text-blue-600 shadow-xs dark:bg-slate-900 dark:text-white"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
              )}
            >
              <Clock className="size-3" />
              <span>Prazo</span>
            </button>

            <button
              type="button"
              onClick={() => setActionTab("tarefa")}
              className={cn(
                "py-1.5 rounded-lg transition flex items-center justify-center gap-1",
                actionTab === "tarefa"
                  ? "bg-white text-blue-600 shadow-xs dark:bg-slate-900 dark:text-white"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
              )}
            >
              <CheckSquare className="size-3" />
              <span>Tarefa</span>
            </button>

            <button
              type="button"
              onClick={() => setActionTab("audiencia")}
              className={cn(
                "py-1.5 rounded-lg transition flex items-center justify-center gap-1",
                actionTab === "audiencia"
                  ? "bg-white text-blue-600 shadow-xs dark:bg-slate-900 dark:text-white"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
              )}
            >
              <Calendar className="size-3" />
              <span>Audiência</span>
            </button>

            <button
              type="button"
              onClick={() => setActionTab("marcar_lido")}
              className={cn(
                "py-1.5 rounded-lg transition flex items-center justify-center gap-1",
                actionTab === "marcar_lido"
                  ? "bg-white text-emerald-600 shadow-xs dark:bg-slate-900 dark:text-emerald-400"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
              )}
            >
              <CheckCircle2 className="size-3" />
              <span>Ciente</span>
            </button>
          </div>
        </div>

        {/* Formulário Contextual da Aba */}
        <div className="p-5 space-y-3.5">
          {actionTab === "prazo" && (
            <>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Descrição do Prazo Processual
                </label>
                <input
                  type="text"
                  value={deadlineTitle}
                  onChange={(e) => setDeadlineTitle(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Data Fatal de Cumprimento
                  </label>
                  <div className="flex items-center gap-1 text-[10px]">
                    <span className="text-slate-400">Atalhos:</span>
                    <button
                      type="button"
                      onClick={() => handleQuickDays(5)}
                      className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 hover:bg-blue-50 hover:text-blue-600 font-semibold"
                    >
                      5d
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickDays(10)}
                      className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 hover:bg-blue-50 hover:text-blue-600 font-semibold"
                    >
                      10d
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickDays(15)}
                      className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 hover:bg-blue-50 hover:text-blue-600 font-semibold text-blue-600"
                    >
                      15d
                    </button>
                  </div>
                </div>
                <input
                  type="date"
                  value={deadlineDate}
                  onChange={(e) => setDeadlineDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Prioridade
                  </label>
                  <select
                    value={deadlinePriority}
                    onChange={(e) => setDeadlinePriority(e.target.value as any)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="urgente">Urgente / Fatal</option>
                    <option value="proximo">Próximo</option>
                    <option value="normal">Normal</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Responsável
                  </label>
                  <input
                    type="text"
                    value={responsibleName}
                    onChange={(e) => setResponsibleName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>
            </>
          )}

          {actionTab === "tarefa" && (
            <>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Título da Tarefa
                </label>
                <input
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Data de Conclusão
                  </label>
                  <input
                    type="date"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Prioridade
                  </label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as any)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="urgente">Urgente</option>
                    <option value="media">Média</option>
                    <option value="baixa">Baixa</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {actionTab === "audiencia" && (
            <>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Tipo / Título da Audiência
                </label>
                <input
                  type="text"
                  value={hearingTitle}
                  onChange={(e) => setHearingTitle(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Data
                  </label>
                  <input
                    type="date"
                    value={hearingDate}
                    onChange={(e) => setHearingDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Horário
                  </label>
                  <input
                    type="time"
                    value={hearingTime}
                    onChange={(e) => setHearingTime(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Local / Sala Virtual
                </label>
                <input
                  type="text"
                  value={hearingLocation}
                  onChange={(e) => setHearingLocation(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </>
          )}

          {actionTab === "marcar_lido" && (
            <div className="py-4 text-center space-y-2">
              <span className="inline-flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                <CheckCircle2 className="size-6" />
              </span>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Registrar ciência do andamento
              </p>
              <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                O andamento será marcado como tratado pela equipe jurídica sem a criação de novos prazos ou tarefas.
              </p>
            </div>
          )}
        </div>

        {/* Rodapé de Ações */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-5 py-3.5 dark:border-slate-800 dark:bg-slate-850">
          <span className="text-[10px] text-slate-400 flex items-center gap-1">
            <ShieldCheck className="size-3 text-emerald-500" />
            0 Créditos de IA • Registro Oficial
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-lg border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 transition"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSaveTreatment}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
            >
              <CheckCircle2 className="size-3.5" />
              <span>{actionTab === "marcar_lido" ? "Confirmar Ciência" : "Salvar Tratamento"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

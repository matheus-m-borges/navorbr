// @ts-nocheck — tipos legados do LawHub em migração
import { useEffect, useState } from "react";
import {
  X,
  MessageSquare,
  User,
  Phone,
  Mail,
  Calendar,
  Briefcase,
  Star,
  CheckCircle2,
  Trash2,
  Paperclip,
  CheckSquare,
  Plus,
  ArrowRight,
  ExternalLink,
  Lock,
  Unlock,
  AlertCircle,
  FileText,
  Clock,
  Send,
  Download,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  LawHubAttendanceService,
  type LawAttendance,
  type AttendanceTimelineEntry,
  type AttendanceDocument,
  type AttendanceTask,
} from "@/lib/lawhub/attendance-service";
import { LawHubService } from "@/lib/lawhub/lawhub-service";

interface AttendanceDetailDrawerProps {
  attendanceId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
  onOpenConvertModal?: (attendance: LawAttendance) => void;
}

export function AttendanceDetailDrawer({
  attendanceId,
  isOpen,
  onClose,
  onUpdate,
  onOpenConvertModal,
}: AttendanceDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<"timeline" | "processo" | "tarefas" | "documentos">("timeline");
  const [newEntryText, setNewEntryText] = useState("");
  const [onlyImportant, setOnlyImportant] = useState(false);

  // Estados de Tarefas
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskResponsible, setNewTaskResponsible] = useState("Dr. Matheus Borges");

  // Estados de Documentos
  const [newDocName, setNewDocName] = useState("");

  // Estados de Encerramento
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
  const [existingProcesses, setExistingProcesses] = useState<Awaited<ReturnType<typeof LawHubService.getProcesses>>>([]);
  useEffect(() => {
    if (!attendanceId) return;
    LawHubService.getProcesses().then(setExistingProcesses).catch(() => {});
  }, [attendanceId]);
  const [closureReason, setClosureReason] = useState("");

  if (!isOpen || !attendanceId) return null;

  const attendance = LawHubAttendanceService.getById(attendanceId);
  if (!attendance) return null;


  // Handlers da Linha do Tempo
  const handleAddTimelineEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntryText.trim()) return;

    LawHubAttendanceService.addTimelineEntry(attendance.id, newEntryText);
    setNewEntryText("");
    toast.success("Registro inserido na linha do tempo!");
    onUpdate();
  };

  const handleToggleImportance = (entryId: string) => {
    const isImp = LawHubAttendanceService.toggleEntryImportance(attendance.id, entryId);
    toast.success(isImp ? "Marcado como importante ⭐" : "Desmarcado como importante");
    onUpdate();
  };

  const handleDeleteEntry = (entryId: string) => {
    if (confirm("Deseja realmente excluir este registro da linha do tempo?")) {
      LawHubAttendanceService.deleteTimelineEntry(attendance.id, entryId);
      toast.success("Registro excluído com sucesso.");
      onUpdate();
    }
  };

  // Handlers de Tarefas
  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    LawHubAttendanceService.addTask(attendance.id, {
      title: newTaskTitle,
      dueDate: newTaskDueDate || "Em 3 dias",
      responsible: newTaskResponsible,
    });

    setNewTaskTitle("");
    setNewTaskDueDate("");
    toast.success("Tarefa adicionada ao atendimento!");
    onUpdate();
  };

  const handleToggleTask = (taskId: string) => {
    LawHubAttendanceService.toggleTaskCompletion(attendance.id, taskId);
    onUpdate();
  };

  // Handlers de Documentos
  const handleAddDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocName.trim()) return;

    LawHubAttendanceService.addDocument(attendance.id, {
      name: newDocName.endsWith(".pdf") ? newDocName : `${newDocName}.pdf`,
      size: "650 KB",
    });

    setNewDocName("");
    toast.success("Documento anexado com sucesso!");
    onUpdate();
  };

  const handleDeleteDocument = (docId: string) => {
    if (confirm("Deseja remover este anexo do atendimento?")) {
      LawHubAttendanceService.deleteDocument(attendance.id, docId);
      toast.success("Documento removido.");
      onUpdate();
    }
  };

  // Handlers de Processo
  const handleLinkProcess = (procId: string) => {
    const proc = existingProcesses.find((p) => p.id === procId);
    if (!proc) return;

    LawHubAttendanceService.linkProcess(attendance.id, {
      id: proc.id,
      cnj: proc.cnj || "Processo sem CNJ",
      action: proc.action,
    });
    toast.success("Processo judicial vinculado com sucesso!");
    onUpdate();
  };

  const handleUnlinkProcess = () => {
    if (confirm("Deseja desvincular este processo do atendimento?")) {
      LawHubAttendanceService.unlinkProcess(attendance.id);
      toast.success("Vínculo removido.");
      onUpdate();
    }
  };

  // Handlers de Encerramento e Reabertura
  const handleCloseAttendance = () => {
    LawHubAttendanceService.closeAttendance(attendance.id, closureReason);
    setIsClosingModalOpen(false);
    setClosureReason("");
    toast.success("Atendimento encerrado com sucesso!");
    onUpdate();
  };

  const handleReopenAttendance = () => {
    LawHubAttendanceService.reopenAttendance(attendance.id);
    toast.success("Atendimento reaberto com sucesso!");
    onUpdate();
  };

  const handleDeleteAttendance = () => {
    if (confirm("ATENÇÃO: Deseja realmente excluir este atendimento? Todos os registros, tarefas e documentos associados serão removidos.")) {
      LawHubAttendanceService.deleteAttendance(attendance.id);
      toast.success("Atendimento excluído.");
      onClose();
      onUpdate();
    }
  };

  const displayedTimeline = onlyImportant
    ? attendance.timeline.filter((e) => e.isImportant)
    : attendance.timeline;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/50 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-3xl h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
        {/* Top Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/80 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="grid size-11 place-items-center rounded-xl bg-blue-600 text-white font-bold text-base shadow-xs shrink-0">
                {attendance.clientName
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")}
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    {attendance.clientName}
                  </h2>

                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase",
                      attendance.status === "aberto"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                        : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                    )}
                  >
                    {attendance.status === "aberto" ? "● Em Aberto" : "Encerrado"}
                  </span>

                  <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                    {attendance.channel}
                  </span>
                </div>

                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 font-medium">
                  {attendance.subject}
                </p>

                {/* Contatos Rápidos */}
                <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-500">
                  {attendance.clientPhone && (
                    <a
                      href={`https://wa.me/55${attendance.clientPhone.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-emerald-600 hover:underline"
                    >
                      <Phone className="size-3" />
                      <span>{attendance.clientPhone}</span>
                    </a>
                  )}

                  {attendance.clientEmail && (
                    <a
                      href={`mailto:${attendance.clientEmail}`}
                      className="inline-flex items-center gap-1 hover:underline text-slate-600 dark:text-slate-400"
                    >
                      <Mail className="size-3" />
                      <span>{attendance.clientEmail}</span>
                    </a>
                  )}

                  <span className="text-slate-400">· Resp: {attendance.responsibleName}</span>
                </div>
              </div>
            </div>

            {/* Ações do Header */}
            <div className="flex items-center gap-1 shrink-0">
              {attendance.status === "aberto" ? (
                <button
                  type="button"
                  onClick={() => setIsClosingModalOpen(true)}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition"
                  title="Encerrar este atendimento"
                >
                  <Lock className="size-3.5 text-slate-500" />
                  <span>Encerrar</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleReopenAttendance}
                  className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300 transition"
                  title="Reabrir este atendimento"
                >
                  <Unlock className="size-3.5 text-blue-600" />
                  <span>Reabrir</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleDeleteAttendance}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 transition"
                title="Excluir atendimento"
              >
                <Trash2 className="size-4" />
              </button>

              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="size-5" />
              </button>
            </div>
          </div>

          {/* Banner de Encerramento quando aplicável */}
          {attendance.status === "encerrado" && attendance.closedAt && (
            <div className="rounded-lg border border-slate-200 bg-slate-100/70 p-2.5 text-[11px] text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
              <span className="font-bold">Encerrado em {attendance.closedAt}:</span>{" "}
              {attendance.closureReason || "Concluído pelo advogado responsável."}
            </div>
          )}

          {/* Tags */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            {attendance.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Navegação por Abas */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 pt-2 text-xs font-semibold">
            <button
              onClick={() => setActiveTab("timeline")}
              className={cn(
                "border-b-2 px-3.5 py-2 transition flex items-center gap-1.5",
                activeTab === "timeline"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
              )}
            >
              <MessageSquare className="size-3.5" />
              <span>Linha do Tempo</span>
              <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                {attendance.timeline.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("processo")}
              className={cn(
                "border-b-2 px-3.5 py-2 transition flex items-center gap-1.5",
                activeTab === "processo"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
              )}
            >
              <Briefcase className="size-3.5" />
              <span>Processo Judicial</span>
              {attendance.linkedProcessCnj && (
                <span className="size-1.5 rounded-full bg-emerald-500" />
              )}
            </button>

            <button
              onClick={() => setActiveTab("tarefas")}
              className={cn(
                "border-b-2 px-3.5 py-2 transition flex items-center gap-1.5",
                activeTab === "tarefas"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
              )}
            >
              <CheckSquare className="size-3.5" />
              <span>Tarefas</span>
              <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                {attendance.tasks.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("documentos")}
              className={cn(
                "border-b-2 px-3.5 py-2 transition flex items-center gap-1.5",
                activeTab === "documentos"
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
              )}
            >
              <Paperclip className="size-3.5" />
              <span>Anexos</span>
              <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                {attendance.documents.length}
              </span>
            </button>
          </div>
        </div>

        {/* Conteúdo das Abas */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* 1. ABA LINHA DO TEMPO */}
          {activeTab === "timeline" && (
            <div className="space-y-4">
              {/* Novo Registro */}
              <form onSubmit={handleAddTimelineEntry} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-800/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <Plus className="size-3 text-blue-600" /> Inserir Novo Registro no Atendimento
                  </span>
                  <span className="text-[10px] text-slate-400">Ctrl+Enter para enviar</span>
                </div>

                <textarea
                  rows={2}
                  placeholder="Registre o teor de uma conversa, contato telefônico, resposta do cliente ou anotação processual..."
                  value={newEntryText}
                  onChange={(e) => setNewEntryText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      handleAddTimelineEntry(e);
                    }
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white leading-relaxed font-sans"
                />

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={!newEntryText.trim()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 disabled:opacity-40 transition"
                  >
                    <Send className="size-3" />
                    <span>Adicionar Registro</span>
                  </button>
                </div>
              </form>

              {/* Filtro de Importantes */}
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setOnlyImportant(!onlyImportant)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition",
                    onlyImportant
                      ? "border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  )}
                >
                  <Star className={cn("size-3.5", onlyImportant ? "fill-amber-400 text-amber-500" : "text-slate-400")} />
                  <span>Apenas importantes ⭐</span>
                </button>

                <span className="text-[11px] text-slate-400">
                  {displayedTimeline.length} registro(s) exibido(s)
                </span>
              </div>

              {/* Timeline List */}
              {displayedTimeline.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center dark:border-slate-800">
                  <p className="text-xs text-slate-500">
                    {onlyImportant
                      ? "Nenhum registro marcado como importante encontrado."
                      : "Nenhum registro inserido na linha do tempo ainda."}
                  </p>
                </div>
              ) : (
                <div className="space-y-3 relative before:absolute before:inset-0 before:left-3 before:w-0.5 before:bg-slate-100 dark:before:bg-slate-800">
                  {displayedTimeline.map((item) => (
                    <div
                      key={item.id}
                      className={cn(
                        "relative pl-8 rounded-xl border p-4 text-xs transition",
                        item.isImportant
                          ? "border-amber-300 bg-amber-50/20 dark:border-amber-800/60 dark:bg-amber-950/10"
                          : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-850"
                      )}
                    >
                      {/* Ponto indicador na linha vertical */}
                      <div
                        className={cn(
                          "absolute left-2 top-4 size-2.5 rounded-full border-2 border-white dark:border-slate-900",
                          item.isImportant ? "bg-amber-500 ring-2 ring-amber-200 dark:ring-amber-900" : "bg-blue-500"
                        )}
                      />

                      <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white">
                            {item.author}
                          </span>
                          {item.authorRole && (
                            <span className="text-[10px] text-slate-400">
                              ({item.authorRole})
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400">
                            {item.createdAt}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleToggleImportance(item.id)}
                            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            title={item.isImportant ? "Desmarcar importante" : "Marcar como importante ⭐"}
                          >
                            <Star
                              className={cn(
                                "size-3.5",
                                item.isImportant
                                  ? "fill-amber-400 text-amber-500"
                                  : "text-slate-300 hover:text-amber-500"
                              )}
                            />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteEntry(item.id)}
                            className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            title="Excluir este registro"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      </div>

                      <p className="whitespace-pre-wrap leading-relaxed text-slate-700 dark:text-slate-300 font-sans">
                        {item.text}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 2. ABA PROCESSO JUDICIAL */}
          {activeTab === "processo" && (
            <div className="space-y-4">
              {attendance.linkedProcessCnj ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-5 dark:border-emerald-900/50 dark:bg-emerald-950/20 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="grid size-9 place-items-center rounded-xl bg-emerald-600 text-white shadow-xs">
                        <CheckCircle2 className="size-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                          Atendimento Vinculado a Processo Judicial
                        </h4>
                        <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                          {attendance.linkedProcessCnj}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleUnlinkProcess}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    >
                      Desvincular
                    </button>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Ação: {attendance.linkedProcessAction || "Procedimento Comum Cível"}
                  </p>

                  <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-900/40">
                    <a
                      href={`/lawhub/processos/${attendance.linkedProcessId || "1"}`}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline dark:text-blue-400"
                    >
                      <span>Acessar os Autos do Processo</span>
                      <ArrowRight className="size-3.5" />
                    </a>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-850 space-y-3">
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <Briefcase className="size-4 text-blue-600" />
                      Vincular a Processo Existente
                    </h4>
                    <p className="text-xs text-slate-500">
                      Selecione um processo do escritório em andamento para associar o histórico deste atendimento:
                    </p>

                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {existingProcesses.map((proc) => (
                        <div
                          key={proc.id}
                          className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/60 hover:bg-blue-50/50 hover:border-blue-200 transition dark:border-slate-800 dark:bg-slate-800/40"
                        >
                          <div>
                            <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                              {proc.cnj || "Processo sem CNJ"}
                            </span>
                            <p className="text-[11px] text-slate-500">
                              {proc.client} • {proc.action}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleLinkProcess(proc.id)}
                            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition"
                          >
                            Vincular
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Converter em Processo Judicial */}
                  <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-900/40 dark:bg-blue-950/20 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                        Deseja ajuizar uma nova ação a partir desta consulta?
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Cria um novo processo judicial aproveitando os dados do cliente e os fatos relatados.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onOpenConvertModal && onOpenConvertModal(attendance)}
                      className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-xs transition shrink-0"
                    >
                      Converter em Novo Processo
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. ABA TAREFAS */}
          {activeTab === "tarefas" && (
            <div className="space-y-4">
              <form onSubmit={handleAddTask} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-800/40 space-y-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <CheckSquare className="size-3 text-blue-600" /> Adicionar Tarefa Vinculada ao Atendimento
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Ex: Obter extrato de FGTS do cliente..."
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    className="sm:col-span-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />

                  <input
                    type="text"
                    placeholder="Prazo: 28/09/2026"
                    value={newTaskDueDate}
                    onChange={(e) => setNewTaskDueDate(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={!newTaskTitle.trim()}
                    className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-40 transition"
                  >
                    Adicionar Tarefa
                  </button>
                </div>
              </form>

              <div className="space-y-2">
                {attendance.tasks.length === 0 ? (
                  <p className="text-center py-6 text-xs text-slate-500">
                    Nenhuma tarefa cadastrada para este atendimento.
                  </p>
                ) : (
                  attendance.tasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => handleToggleTask(task.id)}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-xl border text-xs cursor-pointer transition select-none",
                        task.completed
                          ? "border-emerald-200 bg-emerald-50/40 text-slate-400 line-through dark:border-emerald-900/40 dark:bg-emerald-950/20"
                          : "border-slate-200 bg-white hover:border-blue-300 dark:border-slate-800 dark:bg-slate-850"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={task.completed}
                          onChange={() => {}}
                          className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 pointer-events-none"
                        />
                        <span className={cn("font-medium", !task.completed && "text-slate-900 dark:text-white")}>
                          {task.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3" /> {task.dueDate}
                        </span>
                        <span>{task.responsible}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 4. ABA DOCUMENTOS */}
          {activeTab === "documentos" && (
            <div className="space-y-4">
              <form onSubmit={handleAddDocument} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-800/40 space-y-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                  <Paperclip className="size-3 text-blue-600" /> Anexar Documento do Cliente
                </span>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Nome do arquivo (ex: Procuracao_Assinada, Comprovante_Residencia)"
                    value={newDocName}
                    onChange={(e) => setNewDocName(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />

                  <button
                    type="submit"
                    disabled={!newDocName.trim()}
                    className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-40 transition shrink-0"
                  >
                    Anexar
                  </button>
                </div>
              </form>

              <div className="space-y-2">
                {attendance.documents.length === 0 ? (
                  <p className="text-center py-6 text-xs text-slate-500">
                    Nenhum documento anexado ao atendimento.
                  </p>
                ) : (
                  attendance.documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-850 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="grid size-8 place-items-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                          <FileText className="size-4" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">{doc.name}</p>
                          <p className="text-[10px] text-slate-400">{doc.size} • Anexado em {doc.uploadedAt}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toast.success(`Download de ${doc.name} iniciado.`)}
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
                          title="Baixar arquivo"
                        >
                          <Download className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteDocument(doc.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 dark:hover:bg-red-950/40 transition"
                          title="Remover anexo"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Confirmar Encerramento */}
      {isClosingModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Lock className="size-4 text-blue-600" /> Encerrar Atendimento
            </h3>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              Informe o motivo ou conclusão deste atendimento (ex: Acordo celebrado, Orientação prestada sem necessidade de ação judicial, etc.):
            </p>

            <textarea
              rows={3}
              placeholder="Descreva o motivo do encerramento..."
              value={closureReason}
              onChange={(e) => setClosureReason(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsClosingModalOpen(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCloseAttendance}
                className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition"
              >
                Confirmar Encerramento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

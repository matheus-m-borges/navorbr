// @ts-nocheck — tipos legados do LawHub em migração
import { useState, useEffect } from "react";
import {
  X,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Calendar,
  Clock,
  User,
  Users,
  Briefcase,
  Tag,
  Repeat,
  AlertTriangle,
  MessageSquare,
  Send,
  ListTodo,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LawHubService } from "@/lib/lawhub/lawhub-service";
import type {
  LawTask,
  LawTaskList,
  LawTaskChecklistItem,
  TaskPriority,
  TaskStatus,
  LawProcess,
} from "@/lib/lawhub/types";

interface TaskModalProps {
  isOpen: boolean;
  taskToEdit?: LawTask | null;
  defaultStatus?: "todo" | "doing" | "done";
  defaultListId?: string;
  onClose: () => void;
  onTaskSaved: () => void;
}

const COLLABORATORS = [
  "Dr. Matheus Borges",
  "Dra. Carolina Mendes",
  "Dr. Gabriel Alcantara",
];

const PREDEFINED_TAGS = [
  "PJe",
  "Urgente",
  "Fatal",
  "Cobrança",
  "Contestação",
  "Recurso",
  "Diligência",
  "Consultivo",
  "Reunião",
  "Certidão",
  "Perícia",
];

export function TaskModal({
  isOpen,
  taskToEdit,
  defaultStatus,
  defaultListId,
  onClose,
  onTaskSaved,
}: TaskModalProps) {
  const [taskLists, setTaskLists] = useState<LawTaskList[]>([]);
  const [processes, setProcesses] = useState<LawProcess[]>([]);

  // Form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [listId, setListId] = useState("peticoes");
  const [priority, setPriority] = useState<TaskPriority>("media");
  const [status, setStatus] = useState<TaskStatus>("pendente");
  const [dueDate, setDueDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueTime, setDueTime] = useState("");
  const [assigneeName, setAssigneeName] = useState("Dr. Matheus Borges");
  const [delegatedBy, setDelegatedBy] = useState("");
  const [selectedProcessId, setSelectedProcessId] = useState("");
  const [clientName, setClientName] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState<"diaria" | "semanal" | "mensal">("semanal");

  // Checklist state
  const [checklist, setChecklist] = useState<LawTaskChecklistItem[]>([]);
  const [newChecklistText, setNewChecklistText] = useState("");

  // Tags state
  const [tags, setTags] = useState<string[]>([]);

  // Comments state
  const [comments, setComments] = useState<LawTask["comments"]>([]);
  const [newCommentText, setNewCommentText] = useState("");

  // Nova lista inline state
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [newListName, setNewListName] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    const lists = LawHubService.getTaskLists();
    setTaskLists(lists);

    void LawHubService.getProcesses().then((p) => {
      setProcesses(p);
    });

    if (taskToEdit) {
      setTitle(taskToEdit.title);
      setDescription(taskToEdit.description || "");
      setListId(taskToEdit.list_id || "peticoes");
      setPriority(taskToEdit.priority || "media");
      setStatus(taskToEdit.status || "pendente");
      setDueDate(taskToEdit.due_date || new Date().toISOString().split("T")[0]);
      setDueTime(taskToEdit.due_time || "");
      setAssigneeName(taskToEdit.assigned_to_name || "Dr. Matheus Borges");
      setDelegatedBy(taskToEdit.delegated_by || "");
      setSelectedProcessId(taskToEdit.process_id || "");
      setClientName(taskToEdit.client_name || "");
      setIsRecurring(!!taskToEdit.is_recurring);
      setRecurrenceRule(
        taskToEdit.recurrence_rule && taskToEdit.recurrence_rule !== "nenhuma"
          ? (taskToEdit.recurrence_rule as any)
          : "semanal"
      );
      setChecklist(taskToEdit.checklist || []);
      setTags(taskToEdit.tags || []);
      setComments(taskToEdit.comments || []);
    } else {
      setTitle("");
      setDescription("");
      setListId(defaultListId || "peticoes");
      setPriority("media");
      setStatus(
        defaultStatus === "done"
          ? "concluida"
          : defaultStatus === "doing"
          ? "em_andamento"
          : "pendente"
      );
      setDueDate(new Date().toISOString().split("T")[0]);
      setDueTime("18:00");
      setAssigneeName("Dr. Matheus Borges");
      setDelegatedBy("");
      setSelectedProcessId("");
      setClientName("");
      setIsRecurring(false);
      setRecurrenceRule("semanal");
      setChecklist([]);
      setTags(["PJe"]);
      setComments([]);
    }
  }, [isOpen, taskToEdit, defaultStatus, defaultListId]);

  if (!isOpen) return null;

  const handleProcessChange = (procId: string) => {
    setSelectedProcessId(procId);
    if (!procId) {
      setClientName("");
      return;
    }
    const found = processes.find((p) => p.id === procId);
    if (found) {
      setClientName(found.client_name || found.passive_pole || "");
    }
  };

  const handleAddChecklistItem = () => {
    if (!newChecklistText.trim()) return;
    const newItem: LawTaskChecklistItem = {
      id: "chk-" + Math.random().toString(36).substring(2, 8),
      text: newChecklistText.trim(),
      done: false,
    };
    setChecklist([...checklist, newItem]);
    setNewChecklistText("");
  };

  const handleToggleChecklist = (id: string) => {
    setChecklist(
      checklist.map((c) => (c.id === id ? { ...c, done: !c.done } : c))
    );
  };

  const handleDeleteChecklistItem = (id: string) => {
    setChecklist(checklist.filter((c) => c.id !== id));
  };

  const handleAddComment = () => {
    if (!newCommentText.trim()) return;
    const newComment = {
      id: "cmt-" + Math.random().toString(36).substring(2, 8),
      author: "Dr. Matheus Borges",
      text: newCommentText.trim(),
      created_at: new Date().toISOString(),
    };
    setComments([...(comments || []), newComment]);
    setNewCommentText("");
  };

  const handleAddTag = (t: string) => {
    if (!tags.includes(t)) {
      setTags([...tags, t]);
    }
  };

  const handleRemoveTag = (t: string) => {
    setTags(tags.filter((item) => item !== t));
  };

  const handleCreateList = () => {
    if (!newListName.trim()) return;
    const newList: LawTaskList = {
      id: "list-" + Math.random().toString(36).substring(2, 8),
      name: newListName.trim(),
      color: "#3b82f6",
      is_active: true,
    };
    LawHubService.saveTaskList(newList);
    setTaskLists(LawHubService.getTaskLists());
    setListId(newList.id);
    setNewListName("");
    setIsCreatingList(false);
    toast.success(`Lista "${newList.name}" criada com sucesso!`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Informe o título da atividade.");
      return;
    }

    const selectedProc = processes.find((p) => p.id === selectedProcessId);

    const taskData: Omit<LawTask, "id" | "created_at"> = {
      title: title.trim(),
      description: description.trim() || undefined,
      list_id: listId,
      priority,
      status,
      due_date: dueDate,
      due_time: dueTime.trim() || undefined,
      process_id: selectedProcessId || undefined,
      process_cnj: selectedProc?.process_cnj,
      process_title: selectedProc?.title,
      client_name: clientName.trim() || undefined,
      assigned_to_name: assigneeName,
      delegated_by: delegatedBy.trim() || undefined,
      checklist,
      comments,
      tags,
      is_recurring: isRecurring,
      recurrence_rule: isRecurring ? recurrenceRule : "nenhuma",
      completed_at: status === "concluida" ? new Date().toISOString() : undefined,
    };

    if (taskToEdit) {
      await LawHubService.updateTask({
        ...taskToEdit,
        ...taskData,
      });
      toast.success("Tarefa atualizada com sucesso!");
    } else {
      await LawHubService.createTask(taskData);
      toast.success("Atividade cadastrada com sucesso!");
    }

    onTaskSaved();
    onClose();
  };

  const checklistDoneCount = checklist.filter((c) => c.done).length;
  const checklistPercent =
    checklist.length > 0 ? Math.round((checklistDoneCount / checklist.length) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 dark:border-slate-800 dark:bg-slate-900 flex flex-col max-h-[90vh]">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-blue-600 text-white shadow-sm">
              <ListTodo className="size-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {taskToEdit ? "Editar Atividade / Tarefa" : "Nova Atividade no Escritório"}
              </h3>
              <p className="text-xs text-slate-500">
                Coordene prazos, delegações, checklists e rotinas processuais
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Formulário Scrollável */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-5 text-xs">
          {/* Título */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Título da Atividade *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Elaborar Petição Inicial de Cobrança com Provas"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* Lista de Tarefas & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Lista de Tarefas
                </label>
                <button
                  type="button"
                  onClick={() => setIsCreatingList(!isCreatingList)}
                  className="text-[11px] font-semibold text-blue-600 hover:underline dark:text-blue-400"
                >
                  + Nova Lista
                </button>
              </div>

              {isCreatingList ? (
                <div className="flex items-center gap-1.5 mb-1.5">
                  <input
                    type="text"
                    placeholder="Nome da nova lista..."
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={handleCreateList}
                    className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
                  >
                    Salvar
                  </button>
                </div>
              ) : null}

              <select
                value={listId}
                onChange={(e) => setListId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                {taskLists.map((l) => (
                  <option key={l.id} value={l.id}>
                    📁 {l.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Situação / Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="pendente">⏳ A Fazer / Pendente</option>
                <option value="em_andamento">⚡ Em Andamento</option>
                <option value="concluida">✅ Concluída / Realizada</option>
              </select>
            </div>
          </div>

          {/* Vencimento, Horário e Prioridade */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Data Limite / Vencimento
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Horário Limite (Opcional)
              </label>
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Prioridade
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white font-medium"
              >
                <option value="urgente">🔴 Urgente (Prazo Fatal)</option>
                <option value="alta">🟠 Alta Prioridade</option>
                <option value="media">🟡 Média Prioridade</option>
                <option value="baixa">🟢 Baixa Prioridade</option>
              </select>
            </div>
          </div>

          {/* Atribuição & Delegação */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/40 border border-slate-200/70 dark:border-slate-800">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Responsável pela Execução
              </label>
              <select
                value={assigneeName}
                onChange={(e) => setAssigneeName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                {COLLABORATORS.map((c) => (
                  <option key={c} value={c}>
                    👤 {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Delegado Por (Coordenador/Sócio)
              </label>
              <input
                type="text"
                placeholder="Ex: Dr. Matheus Borges (Delegação)"
                value={delegatedBy}
                onChange={(e) => setDelegatedBy(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          {/* Vínculo a Processo e Cliente */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Vincular a Processo Judicial (Opcional)
              </label>
              <select
                value={selectedProcessId}
                onChange={(e) => handleProcessChange(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">Sem vínculo com processo</option>
                {processes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.process_cnj ? `${p.process_cnj} - ` : ""}
                    {p.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Cliente / Parte Envolvida
              </label>
              <input
                type="text"
                placeholder="Nome do cliente ou empresa"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Instruções e Detalhes da Tarefa
            </label>
            <textarea
              rows={2}
              placeholder="Descreva as orientações práticas, teses ou especificidades para a execução..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white leading-relaxed"
            />
          </div>

          {/* Checklist Integrado (Workflows & Checklist) */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-blue-600" />
                <span className="font-bold text-slate-900 dark:text-white">
                  Checklist de Execução
                </span>
                {checklist.length > 0 && (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    {checklistDoneCount}/{checklist.length} ({checklistPercent}%)
                  </span>
                )}
              </div>
            </div>

            {/* Barra de Progresso */}
            {checklist.length > 0 && (
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${checklistPercent}%` }}
                />
              </div>
            )}

            {/* Itens do Checklist */}
            <div className="space-y-1.5">
              {checklist.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 rounded-lg bg-white p-2 border border-slate-200 dark:border-slate-700 dark:bg-slate-800"
                >
                  <button
                    type="button"
                    onClick={() => handleToggleChecklist(item.id)}
                    className="flex items-center gap-2 flex-1 text-left"
                  >
                    {item.done ? (
                      <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                    ) : (
                      <Circle className="size-4 text-slate-400 shrink-0" />
                    )}
                    <span
                      className={cn(
                        "text-xs text-slate-800 dark:text-slate-200",
                        item.done && "line-through text-slate-400 dark:text-slate-500"
                      )}
                    >
                      {item.text}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteChecklistItem(item.id)}
                    className="text-slate-400 hover:text-red-600 p-1 transition"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Inserir Novo Item no Checklist */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Adicionar etapa ao checklist..."
                value={newChecklistText}
                onChange={(e) => setNewChecklistText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddChecklistItem();
                  }
                }}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <button
                type="button"
                onClick={handleAddChecklistItem}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition"
              >
                <Plus className="size-3.5" /> Adicionar
              </button>
            </div>
          </div>

          {/* Etiquetas / Tags */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Etiquetas e Tags
            </label>
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                >
                  <Tag className="size-2.5" />
                  {t}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(t)}
                    className="hover:text-red-600"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[10px] text-slate-400 mr-1">Sugestões:</span>
              {PREDEFINED_TAGS.filter((t) => !tags.includes(t))
                .slice(0, 6)
                .map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleAddTag(t)}
                    className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
                  >
                    + {t}
                  </button>
                ))}
            </div>
          </div>

          {/* Recorrência */}
          <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Repeat className="size-4 text-slate-500" />
              <div>
                <p className="font-bold text-slate-900 dark:text-white">Atividade Recorrente</p>
                <p className="text-[11px] text-slate-500">
                  Repetir periodicamente na rotina do escritório
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isRecurring && (
                <select
                  value={recurrenceRule}
                  onChange={(e) => setRecurrenceRule(e.target.value as any)}
                  className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="diaria">Diariamente</option>
                  <option value="semanal">Semanalmente</option>
                  <option value="mensal">Mensalmente</option>
                </select>
              )}
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="size-4 rounded text-blue-600"
              />
            </div>
          </div>

          {/* Comentários Internos */}
          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800 space-y-3">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <MessageSquare className="size-4 text-blue-600" />
              <span>Comentários e Notas Internas ({comments?.length || 0})</span>
            </div>

            <div className="space-y-2 max-h-36 overflow-y-auto">
              {comments && comments.length > 0 ? (
                comments.map((cmt) => (
                  <div
                    key={cmt.id}
                    className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-800"
                  >
                    <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1">
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {cmt.author}
                      </span>
                      <span>{new Date(cmt.created_at).toLocaleString("pt-BR")}</span>
                    </div>
                    <p className="text-slate-800 dark:text-slate-200 leading-relaxed font-normal">
                      {cmt.text}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-[11px] text-slate-400 italic">
                  Nenhum comentário registrado nesta atividade.
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                placeholder="Escrever uma observação ou nota interna..."
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddComment();
                  }
                }}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <button
                type="button"
                onClick={handleAddComment}
                className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 transition"
              >
                <Send className="size-3" /> Enviar
              </button>
            </div>
          </div>

          {/* Rodapé com Ações */}
          <div className="flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-800">
            {taskToEdit && (
              <button
                type="button"
                onClick={async () => {
                  if (confirm("Deseja realmente excluir esta atividade?")) {
                    await LawHubService.deleteTask(taskToEdit.id);
                    toast.success("Atividade excluída.");
                    onTaskSaved();
                    onClose();
                  }
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 hover:underline"
              >
                <Trash2 className="size-3.5" /> Excluir Atividade
              </button>
            )}

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
              >
                {taskToEdit ? "Salvar Alterações" : "Criar Atividade"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

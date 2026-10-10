// @ts-nocheck — tipos legados do LawHub em migração
import { useState, useEffect } from "react";
import { X, MessageSquare, User, Phone, Mail, Tag, FileText, Briefcase, Plus } from "lucide-react";
import { toast } from "sonner";
import { LawHubAttendanceService } from "@/lib/lawhub/attendance-service";
import { LawHubService } from "@/lib/lawhub/lawhub-service";

interface NewAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newId: string) => void;
}

const COMMON_TAGS = [
  "Consulta Inicial",
  "Trabalhista",
  "Cível",
  "Família & Sucessões",
  "Previdenciário",
  "Consumidor",
  "Imobiliário",
  "Contratos",
  "Prioridade",
];

export function NewAttendanceModal({ isOpen, onClose, onSuccess }: NewAttendanceModalProps) {
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [channel, setChannel] = useState<"WhatsApp" | "Presencial" | "Telefone" | "Vídeo" | "E-mail">("WhatsApp");
  const [subject, setSubject] = useState("");
  const [responsibleName, setResponsibleName] = useState("Dr. Matheus Borges");
  const [initialMessage, setInitialMessage] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>(["Consulta Inicial"]);
  const [linkedProcessId, setLinkedProcessId] = useState<string>("");

  const [existingProcesses, setExistingProcesses] = useState<any[]>([]);
  const [existingClients, setExistingClients] = useState<any[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    void LawHubService.getProcesses().then((p) => {
      if (Array.isArray(p)) setExistingProcesses(p);
    }).catch(() => {});
    void LawHubService.getClients().then((c) => {
      if (Array.isArray(c)) setExistingClients(c);
    }).catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleSelectClient = (name: string) => {
    setClientName(name);
    const cli = existingClients.find((c) => c.name === name);
    if (cli) {
      if (cli.mobile || cli.phone) setClientPhone(cli.mobile || cli.phone || "");
      if (cli.email) setClientEmail(cli.email);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !subject.trim()) {
      toast.error("Preencha o nome do cliente e o assunto do atendimento.");
      return;
    }

    const linkedProc = existingProcesses.find((p) => p.id === linkedProcessId);

    const created = LawHubAttendanceService.create({
      clientName,
      clientPhone,
      clientEmail,
      channel,
      subject,
      responsibleName,
      initialMessage,
      tags: selectedTags,
      linkedProcessId: linkedProc?.id,
      linkedProcessCnj: linkedProc?.cnj || undefined,
    });

    toast.success("Atendimento registrado com sucesso!");
    onSuccess(created.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 max-h-[92vh] overflow-y-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-blue-600 text-white shadow-xs">
              <MessageSquare className="size-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Novo Atendimento
              </h3>
              <p className="text-xs text-slate-500">
                Inicie o histórico do cliente e registre anotações da consulta
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Dados do Cliente */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/40 space-y-3">
            <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <User className="size-3.5 text-blue-600" /> Dados do Cliente
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nome do Cliente / Interessado *
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Ex: Carlos Eduardo Silva"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  {existingClients.length > 0 && (
                    <select
                      onChange={(e) => handleSelectClient(e.target.value)}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 max-w-[140px]"
                    >
                      <option value="">Buscar CRM...</option>
                      {existingClients.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <Phone className="size-3 text-slate-400" /> Telefone / WhatsApp
                </label>
                <input
                  type="text"
                  placeholder="(86) 99999-9999"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <Mail className="size-3 text-slate-400" /> E-mail
                </label>
                <input
                  type="email"
                  placeholder="cliente@email.com"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Dados do Atendimento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Canal de Atendimento
              </label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as any)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="WhatsApp">WhatsApp</option>
                <option value="Presencial">Presencial no Escritório</option>
                <option value="Telefone">Ligação Telefônica</option>
                <option value="Vídeo">Videoconferência (Meet/Teams)</option>
                <option value="E-mail">E-mail</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Advogado / Responsável
              </label>
              <select
                value={responsibleName}
                onChange={(e) => setResponsibleName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="Dr. Matheus Borges">Dr. Matheus Borges (Sócio)</option>
                <option value="Dra. Carolina Mendes">Dra. Carolina Mendes</option>
                <option value="Dra. Mariana Souza">Dra. Mariana Souza</option>
                <option value="Gabriel Alcantara">Gabriel Alcantara</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Assunto / Demanda *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Rescisão indireta por falta de depósitos de FGTS e assédio moral"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            {/* Vínculo Opcional a Processo */}
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                <Briefcase className="size-3 text-slate-400" /> Vincular a Processo Judicial (Opcional)
              </label>
              <select
                value={linkedProcessId}
                onChange={(e) => setLinkedProcessId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">Nenhum processo vinculado (deixar avulso)</option>
                {existingProcesses.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.cnj || "Processo sem CNJ"} • {p.client} ({p.action})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Etiquetas / Tags */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
              <Tag className="size-3 text-slate-400" /> Etiquetas / Áreas
            </label>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_TAGS.map((tag) => {
                const isSelected = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                      isSelected
                        ? "bg-blue-600 text-white shadow-xs"
                        : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Primeiro Registro / Anotação da Consulta */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
              <FileText className="size-3 text-slate-400" /> Primeiro Registro / Notas da Conversa
            </label>
            <textarea
              rows={3}
              placeholder="Descreva o resumo inicial dos fatos relatados pelo cliente, pedidos e impressões da consulta..."
              value={initialMessage}
              onChange={(e) => setInitialMessage(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white leading-relaxed font-sans"
            />
          </div>

          {/* Ações */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
            >
              Registrar Atendimento
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

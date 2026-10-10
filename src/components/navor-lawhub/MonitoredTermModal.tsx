import { useState, useEffect } from "react";
import {
  X,
  User,
  Building2,
  Clock,
  Globe2,
  Plus,
  CheckCircle2,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { MonitoredPublicationTerm } from "@/lib/lawhub/types";

const BRAZILIAN_STATES = [
  { uf: "AC", name: "Acre" },
  { uf: "AL", name: "Alagoas" },
  { uf: "AP", name: "Amapá" },
  { uf: "AM", name: "Amazonas" },
  { uf: "BA", name: "Bahia" },
  { uf: "CE", name: "Ceará" },
  { uf: "DF", name: "Distrito Federal" },
  { uf: "ES", name: "Espírito Santo" },
  { uf: "GO", name: "Goiás" },
  { uf: "MA", name: "Maranhão" },
  { uf: "MT", name: "Mato Grosso" },
  { uf: "MS", name: "Mato Grosso do Sul" },
  { uf: "MG", name: "Minas Gerais" },
  { uf: "PA", name: "Pará" },
  { uf: "PB", name: "Paraíba" },
  { uf: "PR", name: "Paraná" },
  { uf: "PE", name: "Pernambuco" },
  { uf: "PI", name: "Piauí" },
  { uf: "RJ", name: "Rio de Janeiro" },
  { uf: "RN", name: "Rio Grande do Norte" },
  { uf: "RS", name: "Rio Grande do Sul" },
  { uf: "RO", name: "Rondônia" },
  { uf: "RR", name: "Roraima" },
  { uf: "SC", name: "Santa Catarina" },
  { uf: "SP", name: "São Paulo" },
  { uf: "SE", name: "Sergipe" },
  { uf: "TO", name: "Tocantins" },
];

const DEFAULT_OFFICE_USERS = [
  "Arthur Carvalho Moura Da Silva",
  "Dr. Matheus Borges",
  "Dra. Mariana Costa e Silva",
];

interface MonitoredTermModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (term: Omit<MonitoredPublicationTerm, "id" | "created_at"> & { id?: string }) => void;
  initialTerm?: MonitoredPublicationTerm | null;
  editingTerm?: MonitoredPublicationTerm | null;
  availableUsers?: { id: string; name: string; email?: string }[] | string[];
}

export function MonitoredTermModal({
  isOpen,
  onClose,
  onSave,
  initialTerm,
  editingTerm,
  availableUsers,
}: MonitoredTermModalProps) {
  const activeTerm = initialTerm !== undefined ? initialTerm : editingTerm;

  const usersToDisplay = (availableUsers && availableUsers.length > 0)
    ? availableUsers.map((u) => (typeof u === "string" ? u : u.name))
    : DEFAULT_OFFICE_USERS;

  const [type, setType] = useState<"PF" | "PJ">("PF");
  const [name, setName] = useState("");
  const [oabUf, setOabUf] = useState("PI");
  const [oabNumber, setOabNumber] = useState("");
  const [cpf, setCpf] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [hasHomonyms, setHasHomonyms] = useState(false);
  const [blockedTerms, setBlockedTerms] = useState<string[]>([]);
  const [newBlockedTerm, setNewBlockedTerm] = useState("");
  const [scopeType, setScopeType] = useState<"todos" | "um_estado" | "diferentes_estados">("todos");
  const [singleState, setSingleState] = useState("PI");
  const [selectedStates, setSelectedStates] = useState<string[]>(["PI"]);
  const [notifiedUsers, setNotifiedUsers] = useState<string[]>([usersToDisplay[0] ?? ""]);

  useEffect(() => {
    if (activeTerm) {
      setType(activeTerm.type);
      setName(activeTerm.name);
      setOabUf(activeTerm.oab_uf || "PI");
      setOabNumber(activeTerm.oab_number || "");
      setCpf(activeTerm.cpf || "");
      setCnpj(activeTerm.cnpj || "");
      setHasHomonyms(activeTerm.has_homonyms);
      setBlockedTerms(activeTerm.blocked_terms || []);
      setScopeType(activeTerm.scope_type || "todos");
      if (activeTerm.scope_type === "um_estado" && activeTerm.selected_states?.length > 0) {
        setSingleState(activeTerm.selected_states[0] ?? "PI");
      }
      setSelectedStates(activeTerm.selected_states || ["PI"]);
      setNotifiedUsers(activeTerm.notified_users || [usersToDisplay[0] ?? ""]);
    } else {
      setType("PF");
      setName("");
      setOabUf("PI");
      setOabNumber("");
      setCpf("");
      setCnpj("");
      setHasHomonyms(false);
      setBlockedTerms([]);
      setNewBlockedTerm("");
      setScopeType("todos");
      setSingleState("PI");
      setSelectedStates(["PI"]);
      setNotifiedUsers([DEFAULT_OFFICE_USERS[0] ?? ""]);
    }
  }, [editingTerm, isOpen]);

  if (!isOpen) return null;

  const handleAddBlockedTerm = () => {
    if (!newBlockedTerm.trim()) return;
    if (blockedTerms.includes(newBlockedTerm.trim())) {
      toast.error("Termo de bloqueio já adicionado.");
      return;
    }
    setBlockedTerms([...blockedTerms, newBlockedTerm.trim()]);
    setNewBlockedTerm("");
  };

  const handleRemoveBlockedTerm = (termToRemove: string) => {
    setBlockedTerms(blockedTerms.filter((t) => t !== termToRemove));
  };

  const toggleState = (uf: string) => {
    if (selectedStates.includes(uf)) {
      if (selectedStates.length === 1) {
        toast.warning("Selecione pelo menos um estado.");
        return;
      }
      setSelectedStates(selectedStates.filter((s) => s !== uf));
    } else {
      setSelectedStates([...selectedStates, uf]);
    }
  };

  const toggleNotifiedUser = (userName: string) => {
    if (notifiedUsers.includes(userName)) {
      if (notifiedUsers.length === 1) {
        toast.warning("Pelo menos um usuário deve receber as notificações.");
        return;
      }
      setNotifiedUsers(notifiedUsers.filter((u) => u !== userName));
    } else {
      setNotifiedUsers([...notifiedUsers, userName]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error(type === "PF" ? "Informe o nome do advogado." : "Informe a razão social ou nome da empresa.");
      return;
    }

    if (type === "PF" && !oabNumber.trim()) {
      toast.error("Informe o número da OAB para evitar homônimos.");
      return;
    }

    if (type === "PJ" && !cnpj.trim()) {
      toast.error("Informe o CNPJ da empresa.");
      return;
    }

    const finalStates =
      scopeType === "todos"
        ? BRAZILIAN_STATES.map((s) => s.uf)
        : scopeType === "um_estado"
        ? [singleState]
        : selectedStates;

    const term = {
      ...(activeTerm?.id ? { id: activeTerm.id } : {}),
      type,
      name: name.trim().toUpperCase(),
      oab_uf: type === "PF" ? oabUf : undefined,
      oab_number: type === "PF" ? oabNumber.trim() : undefined,
      cpf: type === "PF" && cpf.trim() ? cpf.trim() : undefined,
      cnpj: type === "PJ" && cnpj.trim() ? cnpj.trim() : undefined,
      has_homonyms: hasHomonyms,
      blocked_terms: hasHomonyms ? blockedTerms : [],
      scope_type: scopeType,
      selected_states: finalStates,
      notified_users: notifiedUsers.length > 0 ? notifiedUsers : [usersToDisplay[0] ?? ""],
      status: activeTerm?.status || ("em_homologacao" as const),
    };

    onSave(term);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 my-8 overflow-hidden text-xs">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-blue-600 text-white shadow-xs">
              <Globe2 className="size-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {editingTerm ? "Editar Nome para Publicações" : "Cadastrar Nome para Receber Publicações"}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Configure os termos e diários oficiais pesquisados automaticamente pelo sistema
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white transition"
          >
            <X className="size-4.5" />
          </button>
        </div>

        {/* Formulário com Scroll */}
        <form onSubmit={handleSubmit} className="max-h-[75vh] overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* Alerta de Operação do Radar LawHub */}
          <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50/80 p-3.5 text-blue-900 shadow-2xs dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200">
            <Clock className="size-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              <strong>Ciclo de Indexação LawHub:</strong> As publicações dos Diários Oficiais e DJEN passam a ser indexadas e entregues em seu painel em <strong>até 48 horas úteis</strong> após a ativação deste termo.
            </p>
          </div>

          {/* Seletor PF vs PJ */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              Escolha o tipo de pesquisa:
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType("PF")}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3.5 text-left transition",
                  type === "PF"
                    ? "border-blue-600 bg-blue-50/60 ring-1 ring-blue-600 dark:border-blue-500 dark:bg-blue-950/40"
                    : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-850"
                )}
              >
                <div
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-lg font-bold text-xs",
                    type === "PF" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 dark:bg-slate-800"
                  )}
                >
                  <User className="size-4.5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">Pessoa Física (PF)</h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Pesquisa pelo nome do advogado, OAB e CPF
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setType("PJ")}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3.5 text-left transition",
                  type === "PJ"
                    ? "border-blue-600 bg-blue-50/60 ring-1 ring-blue-600 dark:border-blue-500 dark:bg-blue-950/40"
                    : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-850"
                )}
              >
                <div
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-lg font-bold text-xs",
                    type === "PJ" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 dark:bg-slate-800"
                  )}
                >
                  <Building2 className="size-4.5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">Pessoa Jurídica (PJ)</h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Pesquisa pelo nome da empresa / escritório e CNPJ
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Dados do Nome & Documentos */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {type === "PF" ? "Nome do Advogado para Pesquisa *" : "Nome da Empresa / Escritório para Pesquisa *"}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={type === "PF" ? "Ex: Arthur Carvalho Moura Da Silva" : "Ex: Borges & Advogados Associados"}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 uppercase placeholder:text-slate-400 placeholder:normal-case focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                required
              />
              <p className="mt-1 text-[10px] text-slate-500">
                Informe o nome exatamente como é citado nas publicações dos diários oficiais.
              </p>
            </div>

            {type === "PF" ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    UF da OAB *
                  </label>
                  <select
                    value={oabUf}
                    onChange={(e) => setOabUf(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {BRAZILIAN_STATES.map((s) => (
                      <option key={s.uf} value={s.uf}>
                        {s.uf} - {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Número da OAB *
                  </label>
                  <input
                    type="text"
                    value={oabNumber}
                    onChange={(e) => setOabNumber(e.target.value)}
                    placeholder="Ex: 17.614"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    CPF (Opcional)
                  </label>
                  <input
                    type="text"
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value)}
                    placeholder="000.000.000-00"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  CNPJ correspondente *
                </label>
                <input
                  type="text"
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  placeholder="00.000.000/0001-00"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  required
                />
              </div>
            )}
          </div>

          {/* Filtro Anti-Homônimos LawHub */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-850 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Info className="size-4 text-amber-500 shrink-0" />
                <span className="font-bold text-slate-900 dark:text-white">
                  Controle Anti-Homônimos LawHub
                </span>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasHomonyms}
                  onChange={(e) => setHasHomonyms(e.target.checked)}
                  className="size-4 rounded text-blue-600"
                />
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Nome passível de ter homônimos
                </span>
              </label>
            </div>

            <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              💡 <strong>Orientação LawHub:</strong> Para evitar o recebimento de publicações de outros profissionais com nomes semelhantes, cadastre termos e variações na lista de bloqueio.
            </p>

            {hasHomonyms && (
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  Adicionar termo ou variação para bloqueio:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newBlockedTerm}
                    onChange={(e) => setNewBlockedTerm(e.target.value)}
                    placeholder="Ex: Arthur Carvalho Silva Junior"
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddBlockedTerm();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddBlockedTerm}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 transition"
                  >
                    <Plus className="size-3.5" /> Adicionar
                  </button>
                </div>

                {/* Lista de Termos Bloqueados */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {blockedTerms.map((term, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-1 text-[11px] font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300"
                    >
                      <span>Bloquear: {term}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveBlockedTerm(term)}
                        className="hover:text-red-900 dark:hover:text-red-100"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                  {blockedTerms.length === 0 && (
                    <span className="text-[10px] text-slate-400 italic">
                      Nenhum homônimo na lista de bloqueio.
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Abrangência Territorial da Varredura */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
              Escopo Territorial do Monitoramento:
            </label>

            <div className="space-y-2">
              <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 p-3 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-850 cursor-pointer">
                <input
                  type="radio"
                  name="scope_radio"
                  checked={scopeType === "todos"}
                  onChange={() => setScopeType("todos")}
                  className="mt-0.5 text-blue-600"
                />
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">
                    Em todos os diários (Recomendado)
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Inclui Diários Oficiais da Justiça Nacional (DJEN), Tribunais Superiores (STF, STJ, TST), Federais (TRFs), Estaduais (TJs) e órgãos públicos do Brasil.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 p-3 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-850 cursor-pointer">
                <input
                  type="radio"
                  name="scope_radio"
                  checked={scopeType === "um_estado"}
                  onChange={() => setScopeType("um_estado")}
                  className="mt-0.5 text-blue-600"
                />
                <div className="flex-1">
                  <p className="font-bold text-slate-900 dark:text-white">
                    Em apenas um estado
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                    Útil para quando você atua exclusivamente em uma região específica.
                  </p>

                  {scopeType === "um_estado" && (
                    <select
                      value={singleState}
                      onChange={(e) => setSingleState(e.target.value)}
                      className="w-full sm:w-60 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      {BRAZILIAN_STATES.map((s) => (
                        <option key={s.uf} value={s.uf}>
                          {s.uf} - {s.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </label>

              <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 p-3 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-850 cursor-pointer">
                <input
                  type="radio"
                  name="scope_radio"
                  checked={scopeType === "diferentes_estados"}
                  onChange={() => setScopeType("diferentes_estados")}
                  className="mt-0.5 text-blue-600"
                />
                <div className="flex-1">
                  <p className="font-bold text-slate-900 dark:text-white">
                    Em diferentes estados
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                    Indicado para quem atua em mais de um estado, permitindo selecionar as regiões de interesse.
                  </p>

                  {scopeType === "diferentes_estados" && (
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 max-h-40 overflow-y-auto p-1 custom-scrollbar">
                        {BRAZILIAN_STATES.map((s) => {
                          const isChecked = selectedStates.includes(s.uf);
                          return (
                            <button
                              key={s.uf}
                              type="button"
                              onClick={() => toggleState(s.uf)}
                              className={cn(
                                "flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-bold transition",
                                isChecked
                                  ? "bg-blue-600 text-white shadow-xs"
                                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                              )}
                            >
                              <span>{s.uf}</span>
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-1.5 text-[10px] text-slate-500">
                        {selectedStates.length} estado(s) selecionado(s): {selectedStates.join(", ")}
                      </p>
                    </div>
                  )}
                </div>
              </label>
            </div>

            {scopeType !== "todos" && (
              <p className="text-[10px] text-slate-500 italic">
                ❗ Lembre-se de revisar essa configuração sempre que cadastrar clientes de novas regiões.
              </p>
            )}
          </div>

          {/* Distribuição e Notificações da Equipe */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">
                  Distribuição de Alertas e Acesso da Equipe:
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Selecione quais operadores e advogados receberão os recortes deste termo na central de Publicações.
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50/50 p-2 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-850">
              {usersToDisplay.map((user) => {
                const isSelected = notifiedUsers.includes(user);
                return (
                  <label
                    key={user}
                    className="flex items-center justify-between p-2 hover:bg-white dark:hover:bg-slate-800 rounded-lg cursor-pointer transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="grid size-7 place-items-center rounded-full bg-blue-100 text-blue-700 font-bold text-[10px] dark:bg-blue-900/40 dark:text-blue-300">
                        {user.substring(0, 2).toUpperCase()}
                      </div>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {user}
                      </span>
                    </div>

                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleNotifiedUser(user)}
                      className="size-4 rounded text-blue-600"
                    />
                  </label>
                );
              })}
            </div>
          </div>

          {/* Botões do Rodapé */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
            >
              <CheckCircle2 className="size-4" />
              <span>Salvar Termo de Publicações</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

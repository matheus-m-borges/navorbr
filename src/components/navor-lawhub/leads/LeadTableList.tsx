import React, { useState } from "react";
import {
  Search,
  Scale,
  ShieldCheck,
  AlertTriangle,
  Clock,
  ArrowRight,
  Filter,
  User,
  Sparkles,
  Trash2,
  Edit3,
  Calendar,
  Target,
} from "lucide-react";
import type { LawLead, LawLeadPipelineStage } from "@/lib/lawhub/lead-types";
import { cn } from "@/lib/utils";

interface LeadTableListProps {
  leads: LawLead[];
  stages: LawLeadPipelineStage[];
  onSelectLead: (lead: LawLead) => void;
  onEditLead?: (lead: LawLead) => void;
  onConvertLead: (leadId: string) => void;
  onDeleteLead: (leadId: string) => void;
}

export function LeadTableList({
  leads,
  stages,
  onSelectLead,
  onEditLead,
  onConvertLead,
  onDeleteLead,
}: LeadTableListProps) {
  const [search, setSearch] = useState("");
  const [selectedArea, setSelectedArea] = useState<string>("todos");
  const [selectedStage, setSelectedStage] = useState<string>("todos");
  const [selectedRate, setSelectedRate] = useState<string>("todos");

  const filteredLeads = leads.filter((lead) => {
    if (selectedArea !== "todos" && lead.area_direito !== selectedArea) return false;
    if (selectedStage !== "todos" && lead.stage_id !== selectedStage) return false;
    if (selectedRate !== "todos" && lead.estimated_success_rate !== selectedRate) return false;
    if (!search.trim()) return true;

    const query = search.toLowerCase();
    return (
      lead.name.toLowerCase().includes(query) ||
      (lead.opposing_party && lead.opposing_party.toLowerCase().includes(query)) ||
      (lead.document_number && lead.document_number.includes(query)) ||
      (lead.phone && lead.phone.includes(query)) ||
      (lead.email && lead.email.toLowerCase().includes(query))
    );
  });

  const getStage = (stageId: string) => stages.find((s) => s.id === stageId);

  return (
    <div className="space-y-4">
      {/* Barra de Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-2 text-xs flex-1">
          <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-2.5 size-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Pesquisar por cliente, contraparte, documento..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <select
            value={selectedArea}
            onChange={(e) => setSelectedArea(e.target.value)}
            className="rounded-md border border-slate-200 bg-transparent px-2.5 py-1.5 font-semibold text-xs text-slate-700 focus:outline-none dark:border-slate-700 dark:text-slate-300"
          >
            <option value="todos">ÁREA: TODAS</option>
            <option value="Trabalhista">Trabalhista</option>
            <option value="Cível">Cível</option>
            <option value="Tributário">Tributário</option>
            <option value="Consumidor">Consumidor</option>
            <option value="Família & Sucessões">Família & Sucessões</option>
            <option value="Previdenciário">Previdenciário</option>
            <option value="Empresarial">Empresarial</option>
          </select>

          <select
            value={selectedStage}
            onChange={(e) => setSelectedStage(e.target.value)}
            className="rounded-md border border-slate-200 bg-transparent px-2.5 py-1.5 font-semibold text-xs text-slate-700 focus:outline-none dark:border-slate-700 dark:text-slate-300"
          >
            <option value="todos">ETAPA: TODAS</option>
            {stages.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name}
              </option>
            ))}
          </select>

          <select
            value={selectedRate}
            onChange={(e) => setSelectedRate(e.target.value)}
            className="rounded-md border border-slate-200 bg-transparent px-2.5 py-1.5 font-semibold text-xs text-slate-700 focus:outline-none dark:border-slate-700 dark:text-slate-300"
          >
            <option value="todos">PROBABILIDADE: TODAS</option>
            <option value="alta">Êxito Alta</option>
            <option value="media">Êxito Média</option>
            <option value="baixa">Êxito Baixa</option>
          </select>
        </div>

        <span className="text-xs text-slate-500 font-semibold">
          {filteredLeads.length} lead(s) encontrado(s)
        </span>
      </div>

      {/* Tabela de Leads */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">LEAD / CONTATO</th>
                <th className="px-4 py-3">ÁREA JURÍDICA</th>
                <th className="px-4 py-3">ETAPA ATUAL</th>
                <th className="px-4 py-3">PARTE CONTRÁRIA & CONFLITO</th>
                <th className="px-4 py-3">ORIGEM / TRÁFEGO</th>
                <th className="px-4 py-3">PROBABILIDADE</th>
                <th className="px-4 py-3 text-right">AÇÕES</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-xs text-slate-400">
                    Nenhum lead encontrado com os filtros aplicados.
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => {
                  const stage = getStage(lead.stage_id);
                  const isConflict = lead.conflict_check_status === "conflict_detected";

                  return (
                    <tr
                      key={lead.id}
                      onClick={() => onSelectLead(lead)}
                      className="cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition group"
                    >
                      {/* Nome e Contato */}
                      <td className="px-4 py-3.5 align-top">
                        <div className="space-y-0.5">
                          <h4 className="font-bold text-slate-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400 transition">
                            {lead.name}
                          </h4>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                            {lead.phone && <span>{lead.phone}</span>}
                            {lead.document_number && <span>• {lead.document_number}</span>}
                          </div>
                        </div>
                      </td>

                      {/* Área */}
                      <td className="px-4 py-3.5 align-top">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 text-[10px] font-bold border border-blue-200/60 dark:border-blue-800">
                          {lead.area_direito}
                        </span>
                      </td>

                      {/* Etapa */}
                      <td className="px-4 py-3.5 align-top">
                        {stage ? (
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-white shadow-2xs"
                            style={{ backgroundColor: stage.color }}
                          >
                            <span className="size-1.5 rounded-full bg-white animate-pulse" />
                            {stage.name}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Sem etapa</span>
                        )}
                      </td>

                      {/* Parte Contrária & Conflito */}
                      <td className="px-4 py-3.5 align-top">
                        {lead.opposing_party ? (
                          <div className="space-y-1">
                            <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                              {lead.opposing_party}
                            </span>
                            <div>
                              {isConflict ? (
                                <span className="inline-flex items-center gap-1 rounded bg-rose-100 px-1.5 py-0.2 text-[9px] font-bold text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                                  <AlertTriangle className="size-2.5" />
                                  Conflito Detectado
                                </span>
                              ) : lead.conflict_check_status === "cleared" ? (
                                <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.2 text-[9px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                  <ShieldCheck className="size-2.5" />
                                  Livre / Sem Conflito
                                </span>
                              ) : null}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Não informada</span>
                        )}
                      </td>

                      {/* Origem / Tráfego */}
                      <td className="px-4 py-3.5 align-top">
                        {lead.traffic_code ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="px-1.5 py-0.5 rounded font-mono text-[9px] font-bold bg-indigo-600 text-white">
                                {lead.traffic_code}
                              </span>
                              <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs truncate max-w-[150px]">
                                {lead.traffic_action_name || lead.source}
                              </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground">{lead.source}</p>
                          </div>
                        ) : lead.lead_type === "futuro" ? (
                          <div className="space-y-0.5">
                            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold text-[10px] border border-amber-500/30 inline-flex items-center gap-1">
                              <Calendar className="size-2.5" />
                              Retorno: {lead.future_contact_date || "A definir"}
                            </span>
                            <p className="text-[10px] text-muted-foreground">{lead.source}</p>
                          </div>
                        ) : (
                          <span className="text-slate-600 dark:text-slate-400 text-xs font-medium">
                            {lead.source || "Indicação"}
                          </span>
                        )}
                      </td>

                      {/* Probabilidade */}
                      <td className="px-4 py-3.5 align-top">
                        <span
                          className={cn(
                            "rounded px-2 py-0.5 text-[10px] font-bold uppercase",
                            lead.estimated_success_rate === "alta"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : lead.estimated_success_rate === "baixa"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          )}
                        >
                          {lead.estimated_success_rate}
                        </span>
                      </td>

                      {/* Ações */}
                      <td className="px-4 py-3.5 align-top text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => (onEditLead ? onEditLead(lead) : onSelectLead(lead))}
                            className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 transition cursor-pointer"
                            title="Editar lead"
                          >
                            <Edit3 className="size-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onConvertLead(lead.id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 text-[11px] font-bold border border-emerald-200 dark:border-emerald-800 transition"
                            title="Converter em Cliente & Processo (1 Clique)"
                          >
                            <Sparkles className="size-3 text-emerald-500" />
                            <span>Converter</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onDeleteLead(lead.id)}
                            className="rounded-lg p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
                            title="Excluir lead"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

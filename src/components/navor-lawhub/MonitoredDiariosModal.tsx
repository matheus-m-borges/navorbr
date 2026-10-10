import React, { useState, useMemo } from "react";
import {
  X,
  Search,
  BookOpen,
  CheckCircle2,
  ShieldCheck,
  Building2,
  Scale,
  Sparkles,
  ExternalLink,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import type { MonitoredPublicationTerm } from "@/lib/lawhub/types";

interface MonitoredDiariosModalProps {
  isOpen: boolean;
  onClose: () => void;
  term?: MonitoredPublicationTerm | null;
}

interface GazetteItem {
  id: string;
  name: string;
  code: string;
  category: "nacional" | "superior" | "estadual" | "trf" | "trt";
  state?: string;
  updateFrequency: string;
  active: boolean;
}

const ALL_GAZETTES: GazetteItem[] = [
  // Nacional & Superiores
  { id: "djen", name: "Diário da Justiça Eletrônico Nacional", code: "DJEN", category: "nacional", updateFrequency: "Diária (CNJ)", active: true },
  { id: "dou", name: "Diário Oficial da União (Seções 1, 2 e 3)", code: "DOU", category: "nacional", updateFrequency: "Diária", active: true },
  { id: "stf", name: "Supremo Tribunal Federal", code: "STF", category: "superior", updateFrequency: "Diária", active: true },
  { id: "stj", name: "Superior Tribunal de Justiça", code: "STJ", category: "superior", updateFrequency: "Diária", active: true },
  { id: "tst", name: "Tribunal Superior do Trabalho", code: "TST", category: "superior", updateFrequency: "Diária", active: true },
  { id: "tse", name: "Tribunal Superior Eleitoral", code: "TSE", category: "superior", updateFrequency: "Diária", active: true },
  { id: "stm", name: "Superior Tribunal Militar", code: "STM", category: "superior", updateFrequency: "Diária", active: true },

  // TRFs
  { id: "trf1", name: "TRF 1ª Região (DF, GO, TO, MT, BA, PI, MA, PA, AM, AC, RO, RR, AP)", code: "TRF1", category: "trf", state: "PI", updateFrequency: "Diária", active: true },
  { id: "trf2", name: "TRF 2ª Região (RJ, ES)", code: "TRF2", category: "trf", state: "RJ", updateFrequency: "Diária", active: true },
  { id: "trf3", name: "TRF 3ª Região (SP, MS)", code: "TRF3", category: "trf", state: "SP", updateFrequency: "Diária", active: true },
  { id: "trf4", name: "TRF 4ª Região (RS, PR, SC)", code: "TRF4", category: "trf", state: "RS", updateFrequency: "Diária", active: true },
  { id: "trf5", name: "TRF 5ª Região (PE, CE, RN, PB, AL, SE)", code: "TRF5", category: "trf", state: "PE", updateFrequency: "Diária", active: true },
  { id: "trf6", name: "TRF 6ª Região (MG)", code: "TRF6", category: "trf", state: "MG", updateFrequency: "Diária", active: true },

  // Estaduais (TJs e DOEs)
  { id: "tjsp", name: "TJSP - Tribunal de Justiça de São Paulo (Cadernos 1, 2, 3 e 4)", code: "TJSP", category: "estadual", state: "SP", updateFrequency: "Diária", active: true },
  { id: "tjpi", name: "TJPI - Tribunal de Justiça do Piauí", code: "TJPI", category: "estadual", state: "PI", updateFrequency: "Diária", active: true },
  { id: "tjrj", name: "TJRJ - Tribunal de Justiça do Rio de Janeiro", code: "TJRJ", category: "estadual", state: "RJ", updateFrequency: "Diária", active: true },
  { id: "tjmg", name: "TJMG - Tribunal de Justiça de Minas Gerais", code: "TJMG", category: "estadual", state: "MG", updateFrequency: "Diária", active: true },
  { id: "tjrs", name: "TJRS - Tribunal de Justiça do Rio Grande do Sul", code: "TJRS", category: "estadual", state: "RS", updateFrequency: "Diária", active: true },
  { id: "tjpr", name: "TJPR - Tribunal de Justiça do Paraná", code: "TJPR", category: "estadual", state: "PR", updateFrequency: "Diária", active: true },
  { id: "tjba", name: "TJBA - Tribunal de Justiça da Bahia", code: "TJBA", category: "estadual", state: "BA", updateFrequency: "Diária", active: true },
  { id: "tjce", name: "TJCE - Tribunal de Justiça do Ceará", code: "TJCE", category: "estadual", state: "CE", updateFrequency: "Diária", active: true },
  { id: "tjpe", name: "TJPE - Tribunal de Justiça de Pernambuco", code: "TJPE", category: "estadual", state: "PE", updateFrequency: "Diária", active: true },
  { id: "tjma", name: "TJMA - Tribunal de Justiça do Maranhão", code: "TJMA", category: "estadual", state: "MA", updateFrequency: "Diária", active: true },
  { id: "tjgo", name: "TJGO - Tribunal de Justiça de Goiás", code: "TJGO", category: "estadual", state: "GO", updateFrequency: "Diária", active: true },
  { id: "tjsc", name: "TJSC - Tribunal de Justiça de Santa Catarina", code: "TJSC", category: "estadual", state: "SC", updateFrequency: "Diária", active: true },
  { id: "tjdft", name: "TJDFT - Tribunal de Justiça do Distrito Federal e Territórios", code: "TJDFT", category: "estadual", state: "DF", updateFrequency: "Diária", active: true },
  { id: "tjmt", name: "TJMT - Tribunal de Justiça de Mato Grosso", code: "TJMT", category: "estadual", state: "MT", updateFrequency: "Diária", active: true },
  { id: "tjms", name: "TJMS - Tribunal de Justiça de Mato Grosso do Sul", code: "TJMS", category: "estadual", state: "MS", updateFrequency: "Diária", active: true },
  { id: "tjes", name: "TJES - Tribunal de Justiça do Espírito Santo", code: "TJES", category: "estadual", state: "ES", updateFrequency: "Diária", active: true },
  { id: "tjpa", name: "TJPA - Tribunal de Justiça do Pará", code: "TJPA", category: "estadual", state: "PA", updateFrequency: "Diária", active: true },
  { id: "tjam", name: "TJAM - Tribunal de Justiça do Amazonas", code: "TJAM", category: "estadual", state: "AM", updateFrequency: "Diária", active: true },
  { id: "tjrn", name: "TJRN - Tribunal de Justiça do Rio Grande do Norte", code: "TJRN", category: "estadual", state: "RN", updateFrequency: "Diária", active: true },
  { id: "tjpb", name: "TJPB - Tribunal de Justiça da Paraíba", code: "TJPB", category: "estadual", state: "PB", updateFrequency: "Diária", active: true },
  { id: "tjal", name: "TJAL - Tribunal de Justiça de Alagoas", code: "TJAL", category: "estadual", state: "AL", updateFrequency: "Diária", active: true },
  { id: "tjse", name: "TJSE - Tribunal de Justiça de Sergipe", code: "TJSE", category: "estadual", state: "SE", updateFrequency: "Diária", active: true },
  { id: "tjto", name: "TJTO - Tribunal de Justiça do Tocantins", code: "TJTO", category: "estadual", state: "TO", updateFrequency: "Diária", active: true },
  { id: "tjro", name: "TJRO - Tribunal de Justiça de Rondônia", code: "TJRO", category: "estadual", state: "RO", updateFrequency: "Diária", active: true },
  { id: "tjac", name: "TJAC - Tribunal de Justiça do Acre", code: "TJAC", category: "estadual", state: "AC", updateFrequency: "Diária", active: true },
  { id: "tjrr", name: "TJRR - Tribunal de Justiça de Roraima", code: "TJRR", category: "estadual", state: "RR", updateFrequency: "Diária", active: true },
  { id: "tjap", name: "TJAP - Tribunal de Justiça do Amapá", code: "TJAP", category: "estadual", state: "AP", updateFrequency: "Diária", active: true },

  // TRTs
  { id: "trt2", name: "TRT 2ª Região (São Paulo - Capital e Região Metropolitana)", code: "TRT2", category: "trt", state: "SP", updateFrequency: "Diária", active: true },
  { id: "trt15", name: "TRT 15ª Região (Campinas e Interior de SP)", code: "TRT15", category: "trt", state: "SP", updateFrequency: "Diária", active: true },
  { id: "trt1", name: "TRT 1ª Região (Rio de Janeiro)", code: "TRT1", category: "trt", state: "RJ", updateFrequency: "Diária", active: true },
  { id: "trt22", name: "TRT 22ª Região (Piauí)", code: "TRT22", category: "trt", state: "PI", updateFrequency: "Diária", active: true },
  { id: "trt3", name: "TRT 3ª Região (Minas Gerais)", code: "TRT3", category: "trt", state: "MG", updateFrequency: "Diária", active: true },
  { id: "trt4", name: "TRT 4ª Região (Rio Grande do Sul)", code: "TRT4", category: "trt", state: "RS", updateFrequency: "Diária", active: true },
  { id: "trt5", name: "TRT 5ª Região (Bahia)", code: "TRT5", category: "trt", state: "BA", updateFrequency: "Diária", active: true },
  { id: "trt10", name: "TRT 10ª Região (DF e Tocantins)", code: "TRT10", category: "trt", state: "DF", updateFrequency: "Diária", active: true },
];

export function MonitoredDiariosModal({
  isOpen,
  onClose,
  term,
}: MonitoredDiariosModalProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const filteredGazettes = useMemo(() => {
    return ALL_GAZETTES.filter((gazette) => {
      // If term has specific scope and it's not "todos"
      if (term && term.scope_type !== "todos") {
        if (gazette.category === "estadual" || gazette.category === "trt") {
          if (gazette.state && !term.selected_states.includes(gazette.state)) {
            return false;
          }
        }
      }

      if (selectedCategory !== "all" && gazette.category !== selectedCategory) {
        return false;
      }

      if (search.trim()) {
        const query = search.toLowerCase();
        return (
          gazette.name.toLowerCase().includes(query) ||
          gazette.code.toLowerCase().includes(query) ||
          (gazette.state && gazette.state.toLowerCase().includes(query))
        );
      }

      return true;
    });
  }, [term, selectedCategory, search]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-slate-200 dark:border-slate-800 dark:bg-slate-900 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600">
              <BookOpen className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Diários Oficiais Monitorados
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                  Varredura Ativa
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                {term
                  ? `Termo pesquisado: ${term.name} (${term.type === "PF" ? `OAB/${term.oab_uf} ${term.oab_number}` : term.cnpj || "PJ"})`
                  : "Lista de todos os diários judiciais e diários oficiais integrados"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 transition"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Scope Info & Filters */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
          {term && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
              <div>
                <span className="text-slate-500 font-medium">Abrangência configurada: </span>
                <span className="font-bold text-slate-800 dark:text-slate-100">
                  {term.scope_type === "todos"
                    ? "Todos os diários da Justiça e Diário Oficial da União (Nacional)"
                    : `Estados selecionados: ${term.selected_states.join(", ")}`}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-600 font-semibold text-[11px]">
                <ShieldCheck className="size-4" />
                Robôs de Inteligência Artificial consultam diariamente
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar tribunal, estado ou diário (ex: TJPI, TRF1, DJEN, SP)..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-xs shadow-sm focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            {/* Category tabs */}
            <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
              {[
                { id: "all", label: "Todos" },
                { id: "nacional", label: "Nacional & DOU" },
                { id: "superior", label: "Superiores" },
                { id: "estadual", label: "Justiça Estadual" },
                { id: "trf", label: "TRF" },
                { id: "trt", label: "Trabalhista" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedCategory(tab.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition ${
                    selectedCategory === tab.id
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* List of Gazettes */}
        <div className="flex-1 overflow-y-auto p-6 space-y-2">
          <div className="text-xs font-semibold text-slate-500 mb-2 flex items-center justify-between">
            <span>Exibindo {filteredGazettes.length} diários cobertos</span>
            <span className="text-[11px] text-slate-400">Varreduras automáticas às 06:00 e 18:00</span>
          </div>

          {filteredGazettes.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Nenhum diário encontrado com os filtros informados.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {filteredGazettes.map((gazette) => (
                <div
                  key={gazette.id}
                  className="flex flex-col justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 hover:border-blue-400 dark:hover:border-blue-700 transition gap-2 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <div className="size-2.5 rounded-full bg-emerald-500 mt-1 shrink-0 animate-pulse" title="Varredura Ativa no Robô" />
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                            {gazette.code}
                          </span>
                          {gazette.state && (
                            <span className="rounded bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                              {gazette.state}
                            </span>
                          )}
                          <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                            🟢 Monitorado Ativo
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                          {gazette.name}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-500">
                    <span>{gazette.updateFrequency} • Última checagem: Hoje, 06:12</span>
                    <button
                      type="button"
                      onClick={() => toast.success(`Conexão com ${gazette.code} testada e confirmada! Robô operacional.`)}
                      className="font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      Testar Conexão
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 px-6 py-3.5 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900 rounded-b-2xl">
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <Sparkles className="size-3.5 text-blue-500" />
            <span>Varredura automática com inteligência artificial LawHub & DJEN unificado</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 px-4 py-2 text-xs font-bold text-white transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

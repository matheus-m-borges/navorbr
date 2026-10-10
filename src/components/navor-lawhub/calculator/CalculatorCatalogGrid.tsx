import { useState, useMemo } from "react";
import {
  Search,
  Sparkles,
  Calculator,
  Scale,
  Landmark,
  Briefcase,
  Users,
  Home,
  Gavel,
  Percent,
  X,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CALCULATOR_CATALOG,
  CALCULATOR_CATEGORIES,
  CalculatorItem,
} from "./calculator-catalog-data";

interface CalculatorCatalogGridProps {
  onSelectCalculator: (calculator: CalculatorItem) => void;
}

export function CalculatorCatalogGrid({ onSelectCalculator }: CalculatorCatalogGridProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("todos");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Ícones temáticos para cada tipo
  const renderIcon = (type: CalculatorItem["iconType"]) => {
    switch (type) {
      case "landmark":
        return <Landmark className="size-5 text-amber-600 dark:text-amber-400" />;
      case "users":
        return <Users className="size-5 text-purple-600 dark:text-purple-400" />;
      case "gavel":
        return <Gavel className="size-5 text-amber-600 dark:text-amber-400" />;
      case "scale":
        return <Scale className="size-5 text-blue-600 dark:text-blue-400" />;
      case "briefcase":
        return <Briefcase className="size-5 text-rose-600 dark:text-rose-400" />;
      case "percent":
        return <Percent className="size-5 text-indigo-600 dark:text-indigo-400" />;
      case "home":
        return <Home className="size-5 text-sky-600 dark:text-sky-400" />;
      case "calculator":
      default:
        return <Calculator className="size-5 text-emerald-600 dark:text-emerald-400" />;
    }
  };

  // Badge de tag de especialidade
  const renderTag = (label: string, tone: string) => {
    const toneClasses = {
      purple: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800",
      teal: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800",
      amber: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
      rose: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
      blue: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
      emerald: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
    }[tone] || "bg-slate-50 text-slate-700 border-slate-200";

    return (
      <span
        key={label}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold border",
          toneClasses
        )}
      >
        {label}
      </span>
    );
  };

  // Filtro dinâmico por categoria e texto de busca
  const filteredCalculators = useMemo(() => {
    return CALCULATOR_CATALOG.filter((item) => {
      const matchesCategory =
        selectedCategory === "todos" ||
        item.category === selectedCategory ||
        (selectedCategory === "civel_geral" && (item.category === "geral" || item.category === "imobiliario"));

      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        item.name.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.categoryLabels.some((l) => l.label.toLowerCase().includes(query));

      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Barra de Filtro e Busca Rápida */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Filtros em Pílulas */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {CALCULATOR_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 font-medium transition whitespace-nowrap",
                selectedCategory === cat.id
                  ? "bg-blue-600 text-white shadow-xs font-bold"
                  : "bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Input de Pesquisa */}
        <div className="relative min-w-[260px] sm:w-72">
          <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar calculadora (ex: divórcio, fgts)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Grid de Blocos das Calculadoras (Inspirado no DrCalc & Padrão LawHub) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredCalculators.map((calc) => (
          <div
            key={calc.id}
            className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition duration-200 hover:-translate-y-0.5 hover:border-emerald-500/60 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-500/50"
          >
            {/* Topo do Card: Ícone Centralizado e Tag IA se houver */}
            <div>
              <div className="flex items-start justify-between">
                <div className="grid size-10 place-items-center rounded-xl bg-slate-50 border border-slate-100 dark:bg-slate-800/80 dark:border-slate-700/60 shadow-2xs group-hover:scale-105 transition">
                  {renderIcon(calc.iconType)}
                </div>

                {calc.hasIa && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/50">
                    <Sparkles className="size-3 text-purple-500" />
                    <span>IA</span>
                  </span>
                )}
              </div>

              {/* Título com Prefixo e Destaque */}
              <div className="mt-3.5">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  <span className="font-normal text-slate-500 dark:text-slate-400">{calc.prefix} </span>
                  <span className="text-slate-900 dark:text-white font-extrabold">{calc.highlightName}</span>
                </h3>
                <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                  {calc.description}
                </p>
              </div>

              {/* Tags de Área */}
              <div className="mt-4 flex flex-wrap items-center gap-1.5">
                {calc.categoryLabels.map((lbl) => renderTag(lbl.label, lbl.tone))}
              </div>
            </div>

            {/* Ação: Botão Realizar Cálculo */}
            <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => onSelectCalculator(calc)}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 active:scale-[0.99] transition duration-150"
              >
                <span>Realizar Cálculo</span>
                <ArrowRight className="size-3.5 opacity-80 group-hover:translate-x-0.5 transition" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredCalculators.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center dark:border-slate-800">
          <Calculator className="mx-auto size-10 text-slate-400" />
          <h4 className="mt-3 text-sm font-bold text-slate-700 dark:text-slate-200">
            Nenhuma calculadora encontrada
          </h4>
          <p className="mt-1 text-xs text-slate-500">
            Tente buscar com outro termo ou selecione a categoria "Todas as Calculadoras".
          </p>
          <button
            onClick={() => {
              setSelectedCategory("todos");
              setSearchQuery("");
            }}
            className="mt-3 text-xs font-bold text-blue-600 hover:underline"
          >
            Limpar filtros de busca
          </button>
        </div>
      )}
    </div>
  );
}

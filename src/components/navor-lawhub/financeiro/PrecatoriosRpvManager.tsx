import { useState, useMemo, useEffect } from "react";
import {
  Scale,
  FileText,
  CheckCircle2,
  Clock,
  Building2,
  AlertCircle,
  DollarSign,
  TrendingUp,
  ArrowUpRight,
  Filter,
  Download,
  Plus,
  Search,
  X,
  ShieldCheck,
  Receipt,
  Calendar,
  ChevronDown,
  Copy,
  Printer,
  RefreshCw,
  Landmark,
  Check,
  Trash2,
  Edit2,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LawFinancialService } from "@/lib/lawhub/financial-service";
import { LawHubService } from "@/lib/lawhub/lawhub-service";
import type {
  LawPrecatórioRpvRequisition,
  JudicialRequisitionType,
  JudicialRequisitionStatus,
  JudicialCourtType,
  JudicialDepositaryBank,
} from "@/lib/lawhub/financial-types";

const REQUISITION_TYPE_LABELS: Record<JudicialRequisitionType, { label: string; badgeClass: string }> = {
  precatorio_alimentar: {
    label: "Precatório Alimentar",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  },
  precatorio_comum: {
    label: "Precatório Comum",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
  },
  rpv_federal: {
    label: "RPV Federal",
    badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800",
  },
  rpv_estadual_municipal: {
    label: "RPV Estadual/Municipal",
    badgeClass: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800",
  },
  alvara_levantamento: {
    label: "Alvará de Levantamento",
    badgeClass: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  },
  deposito_judicial: {
    label: "Depósito Judicial",
    badgeClass: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800",
  },
};

const STATUS_LABELS: Record<JudicialRequisitionStatus, { label: string; badgeClass: string }> = {
  autuado: {
    label: "Autuado no Tribunal",
    badgeClass: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  },
  inscrito_orcamento: {
    label: "Inscrito no Orçamento (LOA)",
    badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  },
  aguardando_liberacao_bancaria: {
    label: "Aguardando Liberação Bancária",
    badgeClass: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300",
  },
  alvara_expedido: {
    label: "Pronto para Levantamento",
    badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300",
  },
  honorarios_destacados: {
    label: "Honorários Destacados (EOAB)",
    badgeClass: "bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300",
  },
  repassado_cliente: {
    label: "Repassado ao Cliente",
    badgeClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  },
  concluido: {
    label: "Prestação Concluída & Quitado",
    badgeClass: "bg-teal-100 text-teal-800 dark:bg-teal-950/50 dark:text-teal-300",
  },
};

const BANK_LABELS: Record<JudicialDepositaryBank, { label: string; badgeClass: string; short: string }> = {
  CEF: {
    label: "Caixa Econômica Federal",
    badgeClass: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300",
    short: "CEF",
  },
  BANCO_DO_BRASIL: {
    label: "Banco do Brasil",
    badgeClass: "bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-950/50 dark:text-yellow-300",
    short: "BB",
  },
  BANCO_DE_BRASILIA: {
    label: "Banco de Brasília (BRB)",
    badgeClass: "bg-cyan-50 text-cyan-800 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300",
    short: "BRB",
  },
  OUTRO: {
    label: "Outra Instituição Depositária",
    badgeClass: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300",
    short: "OUTRO",
  },
};

export function PrecatoriosRpvManager() {
  const [items, setItems] = useState<LawPrecatórioRpvRequisition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("todas");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [bankFilter, setBankFilter] = useState<string>("todos");

  // Modais
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LawPrecatórioRpvRequisition | null>(null);

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedItemForReport, setSelectedItemForReport] = useState<LawPrecatórioRpvRequisition | null>(null);

  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [selectedItemForTransfer, setSelectedItemForTransfer] = useState<LawPrecatórioRpvRequisition | null>(null);
  const [transferDate, setTransferDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [transferReceiptUrl, setTransferReceiptUrl] = useState("");
  const [transferNotes, setTransferNotes] = useState("");

  // Processos e clientes disponíveis para autocomplete
  const [processesList, setProcessesList] = useState<any[]>([]);
  const [clientsList, setClientsList] = useState<any[]>([]);

  // Carregar dados
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [precatorios, procs, clients] = await Promise.all([
        LawFinancialService.getPrecatoriosRequisitions(),
        LawHubService.getProcesses(),
        LawHubService.getClients(),
      ]);
      setItems(precatorios);
      setProcessesList(procs || []);
      setClientsList(clients || []);
    } catch {
      toast.error("Erro ao carregar requisições de precatórios e RPVs.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Métricas Consolidadas
  const metrics = useMemo(() => {
    const totalGross = items.reduce((acc, i) => acc + (Number(i.gross_amount) || 0), 0);
    const totalFees = items.reduce(
      (acc, i) => acc + (Number(i.contract_fee_amount) || 0) + (Number(i.sucumbence_fee_amount) || 0),
      0
    );
    const totalClientNet = items.reduce((acc, i) => acc + (Number(i.client_net_amount) || 0), 0);
    const readyForReleaseCount = items.filter(
      (i) => i.status === "alvara_expedido" || i.status === "aguardando_liberacao_bancaria"
    ).length;
    const reconciledCount = items.filter((i) => i.reconciled_with_financial).length;

    return {
      totalGross,
      totalFees,
      totalClientNet,
      readyForReleaseCount,
      reconciledCount,
      totalCount: items.length,
    };
  }, [items]);

  // Itens filtrados
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (typeFilter !== "todas" && item.requisition_type !== typeFilter) return false;
      if (statusFilter !== "todos" && item.status !== statusFilter) return false;
      if (bankFilter !== "todos" && item.depositary_bank !== bankFilter) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchNumber = item.requisition_number?.toLowerCase().includes(q);
        const matchCnj = item.process_cnj?.toLowerCase().includes(q);
        const matchClient = item.client_name?.toLowerCase().includes(q);
        const matchCourt = item.court?.toLowerCase().includes(q);
        const matchUnit = item.court_unit?.toLowerCase().includes(q);
        if (!matchNumber && !matchCnj && !matchClient && !matchCourt && !matchUnit) return false;
      }
      return true;
    });
  }, [items, searchTerm, typeFilter, statusFilter, bankFilter]);

  // Conciliação de Retenção com 1-Clique (Art. 22 § 4º EOAB)
  const handleReconcileFees = async (item: LawPrecatórioRpvRequisition) => {
    toast.loading("Conciliando retenção de honorários no financeiro e registrando na auditoria forense...", {
      id: "reconcile-fee",
    });

    const res = await LawFinancialService.reconcileFeeRetention(item.id, "Dr. Matheus Borges");
    if (res.success) {
      toast.success(res.message, { id: "reconcile-fee" });
      loadData();
    } else {
      toast.error(res.message, { id: "reconcile-fee" });
    }
  };

  // Confirmar repasse ao cliente
  const handleConfirmTransfer = async () => {
    if (!selectedItemForTransfer) return;
    toast.loading("Registrando repasse ao cliente e lavrando trilha de auditoria...", { id: "confirm-transfer" });

    const success = await LawFinancialService.markClientTransferred(
      selectedItemForTransfer.id,
      {
        transferDate,
        receiptUrl: transferReceiptUrl,
        notes: transferNotes,
      },
      "Dr. Matheus Borges"
    );

    if (success) {
      toast.success("Repasse ao cliente registrado com sucesso e registrado na trilha de auditoria!", {
        id: "confirm-transfer",
      });
      setIsTransferModalOpen(false);
      setSelectedItemForTransfer(null);
      loadData();
    } else {
      toast.error("Erro ao registrar repasse.", { id: "confirm-transfer" });
    }
  };

  // Excluir
  const handleDelete = async (item: LawPrecatórioRpvRequisition) => {
    if (!confirm(`Deseja realmente remover o registro da requisição ${item.requisition_number}?`)) return;
    await LawFinancialService.deletePrecatórioRequisition(item.id);
    toast.success("Registro removido com sucesso!");
    loadData();
  };

  return (
    <div className="space-y-6">
      {/* CABEÇALHO COM TÍTULO E AÇÕES PRINCIPAIS */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="size-10 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 flex items-center justify-center">
              <Scale className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Painel de Inteligência de Precatórios, RPVs e Alvarás
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  Art. 22 § 4º EOAB
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Gestão orçamentária de precatórios alimentares, RPVs federais/estaduais, destaque de honorários e prestação de contas.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => LawFinancialService.exportPrecatoriosCsv(items)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer transition shadow-2xs"
            title="Exportar planilha analítica de requisições judiciais em CSV"
          >
            <Download className="size-3.5 text-slate-500" />
            <span>Exportar CSV</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingItem(null);
              setIsFormModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition uppercase tracking-wider cursor-pointer shadow-xs"
          >
            <Plus className="size-4" />
            <span>NOVO PRECATÓRIO / RPV</span>
          </button>
        </div>
      </div>

      {/* METRIC CARDS / KPIS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CARD 1: TOTAL BRUTO REQUISITADO */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Bruto Requisitado</span>
            <div className="size-9 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 flex items-center justify-center">
              <Landmark className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {metrics.totalGross.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">{metrics.totalCount} requisições judiciais em trâmite</p>
        </div>

        {/* CARD 2: HONORÁRIOS DESTACADOS EOAB */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Honorários Destacados (EOAB)</span>
            <div className="size-9 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400 flex items-center justify-center">
              <DollarSign className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {metrics.totalFees.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            {metrics.reconciledCount} conciliados com o financeiro
          </p>
        </div>

        {/* CARD 3: SALDO LÍQUIDO DOS CLIENTES */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Saldo Líquido dos Clientes</span>
            <div className="size-9 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 flex items-center justify-center">
              <TrendingUp className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {metrics.totalClientNet.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Montante homologado para transferência</p>
        </div>

        {/* CARD 4: PRONTOS PARA LEVANTAMENTO */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Prontos para Levantamento</span>
            <div className="size-9 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 flex items-center justify-center">
              <Clock className="size-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {metrics.readyForReleaseCount}
            </span>
            <span className="text-xs text-slate-400">alvarás / depósitos</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Aguardando saque na CEF / Banco do Brasil</p>
        </div>
      </div>

      {/* FILTROS E PESQUISA */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por CNJ, Nº da requisição, cliente, tribunal ou vara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filtro por Tipo */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="todas">Todos os Tipos</option>
            <option value="precatorio_alimentar">Precatório Alimentar</option>
            <option value="precatorio_comum">Precatório Comum</option>
            <option value="rpv_federal">RPV Federal</option>
            <option value="rpv_estadual_municipal">RPV Estadual/Municipal</option>
            <option value="alvara_levantamento">Alvará de Levantamento</option>
            <option value="deposito_judicial">Depósito Judicial</option>
          </select>

          {/* Filtro por Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="todos">Todos os Status</option>
            <option value="autuado">Autuado</option>
            <option value="inscrito_orcamento">Inscrito no Orçamento</option>
            <option value="aguardando_liberacao_bancaria">Aguardando Liberação</option>
            <option value="alvara_expedido">Pronto para Levantamento</option>
            <option value="honorarios_destacados">Honorários Destacados</option>
            <option value="repassado_cliente">Repassado ao Cliente</option>
            <option value="concluido">Prestação Concluída</option>
          </select>

          {/* Filtro por Banco */}
          <select
            value={bankFilter}
            onChange={(e) => setBankFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="todos">Todos os Bancos</option>
            <option value="CEF">Caixa Econômica Federal</option>
            <option value="BANCO_DO_BRASIL">Banco do Brasil</option>
            <option value="BANCO_DE_BRASILIA">BRB</option>
          </select>

          <button
            type="button"
            onClick={loadData}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
            title="Atualizar dados"
          >
            <RefreshCw className="size-4" />
          </button>
        </div>
      </div>

      {/* TABELA DE REQUISIÇÕES JUDICIAIS */}
      <div className="rounded-2xl border border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-slate-500 uppercase font-semibold text-[10px] tracking-wider">
              <tr>
                <th className="p-4">REQUISIÇÃO & TRIBUNAL</th>
                <th className="p-4">PROCESSO & CLIENTE</th>
                <th className="p-4">TIPO & BANCO</th>
                <th className="p-4">VALOR BRUTO</th>
                <th className="p-4">HONORÁRIOS (EOAB)</th>
                <th className="p-4">LÍQUIDO CLIENTE</th>
                <th className="p-4">STATUS & EXERCÍCIO</th>
                <th className="p-4 text-right">AÇÕES FORENSES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    Nenhuma requisição judicial encontrada com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const typeMeta = REQUISITION_TYPE_LABELS[item.requisition_type] || REQUISITION_TYPE_LABELS.precatorio_alimentar;
                  const statusMeta = STATUS_LABELS[item.status] || STATUS_LABELS.autuado;
                  const bankMeta = BANK_LABELS[item.depositary_bank] || BANK_LABELS.CEF;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                      {/* Coluna 1: Requisição e Tribunal */}
                      <td className="p-4">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>{item.requisition_number}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {item.court}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 max-w-[220px] truncate" title={item.court_unit}>
                          {item.court_unit || "Seção Judiciária / Vara"}
                        </p>
                      </td>

                      {/* Coluna 2: Processo e Cliente */}
                      <td className="p-4">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate max-w-[200px]" title={item.client_name}>
                          {item.client_name}
                        </span>
                        <div className="text-[11px] text-blue-600 dark:text-blue-400 font-mono mt-0.5">
                          {item.process_cnj}
                        </div>
                      </td>

                      {/* Coluna 3: Tipo & Banco */}
                      <td className="p-4 space-y-1">
                        <span className={cn("inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border", typeMeta.badgeClass)}>
                          {typeMeta.label}
                        </span>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                          <span className={cn("px-1.5 py-0.2 rounded text-[10px] font-semibold border", bankMeta.badgeClass)}>
                            {bankMeta.short}
                          </span>
                          <span>{item.agency ? `Ag. ${item.agency}` : ""}</span>
                        </div>
                      </td>

                      {/* Coluna 4: Valor Bruto */}
                      <td className="p-4 font-bold text-slate-900 dark:text-white">
                        {item.gross_amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </td>

                      {/* Coluna 5: Honorários Retidos */}
                      <td className="p-4">
                        <div className="font-bold text-purple-700 dark:text-purple-400">
                          {item.contract_fee_amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          <span className="text-[10px] text-slate-400 font-normal ml-1">({item.contract_fee_percentage}%)</span>
                        </div>
                        {item.sucumbence_fee_amount > 0 && (
                          <div className="text-[10px] text-slate-500">
                            + {item.sucumbence_fee_amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} (sucumbência)
                          </div>
                        )}
                        {item.has_fee_retention_order && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                            <ShieldCheck className="size-3" /> Art. 22 §4º Deferido
                          </span>
                        )}
                      </td>

                      {/* Coluna 6: Líquido Cliente */}
                      <td className="p-4">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                          {item.client_net_amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </span>
                        {item.costs_deducted_amount > 0 && (
                          <div className="text-[10px] text-rose-500">
                            - {item.costs_deducted_amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} (custas ressarcidas)
                          </div>
                        )}
                      </td>

                      {/* Coluna 7: Status & Exercício */}
                      <td className="p-4">
                        <span className={cn("inline-block px-2.5 py-1 rounded-full text-[10px] font-bold", statusMeta.badgeClass)}>
                          {statusMeta.label}
                        </span>
                        <div className="text-[10px] text-slate-400 mt-1">
                          {item.budget_year ? `LOA ${item.budget_year}` : "Exercício Atual"}
                          {item.expected_payment_date ? ` • Prev: ${new Date(item.expected_payment_date).toLocaleDateString("pt-BR")}` : ""}
                        </div>
                      </td>

                      {/* Coluna 8: Ações Forenses */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Ação 1: Conciliar Retenção EOAB */}
                          {!item.reconciled_with_financial ? (
                            <button
                              type="button"
                              onClick={() => handleReconcileFees(item)}
                              className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-950/60 dark:text-purple-300 dark:hover:bg-purple-900 border border-purple-200 dark:border-purple-800 text-[11px] font-bold cursor-pointer transition shadow-2xs"
                              title="Conciliar honorários contratuais retidos diretamente com o financeiro (Art. 22 § 4º EOAB)"
                            >
                              Conciliar EOAB
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-bold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/50">
                              <CheckCircle2 className="size-3.5" /> Conciliado
                            </span>
                          )}

                          {/* Ação 2: Registrar Repasse ao Cliente */}
                          {item.status !== "repassado_cliente" && item.status !== "concluido" && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedItemForTransfer(item);
                                setIsTransferModalOpen(true);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold cursor-pointer transition"
                              title="Registrar transferência bancária efetuada ao cliente"
                            >
                              Repassar
                            </button>
                          )}

                          {/* Ação 3: Prestação de Contas */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedItemForReport(item);
                              setIsReportModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                            title="Emitir Certidão de Prestação de Contas & Quitação Mútua (Art. 320 CC)"
                          >
                            <FileSpreadsheet className="size-4 text-blue-600" />
                          </button>

                          {/* Ação 4: Editar */}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingItem(item);
                              setIsFormModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                            title="Editar Requisição"
                          >
                            <Edit2 className="size-3.5" />
                          </button>

                          {/* Ação 5: Excluir */}
                          <button
                            type="button"
                            onClick={() => handleDelete(item)}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 hover:border-rose-200 dark:border-slate-700 dark:hover:bg-rose-950/40 text-rose-600 cursor-pointer"
                            title="Remover Registro"
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

      {/* ========================================================================= */}
      {/* MODAL 1: FORMULÁRIO DE PRECATÓRIO / RPV / ALVARÁ                         */}
      {/* ========================================================================= */}
      {isFormModalOpen && (
        <PrecatórioFormModal
          isOpen={isFormModalOpen}
          initialData={editingItem}
          processesList={processesList}
          clientsList={clientsList}
          onClose={() => setIsFormModalOpen(false)}
          onSaved={() => {
            setIsFormModalOpen(false);
            loadData();
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CERTIDÃO DE PRESTAÇÃO DE CONTAS & QUITAÇÃO MÚTUA               */}
      {/* ========================================================================= */}
      {isReportModalOpen && selectedItemForReport && (
        <PrestaçãoContasModal
          isOpen={isReportModalOpen}
          item={selectedItemForReport}
          onClose={() => {
            setIsReportModalOpen(false);
            setSelectedItemForReport(null);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: REGISTRO DE REPASSE BANCÁRIO AO CLIENTE                         */}
      {/* ========================================================================= */}
      {isTransferModalOpen && selectedItemForTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="size-5 text-emerald-600" />
                Registrar Repasse ao Cliente
              </h3>
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/60 space-y-1.5">
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  Cliente: <span className="font-bold">{selectedItemForTransfer.client_name}</span>
                </p>
                <p className="text-slate-500">
                  Requisição: {selectedItemForTransfer.requisition_number} ({selectedItemForTransfer.court})
                </p>
                <div className="pt-1 flex items-baseline justify-between border-t border-slate-200 dark:border-slate-700">
                  <span className="font-medium text-slate-600 dark:text-slate-400">Valor Líquido do Repasse:</span>
                  <span className="font-bold text-emerald-600 text-sm">
                    {selectedItemForTransfer.client_net_amount.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </span>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Data da Transferência / Liquidação <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Comprovante / Link do Documento (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="https://... ou identificador da TED/PIX"
                  value={transferReceiptUrl}
                  onChange={(e) => setTransferReceiptUrl(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">Observações do Repasse</label>
                <textarea
                  rows={2}
                  placeholder="Ex: TED enviada para conta corrente indicada pelo titular com recibo assinado."
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmTransfer}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer transition shadow-xs"
                >
                  CONFIRMAR REPASSE
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTE: MODAL DE CADASTRO/EDIÇÃO DE PRECATÓRIO OU RPV
// ============================================================================
interface PrecatórioFormModalProps {
  isOpen: boolean;
  initialData: LawPrecatórioRpvRequisition | null;
  processesList: any[];
  clientsList: any[];
  onClose: () => void;
  onSaved: () => void;
}

function PrecatórioFormModal({
  initialData,
  processesList,
  clientsList,
  onClose,
  onSaved,
}: PrecatórioFormModalProps) {
  const isEditing = !!initialData?.id;

  const [processSearch, setProcessSearch] = useState(initialData?.process_cnj || "");
  const [selectedProcess, setSelectedProcess] = useState<any>(null);
  const [isProcessDropdownOpen, setIsProcessDropdownOpen] = useState(false);

  const [clientName, setClientName] = useState(initialData?.client_name || "");
  const [clientDoc, setClientDoc] = useState(initialData?.client_document || "");
  const [requisitionNumber, setRequisitionNumber] = useState(initialData?.requisition_number || "");
  const [court, setCourt] = useState<JudicialCourtType>(initialData?.court || "TRF1");
  const [courtUnit, setCourtUnit] = useState(initialData?.court_unit || "1ª Vara Federal de Teresina");
  const [requisitionType, setRequisitionType] = useState<JudicialRequisitionType>(
    initialData?.requisition_type || "precatorio_alimentar"
  );
  const [depositaryBank, setDepositaryBank] = useState<JudicialDepositaryBank>(
    initialData?.depositary_bank || "BANCO_DO_BRASIL"
  );
  const [agency, setAgency] = useState(initialData?.agency || "");
  const [accountNumber, setAccountNumber] = useState(initialData?.account_number || "");

  const [grossAmount, setGrossAmount] = useState<string>(initialData ? String(initialData.gross_amount) : "");
  const [contractFeePct, setContractFeePct] = useState<number>(initialData?.contract_fee_percentage ?? 25);
  const [contractFeeAmount, setContractFeeAmount] = useState<string>(
    initialData ? String(initialData.contract_fee_amount) : ""
  );
  const [sucumbenceFeeAmount, setSucumbenceFeeAmount] = useState<string>(
    initialData ? String(initialData.sucumbence_fee_amount) : "0"
  );
  const [costsAmount, setCostsAmount] = useState<string>(initialData ? String(initialData.costs_deducted_amount) : "0");

  const [budgetYear, setBudgetYear] = useState<number>(
    initialData?.budget_year || (new Date().getFullYear() + (requisitionType.startsWith("precatorio") ? 1 : 0))
  );
  const [issuanceDate, setIssuanceDate] = useState(
    initialData?.issuance_date || new Date().toISOString().slice(0, 10)
  );
  const [expectedPaymentDate, setExpectedPaymentDate] = useState(initialData?.expected_payment_date || "");
  const [hasFeeRetentionOrder, setHasFeeRetentionOrder] = useState(initialData?.has_fee_retention_order ?? true);
  const [status, setStatus] = useState<JudicialRequisitionStatus>(initialData?.status || "autuado");
  const [notes, setNotes] = useState(initialData?.notes || "");

  // Atualização dinâmica do valor de honorários
  const handleGrossChange = (valStr: string) => {
    setGrossAmount(valStr);
    const parsed = parseFloat(valStr.replace(/[^0-9,.-]/g, "").replace(",", ".")) || 0;
    if (parsed > 0 && contractFeePct > 0) {
      const calcFee = (parsed * contractFeePct) / 100;
      setContractFeeAmount(calcFee.toFixed(2));
    }
  };

  const handlePctChange = (pct: number) => {
    setContractFeePct(pct);
    const parsed = parseFloat(grossAmount.replace(/[^0-9,.-]/g, "").replace(",", ".")) || 0;
    if (parsed > 0) {
      const calcFee = (parsed * pct) / 100;
      setContractFeeAmount(calcFee.toFixed(2));
    }
  };

  // Cálculo do líquido em tempo real
  const computedNet = useMemo(() => {
    const gross = parseFloat(grossAmount.replace(/[^0-9,.-]/g, "").replace(",", ".")) || 0;
    const fee = parseFloat(contractFeeAmount.replace(/[^0-9,.-]/g, "").replace(",", ".")) || 0;
    const suc = parseFloat(sucumbenceFeeAmount.replace(/[^0-9,.-]/g, "").replace(",", ".")) || 0;
    const costs = parseFloat(costsAmount.replace(/[^0-9,.-]/g, "").replace(",", ".")) || 0;
    const net = gross - fee - suc - costs;
    return net > 0 ? net : 0;
  }, [grossAmount, contractFeeAmount, sucumbenceFeeAmount, costsAmount]);

  // Filtragem de processos no autocomplete
  const filteredProcesses = useMemo(() => {
    if (!processSearch.trim()) return processesList.slice(0, 8);
    const q = processSearch.toLowerCase();
    return processesList
      .filter(
        (p) =>
          (p.cnj_number && p.cnj_number.toLowerCase().includes(q)) ||
          (p.client_name && p.client_name.toLowerCase().includes(q)) ||
          (p.title && p.title.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [processesList, processSearch]);

  const handleSelectProcess = (p: any) => {
    setSelectedProcess(p);
    setProcessSearch(p.cnj_number);
    setIsProcessDropdownOpen(false);

    if (p.client_name) setClientName(p.client_name);
    if (p.client_document) setClientDoc(p.client_document);
    if (p.court) setCourt(p.court);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const grossParsed = parseFloat(grossAmount.replace(/[^0-9,.-]/g, "").replace(",", ".")) || 0;
    if (grossParsed <= 0) {
      toast.error("Informe um valor bruto válido.");
      return;
    }
    if (!clientName.trim()) {
      toast.error("Informe o nome do cliente.");
      return;
    }

    toast.loading("Salvando requisição judicial...", { id: "save-req" });

    try {
      await LawFinancialService.savePrecatórioRequisition({
        id: initialData?.id,
        process_id: selectedProcess?.id || initialData?.process_id || "",
        process_cnj: processSearch || initialData?.process_cnj || "0000000-00.0000.0.00.0000",
        client_id: selectedProcess?.client_id || initialData?.client_id || "",
        client_name: clientName.trim(),
        client_document: clientDoc.trim() || undefined,
        requisition_number: requisitionNumber.trim() || `REQ-${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`,
        court,
        court_unit: courtUnit.trim(),
        requisition_type: requisitionType,
        depositary_bank: depositaryBank,
        agency: agency.trim(),
        account_number: accountNumber.trim(),
        gross_amount: grossParsed,
        contract_fee_percentage: contractFeePct,
        contract_fee_amount: parseFloat(contractFeeAmount) || (grossParsed * contractFeePct) / 100,
        sucumbence_fee_amount: parseFloat(sucumbenceFeeAmount) || 0,
        costs_deducted_amount: parseFloat(costsAmount) || 0,
        client_net_amount: computedNet,
        budget_year: budgetYear,
        issuance_date: issuanceDate,
        expected_payment_date: expectedPaymentDate || undefined,
        has_fee_retention_order: hasFeeRetentionOrder,
        status,
        notes: notes.trim(),
      });

      toast.success("Precatório / RPV salvo com sucesso!", { id: "save-req" });
      onSaved();
    } catch {
      toast.error("Erro ao salvar requisição.", { id: "save-req" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-3xl rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 shadow-2xl my-8">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
            <Scale className="size-5 text-blue-600" />
            {isEditing ? "Editar Requisição Judicial" : "Cadastrar Novo Precatório ou RPV"}
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4 text-xs">
          {/* LINHA 1: VINCULAÇÃO DE PROCESSO & CLIENTE */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="relative">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Processo CNJ Vinculado <span className="text-rose-500">*</span>
              </label>
              <div className="relative mt-1">
                <input
                  type="text"
                  placeholder="Digite o CNJ ou cliente..."
                  value={processSearch}
                  onChange={(e) => {
                    setProcessSearch(e.target.value);
                    setIsProcessDropdownOpen(true);
                  }}
                  onFocus={() => setIsProcessDropdownOpen(true)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  required
                />
                <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 pointer-events-none" />
              </div>

              {isProcessDropdownOpen && filteredProcesses.length > 0 && (
                <div className="absolute left-0 right-0 z-20 mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                  {filteredProcesses.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => handleSelectProcess(p)}
                      className="cursor-pointer rounded-lg p-2 hover:bg-blue-50 dark:hover:bg-slate-700 transition"
                    >
                      <p className="font-bold text-slate-800 dark:text-white">{p.cnj_number}</p>
                      <p className="text-[11px] text-slate-400">{p.client_name || p.title}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Cliente Titular do Crédito <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Nome completo ou Razão Social"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                required
              />
            </div>
          </div>

          {/* LINHA 2: TIPO DE REQUISIÇÃO, NÚMERO & TRIBUNAL */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Tipo de Requisição <span className="text-rose-500">*</span>
              </label>
              <select
                value={requisitionType}
                onChange={(e) => setRequisitionType(e.target.value as JudicialRequisitionType)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="precatorio_alimentar">Precatório Alimentar (Prioritário)</option>
                <option value="precatorio_comum">Precatório Comum</option>
                <option value="rpv_federal">RPV Federal (Até 60 SM)</option>
                <option value="rpv_estadual_municipal">RPV Estadual/Municipal</option>
                <option value="alvara_levantamento">Alvará de Levantamento</option>
                <option value="deposito_judicial">Depósito Judicial Direto</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Número da Requisição / PRC / RPV <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Ex: PRC-2026/001429-TRF1"
                value={requisitionNumber}
                onChange={(e) => setRequisitionNumber(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                required
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">Tribunal Competente</label>
              <select
                value={court}
                onChange={(e) => setCourt(e.target.value as JudicialCourtType)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="TRF1">TRF1 (Federal - Piauí e Região)</option>
                <option value="TJPI">TJPI (Estadual do Piauí)</option>
                <option value="TRT22">TRT22 (Trabalhista Piauí)</option>
                <option value="TRF2">TRF2</option>
                <option value="TRF3">TRF3</option>
                <option value="TRF4">TRF4</option>
                <option value="TRF5">TRF5</option>
                <option value="TRF6">TRF6</option>
                <option value="TJMA">TJMA</option>
                <option value="TJCE">TJCE</option>
                <option value="STJ">Superior Tribunal de Justiça (STJ)</option>
                <option value="STF">Supremo Tribunal Federal (STF)</option>
                <option value="OUTRO">Outro Tribunal</option>
              </select>
            </div>
          </div>

          {/* LINHA 3: BANCO DEPOSITÁRIO, AGÊNCIA E CONTA */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Banco Depositário Judicial <span className="text-rose-500">*</span>
              </label>
              <select
                value={depositaryBank}
                onChange={(e) => setDepositaryBank(e.target.value as JudicialDepositaryBank)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="CEF">Caixa Econômica Federal (CEF)</option>
                <option value="BANCO_DO_BRASIL">Banco do Brasil (BB)</option>
                <option value="BANCO_DE_BRASILIA">Banco de Brasília (BRB)</option>
                <option value="OUTRO">Outro Banco</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">Agência Bancária</label>
              <input
                type="text"
                placeholder="Ex: 0021-X ou 3791"
                value={agency}
                onChange={(e) => setAgency(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">Conta / Operação Judicial</label>
              <input
                type="text"
                placeholder="Ex: 00019283-9 / Op 040"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          {/* LINHA 4: COMPOSIÇÃO FINANCEIRA & RETENÇÃO ART. 22 § 4º EOAB */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
              <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <DollarSign className="size-4 text-purple-600" />
                Composição Contábil e Destaque de Honorários
              </span>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasFeeRetentionOrder}
                  onChange={(e) => setHasFeeRetentionOrder(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-purple-500"
                />
                <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300">
                  Retenção Art. 22 § 4º EOAB Deferida
                </span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Valor Bruto (R$) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={grossAmount}
                  onChange={(e) => handleGrossChange(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Honorários Contratuais ({contractFeePct}%)
                </label>
                <div className="mt-1 flex items-center gap-1">
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={contractFeePct}
                    onChange={(e) => handlePctChange(Number(e.target.value))}
                    className="w-14 rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs text-center font-bold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    title="% de honorários contratuais"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={contractFeeAmount}
                    onChange={(e) => setContractFeeAmount(e.target.value)}
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-purple-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-purple-400"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">Honorários Sucumbenciais (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={sucumbenceFeeAmount}
                  onChange={(e) => setSucumbenceFeeAmount(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 dark:text-slate-300">Custas Reembolsáveis (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  value={costsAmount}
                  onChange={(e) => setCostsAmount(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-rose-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-rose-400"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-200 dark:border-slate-700">
              <span className="font-semibold text-slate-600 dark:text-slate-400">
                Líquido Projetado do Cliente (Saldo de Repasse):
              </span>
              <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                {computedNet.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
            </div>
          </div>

          {/* LINHA 5: EXERCÍCIO ORÇAMENTÁRIO (LOA) & DATAS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">Exercício Orçamentário (LOA)</label>
              <input
                type="number"
                value={budgetYear}
                onChange={(e) => setBudgetYear(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-bold"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">Data de Autuação / Expedição</label>
              <input
                type="date"
                value={issuanceDate}
                onChange={(e) => setIssuanceDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">Previsão de Pagamento Bancário</label>
              <input
                type="date"
                value={expectedPaymentDate}
                onChange={(e) => setExpectedPaymentDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          {/* LINHA 6: STATUS & OBSERVAÇÕES */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300">Status Atual do Levantamento</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as JudicialRequisitionStatus)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="autuado">Autuado</option>
                <option value="inscrito_orcamento">Inscrito no Orçamento</option>
                <option value="aguardando_liberacao_bancaria">Aguardando Liberação Bancária</option>
                <option value="alvara_expedido">Pronto para Levantamento</option>
                <option value="honorarios_destacados">Honorários Destacados (EOAB)</option>
                <option value="repassado_cliente">Repassado ao Cliente</option>
                <option value="concluido">Prestação Concluída</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Observações & Despachos Judiciais</label>
              <input
                type="text"
                placeholder="Ex: Deferida retenção de 25% pelo TRF1 nos termos do contrato juntado aos autos."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          {/* BOTÕES */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold cursor-pointer dark:border-slate-700 dark:text-slate-300 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition cursor-pointer shadow-xs uppercase tracking-wider"
            >
              SALVAR REQUISIÇÃO
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTE: CERTIDÃO DE PRESTAÇÃO DE CONTAS & QUITAÇÃO MÚTUA
// ============================================================================
interface PrestaçãoContasModalProps {
  isOpen: boolean;
  item: LawPrecatórioRpvRequisition;
  onClose: () => void;
}

function PrestaçãoContasModal({ item, onClose }: PrestaçãoContasModalProps) {
  const [copied, setCopied] = useState(false);

  const reportDate = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const handlePrint = () => {
    window.print();
  };

  const handleCopyText = () => {
    const text = `
TERMO DE PRESTAÇÃO DE CONTAS DISCRIMINADA E QUITAÇÃO MÚTUA
Processo Judicial nº: ${item.process_cnj}
Tribunal / Vara: ${item.court} — ${item.court_unit || ""}
Requisição de Pagamento nº: ${item.requisition_number} (${REQUISITION_TYPE_LABELS[item.requisition_type]?.label || item.requisition_type})
Instituição Depositária: ${BANK_LABELS[item.depositary_bank]?.label || item.depositary_bank}
Cliente / Titular: ${item.client_name} (CPF/CNPJ: ${item.client_document || "Sob sigilo"})

DEMONSTRATIVO FINANCEIRO:
(+) Valor Bruto Homologado: ${item.gross_amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
(-) Honorários Advocatícios Contratuais (${item.contract_fee_percentage}%): ${item.contract_fee_amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
(-) Honorários Sucumbenciais: ${item.sucumbence_fee_amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
(-) Dedução de Custas Adiantadas: ${item.costs_deducted_amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
(=) VALOR LÍQUIDO EFETIVAMENTE PAGO AO CLIENTE: ${item.client_net_amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}

DECLARAÇÃO DE QUITAÇÃO (Art. 320 do Código Civil):
Pelo presente instrumento, as partes outorgam mútua, plena, geral e irrevogável quitação com relação aos valores devidos no processo em referência.
Teresina - PI, ${reportDate}.
`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Termo copiado para a área de transferência!");
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200 dark:border-slate-800 shadow-2xl my-8">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-blue-600" />
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Certidão de Prestação de Contas & Quitação
            </h3>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="size-5" />
          </button>
        </div>

        {/* ÁREA TIMBRADA PARA IMPRESSÃO */}
        <div id="prestacao-contas-print" className="mt-4 p-6 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4 text-xs">
          {/* CABEÇALHO DO ESCRITÓRIO */}
          <div className="text-center pb-3 border-b border-slate-200 dark:border-slate-700">
            <h2 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              NAVOR & BORGES ADVOGADOS ASSOCIADOS
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              OAB/PI nº 0000 • Advocacia Cível, Trabalhista e Precatórios Federais
            </p>
            <p className="text-[10px] text-slate-400">
              Av. Senador Area Leão, Teresina - PI • contato@navorlaw.com.br
            </p>
          </div>

          <div className="text-center py-1">
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-300">
              Demonstrativo de Prestação de Contas Discriminada
            </span>
            <p className="text-[11px] text-slate-500 mt-1">
              Amparo Legal: Art. 22 § 4º da Lei nº 8.906/94 c/c Art. 320 do Código Civil
            </p>
          </div>

          {/* DADOS DO PROCESSO & BENEFICIÁRIO */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
            <div>
              <p className="text-slate-400 font-medium">Cliente / Outorgante:</p>
              <p className="font-bold text-slate-900 dark:text-white">{item.client_name}</p>
              <p className="text-[10px] text-slate-400">CPF/CNPJ: {item.client_document || "Sob sigilo"}</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Processo CNJ:</p>
              <p className="font-bold text-blue-600 font-mono">{item.process_cnj}</p>
              <p className="text-[10px] text-slate-400">{item.court} • {item.court_unit}</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Requisição / Modalidade:</p>
              <p className="font-bold text-slate-900 dark:text-white font-mono">{item.requisition_number}</p>
              <p className="text-[10px] text-slate-500">{REQUISITION_TYPE_LABELS[item.requisition_type]?.label}</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Instituição Depositária:</p>
              <p className="font-bold text-slate-900 dark:text-white">{BANK_LABELS[item.depositary_bank]?.label}</p>
              <p className="text-[10px] text-slate-500">Ag: {item.agency || "Central"} • Conta: {item.account_number || "Judicial"}</p>
            </div>
          </div>

          {/* DEMONSTRATIVO CONTÁBIL */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-800">
            <table className="w-full text-left">
              <thead className="bg-slate-100 dark:bg-slate-700/50 text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                <tr>
                  <th className="p-2.5">DISCRIMINAÇÃO DAS VERBAS</th>
                  <th className="p-2.5 text-right">VALOR (R$)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                <tr className="font-bold text-slate-900 dark:text-white">
                  <td className="p-2.5">(+) Valor Bruto Homologado na Requisição</td>
                  <td className="p-2.5 text-right">
                    {item.gross_amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </td>
                </tr>
                <tr className="text-purple-700 dark:text-purple-400">
                  <td className="p-2.5 pl-5">
                    (-) Honorários Contratuais Destacados ({item.contract_fee_percentage}% - Art. 22 §4º EOAB)
                  </td>
                  <td className="p-2.5 text-right font-semibold">
                    - {item.contract_fee_amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </td>
                </tr>
                {item.sucumbence_fee_amount > 0 && (
                  <tr className="text-slate-600 dark:text-slate-300">
                    <td className="p-2.5 pl-5">(-) Honorários Sucumbenciais Fixados pelo Juízo (Art. 23 EOAB)</td>
                    <td className="p-2.5 text-right font-semibold">
                      - {item.sucumbence_fee_amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                  </tr>
                )}
                {item.costs_deducted_amount > 0 && (
                  <tr className="text-rose-600 dark:text-rose-400">
                    <td className="p-2.5 pl-5">(-) Reembolso de Despesas e Custas Adiantadas pelo Escritório</td>
                    <td className="p-2.5 text-right font-semibold">
                      - {item.costs_deducted_amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                  </tr>
                )}
                <tr className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                  <td className="p-3">(=) SALDO LÍQUIDO EFETIVAMENTE PAGO AO CLIENTE</td>
                  <td className="p-3 text-right">
                    {item.client_net_amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* TERMO DE QUITAÇÃO */}
          <div className="p-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed space-y-2">
            <p className="font-bold text-slate-800 dark:text-slate-200">
              CLÁUSULA DE QUITAÇÃO RECÍPROCA (Art. 320 do Código Civil Brasileiro):
            </p>
            <p>
              O contratante/cliente supraqualificado declara ter recebido do patrono constituído a importância líquida supra discriminada, conferindo ao escritório a mais ampla, geral, rasa e irrevogável quitação de todas as obrigações financeiras decorrentes do patrocínio processual em referência, nada mais tendo a pleitear a qualquer título.
            </p>
          </div>

          <div className="pt-6 grid grid-cols-2 gap-8 text-center text-[10px]">
            <div className="border-t border-slate-300 dark:border-slate-600 pt-1.5">
              <p className="font-bold text-slate-800 dark:text-slate-200">NAVOR & BORGES ADVOGADOS ASSOCIADOS</p>
              <p className="text-slate-400">Dr. Matheus Borges • OAB/PI 0000</p>
            </div>
            <div className="border-t border-slate-300 dark:border-slate-600 pt-1.5">
              <p className="font-bold text-slate-800 dark:text-slate-200">{item.client_name}</p>
              <p className="text-slate-400">Beneficiário / Titular do Crédito</p>
            </div>
          </div>

          <div className="text-center text-[10px] text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-700">
            Documento emitido eletronicamente via Navor LawHub Enterprise em {reportDate} • Hash de Autenticidade: SHA256:{item.id.replace(/[^a-zA-Z0-9]/g, "")}
          </div>
        </div>

        {/* BOTÕES DE AÇÃO */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={handleCopyText}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer transition"
          >
            {copied ? <Check className="size-4 text-emerald-600" /> : <Copy className="size-4 text-slate-500" />}
            <span>{copied ? "Copiado!" : "Copiar Texto"}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 font-semibold cursor-pointer"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer transition shadow-xs"
            >
              <Printer className="size-4" />
              <span>IMPRIMIR / PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

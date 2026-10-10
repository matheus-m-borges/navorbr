import { useState, useEffect, useMemo } from "react";
import { GlassCard, PrimaryButton, GhostButton } from "@/components/navor-rephub/ui";
import {
  CheckCircle2,
  DollarSign,
  FileText,
  Printer,
  Plus,
  Building2,
  Calendar,
  AlertCircle,
  Download,
  Trash2,
  ShieldAlert,
  Percent,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface MedicaoItem {
  id: string;
  stageName: string;
  unit: string;
  quantityContract: number;
  unitPrice: number;
  prevPercentage: number;
  currentPercentage: number;
  currentValue: number;
}

export interface BoletimMedicao {
  id: string;
  obraId: string;
  code: string; // Ex: BM #01, BM #02
  contractorName: string;
  contractorCnpj: string;
  contractService: string;
  periodStart: string;
  periodEnd: string;
  grossAmount: number;
  retentionPct: number;
  retentionAmount: number;
  netAmount: number;
  status: "elaboracao" | "analise" | "aprovado" | "pago";
  fiscalNotes: string;
  engineerName: string;
  items: MedicaoItem[];
  createdAt: string;
}

interface BoletimMedicaoManagerProps {
  obraId: string;
  obraName: string;
  stages: any[];
}

export function BoletimMedicaoManager({ obraId, obraName, stages }: BoletimMedicaoManagerProps) {
  const [bms, setBms] = useState<BoletimMedicao[]>([]);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedBm, setSelectedBm] = useState<BoletimMedicao | null>(null);

  // Form State
  const [contractorName, setContractorName] = useState("");
  const [contractorCnpj, setContractorCnpj] = useState("");
  const [contractService, setContractService] = useState("Alvenaria e Estrutura de Concreto Armado");
  const [periodStart, setPeriodStart] = useState(new Date(Date.now() - 15 * 86400000).toISOString().slice(0, 10));
  const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().slice(0, 10));
  const [retentionPct, setRetentionPct] = useState("5");
  const [fiscalNotes, setFiscalNotes] = useState("Serviços medidos in loco conforme prumo, nível e resistência estipulados em memorial.");
  const [engineerName, setEngineerName] = useState("Eng. Responsável Técnico");

  // Itens da medição no formulário
  const [items, setItems] = useState<MedicaoItem[]>([
    {
      id: "it-1",
      stageName: "Fundação e Estrutura",
      unit: "m³",
      quantityContract: 120,
      unitPrice: 650,
      prevPercentage: 30,
      currentPercentage: 60,
      currentValue: 23400,
    },
    {
      id: "it-2",
      stageName: "Alvenaria e Vedações",
      unit: "m²",
      quantityContract: 450,
      unitPrice: 85,
      prevPercentage: 10,
      currentPercentage: 40,
      currentValue: 11475,
    },
  ]);

  // Carregar dados salvos
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`enghub_bms_${obraId}`);
      if (stored) {
        setBms(JSON.parse(stored));
      } else {
        const demoBm: BoletimMedicao = {
          id: `bm-demo-01`,
          obraId,
          code: "BM #01",
          contractorName: "ConstruTech Empreiteira Ltda",
          contractorCnpj: "41.982.341/0001-92",
          contractService: "Fôrmas, Armação e Concretagem Estrutural",
          periodStart: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
          periodEnd: new Date(Date.now() - 15 * 86400000).toISOString().slice(0, 10),
          grossAmount: 34875,
          retentionPct: 5,
          retentionAmount: 1743.75,
          netAmount: 33131.25,
          status: "aprovado",
          fiscalNotes: "Medição conferida e homologada pela fiscalização. Retenção técnica de 5% retida na fonte para garantia de entrega.",
          engineerName: "Eng. Artur Cavalcante",
          items: [
            {
              id: "it-1",
              stageName: "Fundação e Estrutura",
              unit: "m³",
              quantityContract: 120,
              unitPrice: 650,
              prevPercentage: 30,
              currentPercentage: 60,
              currentValue: 23400,
            },
            {
              id: "it-2",
              stageName: "Alvenaria e Vedações",
              unit: "m²",
              quantityContract: 450,
              unitPrice: 85,
              prevPercentage: 10,
              currentPercentage: 40,
              currentValue: 11475,
            },
          ],
          createdAt: new Date().toISOString(),
        };
        setBms([demoBm]);
        localStorage.setItem(`enghub_bms_${obraId}`, JSON.stringify([demoBm]));
      }
    } catch {}
  }, [obraId]);

  const saveBms = (newList: BoletimMedicao[]) => {
    setBms(newList);
    try {
      localStorage.setItem(`enghub_bms_${obraId}`, JSON.stringify(newList));
    } catch {}
  };

  const calculatedGross = useMemo(() => {
    return items.reduce((acc, it) => acc + (it.currentValue || 0), 0);
  }, [items]);

  const calculatedRetention = useMemo(() => {
    const pct = parseFloat(retentionPct) || 0;
    return (calculatedGross * pct) / 100;
  }, [calculatedGross, retentionPct]);

  const calculatedNet = calculatedGross - calculatedRetention;

  const handleUpdateItem = (idx: number, patch: Partial<MedicaoItem>) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const updated = { ...item, ...patch };
        const qtd = updated.quantityContract || 0;
        const price = updated.unitPrice || 0;
        const pct = updated.currentPercentage || 0;
        updated.currentValue = qtd * price * (pct / 100);
        return updated;
      })
    );
  };

  // Totais Gerais
  const totalMeasured = sumAmounts(bms, "grossAmount");
  const totalRetained = sumAmounts(bms, "retentionAmount");
  const totalNet = sumAmounts(bms, "netAmount");

  function sumAmounts(list: BoletimMedicao[], field: keyof BoletimMedicao): number {
    return list.reduce((acc, cur) => acc + (Number(cur[field]) || 0), 0);
  }

  const handleCreateBm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contractorName.trim()) {
      toast.error("Informe a Razão Social ou nome do empreiteiro.");
      return;
    }
    if (items.length === 0 || calculatedGross <= 0) {
      toast.error("A medição deve conter ao menos um item com valor medido.");
      return;
    }

    const code = `BM #${String(bms.length + 1).padStart(2, "0")}`;
    const newBm: BoletimMedicao = {
      id: `bm-${Date.now()}`,
      obraId,
      code,
      contractorName: contractorName.trim(),
      contractorCnpj: contractorCnpj.trim() || "00.000.000/0001-00",
      contractService: contractService.trim(),
      periodStart,
      periodEnd,
      grossAmount: calculatedGross,
      retentionPct: parseFloat(retentionPct) || 0,
      retentionAmount: calculatedRetention,
      netAmount: calculatedNet,
      status: "aprovado",
      fiscalNotes: fiscalNotes.trim(),
      engineerName: engineerName.trim(),
      items: [...items],
      createdAt: new Date().toISOString(),
    };

    const updated = [newBm, ...bms];
    saveBms(updated);
    toast.success(`${code} cadastrado e aprovado com sucesso!`);
    setIsNewModalOpen(false);
    setContractorName("");
    setContractorCnpj("");
  };

  const handleApproveBm = (id: string) => {
    const updated = bms.map((b) => (b.id === id ? { ...b, status: "pago" as const } : b));
    saveBms(updated);
    toast.success("Boletim de Medição liquidado e liberado para o financeiro!");
    if (selectedBm?.id === id) {
      setSelectedBm({ ...selectedBm, status: "pago" });
    }
  };

  const handleDeleteBm = (id: string) => {
    if (!confirm("Deseja realmente remover este Boletim de Medição?")) return;
    const updated = bms.filter((b) => b.id !== id);
    saveBms(updated);
    if (selectedBm?.id === id) setSelectedBm(null);
    toast.success("Boletim excluído.");
  };

  const handleExportCsv = () => {
    const headers = [
      "Boletim",
      "Empreiteiro / Fornecedor",
      "CNPJ",
      "Serviço Contratado",
      "Período Início",
      "Período Fim",
      "Valor Bruto (R$)",
      "Retenção (%)",
      "Valor Retido (R$)",
      "Líquido Liberado (R$)",
      "Status",
    ];

    const rows = bms.map((b) => [
      b.code,
      b.contractorName,
      b.contractorCnpj,
      b.contractService,
      b.periodStart,
      b.periodEnd,
      b.grossAmount.toFixed(2).replace(".", ","),
      b.retentionPct.toFixed(2).replace(".", ","),
      b.retentionAmount.toFixed(2).replace(".", ","),
      b.netAmount.toFixed(2).replace(".", ","),
      b.status.toUpperCase(),
    ]);

    rows.push([
      "TOTAL GERAL",
      "",
      "",
      "",
      "",
      "",
      totalMeasured.toFixed(2).replace(".", ","),
      "",
      totalRetained.toFixed(2).replace(".", ","),
      totalNet.toFixed(2).replace(".", ","),
      "APURADO",
    ]);

    const csvContent = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\r\n");

    const blob = new Blob([`\uFEFF${csvContent}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `boletins-medicao-${obraName.toLowerCase().replace(/\s+/g, "-")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Boletins de Medição exportados com sucesso em CSV Excel.");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="font-display font-bold text-lg text-white flex items-center gap-2">
            <CheckCircle2 className="size-5 text-emerald-400" />
            Boletins de Medição de Empreiteiros e Terceiros
          </h3>
          <p className="text-xs text-muted-foreground">
            Aferição de avanço físico de mão de obra contratada, controle de retenções contratuais e liberação para pagamento
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white hover:bg-white/10 transition cursor-pointer"
          >
            <Download className="size-4 text-emerald-400" />
            <span>Exportar CSV</span>
          </button>
          <button
            type="button"
            onClick={() => setIsNewModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gold px-3.5 py-2 text-xs font-bold text-background hover:bg-yellow-400 transition shadow-xs cursor-pointer"
          >
            <Plus className="size-4" />
            <span>Novo Boletim</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Financeiros da Medição */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <GlassCard className="p-3.5 flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Total Medido (Bruto)
          </span>
          <div className="mt-1 font-display text-xl font-bold text-white font-mono">
            R$ {totalMeasured.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-muted-foreground">{bms.length} medição(ões)</span>
        </GlassCard>

        <GlassCard className="p-3.5 flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
            Retenção Técnica
          </span>
          <div className="mt-1 font-display text-xl font-bold text-amber-400 font-mono">
            R$ {totalRetained.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-amber-400/80">Garantia pós-obra retida</span>
        </GlassCard>

        <GlassCard className="p-3.5 flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
            Líquido Liberado
          </span>
          <div className="mt-1 font-display text-xl font-bold text-emerald-400 font-mono">
            R$ {totalNet.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-emerald-400/80">Apto a pagamento</span>
        </GlassCard>

        <GlassCard className="p-3.5 flex flex-col justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Status da Fiscalização
          </span>
          <div className="mt-1 flex items-center gap-1.5 text-xs font-bold text-emerald-400">
            <CheckCircle2 className="size-4" />
            <span>100% Homologado</span>
          </div>
          <span className="text-[10px] text-muted-foreground">Conferência in loco</span>
        </GlassCard>
      </div>

      {/* Lista dos Boletins de Medição */}
      <div className="space-y-3">
        {bms.length === 0 ? (
          <GlassCard className="p-8 text-center space-y-2">
            <FileText className="size-10 text-gold/40 mx-auto" />
            <h4 className="text-sm font-bold text-white">Nenhum Boletim de Medição cadastrado</h4>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Clique em "Novo Boletim" para aferir os serviços dos empreiteiros, calcular a retenção técnica e emitir o espelho de pagamento.
            </p>
          </GlassCard>
        ) : (
          bms.map((bm) => (
            <GlassCard
              key={bm.id}
              className="p-5 space-y-4 hover:border-gold/30 transition border-white/5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-display font-black text-xs">
                    {bm.code}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{bm.contractorName}</span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                          bm.status === "pago"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                        )}
                      >
                        {bm.status === "pago" ? "Liquidado no Financeiro" : "Aprovado pela Fiscalização"}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      CNPJ: {bm.contractorCnpj} • {bm.contractService} • Período:{" "}
                      {new Date(bm.periodStart + "T12:00:00").toLocaleDateString("pt-BR")} a{" "}
                      {new Date(bm.periodEnd + "T12:00:00").toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto">
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                      Valor Líquido
                    </span>
                    <span className="font-display font-bold text-base text-emerald-400 font-mono">
                      R$ {bm.netAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedBm(bm)}
                    className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-white/10 transition cursor-pointer"
                  >
                    Espelho / Detalhes
                  </button>

                  {bm.status !== "pago" && (
                    <button
                      type="button"
                      onClick={() => handleApproveBm(bm.id)}
                      className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition cursor-pointer"
                    >
                      Liquidar
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDeleteBm(bm.id)}
                    className="text-white/40 hover:text-rose-400 p-1 transition"
                    title="Excluir Medição"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>

              {/* Itens Medidos */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/5 text-[10px] font-bold uppercase text-muted-foreground">
                    <tr>
                      <th className="p-2">Item / Etapa</th>
                      <th className="p-2 text-center">Unid.</th>
                      <th className="p-2 text-right">Qtd Contratada</th>
                      <th className="p-2 text-right">Preço Unit.</th>
                      <th className="p-2 text-center">Medição Ant.</th>
                      <th className="p-2 text-center">Medição Atual</th>
                      <th className="p-2 text-right">Total Liberado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {bm.items.map((it) => (
                      <tr key={it.id} className="hover:bg-white/5">
                        <td className="p-2 font-medium text-white">{it.stageName}</td>
                        <td className="p-2 text-center text-muted-foreground">{it.unit}</td>
                        <td className="p-2 text-right font-mono text-white/80">{it.quantityContract}</td>
                        <td className="p-2 text-right font-mono text-white/80">
                          R$ {it.unitPrice.toFixed(2).replace(".", ",")}
                        </td>
                        <td className="p-2 text-center text-muted-foreground font-mono">{it.prevPercentage}%</td>
                        <td className="p-2 text-center font-bold text-gold font-mono">{it.currentPercentage}%</td>
                        <td className="p-2 text-right font-mono font-bold text-emerald-400">
                          R$ {it.currentValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between text-xs text-muted-foreground pt-1 border-t border-white/5">
                <div>
                  Retenção Contratual ({bm.retentionPct}%):{" "}
                  <strong className="text-amber-400 font-mono">
                    R$ {bm.retentionAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </strong>
                </div>
                <div>
                  Fiscal Técnico: <strong className="text-white">{bm.engineerName}</strong>
                </div>
              </div>
            </GlassCard>
          ))
        )}
      </div>

      {/* Modal Novo Boletim de Medição */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-slate-950 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h4 className="font-display font-bold text-base text-white">
                  Novo Boletim de Medição de Empreiteiro
                </h4>
                <p className="text-xs text-muted-foreground">{obraName}</p>
              </div>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="text-muted-foreground hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateBm} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-muted-foreground block mb-1">
                    Empreiteiro / Razão Social *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Empreiteira Silva & Filhos Ltda"
                    value={contractorName}
                    onChange={(e) => setContractorName(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-gold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-muted-foreground block mb-1">CNPJ / CPF</label>
                  <input
                    type="text"
                    placeholder="00.000.000/0001-00"
                    value={contractorCnpj}
                    onChange={(e) => setContractorCnpj(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-gold focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-muted-foreground block mb-1">Escopo do Serviço</label>
                <input
                  type="text"
                  value={contractService}
                  onChange={(e) => setContractService(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-gold focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-muted-foreground block mb-1">Início da Medição *</label>
                  <input
                    type="date"
                    required
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-gold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-muted-foreground block mb-1">Fim da Medição *</label>
                  <input
                    type="date"
                    required
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-gold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-bold text-muted-foreground block mb-1">Retenção Técnica (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={retentionPct}
                    onChange={(e) => setRetentionPct(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-gold focus:outline-none"
                  />
                </div>
              </div>

              {/* Itens de Medição */}
              <div className="space-y-2">
                <span className="font-bold uppercase tracking-wider text-[10px] text-gold block">
                  Itens e Fases Medidas
                </span>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-2">
                  {items.map((it, idx) => (
                    <div key={it.id} className="grid grid-cols-12 gap-2 items-center text-xs">
                      <div className="col-span-4">
                        <input
                          type="text"
                          value={it.stageName}
                          onChange={(e) => handleUpdateItem(idx, { stageName: e.target.value })}
                          className="w-full rounded bg-black/40 border border-white/10 px-2 py-1 text-white"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          placeholder="Qtd"
                          value={it.quantityContract}
                          onChange={(e) =>
                            handleUpdateItem(idx, { quantityContract: parseFloat(e.target.value) || 0 })
                          }
                          className="w-full rounded bg-black/40 border border-white/10 px-2 py-1 text-white text-right"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          placeholder="Preço Unit"
                          value={it.unitPrice}
                          onChange={(e) =>
                            handleUpdateItem(idx, { unitPrice: parseFloat(e.target.value) || 0 })
                          }
                          className="w-full rounded bg-black/40 border border-white/10 px-2 py-1 text-white text-right"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          placeholder="% Medido"
                          value={it.currentPercentage}
                          onChange={(e) =>
                            handleUpdateItem(idx, { currentPercentage: parseFloat(e.target.value) || 0 })
                          }
                          className="w-full rounded bg-black/40 border border-white/10 px-2 py-1 text-gold text-right font-bold"
                        />
                      </div>
                      <div className="col-span-2 text-right font-mono font-bold text-emerald-400">
                        R$ {it.currentValue.toFixed(2).replace(".", ",")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Resumo dos Valores Calculados */}
              <div className="rounded-lg bg-white/5 p-3 flex flex-wrap items-center justify-between text-xs">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase">Total Bruto Medido</span>
                  <span className="font-bold text-white font-mono text-sm">
                    R$ {calculatedGross.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase">
                    Retenção Técnica ({retentionPct}%)
                  </span>
                  <span className="font-bold text-amber-400 font-mono text-sm">
                    - R$ {calculatedRetention.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase">Valor Líquido Aprovado</span>
                  <span className="font-bold text-emerald-400 font-mono text-base">
                    R$ {calculatedNet.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div>
                <label className="font-bold text-muted-foreground block mb-1">
                  Parecer Técnico da Fiscalização
                </label>
                <textarea
                  rows={2}
                  value={fiscalNotes}
                  onChange={(e) => setFiscalNotes(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-white focus:border-gold focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="rounded-lg bg-white/10 px-4 py-2 font-bold text-white hover:bg-white/20 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-gold px-4 py-2 font-bold text-background hover:bg-yellow-400 transition cursor-pointer shadow-xs"
                >
                  Salvar e Aprovar Medição
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Visualizador e Impressão Técnica do Boletim */}
      {selectedBm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-slate-950 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="size-5 text-gold" />
                <h4 className="font-display font-bold text-base text-white">
                  Espelho do Boletim de Medição ({selectedBm.code})
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/5 px-2.5 py-1 text-xs font-semibold text-white hover:bg-white/10 transition cursor-pointer"
                >
                  <Printer className="size-3.5 text-gold" />
                  Imprimir / PDF
                </button>
                <button
                  onClick={() => setSelectedBm(null)}
                  className="text-muted-foreground hover:text-white text-sm"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Layout Timbrado */}
            <div className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-white">
              <div className="grid grid-cols-2 gap-4 pb-3 border-b border-white/10">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Obra</span>
                  <span className="font-bold text-sm text-gold">{obraName}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Empreiteiro</span>
                  <span className="font-bold">{selectedBm.contractorName}</span>
                  <span className="text-[10px] text-muted-foreground block">CNPJ: {selectedBm.contractorCnpj}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pb-3 border-b border-white/10 text-center">
                <div className="rounded bg-black/30 p-2">
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Valor Bruto</span>
                  <span className="font-bold font-mono text-sm">
                    R$ {selectedBm.grossAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="rounded bg-black/30 p-2">
                  <span className="text-[10px] text-amber-400 uppercase font-bold block">
                    Retenção ({selectedBm.retentionPct}%)
                  </span>
                  <span className="font-bold font-mono text-sm text-amber-400">
                    - R$ {selectedBm.retentionAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="rounded bg-black/30 p-2">
                  <span className="text-[10px] text-emerald-400 uppercase font-bold block">Valor Líquido</span>
                  <span className="font-bold font-mono text-sm text-emerald-400">
                    R$ {selectedBm.netAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-gold uppercase font-bold block mb-1">
                  Parecer Técnico de Fiscalização
                </span>
                <p className="leading-relaxed text-white/90 bg-black/30 p-2.5 rounded-lg">
                  {selectedBm.fiscalNotes}
                </p>
              </div>

              <div className="pt-4 grid grid-cols-2 gap-6 text-center text-[11px] border-t border-white/10">
                <div>
                  <div className="border-t border-white/20 pt-1 mt-6">
                    <p className="font-bold">{selectedBm.engineerName}</p>
                    <p className="text-[10px] text-muted-foreground">Engenheiro Fiscal da Obra</p>
                  </div>
                </div>
                <div>
                  <div className="border-t border-white/20 pt-1 mt-6">
                    <p className="font-bold">{selectedBm.contractorName}</p>
                    <p className="text-[10px] text-muted-foreground">Representante Legal do Empreiteiro</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedBm(null)}
                className="rounded-lg bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20 transition cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

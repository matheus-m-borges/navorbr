import { useState, useEffect, useRef } from "react";
import {
  X,
  Check,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Play,
  Printer,
  HelpCircle,
  Clock,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Building,
  Save,
  FileSpreadsheet,
  Layers,
  Users,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CalculatorItem } from "./calculator-catalog-data";
import {
  formatCurrency,
  formatPercent,
  CalculatorDraft,
  CalculatorDraftService,
} from "@/products/lawhub/domain/calculator-utils";
import { CalculationEngine } from "@/modules/legal-calculator/engine/CalculationEngine";
import { LegalRuleResolver } from "@/modules/legal-calculator/engine/LegalRuleResolver";
import { LegalCalculatorService } from "@/lib/lawhub/legal-calculator-service";
import {
  CalculationRecord,
  CalculationResult,
  LegalArea,
  LegalRuleResolution,
} from "@/modules/legal-calculator/types";

interface LegalCalculationModalProps {
  isOpen: boolean;
  onClose: () => void;
  calculatorItem: CalculatorItem | null;
  draftToResume: CalculatorDraft | null;
  onSavedSuccess?: (record: CalculationRecord) => Promise<void> | void;
}

export function LegalCalculationModal({
  isOpen,
  onClose,
  calculatorItem,
  draftToResume,
  onSavedSuccess,
}: LegalCalculationModalProps) {
  // Stepper
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);

  // Campos Básicos
  const [calcName, setCalcName] = useState("");
  const [processNumber, setProcessNumber] = useState("");
  const [clientName, setClientName] = useState("");
  const [tribunal, setTribunal] = useState("TJPI");
  const [legalArea, setLegalArea] = useState<LegalArea>("Civel");
  const [obligationNature, setObligationNature] = useState("");
  const [principalAmount, setPrincipalAmount] = useState<number>(100000);
  const [dueDate, setDueDate] = useState("2024-09-01");
  const [citationDate, setCitationDate] = useState("2024-09-01");
  const [finalDate, setFinalDate] = useState("2025-06-01");
  const [penaltyPercent, setPenaltyPercent] = useState<number>(0);
  const [honoraryPercent, setHonoraryPercent] = useState<number>(10);

  // Campos Específicos por Tipo (Divórcio, Pensão, Bancário)
  const [divorceAssets, setDivorceAssets] = useState<
    Array<{ id: string; name: string; value: number; assignedTo: "conjuge1" | "conjuge2" | "venda" }>
  >([
    { id: "1", name: "Imóvel Residencial (Casa)", value: 450000, assignedTo: "conjuge1" },
    { id: "2", name: "Veículo Automotor", value: 95000, assignedTo: "conjuge2" },
    { id: "3", name: "Aplicações Financeiras / Poupança", value: 120000, assignedTo: "venda" },
  ]);
  const [alimonyIncome, setAlimonyIncome] = useState<number>(8500);
  const [alimonyExpenses, setAlimonyExpenses] = useState<number>(3200);
  const [revisionalContractRate, setRevisionalContractRate] = useState<number>(2.45);
  const [revisionalBacenRate, setRevisionalBacenRate] = useState<number>(1.62);

  // IA
  const [decisionDocumentText, setDecisionDocumentText] = useState(
    `Vistos etc. Julgo PROCEDENTE a ação ordinária para condenar a parte requerida ao pagamento da obrigação principal atualizada pelo IPCA a contar do vencimento, com incidência de juros de mora conforme o art. 406 do Código Civil a partir da citação, além de honorários de 10%.`
  );
  const [extractedParameters, setExtractedParameters] = useState<
    Array<{
      key: string;
      label: string;
      suggestedValue: any;
      status: "CONFIRMED" | "EDITED" | "IGNORED" | "PENDING";
      confidence: "HIGH" | "MEDIUM" | "LOW";
      rationale: string;
    }>
  >([]);

  // Resolução & Resultado
  const [activeResolution, setActiveResolution] = useState<LegalRuleResolution | null>(null);
  const [activeResult, setActiveResult] = useState<CalculationResult | null>(null);
  const [whyRuleModalOpen, setWhyRuleModalOpen] = useState(false);
  const [lastAutoSaveTime, setLastAutoSaveTime] = useState<string>("");

  const isInitializedRef = useRef(false);

  // Carregar Rascunho ou Dados Iniciais
  useEffect(() => {
    if (!isOpen) {
      isInitializedRef.current = false;
      return;
    }

    if (draftToResume) {
      // Retomar do Rascunho
      setWizardStep(draftToResume.wizardStep || 1);
      setCalcName(draftToResume.data.calcName || "");
      setProcessNumber(draftToResume.data.processNumber || "");
      setClientName(draftToResume.data.clientName || "");
      setTribunal(draftToResume.data.tribunal || "TJPI");
      setObligationNature(draftToResume.data.obligationNature || "");
      setPrincipalAmount(draftToResume.data.principalAmount || 100000);
      setDueDate(draftToResume.data.dueDate || "2024-09-01");
      setCitationDate(draftToResume.data.citationDate || "2024-09-01");
      setFinalDate(draftToResume.data.finalDate || "2025-06-01");
      setPenaltyPercent(draftToResume.data.penaltyPercent || 0);
      setHonoraryPercent(draftToResume.data.honoraryPercent || 10);
      if (draftToResume.data.decisionDocumentText) {
        setDecisionDocumentText(draftToResume.data.decisionDocumentText);
      }
      if (draftToResume.data.divorceAssets) {
        setDivorceAssets(draftToResume.data.divorceAssets);
      }
      if (draftToResume.data.alimonyIncome) setAlimonyIncome(draftToResume.data.alimonyIncome);
      if (draftToResume.data.alimonyExpenses) setAlimonyExpenses(draftToResume.data.alimonyExpenses);
      if (draftToResume.data.revisionalContractRate) setRevisionalContractRate(draftToResume.data.revisionalContractRate);
      if (draftToResume.data.revisionalBacenRate) setRevisionalBacenRate(draftToResume.data.revisionalBacenRate);

      setLastAutoSaveTime(new Date(draftToResume.updatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
      toast.success("Rascunho recuperado com sucesso!");
    } else if (calculatorItem) {
      // Novo Cálculo Inicial
      setWizardStep(1);
      setCalcName(`${calculatorItem.name} — ${new Date().toLocaleDateString("pt-BR")}`);
      setObligationNature(calculatorItem.defaultObligation);
      setLegalArea(calculatorItem.defaultArea as LegalArea);
      setPrincipalAmount(calculatorItem.id === "divorcio" ? 665000 : 100000);
      setActiveResult(null);
      setActiveResolution(null);
    }

    isInitializedRef.current = true;
  }, [isOpen, draftToResume, calculatorItem]);

  // Auto-Save do Rascunho no LocalStorage
  useEffect(() => {
    if (!isOpen || !isInitializedRef.current || wizardStep === 4) return;

    const timer = setTimeout(() => {
      const calcId = calculatorItem?.id || draftToResume?.calculatorId || "geral";
      const calcTitle = calculatorItem?.name || draftToResume?.calculatorName || "Cálculo Jurídico";

      const draft: CalculatorDraft = {
        calculatorId: calcId,
        calculatorName: calcTitle,
        legalArea: (legalArea as string) || "Civel",
        wizardStep,
        updatedAt: new Date().toISOString(),
        data: {
          calcName,
          processNumber,
          clientName,
          tribunal,
          obligationNature,
          principalAmount,
          dueDate,
          citationDate,
          finalDate,
          penaltyPercent,
          honoraryPercent,
          decisionDocumentText,
          divorceAssets,
          alimonyIncome,
          alimonyExpenses,
          revisionalContractRate,
          revisionalBacenRate,
        },
      };

      CalculatorDraftService.saveDraft(draft);
      setLastAutoSaveTime(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
    }, 600);

    return () => clearTimeout(timer);
  }, [
    isOpen,
    wizardStep,
    calcName,
    processNumber,
    clientName,
    tribunal,
    legalArea,
    obligationNature,
    principalAmount,
    dueDate,
    citationDate,
    finalDate,
    penaltyPercent,
    honoraryPercent,
    decisionDocumentText,
    divorceAssets,
    alimonyIncome,
    alimonyExpenses,
    revisionalContractRate,
    revisionalBacenRate,
    calculatorItem,
    draftToResume,
  ]);

  if (!isOpen) return null;

  // Handlers
  const handleRunAiExtraction = () => {
    toast.loading("IA analisando termos e dispositivo...", { id: "ai-extract" });
    setTimeout(() => {
      const extracted = LegalCalculatorService.extractParametersFromText(decisionDocumentText);
      setExtractedParameters(extracted);
      toast.success("Parâmetros jurídicos identificados com sucesso!", { id: "ai-extract" });
    }, 600);
  };

  const handleResolveLegalRule = () => {
    const resolution = LegalRuleResolver.resolve({
      calculationType: "CumprimentoDeSentenca",
      legalArea,
      obligationNature: obligationNature || "Obrigação Judicial",
      dueDate,
      citationDate,
      paymentDate: finalDate,
      tribunal,
    });
    setActiveResolution(resolution);
    setWizardStep(3);
  };

  const handleExecuteCalculation = async () => {
    let effectiveResolution = activeResolution;
    if (!effectiveResolution) {
      effectiveResolution = LegalRuleResolver.resolve({
        calculationType: "CumprimentoDeSentenca",
        legalArea,
        obligationNature: obligationNature || "Obrigação Judicial",
        dueDate,
        citationDate,
        paymentDate: finalDate,
        tribunal,
      });
      setActiveResolution(effectiveResolution);
    }

    try {
      const newCalcId = `calc-${Date.now()}`;
      const effectivePrincipal =
        calculatorItem?.id === "divorcio"
          ? divorceAssets.reduce((sum, item) => sum + (Number(item.value) || 0), 0)
          : principalAmount;

      const res = CalculationEngine.execute({
        calculationId: newCalcId,
        items: [
          {
            id: "item-1",
            description: obligationNature || "Obrigação Principal",
            originalAmount: effectivePrincipal,
            referenceDate: dueDate,
            correctionStart: dueDate,
            interestStart: citationDate || dueDate,
            finalDate,
            penaltyPercent,
            honoraryPercent,
          },
        ],
        resolution: effectiveResolution,
        penaltyPercent,
        honoraryPercent,
      });

      setActiveResult(res);

      const record: CalculationRecord = {
        id: newCalcId,
        tenantId: "tenant-demo",
        userId: "user-advogado",
        clientName: clientName || "Cliente Geral",
        processNumber: processNumber || "0800000-00.2024.8.18.0000",
        calculationName: calcName || `${calculatorItem?.name || "Cálculo"} - ${clientName || "Geral"}`,
        legalArea,
        calculationType: "Execucao",
        obligationNature: obligationNature || "Dívida Civil",
        tribunal,
        state: "PI",
        status: "VALIDATED",
        validationStatus: "VALIDATED",
        originalAmount: effectivePrincipal,
        totalResult: res.total,
        engineVersion: CalculationEngine.ENGINE_VERSION,
        deterministicHash: res.deterministicHash,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        items: [
          {
            description: obligationNature || "Obrigação Principal",
            originalAmount: effectivePrincipal,
            referenceDate: dueDate,
            finalDate,
          },
        ],
        payments: [],
        confirmedParameters: {
          penaltyPercent,
          honoraryPercent,
        },
        resolution: effectiveResolution,
        result: res,
      };

      // Persistir no acervo da conta antes de apresentar a conclusão.
      if (onSavedSuccess) await onSavedSuccess(record);

      // Limpar rascunho temporário após cálculo concluído com sucesso
      CalculatorDraftService.clearDraft();

      setWizardStep(4);
      toast.success("Demonstrativo homologado e salvo na sua conta!");
    } catch (e: any) {
      toast.error(`Falha no cálculo: ${e.message}`);
    }
  };

  const handleClose = () => {
    if (wizardStep < 4 && (clientName || calcName || principalAmount > 0)) {
      toast.info("Rascunho salvo automaticamente. Você poderá continuar quando quiser.", {
        icon: <Clock className="size-4 text-amber-500" />,
      });
    }
    onClose();
  };

  // Cálculos auxiliares para Divórcio
  const totalDivorceAssets = divorceAssets.reduce((sum, b) => sum + (Number(b.value) || 0), 0);
  const meacaoValor = totalDivorceAssets / 2;
  const conjuge1Total = divorceAssets.filter((b) => b.assignedTo === "conjuge1").reduce((sum, b) => sum + Number(b.value), 0);
  const conjuge2Total = divorceAssets.filter((b) => b.assignedTo === "conjuge2").reduce((sum, b) => sum + Number(b.value), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-3 sm:p-5 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-blue-600 text-white shadow-xs">
              <Scale className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {calculatorItem?.name || draftToResume?.calculatorName || "Calculadora Jurídica"}
                </h3>
                {calculatorItem?.hasIa && (
                  <span className="inline-flex items-center gap-1 rounded bg-purple-100 px-2 py-0.5 text-[10px] font-black text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                    <Sparkles className="size-3" />
                    IA INTEGRADA
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {calculatorItem?.description || "Motor jurídico de liquidação com precisão legal"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {lastAutoSaveTime && wizardStep < 4 && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700">
                <Check className="size-3 text-emerald-500" />
                Rascunho salvo às {lastAutoSaveTime}
              </span>
            )}
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 transition"
              title="Fechar (seu rascunho continuará salvo)"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Stepper Progress Indicator */}
        <div className="border-b border-slate-100 bg-white px-6 py-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            {[
              { step: 1, label: "1. Fatos & Dados" },
              { step: 2, label: "2. Documento & IA" },
              { step: 3, label: "3. Enquadramento Legal" },
              { step: 4, label: "4. Demonstrativo Homologado" },
            ].map((s) => (
              <div key={s.step} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (s.step < wizardStep) setWizardStep(s.step as any);
                  }}
                  disabled={s.step > wizardStep}
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full text-xs font-bold transition",
                    wizardStep === s.step
                      ? "bg-blue-600 text-white shadow-xs ring-2 ring-blue-600/30"
                      : wizardStep > s.step
                      ? "bg-emerald-500 text-white cursor-pointer hover:bg-emerald-600"
                      : "bg-slate-100 text-slate-400 dark:bg-slate-800 cursor-not-allowed"
                  )}
                >
                  {wizardStep > s.step ? <Check className="size-4" /> : s.step}
                </button>
                <span
                  className={cn(
                    "text-xs hidden sm:inline font-medium",
                    wizardStep === s.step ? "text-blue-600 font-bold dark:text-blue-400" : "text-slate-500"
                  )}
                >
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Conteúdo Dinâmico do Modal com Rolagem */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* ========================================================================= */}
          {/* ETAPA 1: Identificação dos Fatos e Parâmetros                             */}
          {/* ========================================================================= */}
          {wizardStep === 1 && (
            <div className="space-y-5">
              <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 text-xs text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200">
                <p>
                  <strong>Preenchimento Guiado:</strong> Os dados inseridos são salvos automaticamente no seu navegador. Se precisar consultar outros documentos e fechar esta tela, você poderá continuar exatamente de onde parou.
                </p>
              </div>

              {/* Informações Gerais */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Título do Cálculo / Descrição do Procedimento *
                  </label>
                  <input
                    type="text"
                    value={calcName}
                    onChange={(e) => setCalcName(e.target.value)}
                    placeholder="Ex: Partilha de Bens e Alimentos — Processo X"
                    className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Cliente / Requerente *
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Ex: Dra. Mariana Costa"
                    className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Número do Processo (CNJ)
                  </label>
                  <input
                    type="text"
                    value={processNumber}
                    onChange={(e) => setProcessNumber(e.target.value)}
                    placeholder="0000000-00.0000.0.00.0000"
                    className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs font-mono text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Tribunal Competente
                  </label>
                  <select
                    value={tribunal}
                    onChange={(e) => setTribunal(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="TJPI">TJPI — Tribunal de Justiça do Piauí</option>
                    <option value="TJSP">TJSP — Tribunal de Justiça de São Paulo</option>
                    <option value="TJMA">TJMA — Tribunal de Justiça do Maranhão</option>
                    <option value="TRF1">TRF1 — Tribunal Regional Federal 1ª Região</option>
                    <option value="TRT22">TRT22 — Tribunal Regional do Trabalho 22ª Região</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Natureza da Obrigação
                  </label>
                  <input
                    type="text"
                    value={obligationNature}
                    onChange={(e) => setObligationNature(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              {/* CAMPOS ESPECÍFICOS: DIVÓRCIO & PARTILHA DE BENS */}
              {calculatorItem?.id === "divorcio" && (
                <div className="rounded-xl border border-purple-200 bg-purple-50/40 p-5 dark:border-purple-900/50 dark:bg-purple-950/20 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="size-4 text-purple-600" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-purple-900 dark:text-purple-300">
                        Relação de Bens do Casal & Partilha
                      </h4>
                    </div>
                    <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">
                      Monte-Mor Total: <strong>{formatCurrency(totalDivorceAssets)}</strong> | Meação (50%): <strong>{formatCurrency(meacaoValor)}</strong>
                    </span>
                  </div>

                  <div className="space-y-2">
                    {divorceAssets.map((asset, idx) => (
                      <div
                        key={asset.id}
                        className="flex flex-col sm:flex-row items-center gap-2 rounded-lg bg-white p-2.5 shadow-2xs border border-purple-100 dark:bg-slate-800 dark:border-slate-700"
                      >
                        <input
                          type="text"
                          value={asset.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setDivorceAssets((prev) =>
                              prev.map((a) => (a.id === asset.id ? { ...a, name: val } : a))
                            );
                          }}
                          placeholder="Descrição do bem (ex: Apartamento 302)"
                          className="flex-1 rounded border border-slate-200 p-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                        />
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <input
                            type="number"
                            value={asset.value}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setDivorceAssets((prev) =>
                                prev.map((a) => (a.id === asset.id ? { ...a, value: val } : a))
                              );
                            }}
                            placeholder="Valor R$"
                            className="w-28 rounded border border-slate-200 p-1.5 text-xs font-mono font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                          />
                          <select
                            value={asset.assignedTo}
                            onChange={(e) => {
                              const val = e.target.value as any;
                              setDivorceAssets((prev) =>
                                prev.map((a) => (a.id === asset.id ? { ...a, assignedTo: val } : a))
                              );
                            }}
                            className="rounded border border-slate-200 p-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                          >
                            <option value="conjuge1">Cônjuge A</option>
                            <option value="conjuge2">Cônjuge B</option>
                            <option value="venda">Venda / Divisão</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              setDivorceAssets((prev) => prev.filter((a) => a.id !== asset.id));
                            }}
                            className="text-slate-400 hover:text-red-500 p-1"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setDivorceAssets((prev) => [
                          ...prev,
                          {
                            id: String(Date.now()),
                            name: "Novo Bem do Casal",
                            value: 50000,
                            assignedTo: "venda",
                          },
                        ]);
                      }}
                      className="inline-flex items-center gap-1 text-xs font-bold text-purple-700 dark:text-purple-300 hover:underline pt-1"
                    >
                      <Plus className="size-3.5" />
                      <span>Adicionar Outro Bem à Partilha</span>
                    </button>
                  </div>
                </div>
              )}

              {/* CAMPOS ESPECÍFICOS: PENSÃO ALIMENTÍCIA */}
              {calculatorItem?.id === "pensao" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-purple-200 bg-purple-50/40 p-4 dark:border-purple-900/50 dark:bg-purple-950/20">
                  <div>
                    <label className="text-xs font-bold text-purple-900 dark:text-purple-300">
                      Renda Líquida Comprovada do Alimentante (R$)
                    </label>
                    <input
                      type="number"
                      value={alimonyIncome}
                      onChange={(e) => setAlimonyIncome(Number(e.target.value))}
                      className="mt-1 w-full rounded border border-purple-200 p-2 text-xs font-mono font-bold text-purple-900 dark:border-purple-800 dark:bg-slate-900 dark:text-white"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Deduzidos descontos compulsórios (IRRF e INSS).</p>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-purple-900 dark:text-purple-300">
                      Despesas Essenciais Mensais do Beneficiário (R$)
                    </label>
                    <input
                      type="number"
                      value={alimonyExpenses}
                      onChange={(e) => setAlimonyExpenses(Number(e.target.value))}
                      className="mt-1 w-full rounded border border-purple-200 p-2 text-xs font-mono font-bold text-purple-900 dark:border-purple-800 dark:bg-slate-900 dark:text-white"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Educação, moradia, alimentação e saúde.</p>
                  </div>
                </div>
              )}

              {/* CAMPOS PADRÃO DE ATUALIZAÇÃO / VALORES */}
              {calculatorItem?.id !== "divorcio" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Valor Principal Original (R$) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={principalAmount}
                      onChange={(e) => setPrincipalAmount(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-xs font-mono font-bold text-blue-600 dark:border-slate-700 dark:bg-slate-800 dark:text-blue-400"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Termo Inicial / Vencimento *
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Data da Citação (Juros Moratórios)
                    </label>
                    <input
                      type="date"
                      value={citationDate}
                      onChange={(e) => setCitationDate(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Data Final de Apuração
                    </label>
                    <input
                      type="date"
                      value={finalDate}
                      onChange={(e) => setFinalDate(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* ETAPA 2: Documento da Decisão & Extração IA                               */}
          {/* ========================================================================= */}
          {wizardStep === 2 && (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Análise do Título Executivo / Decisão Judicial
                  </h4>
                  <p className="text-xs text-slate-500">
                    Cole o teor da decisão ou sentença. A IA identificará índices, termos iniciais e honorários sugeridos.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleRunAiExtraction}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-purple-700 transition shrink-0"
                >
                  <Sparkles className="size-3.5" />
                  <span>Extrair Parâmetros com IA</span>
                </button>
              </div>

              <div>
                <textarea
                  rows={5}
                  value={decisionDocumentText}
                  onChange={(e) => setDecisionDocumentText(e.target.value)}
                  placeholder="Cole aqui o trecho do dispositivo da sentença ou cláusula do contrato..."
                  className="w-full rounded-lg border border-slate-200 p-3 text-xs leading-relaxed dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {extractedParameters.length > 0 && (
                <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-4 dark:border-purple-900/40 dark:bg-purple-950/20 space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-purple-600" />
                    <h5 className="text-xs font-bold uppercase text-purple-900 dark:text-purple-300">
                      Parâmetros Extraídos:
                    </h5>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {extractedParameters.map((p) => (
                      <div
                        key={p.key}
                        className="rounded-lg bg-white p-3 border border-purple-100 shadow-2xs dark:bg-slate-800 dark:border-purple-900/60"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{p.label}</span>
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                            {p.status}
                          </span>
                        </div>
                        <p className="text-xs font-mono font-bold text-blue-600 mt-1">
                          {String(p.suggestedValue)}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1">{p.rationale}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* ETAPA 3: Resolução Jurídica & Enquadramento                               */}
          {/* ========================================================================= */}
          {wizardStep === 3 && (
            <div className="space-y-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-950/40 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400">
                      ENQUADRAMENTO LEGAL IDENTIFICADO
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                      {activeResolution?.legalRuleName || "Código Civil Brasileiro (Reforma Lei 14.905/2024)"}
                    </h4>
                  </div>
                  <span className="rounded bg-emerald-100 px-2.5 py-1 text-[11px] font-black text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                    ALTA CONFIANÇA
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="rounded-lg bg-white p-3 border border-slate-200 dark:bg-slate-900 dark:border-slate-800 space-y-1">
                    <span className="text-[10px] uppercase text-slate-400 font-bold">Correção Monetária</span>
                    <p className="font-bold text-slate-900 dark:text-white">IPCA (IBGE SIDRA Oficial)</p>
                    <p className="text-slate-500 text-[11px]">Art. 389 do CC com vigência integral da Lei 14.905/2024.</p>
                  </div>

                  <div className="rounded-lg bg-white p-3 border border-slate-200 dark:bg-slate-900 dark:border-slate-800 space-y-1">
                    <span className="text-[10px] uppercase text-slate-400 font-bold">Juros Moratórios</span>
                    <p className="font-bold text-slate-900 dark:text-white">Taxa Legal BCB (Piso Zero)</p>
                    <p className="text-slate-500 text-[11px]">Art. 406 do CC calculada pelo Banco Central do Brasil.</p>
                  </div>
                </div>

                {/* Acréscimos Processuais */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Multa Processual / Art. 523 CPC (%)
                    </label>
                    <input
                      type="number"
                      value={penaltyPercent}
                      onChange={(e) => setPenaltyPercent(Number(e.target.value))}
                      className="mt-1 w-full rounded border border-slate-200 p-2 text-xs font-mono font-bold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Honorários Sucumbenciais / Executivos (%)
                    </label>
                    <input
                      type="number"
                      value={honoraryPercent}
                      onChange={(e) => setHonoraryPercent(Number(e.target.value))}
                      className="mt-1 w-full rounded border border-slate-200 p-2 text-xs font-mono font-bold dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ETAPA 4: Demonstrativo Homologado & Memória Mês a Mês                    */}
          {/* ========================================================================= */}
          {wizardStep === 4 && activeResult && (
            <div className="space-y-6">
              {/* Card de Resumo do Resultado */}
              <div className="rounded-2xl border border-emerald-500/40 bg-emerald-50/30 p-6 dark:border-emerald-900/60 dark:bg-emerald-950/20 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-emerald-200 pb-4 dark:border-emerald-900/50">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      DEMONSTRATIVO DE CÁLCULO HOMOLOGADO
                    </span>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                      {formatCurrency(activeResult.total)}
                    </h3>
                    <p className="text-[11px] font-mono text-slate-500 mt-1">
                      Hash SHA-256: <strong>{activeResult.deterministicHash || "LHUB-OFICIAL"}</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition"
                    >
                      <Printer className="size-3.5" />
                      <span>Imprimir Certidão Oficial</span>
                    </button>
                  </div>
                </div>

                {/* Detalhamento dos Componentes (Blindado com formatCurrency) */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-2xs">
                    <span className="text-[10px] uppercase text-slate-400 font-bold">Principal</span>
                    <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                      {formatCurrency(activeResult.principal)}
                    </p>
                  </div>

                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-2xs">
                    <span className="text-[10px] uppercase text-slate-400 font-bold">Correção</span>
                    <p className="text-sm font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                      + {formatCurrency(activeResult.correction)}
                    </p>
                  </div>

                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-2xs">
                    <span className="text-[10px] uppercase text-slate-400 font-bold">Juros</span>
                    <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                      + {formatCurrency(activeResult.interest)}
                    </p>
                  </div>

                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-2xs">
                    <span className="text-[10px] uppercase text-slate-400 font-bold">Honorários</span>
                    <p className="text-sm font-bold text-purple-600 dark:text-purple-400 mt-0.5">
                      + {formatCurrency(activeResult.honorary)}
                    </p>
                  </div>

                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-2xs col-span-2 sm:col-span-1">
                    <span className="text-[10px] uppercase text-slate-400 font-bold">Total Liquidado</span>
                    <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {formatCurrency(activeResult.total)}
                    </p>
                  </div>
                </div>
              </div>

              {/* SE FOR DIVÓRCIO: DEMONSTRATIVO DE PARTILHA DOS BENS */}
              {calculatorItem?.id === "divorcio" && (
                <div className="rounded-xl border border-purple-200 bg-white p-5 dark:border-purple-900/60 dark:bg-slate-900 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-purple-900 dark:text-purple-300">
                    Demonstrativo de Partilha e Meação dos Cônjuges
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                      <span className="text-slate-500 font-medium">Acervo Patrimonial Total</span>
                      <p className="text-base font-bold text-slate-900 dark:text-white mt-0.5">{formatCurrency(totalDivorceAssets)}</p>
                    </div>
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                      <span className="text-slate-500 font-medium">Quinhão Cônjuge A</span>
                      <p className="text-base font-bold text-blue-700 dark:text-blue-400 mt-0.5">{formatCurrency(conjuge1Total)}</p>
                    </div>
                    <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg">
                      <span className="text-slate-500 font-medium">Quinhão Cônjuge B</span>
                      <p className="text-base font-bold text-indigo-700 dark:text-indigo-400 mt-0.5">{formatCurrency(conjuge2Total)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Tabela do Demonstrativo Discriminado Mês a Mês (Art. 524 CPC) */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                    Demonstrativo Discriminado e Atualizado (Art. 524 CPC)
                  </h4>
                  <span className="text-[11px] text-slate-400">Critério Pro Rata Die / Simples</span>
                </div>

                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">MÊS/ANO</th>
                        <th className="py-2.5 px-3">DIAS</th>
                        <th className="py-2.5 px-3 text-right">PRINCIPAL</th>
                        <th className="py-2.5 px-3 text-right">ÍNDICE (%)</th>
                        <th className="py-2.5 px-3 text-right">CORREÇÃO</th>
                        <th className="py-2.5 px-3 text-right">JUROS (%)</th>
                        <th className="py-2.5 px-3 text-right">JUROS (R$)</th>
                        <th className="py-2.5 px-3 text-right">SALDO FINAL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                      {activeResult.items[0]?.periods?.map((p) => (
                        <tr key={p.periodIndex} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                          <td className="py-2 px-3 font-bold text-slate-900 dark:text-white">{p.periodLabel}</td>
                          <td className="py-2 px-3 text-slate-400">{p.daysCount}</td>
                          <td className="py-2 px-3 text-right">{formatCurrency(p.openingPrincipal)}</td>
                          <td className="py-2 px-3 text-right text-blue-600">{formatPercent(p.indexRatePercent)}</td>
                          <td className="py-2 px-3 text-right font-semibold">{formatCurrency(p.correctionAmount)}</td>
                          <td className="py-2 px-3 text-right text-indigo-600">{formatPercent(p.interestRatePercent, 4)}</td>
                          <td className="py-2 px-3 text-right font-semibold">{formatCurrency(p.interestAmount)}</td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900 dark:text-white">
                            {formatCurrency(p.closingBalance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé de Navegação do Modal */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/50">
          <div>
            {wizardStep > 1 && wizardStep < 4 && (
              <button
                type="button"
                onClick={() => setWizardStep((prev) => (prev - 1) as any)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition"
              >
                <ArrowLeft className="size-3.5" />
                <span>Voltar</span>
              </button>
            )}

            {wizardStep === 1 && (
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                Cancelar
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {wizardStep === 1 && (
              <button
                type="button"
                onClick={() => {
                  if (calculatorItem?.id !== "divorcio" && (!principalAmount || principalAmount <= 0)) {
                    toast.error("Informe um valor principal positivo para prosseguir.");
                    return;
                  }
                  setWizardStep(2);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 active:scale-98 transition"
              >
                <span>Avançar para Documento & IA</span>
                <ArrowRight className="size-3.5" />
              </button>
            )}

            {wizardStep === 2 && (
              <button
                type="button"
                onClick={handleResolveLegalRule}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 active:scale-98 transition"
              >
                <span>Enquadrar Regra Jurídica</span>
                <ArrowRight className="size-3.5" />
              </button>
            )}

            {wizardStep === 3 && (
              <button
                type="button"
                onClick={handleExecuteCalculation}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-700 active:scale-98 transition"
              >
                <Play className="size-3.5 fill-white" />
                <span>Homologar e Gerar Demonstrativo</span>
              </button>
            )}

            {wizardStep === 4 && (
              <button
                type="button"
                onClick={() => {
                  toast.success("Cálculo salvo no acervo!");
                  onClose();
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition"
              >
                <Check className="size-3.5" />
                <span>Concluir e Fechar</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

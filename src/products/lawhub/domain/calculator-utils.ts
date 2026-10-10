/**
 * Utilitários seguros e gerenciador de rascunhos da Calculadora Jurídica
 */

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return "R$ 0,00";
  }
  return `R$ ${Number(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatPercent(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return "0,00%";
  }
  return `${Number(value).toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;
}

export interface CalculatorDraft {
  calculatorId: string;
  calculatorName: string;
  legalArea: string;
  wizardStep: 1 | 2 | 3 | 4;
  updatedAt: string;
  data: {
    calcName: string;
    processNumber: string;
    clientName: string;
    tribunal: string;
    obligationNature: string;
    principalAmount: number;
    dueDate: string;
    citationDate: string;
    finalDate: string;
    penaltyPercent: number;
    honoraryPercent: number;
    decisionDocumentText?: string;
    // Campos específicos para calculadoras temáticas
    divorceAssets?: Array<{ id: string; name: string; value: number; assignedTo: "conjuge1" | "conjuge2" | "venda" }>;
    revisionalContractRate?: number;
    revisionalBacenRate?: number;
    alimonyIncome?: number;
    alimonyExpenses?: number;
    customNotes?: string;
  };
}

const STORAGE_CALCULATOR_DRAFT_KEY = "lawhub_calculator_active_draft";

export class CalculatorDraftService {
  static saveDraft(draft: CalculatorDraft): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_CALCULATOR_DRAFT_KEY, JSON.stringify(draft));
    } catch (e) {
      console.error("Falha ao salvar rascunho da calculadora:", e);
    }
  }

  static getDraft(): CalculatorDraft | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(STORAGE_CALCULATOR_DRAFT_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  static clearDraft(): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(STORAGE_CALCULATOR_DRAFT_KEY);
    } catch (e) {
      console.error("Falha ao limpar rascunho da calculadora:", e);
    }
  }
}

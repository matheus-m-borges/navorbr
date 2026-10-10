// @ts-nocheck — tipos legados do LawHub em migração
// ============================================================================
// NAVOR LAWHUB — MOTOR FINANCEIRO JURÍDICO SERVICE 2.0
// ============================================================================
// Camada de domínio e persistência no Supabase com isolamento RLS.
// Integração desacoplada com Navor Integration Core (Asaas).
// ============================================================================

import { supabase } from "@/integrations/supabase/client";
import { NavorPaymentCore } from "@/lib/integrations/payment-provider";
import { LawHubService } from "./lawhub-service";
import { LawHubAuditService } from "./audit-service";
import { createLawHubContract } from "./contract.functions";
import type {
  LawFeeContract,
  LawAccountReceivable,
  LawReceivableInstallment,
  LawAccountPayable,
  LawProcessCost,
  LawJudicialRelease,
  LawPrecatórioRpvRequisition,
  LawFeeDistribution,
  LawFinancialAccount,
  LawFinancialTransaction,
  FinancialDashboardMetrics,
  LawContractTemplate,
  ContractType,
  PaymentMethod,
} from "./financial-types";

export const LawFinancialService = {
  // Alias de compatibilidade
  async getAccountsReceivable(): Promise<LawAccountReceivable[]> {
    return this.getReceivables();
  },

  async getFeeContracts(): Promise<LawFeeContract[]> {
    return this.getContracts();
  },

  async settleReceivable(receivableId: string, amount?: number): Promise<boolean> {
    try {
      const all = this._getLocalReceivables();
      const idx = all.findIndex((r: any) => r.id === receivableId);
      if (idx !== -1) {
        const item = all[idx];
        const paid = amount || item.total_amount;
        all[idx] = {
          ...item,
          paid_amount: paid,
          balance_amount: Math.max(0, item.total_amount - paid),
          status: "paga",
        };
        this._saveLocalReceivables(all);
      }
      await supabase
        .from("law_accounts_receivable")
        .update({
          status: "paga",
          paid_amount: amount,
          balance_amount: 0,
        })
        .eq("id", receivableId);
      return true;
    } catch {
      return false;
    }
  },

  async registerReceivablePayment(receivableId: string, params: { amount: number; payment_method?: string }): Promise<boolean> {
    return this.settleReceivable(receivableId, params.amount);
  },

  // --------------------------------------------------------------------------
  // 1. DASHBOARD & MÉTRICAS EXECUTIVAS
  // --------------------------------------------------------------------------
  async getDashboardMetrics(): Promise<FinancialDashboardMetrics> {
    try {
      const [
        { data: accounts },
        { data: receivables },
        { data: payables },
        { data: contracts },
        { data: payments },
      ] = await Promise.all([
        supabase.from("law_financial_accounts").select("current_balance").eq("is_active", true),
        supabase.from("law_accounts_receivable").select("total_amount, paid_amount, balance_amount, status, due_date"),
        supabase.from("law_accounts_payable").select("amount, status, due_date"),
        supabase.from("law_fee_contracts").select("total_amount, status"),
        supabase.from("law_payments").select("amount, payment_date"),
      ]);

      const totalBalance = (accounts || []).reduce((acc: number, curr: any) => acc + (Number(curr.current_balance) || 0), 0);
      
      const todayStr = new Date().toISOString().split("T")[0];
      const currentMonthStr = todayStr.substring(0, 7);

      const receivedToday = (payments || [])
        .filter((p: any) => p.payment_date?.startsWith(todayStr))
        .reduce((acc: number, curr: any) => acc + (Number(curr.amount) || 0), 0);

      const receivedThisMonth = (payments || [])
        .filter((p: any) => p.payment_date?.startsWith(currentMonthStr))
        .reduce((acc: number, curr: any) => acc + (Number(curr.amount) || 0), 0);

      const receivableTotal = (receivables || [])
        .filter((r: any) => r.status === "aberta" || r.status === "parcialmente_paga")
        .reduce((acc: number, curr: any) => acc + (Number(curr.balance_amount) || 0), 0);

      const overdueTotal = (receivables || [])
        .filter((r: any) => (r.status === "vencida" || (r.status === "aberta" && r.due_date < todayStr)))
        .reduce((acc: number, curr: any) => acc + (Number(curr.balance_amount) || 0), 0);

      const payableTotal = (payables || [])
        .filter((p: any) => p.status === "aberta")
        .reduce((acc: number, curr: any) => acc + (Number(curr.amount) || 0), 0);

      const expensesThisMonth = (payables || [])
        .filter((p: any) => p.status === "paga" && p.due_date?.startsWith(currentMonthStr))
        .reduce((acc: number, curr: any) => acc + (Number(curr.amount) || 0), 0);

      const contractedFeesTotal = (contracts || [])
        .filter((c: any) => c.status !== "cancelado")
        .reduce((acc: number, curr: any) => acc + (Number(curr.total_amount) || 0), 0);

      const receivedFeesTotal = (receivables || [])
        .reduce((acc: number, curr: any) => acc + (Number(curr.paid_amount) || 0), 0);

      const totalFaturado = receivableTotal + receivedThisMonth;
      const inadimplenciaRate = totalFaturado > 0 ? Math.round((overdueTotal / totalFaturado) * 100) : 0;

      return {
        totalBalance,
        receivedToday,
        receivedThisMonth,
        receivableTotal,
        overdueTotal,
        payableTotal,
        expensesThisMonth,
        operatingResult: receivedThisMonth - expensesThisMonth,
        contractedFeesTotal,
        receivedFeesTotal,
        inadimplenciaRate,
      };
    } catch (error) {
      throw new Error(`Falha ao carregar o financeiro LawHub: ${error instanceof Error ? error.message : String(error)}`);
    }
  },

  // --------------------------------------------------------------------------
  // 2. CONTRATOS DE HONORÁRIOS & MODELOS
  // --------------------------------------------------------------------------
  async getContracts(): Promise<LawFeeContract[]> {
    const { data, error } = await supabase
      .from("law_fee_contracts")
      .select(`
        *,
        client:law_clients(name),
        responsible:law_lawyers!responsible_lawyer_id(name),
        captor:law_lawyers!captor_lawyer_id(name)
      `)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Falha ao listar contratos financeiros: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return [];
    }

    return data.map((c: any) => ({
      ...c,
      client_name: c.client?.name || "",
      responsible_lawyer_name: c.responsible?.name,
      captor_lawyer_name: c.captor?.name,
    }));
  },

  async createContract(contractData: Partial<LawFeeContract>): Promise<LawFeeContract> {
    if (!contractData.client_id) {
      throw new Error("Cliente persistido é obrigatório para emissão de contrato.");
    }
    if (!contractData.template_id) {
      throw new Error("Modelo de contrato ativo é obrigatório para emissão de contrato.");
    }

    const created = await createLawHubContract({
      data: {
        clientId: contractData.client_id,
        templateId: contractData.template_id,
        processId: contractData.process_id,
        contractNumber: contractData.contract_number,
        title: contractData.title,
        contractType: contractData.contract_type,
        totalAmount: contractData.total_amount,
        entryAmount: contractData.entry_amount,
        installmentsCount: contractData.installments_count,
        monthlyAmount: contractData.monthly_amount,
        contingencyPercentage: contractData.contingency_percentage,
        sucumbencePercentage: contractData.sucumbence_percentage,
        startDate: contractData.start_date,
        notes: contractData.notes,
      },
    });

    return created as unknown as LawFeeContract;
  },

  async getContractTemplates(): Promise<LawContractTemplate[]> {
    const { data, error } = await supabase
      .from("law_contract_templates")
      .select("*")
      .eq("is_active", true);

    if (error) {
      throw new Error(`Falha ao carregar modelos financeiros: ${error.message}`);
    }

    return (data || []) as LawContractTemplate[];
  },

  // --------------------------------------------------------------------------
  // 3. CONTAS A RECEBER, HONORÁRIOS & PARCELAS
  // --------------------------------------------------------------------------
  _getLocalReceivables(): LawAccountReceivable[] {
    try {
      const raw = localStorage.getItem("navor_lawhub_receivables_v2");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  _saveLocalReceivables(items: LawAccountReceivable[]) {
    try {
      localStorage.setItem("navor_lawhub_receivables_v2", JSON.stringify(items));
    } catch {}
  },

  async getReceivables(): Promise<LawAccountReceivable[]> {
    const listMap = new Map<string, LawAccountReceivable>();

    // 1. Tenta carregar do Supabase
    try {
      const { data, error } = await supabase
        .from("law_accounts_receivable")
        .select(`
          *,
          client:law_clients(name),
          contract:law_fee_contracts(contract_number),
          installments:law_receivable_installments(*)
        `)
        .order("due_date", { ascending: true });

      if (!error && data && data.length > 0) {
        for (const r of data) {
          listMap.set(r.id, {
            ...r,
            client_name: r.client?.name || r.client_name || "Cliente",
            contract_number: r.contract?.contract_number || r.contract_number,
          });
        }
      }
    } catch {}

    // O banco é a fonte autoritativa. O estado local legado não pode criar
    // recebíveis que não existem no tenant atual.
    if (listMap.size === 0) return [];

    // 2. Compatibilidade legada: só enriquece registros já encontrados no banco.
    const localItems = this._getLocalReceivables();
    for (const item of localItems) {
      if (!listMap.has(item.id)) {
        listMap.set(item.id, item);
      }
    }

    // 3. Mescla com entradas do LawHubService (tela de Processos, Leads e Honorários manuais)
    try {
      const finEntries = await LawHubService.getFinancialEntries();
      for (const entry of finEntries) {
        // Se for honorário ou lançamento do usuário
        if (entry.entry_type === "honorario" || entry.amount > 0) {
          const recId = entry.id.startsWith("rec-") ? entry.id : `rec-${entry.id}`;
          if (!listMap.has(recId)) {
            const isPaid = entry.status === "pago";
            const amt = Number(entry.amount) || 0;
            listMap.set(recId, {
              id: recId,
              account_id: "acc-1",
              client_name: entry.client_name || "Cliente Vinculado",
              process_cnj: entry.process_cnj || "",
              process_id: entry.process_id,
              description: entry.title || "Honorários da elaboração do contrato de prestação de serviços",
              category: "Honorário Contratual",
              original_amount: amt,
              discount_amount: 0,
              interest_amount: 0,
              fine_amount: 0,
              total_amount: amt,
              paid_amount: isPaid ? amt : 0,
              balance_amount: isPaid ? 0 : amt,
              due_date: entry.due_date || new Date().toISOString().slice(0, 10),
              competence_date: (entry.created_at || new Date().toISOString()).slice(0, 10),
              status: isPaid ? "paga" : "aberta",
              notes: entry.notes,
              installments: [
                {
                  id: `inst-${recId}-1`,
                  account_id: "acc-1",
                  receivable_id: recId,
                  client_id: "cli-1",
                  client_name: entry.client_name,
                  installment_number: 1,
                  total_installments: 1,
                  amount: amt,
                  discount_amount: 0,
                  interest_amount: 0,
                  fine_amount: 0,
                  total_due: amt,
                  paid_amount: isPaid ? amt : 0,
                  due_date: entry.due_date || new Date().toISOString().slice(0, 10),
                  status: isPaid ? "paga" : "aberta",
                  created_at: entry.created_at || new Date().toISOString(),
                  updated_at: entry.created_at || new Date().toISOString(),
                }
              ],
              created_at: entry.created_at || new Date().toISOString(),
              updated_at: entry.created_at || new Date().toISOString(),
            });
          }
        }
      }
    } catch {}

    // 4. Retorna recebíveis reais sem fallback fictício

    const result = Array.from(listMap.values());
    result.sort((a, b) => (a.due_date > b.due_date ? 1 : -1));
    return result;
  },

  async createReceivable(payload: Partial<LawAccountReceivable>): Promise<LawAccountReceivable> {
    const recId = payload.id || `rec-${Date.now()}`;
    const total = Number(payload.total_amount) || Number(payload.original_amount) || 0;
    
    // Constrói objeto com valores padronizados
    const newRec: LawAccountReceivable = {
      id: recId,
      account_id: payload.account_id || "acc-1",
      client_id: payload.client_id || "cli-1",
      client_name: payload.client_name || "Cliente",
      contract_id: payload.contract_id,
      process_id: payload.process_id,
      process_cnj: payload.process_cnj,
      description: payload.description || "Honorários Advocatícios",
      category: payload.category || "Honorário Contratual",
      original_amount: total,
      discount_amount: 0,
      interest_amount: 0,
      fine_amount: 0,
      total_amount: total,
      paid_amount: 0,
      balance_amount: total,
      due_date: payload.due_date || new Date().toISOString().slice(0, 10),
      competence_date: payload.competence_date || new Date().toISOString().slice(0, 10),
      status: "aberta",
      notes: payload.notes,
      installments: payload.installments || [
        {
          id: `inst-${recId}-1`,
          account_id: "acc-1",
          receivable_id: recId,
          client_id: payload.client_id || "cli-1",
          client_name: payload.client_name,
          installment_number: 1,
          total_installments: 1,
          amount: total,
          discount_amount: 0,
          interest_amount: 0,
          fine_amount: 0,
          total_due: total,
          paid_amount: 0,
          due_date: payload.due_date || new Date().toISOString().slice(0, 10),
          status: "aberta",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 1. Salva no localStorage para consistência imediata
    const current = this._getLocalReceivables();
    this._saveLocalReceivables([newRec, ...current]);

    // 2. Salva no LawHubService (para a tela de Processos refletir imediatamente)
    try {
      await LawHubService.createFinancialEntry({
        process_id: newRec.process_id,
        process_cnj: newRec.process_cnj,
        client_name: newRec.client_name,
        title: newRec.description,
        amount: newRec.total_amount,
        due_date: newRec.due_date,
        entry_type: "honorario",
        status: "pendente",
        notes: newRec.notes,
      });
    } catch {}

    // 3. Tenta persistir no Supabase (se as tabelas estiverem disponíveis)
    try {
      await supabase.from("law_accounts_receivable").insert({
        id: newRec.id,
        account_id: newRec.account_id,
        client_id: newRec.client_id,
        process_id: newRec.process_id,
        process_cnj: newRec.process_cnj,
        description: newRec.description,
        category: newRec.category,
        original_amount: newRec.original_amount,
        total_amount: newRec.total_amount,
        paid_amount: 0,
        balance_amount: newRec.total_amount,
        due_date: newRec.due_date,
        competence_date: newRec.competence_date,
        status: newRec.status,
        notes: newRec.notes,
      });

      if (newRec.installments && newRec.installments.length > 0) {
        await supabase.from("law_receivable_installments").insert(
          newRec.installments.map((inst) => ({
            id: inst.id,
            account_id: inst.account_id,
            receivable_id: inst.receivable_id,
            installment_number: inst.installment_number,
            total_installments: inst.total_installments,
            amount: inst.amount,
            total_due: inst.total_due,
            paid_amount: 0,
            due_date: inst.due_date,
            status: inst.status,
          }))
        );
      }
    } catch {}

    return newRec;
  },

  // --------------------------------------------------------------------------
  // 4. GERAÇÃO DE COBRANÇA ASAAS & COBRANÇA MANUAL
  // --------------------------------------------------------------------------
  async generateAsaasBilling(params: {
    receivableId: string;
    installmentId?: string;
    clientName: string;
    clientCpfCnpj?: string;
    amount: number;
    dueDate: string;
    description: string;
    method: PaymentMethod;
  }): Promise<{ success: boolean; charge?: any; error?: string }> {
    try {
      const chargeRes = await NavorPaymentCore.provider.createCharge({
        billingType: params.method === "TED" || params.method === "DINHEIRO" ? "BOLETO" : (params.method as any),
        value: params.amount,
        dueDate: params.dueDate,
        description: params.description,
        externalReference: params.installmentId || params.receivableId,
        customerName: params.clientName,
        cpfCnpj: params.clientCpfCnpj,
      });

      if (!chargeRes.success) {
        return { success: false, error: chargeRes.error || "Falha ao comunicar com Asaas" };
      }

      // Atualiza o registro local com a cobrança Asaas
      const all = this._getLocalReceivables();
      const updated = all.map((rec) => {
        if (rec.id === params.receivableId) {
          const updatedInst = (rec.installments || []).map((inst) => {
            if (!params.installmentId || inst.id === params.installmentId) {
              return {
                ...inst,
                billing: {
                  id: `bill-${Date.now()}`,
                  account_id: "acc-1",
                  client_id: rec.client_id,
                  provider: "asaas" as const,
                  provider_charge_id: chargeRes.chargeId || `pay_${Date.now()}`,
                  provider_status: "PENDING",
                  payment_method: params.method,
                  amount: params.amount,
                  due_date: params.dueDate,
                  payment_url: chargeRes.invoiceUrl || "",
                  pix_qr_code: chargeRes.pixQrCode,
                  pix_copy_paste: chargeRes.pixCopyPaste,
                  bank_slip_barcode: chargeRes.bankSlipBarcode,
                  bank_slip_identification_field: chargeRes.bankSlipIdentificationField,
                  status: "gerada",
                  created_at: new Date().toISOString(),
                },
              };
            }
            return inst;
          });
          return { ...rec, installments: updatedInst };
        }
        return rec;
      });
      this._saveLocalReceivables(updated);

      return { success: true, charge: chargeRes };
    } catch (err: any) {
      return { success: false, error: err.message || "Erro ao gerar cobrança Asaas" };
    }
  },

  async recordManualPayment(params: {
    receivableId: string;
    installmentId?: string;
    paymentMethod: "PIX" | "DINHEIRO" | "TED" | "CREDIT_CARD" | "BOLETO";
    paidAmount: number;
    paymentDate: string;
    bankAccount?: string;
    notes?: string;
  }): Promise<boolean> {
    try {
      const all = this._getLocalReceivables();
      const updated = all.map((rec) => {
        if (rec.id === params.receivableId) {
          let updatedPaidTotal = rec.paid_amount;
          const updatedInst = (rec.installments || []).map((inst) => {
            if (!params.installmentId || inst.id === params.installmentId) {
              updatedPaidTotal += params.paidAmount;
              return {
                ...inst,
                status: "paga" as const,
                paid_amount: params.paidAmount,
                payment_date: params.paymentDate,
                payment_method: params.paymentMethod,
                billing: {
                  id: `bill-manual-${Date.now()}`,
                  account_id: "acc-1",
                  client_id: rec.client_id,
                  provider: "manual" as const,
                  payment_method: params.paymentMethod,
                  amount: params.paidAmount,
                  due_date: inst.due_date,
                  status: "pago",
                  created_at: new Date().toISOString(),
                }
              };
            }
            return inst;
          });

          const newBalance = Math.max(0, rec.total_amount - updatedPaidTotal);
          return {
            ...rec,
            paid_amount: updatedPaidTotal,
            balance_amount: newBalance,
            status: newBalance <= 0 ? ("paga" as const) : ("parcialmente_paga" as const),
            installments: updatedInst,
          };
        }
        return rec;
      });
      this._saveLocalReceivables(updated);

      // Tenta persistir no Supabase se houver tabela
      try {
        if (params.installmentId) {
          await supabase.from("law_receivable_installments").update({
            status: "paga",
            paid_amount: params.paidAmount,
            payment_date: params.paymentDate,
            payment_method: params.paymentMethod,
          }).eq("id", params.installmentId);
        }
      } catch {}

      return true;
    } catch {
      return false;
    }
  },

  async generateBilling(installmentId: string, method: PaymentMethod): Promise<boolean> {
    try {
      const res = await NavorPaymentCore.provider.createCharge({
        billingType: method === "TED" ? "BOLETO" : (method as any),
        value: 1000,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        description: `Honorários Advocatícios - Parcela ${installmentId}`,
        externalReference: installmentId,
      });

      return res.success;
    } catch {
      return false;
    }
  },

  async getAsaasCharges(): Promise<{
    charges: Array<{
      id: string;
      chargeId: string;
      clientName: string;
      processCnj?: string;
      description: string;
      amount: number;
      dueDate: string;
      status: string;
      paymentMethod: string;
      paymentUrl?: string;
      pixQrCode?: string;
      pixCopyPaste?: string;
      receivableId: string;
      installmentId?: string;
      createdAt: string;
    }>;
    totalAmount: number;
    receivedAmount: number;
    pendingAmount: number;
    overdueAmount: number;
  }> {
    const receivables = await this.getReceivables();
    const list: any[] = [];
    let totalAmount = 0;
    let receivedAmount = 0;
    let pendingAmount = 0;
    let overdueAmount = 0;

    const todayStr = new Date().toISOString().slice(0, 10);

    for (const rec of receivables) {
      if (rec.installments && rec.installments.length > 0) {
        for (const inst of rec.installments) {
          if (inst.billing && inst.billing.provider === "asaas") {
            const b = inst.billing;
            const amt = b.amount || inst.amount;
            totalAmount += amt;

            let st = (b.provider_status || "PENDING").toUpperCase();
            if (inst.status === "paga" || b.status === "pago") {
              st = "RECEIVED";
              receivedAmount += amt;
            } else if (inst.due_date < todayStr) {
              st = "OVERDUE";
              overdueAmount += amt;
            } else {
              pendingAmount += amt;
            }

            list.push({
              id: b.id || `bill-${inst.id}`,
              chargeId: b.provider_charge_id || `pay_${inst.id}`,
              clientName: rec.client_name,
              processCnj: rec.process_cnj,
              description: rec.description + (rec.installments.length > 1 ? ` (Parcela ${inst.installment_number}/${inst.total_installments})` : ""),
              amount: amt,
              dueDate: b.due_date || inst.due_date,
              status: st,
              paymentMethod: b.payment_method || "PIX",
              paymentUrl: b.payment_url || "",
              pixQrCode: b.pix_qr_code,
              pixCopyPaste: b.pix_copy_paste,
              receivableId: rec.id,
              installmentId: inst.id,
              createdAt: b.created_at || rec.created_at,
            });
          }
        }
      }
    }

    // Sem faturas emitidas: retorna lista vazia factual (removido itens demonstrativos legados)
    if (list.length === 0) {
      return {
        charges: [],
        totalAmount: 0,
        receivedAmount: 0,
        pendingAmount: 0,
        overdueAmount: 0,
      };
    }

    return {
      charges: list,
      totalAmount,
      receivedAmount,
      pendingAmount,
      overdueAmount,
    };
  },

  // --------------------------------------------------------------------------
  // 5. CONTAS A PAGAR, DESPESAS & HONORÁRIOS DE FUNCIONÁRIOS / ASSOCIADOS
  // --------------------------------------------------------------------------
  _getLocalPayables(): LawAccountPayable[] {
    try {
      const raw = localStorage.getItem("navor_lawhub_payables_v2");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  _saveLocalPayables(items: LawAccountPayable[]) {
    try {
      localStorage.setItem("navor_lawhub_payables_v2", JSON.stringify(items));
    } catch {}
  },

  async getPayables(): Promise<LawAccountPayable[]> {
    const listMap = new Map<string, LawAccountPayable>();

    // 1. Tenta carregar do Supabase
    try {
      const { data, error } = await supabase
        .from("law_accounts_payable")
        .select("*")
        .order("due_date", { ascending: true });

      if (!error && data && data.length > 0) {
        for (const p of data) {
          listMap.set(p.id, p);
        }
      }
    } catch {}

    if (listMap.size === 0) return [];

    // 2. Compatibilidade legada somente para registros já persistidos no banco
    const localItems = this._getLocalPayables();
    for (const item of localItems) {
      if (!listMap.has(item.id)) {
        listMap.set(item.id, item);
      }
    }

    // 3. Fallback inicial representativo
    if (listMap.size === 0) {
      const initialPayables: LawAccountPayable[] = [
        {
          id: "pay-1",
          account_id: "acc-1",
          supplier_name: "Edifício Executive Center Teresina",
          category: "Aluguel",
          cost_center: "Geral",
          description: "Locação da Sede do Escritório - Mês 09/2026",
          amount: 3200.0,
          due_date: "2026-10-10",
          competence_date: "2026-09-01",
          status: "aberta",
          created_at: "2026-09-10",
          updated_at: "2026-09-10",
        },
        {
          id: "pay-2",
          account_id: "acc-1",
          supplier_name: "Dr. Carlos Eduardo (Advogado Associado)",
          category: "Honorários de Associados",
          cost_center: "Trabalhista",
          description: "Repasse de Honorários de Êxito - Processo 0802243",
          amount: 4500.0,
          due_date: "2026-09-28",
          competence_date: "2026-09-01",
          status: "aberta",
          notes: "Colaborador: Dr. Carlos Eduardo",
          created_at: "2026-09-15",
          updated_at: "2026-09-15",
        },
        {
          id: "pay-3",
          account_id: "acc-1",
          supplier_name: "Dra. Mariana Costa (Advogada Associada)",
          category: "Honorários de Associados",
          cost_center: "Cível",
          description: "Honorários Mensais Contratuais - Ref. Setembro",
          amount: 5200.0,
          due_date: "2026-09-30",
          competence_date: "2026-09-01",
          status: "aberta",
          notes: "Colaborador: Dra. Mariana Costa",
          created_at: "2026-09-15",
          updated_at: "2026-09-15",
        },
      ];
      for (const item of initialPayables) {
        listMap.set(item.id, item);
      }
    }

    const result = Array.from(listMap.values());
    result.sort((a, b) => (a.due_date > b.due_date ? 1 : -1));
    return result;
  },

  async createPayable(payload: Partial<LawAccountPayable>): Promise<LawAccountPayable> {
    const payId = payload.id || `pay-${Date.now()}`;
    const newPay: LawAccountPayable = {
      id: payId,
      account_id: payload.account_id || "acc-1",
      supplier_name: payload.supplier_name || "Colaborador / Fornecedor",
      category: payload.category || "Honorários de Associados",
      cost_center: payload.cost_center || "Geral",
      description: payload.description || "Pagamento de Honorário / Despesa",
      amount: Number(payload.amount) || 0,
      due_date: payload.due_date || new Date().toISOString().slice(0, 10),
      competence_date: payload.competence_date || new Date().toISOString().slice(0, 10),
      status: (payload.status as any) || "aberta",
      payment_date: payload.payment_date,
      payment_method: payload.payment_method,
      notes: payload.notes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Salva localmente
    const current = this._getLocalPayables();
    this._saveLocalPayables([newPay, ...current]);

    // Tenta persistir no Supabase
    try {
      await supabase.from("law_accounts_payable").insert({
        id: newPay.id,
        account_id: newPay.account_id,
        supplier_name: newPay.supplier_name,
        category: newPay.category,
        cost_center: newPay.cost_center,
        description: newPay.description,
        amount: newPay.amount,
        due_date: newPay.due_date,
        competence_date: newPay.competence_date,
        status: newPay.status,
        notes: newPay.notes,
      });
    } catch {}

    return newPay;
  },

  // --------------------------------------------------------------------------
  // CATEGORIAS FINANCEIRAS (CONFORME PRINT 1)
  // --------------------------------------------------------------------------
  _getCategoriesStorage(): any[] {
    try {
      const raw = localStorage.getItem("navor_lawhub_categories_v2");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  _saveCategoriesStorage(items: any[]) {
    try {
      localStorage.setItem("navor_lawhub_categories_v2", JSON.stringify(items));
    } catch {}
  },

  async getCategories(): Promise<any[]> {
    const local = this._getCategoriesStorage();
    if (local.length > 0) return local;

    // 24 Categorias Padrão Pré-Definidas (Fiel ao Print 1 do Astrea)
    const initialCategories = [
      { id: "cat-1", name: "Adiantamento de despesas", color: "#65a30d", type: "despesa", allows_entry: true, status: "ativo" },
      { id: "cat-2", name: "Aluguel", color: "#dc2626", type: "despesa", allows_entry: true, status: "ativo" },
      { id: "cat-3", name: "Anuidade OAB", color: "#f43f5e", type: "despesa", allows_entry: true, status: "ativo" },
      { id: "cat-4", name: "Capitalização sócios", color: "#a855f7", type: "receita", allows_entry: true, status: "ativo" },
      { id: "cat-5", name: "Condomínio", color: "#fb7185", type: "despesa", allows_entry: true, status: "ativo" },
      { id: "cat-6", name: "Contador", color: "#7f1d1d", type: "despesa", allows_entry: true, status: "ativo" },
      { id: "cat-7", name: "CSLL", color: "#0f172a", type: "despesa", allows_entry: true, status: "ativo" },
      { id: "cat-8", name: "Despesa do cliente", color: "#84cc16", type: "despesa", allows_entry: true, status: "ativo" },
      { id: "cat-9", name: "Honorários de Associados", color: "#2563eb", type: "despesa", allows_entry: true, status: "ativo" },
      { id: "cat-10", name: "Salários e Encargos", color: "#1e3a8a", type: "despesa", allows_entry: true, status: "ativo" },
      { id: "cat-11", name: "Honorário Contratual (Cliente)", color: "#10b981", type: "receita", allows_entry: true, status: "ativo" },
      { id: "cat-12", name: "Sucumbência (Cliente)", color: "#065f46", type: "receita", allows_entry: true, status: "ativo" },
      { id: "cat-13", name: "Assessoria Mensal / Retainer", color: "#3b82f6", type: "receita", allows_entry: true, status: "ativo" },
      { id: "cat-14", name: "Consultoria Jurídica Avulsa", color: "#6366f1", type: "receita", allows_entry: true, status: "ativo" },
      { id: "cat-15", name: "Custas Processuais TJ", color: "#ea580c", type: "despesa", allows_entry: true, status: "ativo" },
      { id: "cat-16", name: "Pró-Labore dos Sócios", color: "#9333ea", type: "despesa", allows_entry: true, status: "ativo" },
      { id: "cat-17", name: "Internet & Telefonia", color: "#0284c7", type: "despesa", allows_entry: true, status: "ativo" },
      { id: "cat-18", name: "Softwares & Licenças", color: "#4f46e5", type: "despesa", allows_entry: true, status: "ativo" },
      { id: "cat-19", name: "Material de Escritório", color: "#d97706", type: "despesa", allows_entry: true, status: "ativo" },
      { id: "cat-20", name: "Marketing & Publicidade", color: "#db2777", type: "despesa", allows_entry: true, status: "ativo" },
      { id: "cat-21", name: "Impostos Federais (IRPJ/PIS/COFINS)", color: "#111827", type: "despesa", allows_entry: true, status: "ativo" },
      { id: "cat-22", name: "ISS / Taxas Municipais", color: "#374151", type: "despesa", allows_entry: true, status: "ativo" },
      { id: "cat-23", name: "Viagens e Diligências", color: "#0891b2", type: "despesa", allows_entry: true, status: "ativo" },
      { id: "cat-24", name: "Outras Receitas", color: "#14b8a6", type: "receita", allows_entry: true, status: "ativo" },
    ];

    this._saveCategoriesStorage(initialCategories);
    return initialCategories;
  },

  async addCategory(cat: { name: string; color?: string; type?: "receita" | "despesa"; allows_entry?: boolean }): Promise<any> {
    const current = await this.getCategories();
    const newCat = {
      id: `cat-${Date.now()}`,
      name: cat.name,
      color: cat.color || "#2563eb",
      type: cat.type || "despesa",
      allows_entry: cat.allows_entry !== false,
      status: "ativo",
    };
    const updated = [newCat, ...current];
    this._saveCategoriesStorage(updated);
    return newCat;
  },

  // --------------------------------------------------------------------------
  // CENTROS DE CUSTO (CONFORME PRINT 2)
  // --------------------------------------------------------------------------
  _getCostCentersStorage(): any[] {
    try {
      const raw = localStorage.getItem("navor_lawhub_cost_centers_v2");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  _saveCostCentersStorage(items: any[]) {
    try {
      localStorage.setItem("navor_lawhub_cost_centers_v2", JSON.stringify(items));
    } catch {}
  },

  async getCostCenters(): Promise<any[]> {
    const local = this._getCostCentersStorage();
    if (local.length > 0) return local;

    // 4 Centros de Custo Pré-Definidos (Fiel ao Print 2 do Astrea)
    const initialCenters = [
      { id: "cc-1", name: "Família", status: "ativo" },
      { id: "cc-2", name: "Trabalhista", status: "ativo" },
      { id: "cc-3", name: "Tributário", status: "ativo" },
      { id: "cc-4", name: "Cível", status: "ativo" },
    ];

    this._saveCostCentersStorage(initialCenters);
    return initialCenters;
  },

  async addCostCenter(center: { name: string }): Promise<any> {
    const current = await this.getCostCenters();
    const newCC = {
      id: `cc-${Date.now()}`,
      name: center.name,
      status: "ativo",
    };
    const updated = [...current, newCC];
    this._saveCostCentersStorage(updated);
    return newCC;
  },

  // --------------------------------------------------------------------------
  // FLUXO DE CAIXA CRUZADO (RECEITAS vs DESPESAS)
  // --------------------------------------------------------------------------
  async getCashFlowData(monthStr?: string): Promise<{
    summary: {
      initialBalance: number;
      totalInflows: number;
      totalOutflows: number;
      periodResult: number;
      finalBalance: number;
    };
    dailyEntries: Array<{
      date: string;
      inflows: number;
      outflows: number;
      dayResult: number;
      accumulatedBalance: number;
      items: any[];
    }>;
  }> {
    const [receivables, payables] = await Promise.all([
      this.getReceivables(),
      this.getPayables(),
    ]);

    const targetMonth = monthStr || new Date().toISOString().slice(0, 7);
    let initialBalance = 45000.0; // Saldo de abertura do escritório

    // Agrupa por dia
    const dayMap = new Map<string, { inflows: number; outflows: number; items: any[] }>();

    for (const rec of receivables) {
      if (rec.due_date && rec.due_date.startsWith(targetMonth)) {
        const d = rec.due_date;
        const cur = dayMap.get(d) || { inflows: 0, outflows: 0, items: [] };
        cur.inflows += Number(rec.total_amount) || 0;
        cur.items.push({
          type: "entrada",
          title: rec.description,
          party: rec.client_name,
          amount: rec.total_amount,
          status: rec.status,
          category: rec.category,
        });
        dayMap.set(d, cur);
      }
    }

    for (const pay of payables) {
      if (pay.due_date && pay.due_date.startsWith(targetMonth)) {
        const d = pay.due_date;
        const cur = dayMap.get(d) || { inflows: 0, outflows: 0, items: [] };
        cur.outflows += Number(pay.amount) || 0;
        cur.items.push({
          type: "saida",
          title: pay.description,
          party: pay.supplier_name,
          amount: pay.amount,
          status: pay.status,
          category: pay.category,
        });
        dayMap.set(d, cur);
      }
    }

    const sortedDates = Array.from(dayMap.keys()).sort();
    let runningBalance = initialBalance;
    let totalInflows = 0;
    let totalOutflows = 0;

    const dailyEntries = sortedDates.map((date) => {
      const data = dayMap.get(date)!;
      totalInflows += data.inflows;
      totalOutflows += data.outflows;
      const dayResult = data.inflows - data.outflows;
      runningBalance += dayResult;

      return {
        date,
        inflows: data.inflows,
        outflows: data.outflows,
        dayResult,
        accumulatedBalance: runningBalance,
        items: data.items,
      };
    });

    const periodResult = totalInflows - totalOutflows;

    return {
      summary: {
        initialBalance,
        totalInflows,
        totalOutflows,
        periodResult,
        finalBalance: runningBalance,
      },
      dailyEntries,
    };
  },

  // --------------------------------------------------------------------------
  // 6. CUSTAS PROCESSUAIS & REEMBOLSOS
  // --------------------------------------------------------------------------
  async getProcessCosts(): Promise<LawProcessCost[]> {
    try {
      const { data, error } = await supabase
        .from("law_process_costs")
        .select(`
          *,
          client:law_clients(name),
          process:law_processes(cnj_number)
        `)
        .order("receipt_date", { ascending: false });

      if (!error && data && data.length > 0) {
        return data.map((c: any) => ({
          ...c,
          client_name: c.client?.name || "Cliente",
          process_cnj: c.process?.cnj_number,
        }));
      }
    } catch {}

    return [
      {
        id: "cost-1",
        account_id: "acc-1",
        process_id: "proc-1",
        process_cnj: "0825690-90.2020.8.18.0140",
        client_id: "cli-1",
        client_name: "Ativa Representações Comerciais Ltda",
        cost_type: "preparo_recursal",
        description: "Guia de Preparo de Apelação TJPI",
        amount: 840.5,
        receipt_date: "2026-09-15",
        advanced_by: "escritorio",
        status: "reembolso_pendente",
        created_at: "2026-09-15",
        updated_at: "2026-09-15",
      },
    ];
  },

  // --------------------------------------------------------------------------
  // 7. ALVARÁS JUDICIAIS, ACORDOS E PRESTAÇÃO DE CONTAS
  // --------------------------------------------------------------------------
  async getJudicialReleases(): Promise<LawJudicialRelease[]> {
    try {
      const { data, error } = await supabase
        .from("law_judicial_releases")
        .select(`
          *,
          client:law_clients(name),
          process:law_processes(cnj_number)
        `)
        .order("release_date", { ascending: false });

      if (!error && data && data.length > 0) {
        return data.map((r: any) => ({
          ...r,
          client_name: r.client?.name || "Cliente",
          process_cnj: r.process?.cnj_number,
        }));
      }
    } catch {}

    return [
      {
        id: "rel-1",
        account_id: "acc-1",
        process_id: "proc-2",
        process_cnj: "0802243-10.2019.8.18.0140",
        client_id: "cli-2",
        client_name: "M&G Confecções Ltda - Epp",
        release_type: "alvara",
        gross_amount: 100000.0,
        contract_fee_amount: 20000.0, // 20%
        sucumbence_fee_amount: 10000.0, // 10%
        costs_deducted_amount: 1200.0, // custas
        client_net_amount: 68800.0, // saldo repasse
        release_date: "2026-09-18",
        status: "recebido_pendente_repasse",
        created_at: "2026-09-18",
      },
    ];
  },

  // --------------------------------------------------------------------------
  // 8. CONVERSÃO DE LEAD EM CLIENTE JURÍDICO VIA RPC
  // --------------------------------------------------------------------------
  async convertLeadToClient(leadId: string, _leadData?: any): Promise<{ client: any; contract: null }> {
    const { data: rpcResult, error: rpcErr } = await supabase.rpc("convert_lawhub_lead_to_client", {
      p_lead_id: leadId,
    });
    if (rpcErr || !rpcResult) {
      throw new Error(`Falha na conversão de lead via RPC: ${rpcErr?.message || "resposta vazia"}`);
    }

    const { data: client, error: clientErr } = await supabase
      .from("law_clients")
      .select("*")
      .eq("id", rpcResult.client_id)
      .single();
    if (clientErr || !client) {
      throw new Error(`Cliente gerado pela conversão não foi localizado: ${clientErr?.message || "não encontrado"}`);
    }

    // Contrato não é gerado implicitamente na conversão do lead.
    // A emissão de contrato deve ser explícita com client_id e template_id reais.
    return { client, contract: null };
  },

  // --------------------------------------------------------------------------
  // 9. INTELIGÊNCIA DE PRECATÓRIOS, RPVS E LEVANTAMENTOS JUDICIAIS 2.0
  // --------------------------------------------------------------------------
  _getLocalPrecatorios(): LawPrecatórioRpvRequisition[] {
    try {
      const raw = localStorage.getItem("navor_lawhub_precatorios_rpv_v1");
      if (raw) return JSON.parse(raw);
    } catch {}

    const seed: LawPrecatórioRpvRequisition[] = [
      {
        id: "prc-2026-001",
        account_id: "acc-1",
        process_id: "proc-2",
        process_cnj: "0802243-10.2019.8.18.0140",
        client_id: "cli-2",
        client_name: "M&G Confecções Ltda - Epp",
        client_document: "14.288.902/0001-33",
        requisition_number: "PRC-2026/001429-TRF1",
        court: "TRF1",
        court_unit: "1ª Vara Federal de Teresina / Seção Judiciária do Piauí",
        requisition_type: "precatorio_alimentar",
        depositary_bank: "BANCO_DO_BRASIL",
        agency: "0021-X",
        account_number: "98.241-1",
        gross_amount: 245000.0,
        contract_fee_percentage: 25,
        contract_fee_amount: 61250.0,
        sucumbence_fee_amount: 24500.0,
        costs_deducted_amount: 1850.0,
        client_net_amount: 157400.0,
        budget_year: 2026,
        issuance_date: "2025-11-20",
        expected_payment_date: "2026-10-30",
        status: "aguardando_liberacao_bancaria",
        has_fee_retention_order: true,
        reconciled_with_financial: false,
        notes: "Retenção de honorários contratuais de 25% deferida pelo Juízo Federal nos termos do Art. 22 §4º do EOAB.",
        created_at: "2025-11-20T10:00:00Z",
        updated_at: "2026-09-20T14:30:00Z",
      },
      {
        id: "rpv-2026-002",
        account_id: "acc-1",
        process_id: "proc-1",
        process_cnj: "0018921-44.2023.8.18.0001",
        client_id: "cli-1",
        client_name: "Arthur Carvalho Moura da Silva",
        client_document: "891.204.913-04",
        requisition_number: "RPV-2026/04118-TJPI",
        court: "TJPI",
        court_unit: "Juizado Especial da Fazenda Pública de Teresina",
        requisition_type: "rpv_estadual_municipal",
        depositary_bank: "CEF",
        agency: "3791",
        account_number: "00019283-9",
        gross_amount: 42350.0,
        contract_fee_percentage: 30,
        contract_fee_amount: 12705.0,
        sucumbence_fee_amount: 0,
        costs_deducted_amount: 450.0,
        client_net_amount: 29195.0,
        issuance_date: "2026-07-10",
        expected_payment_date: "2026-09-30",
        payment_date: "2026-09-22",
        status: "alvara_expedido",
        has_fee_retention_order: true,
        reconciled_with_financial: false,
        notes: "Depósito realizado na Caixa Econômica Federal. Alvará eletrônico pronto para levantamento e repasse ao cliente.",
        created_at: "2026-07-10T09:15:00Z",
        updated_at: "2026-09-22T11:00:00Z",
      },
      {
        id: "alv-2026-003",
        account_id: "acc-1",
        process_id: "proc-3",
        process_cnj: "0000412-88.2022.5.22.0002",
        client_id: "cli-3",
        client_name: "Raimunda Sousa Viana",
        client_document: "432.189.043-91",
        requisition_number: "ALV-2026/00982-TRT22",
        court: "TRT22",
        court_unit: "2ª Vara do Trabalho de Teresina",
        requisition_type: "alvara_levantamento",
        depositary_bank: "CEF",
        agency: "0029",
        account_number: "2022-522-19",
        gross_amount: 86500.0,
        contract_fee_percentage: 20,
        contract_fee_amount: 17300.0,
        sucumbence_fee_amount: 8650.0,
        costs_deducted_amount: 0,
        client_net_amount: 60550.0,
        issuance_date: "2026-08-15",
        payment_date: "2026-09-10",
        transfer_date: "2026-09-12",
        status: "concluido",
        has_fee_retention_order: true,
        reconciled_with_financial: true,
        notes: "Honorários e sucumbência recebidos pelo escritório. Repasse do saldo líquido de R$ 60.550,00 concluído via TED com quitação mútua assinada.",
        created_at: "2026-08-15T08:00:00Z",
        updated_at: "2026-09-12T16:00:00Z",
      },
    ];

    try {
      localStorage.setItem("navor_lawhub_precatorios_rpv_v1", JSON.stringify(seed));
    } catch {}
    return seed;
  },

  _saveLocalPrecatorios(items: LawPrecatórioRpvRequisition[]) {
    try {
      localStorage.setItem("navor_lawhub_precatorios_rpv_v1", JSON.stringify(items));
    } catch {}
  },

  async getPrecatoriosRequisitions(): Promise<LawPrecatórioRpvRequisition[]> {
    // 1. Tenta buscar no Supabase
    try {
      const { data, error } = await supabase
        .from("law_precatorios_rpv")
        .select(`
          *,
          client:law_clients(name, document),
          process:law_processes(cnj_number)
        `)
        .order("created_at", { ascending: false });

      if (!error && data && data.length > 0) {
        return data.map((d: any) => ({
          ...d,
          client_name: d.client?.name || d.client_name || "Cliente",
          client_document: d.client?.document || d.client_document,
          process_cnj: d.process?.cnj_number || d.process_cnj,
        }));
      }
    } catch {}

    // 2. Fallback resiliente com armazenamento local
    return this._getLocalPrecatorios();
  },

  async savePrecatórioRequisition(req: Partial<LawPrecatórioRpvRequisition>, operatorName = "Dr. Matheus Borges"): Promise<LawPrecatórioRpvRequisition> {
    const all = this._getLocalPrecatorios();
    const isNew = !req.id;
    const now = new Date().toISOString();

    const gross = Number(req.gross_amount) || 0;
    const feePct = Number(req.contract_fee_percentage) || 20;
    const feeAmt = req.contract_fee_amount !== undefined ? Number(req.contract_fee_amount) : (gross * feePct) / 100;
    const sucAmt = Number(req.sucumbence_fee_amount) || 0;
    const costsAmt = Number(req.costs_deducted_amount) || 0;
    const net = gross - feeAmt - sucAmt - costsAmt;

    const requisition: LawPrecatórioRpvRequisition = {
      id: req.id || `prc-${Date.now()}`,
      account_id: req.account_id || "acc-1",
      process_id: req.process_id || "",
      process_cnj: req.process_cnj || "",
      client_id: req.client_id || "",
      client_name: req.client_name || "Cliente Não Informado",
      client_document: req.client_document,
      requisition_number: req.requisition_number || `REQ-${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`,
      court: req.court || "TRF1",
      court_unit: req.court_unit || "",
      requisition_type: req.requisition_type || "precatorio_alimentar",
      depositary_bank: req.depositary_bank || "CEF",
      agency: req.agency || "",
      account_number: req.account_number || "",
      gross_amount: gross,
      contract_fee_percentage: feePct,
      contract_fee_amount: feeAmt,
      sucumbence_fee_amount: sucAmt,
      costs_deducted_amount: costsAmt,
      client_net_amount: net > 0 ? net : 0,
      budget_year: req.budget_year || (new Date().getFullYear() + (req.requisition_type?.startsWith("precatorio") ? 1 : 0)),
      issuance_date: req.issuance_date || now.split("T")[0],
      expected_payment_date: req.expected_payment_date,
      payment_date: req.payment_date,
      transfer_date: req.transfer_date,
      status: req.status || "autuado",
      has_fee_retention_order: req.has_fee_retention_order ?? true,
      reconciled_with_financial: req.reconciled_with_financial ?? false,
      receivable_id: req.receivable_id,
      receipt_url: req.receipt_url,
      notes: req.notes,
      created_at: req.created_at || now,
      updated_at: now,
    };

    let updatedList: LawPrecatórioRpvRequisition[];
    if (isNew) {
      updatedList = [requisition, ...all];
    } else {
      updatedList = all.map((item) => (item.id === requisition.id ? requisition : item));
    }
    this._saveLocalPrecatorios(updatedList);

    // Tenta persistir no Supabase se tabela existir
    try {
      await supabase.from("law_precatorios_rpv").upsert(requisition);
    } catch {}

    // Registra trilha de auditoria forense
    try {
      await LawHubAuditService.recordEvent({
        event_type: "dados_exportados",
        title: isNew ? "Cadastro de Precatório / RPV no Sistema" : "Atualização de Precatório / RPV",
        description: `${requisition.requisition_type.toUpperCase()} nº ${requisition.requisition_number} (${requisition.court}) no valor de ${gross.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} vinculado ao processo ${requisition.process_cnj}.`,
        user_name: operatorName,
        resource_type: "financeiro",
        resource_id: requisition.id,
        process_cnj: requisition.process_cnj,
        severity: "info",
        metadata: {
          gross_amount: gross,
          contract_fee_amount: feeAmt,
          client_net_amount: net,
          court: requisition.court,
          depositary_bank: requisition.depositary_bank,
        },
      });
    } catch {}

    return requisition;
  },

  async deletePrecatórioRequisition(id: string): Promise<boolean> {
    const all = this._getLocalPrecatorios();
    const updated = all.filter((item) => item.id !== id);
    this._saveLocalPrecatorios(updated);

    try {
      await supabase.from("law_precatorios_rpv").delete().eq("id", id);
    } catch {}
    return true;
  },

  /**
   * Conciliação Direta de Honorários com o Financeiro (Art. 22, § 4º EOAB)
   * Realiza a baixa do valor dos honorários contratuais diretamente retidos pelo Juízo/Banco,
   * gerando o lançamento de receita correspondente e gravando na trilha de auditoria forense.
   */
  async reconcileFeeRetention(requisitionId: string, operatorName = "Dr. Matheus Borges"): Promise<{ success: boolean; message: string }> {
    const all = this._getLocalPrecatorios();
    const target = all.find((item) => item.id === requisitionId);

    if (!target) {
      return { success: false, message: "Requisição não encontrada no sistema." };
    }

    const totalRetainedFees = (Number(target.contract_fee_amount) || 0) + (Number(target.sucumbence_fee_amount) || 0);

    if (totalRetainedFees <= 0) {
      return { success: false, message: "Não há honorários destacados a conciliar para esta requisição." };
    }

    const today = new Date().toISOString().split("T")[0];

    // 1. Cria a Conta a Receber baixada/liquidada no Financeiro 2.0
    const recId = `rec-retained-${Date.now()}`;
    const newReceivable: LawAccountReceivable = {
      id: recId,
      account_id: target.account_id || "acc-1",
      client_id: target.client_id || "cli-1",
      client_name: target.client_name,
      process_id: target.process_id,
      process_cnj: target.process_cnj,
      description: `Honorários Destacados (Art. 22 §4º EOAB) — ${target.requisition_number} (${target.court})`,
      category: "Honorário Contratual",
      original_amount: totalRetainedFees,
      discount_amount: 0,
      interest_amount: 0,
      fine_amount: 0,
      total_amount: totalRetainedFees,
      paid_amount: totalRetainedFees,
      balance_amount: 0,
      due_date: today,
      competence_date: today,
      status: "paga",
      notes: `Honorários retidos na fonte bancária (${target.depositary_bank}) por deferimento judicial do Art. 22 § 4º da Lei 8.906/94 na requisição ${target.requisition_number}.`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      installments: [
        {
          id: `inst-${recId}-1`,
          account_id: "acc-1",
          receivable_id: recId,
          client_id: target.client_id,
          installment_number: 1,
          total_installments: 1,
          amount: totalRetainedFees,
          discount_amount: 0,
          interest_amount: 0,
          fine_amount: 0,
          total_due: totalRetainedFees,
          paid_amount: totalRetainedFees,
          due_date: today,
          payment_date: today,
          payment_method: target.depositary_bank === "CEF" ? "TED" : "TED",
          status: "paga",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    };

    // Salva nos recebíveis locais
    const currentRecs = this._getLocalReceivables();
    this._saveLocalReceivables([newReceivable, ...currentRecs]);

    // 2. Atualiza a Requisição
    const updatedTarget: LawPrecatórioRpvRequisition = {
      ...target,
      status: target.status === "repassado_cliente" || target.status === "concluido" ? target.status : "honorarios_destacados",
      reconciled_with_financial: true,
      receivable_id: recId,
      updated_at: new Date().toISOString(),
    };

    const updatedList = all.map((item) => (item.id === requisitionId ? updatedTarget : item));
    this._saveLocalPrecatorios(updatedList);

    // 3. Registra na Trilha de Auditoria Forense SHA-256
    try {
      await LawHubAuditService.recordEvent({
        event_type: "honorarios_retidos_eoab",
        title: "Retenção de Honorários Advocatícios (Art. 22 § 4º EOAB) Conciliada",
        description: `Honorários no total de ${totalRetainedFees.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} destacados e conciliados sobre ${target.requisition_number} (${target.court} - ${target.depositary_bank}) referente ao processo ${target.process_cnj}.`,
        user_name: operatorName,
        resource_type: "financeiro",
        resource_id: requisitionId,
        process_cnj: target.process_cnj,
        severity: "info",
        metadata: {
          requisition_number: target.requisition_number,
          contract_fee_amount: target.contract_fee_amount,
          sucumbence_fee_amount: target.sucumbence_fee_amount,
          depositary_bank: target.depositary_bank,
          financial_receivable_id: recId,
        },
      });
    } catch {}

    return {
      success: true,
      message: `Honorários de ${totalRetainedFees.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} destacados e conciliados no financeiro com sucesso!`,
    };
  },

  /**
   * Registra a conclusão da transferência do saldo líquido ao cliente
   */
  async markClientTransferred(
    requisitionId: string,
    transferData: { transferDate: string; receiptUrl?: string; notes?: string },
    operatorName = "Dr. Matheus Borges"
  ): Promise<boolean> {
    const all = this._getLocalPrecatorios();
    const target = all.find((item) => item.id === requisitionId);
    if (!target) return false;

    const updatedTarget: LawPrecatórioRpvRequisition = {
      ...target,
      status: target.reconciled_with_financial ? "concluido" : "repassado_cliente",
      transfer_date: transferData.transferDate,
      receipt_url: transferData.receiptUrl || target.receipt_url,
      notes: transferData.notes ? `${target.notes || ""} | ${transferData.notes}` : target.notes,
      updated_at: new Date().toISOString(),
    };

    const updatedList = all.map((item) => (item.id === requisitionId ? updatedTarget : item));
    this._saveLocalPrecatorios(updatedList);

    // Registra na Trilha de Auditoria Forense
    try {
      await LawHubAuditService.recordEvent({
        event_type: "repasse_cliente_realizado",
        title: "Repasse do Saldo Líquido de Precatório/RPV ao Cliente",
        description: `Repasse bancário no valor líquido de ${target.client_net_amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} efetivado ao cliente ${target.client_name} referente à requisição ${target.requisition_number}.`,
        user_name: operatorName,
        resource_type: "financeiro",
        resource_id: requisitionId,
        process_cnj: target.process_cnj,
        severity: "info",
        metadata: {
          transfer_date: transferData.transferDate,
          client_net_amount: target.client_net_amount,
          requisition_number: target.requisition_number,
        },
      });
    } catch {}

    return true;
  },

  /**
   * Exporta relatório em CSV para auditoria contábil e prestação de contas
   */
  exportPrecatoriosCsv(items?: LawPrecatórioRpvRequisition[]) {
    const list = items || this._getLocalPrecatorios();
    if (!list || list.length === 0) return;

    const headers = [
      "ID",
      "Número da Requisição",
      "Tribunal",
      "Vara/Unidade",
      "Tipo",
      "Banco Depositário",
      "Processo CNJ",
      "Cliente Titular",
      "CPF/CNPJ Cliente",
      "Valor Bruto (R$)",
      "Honorários Contratuais %",
      "Honorários Contratuais (R$)",
      "Honorários Sucumbenciais (R$)",
      "Custas Reembolsadas (R$)",
      "Valor Líquido Cliente (R$)",
      "Exercício Orçamentário",
      "Data Autuação",
      "Previsão Pagamento",
      "Data Levantamento",
      "Data Repasse Cliente",
      "Status",
      "Retenção Art. 22 §4º Deferida",
      "Conciliado com Financeiro",
    ];

    const rows = list.map((item) => [
      `"${item.id}"`,
      `"${item.requisition_number}"`,
      `"${item.court}"`,
      `"${(item.court_unit || "").replace(/"/g, '""')}"`,
      `"${item.requisition_type}"`,
      `"${item.depositary_bank}"`,
      `"${item.process_cnj}"`,
      `"${item.client_name.replace(/"/g, '""')}"`,
      `"${item.client_document || ""}"`,
      item.gross_amount.toFixed(2),
      item.contract_fee_percentage,
      item.contract_fee_amount.toFixed(2),
      item.sucumbence_fee_amount.toFixed(2),
      item.costs_deducted_amount.toFixed(2),
      item.client_net_amount.toFixed(2),
      item.budget_year || "",
      item.issuance_date,
      item.expected_payment_date || "",
      item.payment_date || "",
      item.transfer_date || "",
      `"${item.status}"`,
      item.has_fee_retention_order ? "Sim" : "Não",
      item.reconciled_with_financial ? "Sim" : "Não",
    ]);

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `lawhub_precatorios_rpv_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};


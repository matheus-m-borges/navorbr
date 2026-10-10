import type { ContractGenerationParams, ContractSignatureType, ContractStatus, ContractTemplateType, LawContract } from "./contract-types";
import { archiveLawHubContract, createLawHubContract, getLawHubContract, listLawHubContracts, updateLawHubContract, listLawHubContractTemplates } from "./contract.functions";

export const CONTRACT_TEMPLATE_NAMES: Record<ContractTemplateType, string> = { civel: "Cível", trabalhista: "Trabalhista", tributario: "Tributário", familia: "Família", geral: "Geral" };

export function mapContractStatus(status: unknown): ContractStatus {
  if (status === "assinado") return "assinado";
  if (status === "cancelado") return "cancelado";
  if (status === "aguardando_assinatura") return "aguardando_assinatura";
  return "minuta";
}

function mapContract(row: any): LawContract {
  const client = row.law_clients || {};
  return {
    id: row.id,
    contract_number: row.contract_number,
    process_id: row.process_id || undefined,
    client_id: row.client_id,
    client_name: client.name || "",
    client_document: client.document || undefined,
    client_email: client.email || undefined,
    client_phone: client.phone || undefined,
    client_address: client.address || undefined,
    lawyer_name: "",
    lawyer_oab: "",
    office_name: "",
    template_type: "geral",
    title: row.title,
    content: row.content || "",
    honorarios_fixos: Number(row.total_amount || 0),
    honorarios_exito_percentual: Number(row.contingency_percentage || 0),
    status: mapContractStatus(row.status),
    signature_type: "pendente",
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function generateContractText(_params?: ContractGenerationParams): never { throw new Error("A geração exige um template real cadastrado em law_contract_templates."); }
export function generateProcuracaoText(): never { throw new Error("Procuração contratual indisponível até existir template real cadastrado."); }

export const ContractService = {
  async getTemplates(): Promise<any[]> {
    return await listLawHubContractTemplates({ data: {} });
  },
  async getContracts(): Promise<LawContract[]> {
    return (await listLawHubContracts({ data: {} })).map(mapContract);
  },
  async getContractById(id: string): Promise<LawContract | undefined> {
    try {
      const row = await getLawHubContract({ data: { contractId: id } });
      return row ? mapContract(row) : undefined;
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes("não encontrado") || msg.includes("não localizado")) {
        return undefined;
      }
      throw err;
    }
  },
  async getContractsByProcess(processId: string): Promise<LawContract[]> {
    return (await listLawHubContracts({ data: {} }))
      .filter((row: any) => row.process_id === processId)
      .map(mapContract);
  },
  async getContractsByClient(clientId: string): Promise<LawContract[]> {
    return (await listLawHubContracts({ data: { clientId } })).map(mapContract);
  },
  async createContract(params: ContractGenerationParams & { title?: string; customText?: string; template_id?: string }): Promise<LawContract> {
    if (!params.client_id) throw new Error("Selecione um cliente real antes de criar o contrato.");
    if (!params.template_id) throw new Error("Selecione um template real cadastrado antes de criar o contrato.");
    return mapContract(
      await createLawHubContract({
        data: {
          clientId: params.client_id,
          templateId: params.template_id,
          processId: params.process_id,
          contractNumber: "",
          title: params.title || params.client_name || "Contrato de Honorários",
          totalAmount: params.honorarios_fixos,
          contingencyPercentage: params.honorarios_exito_percentual,
        },
      })
    );
  },
  async updateContract(id: string, updates: Partial<LawContract>): Promise<LawContract | undefined> {
    return mapContract(
      await updateLawHubContract({
        data: {
          contractId: id,
          changes: {
            content: updates.content,
            title: updates.title,
            notes: updates.honorarios_descricao,
          },
        },
      })
    );
  },
  async signContract(
    _id: string,
    _signature: {
      signatureType: ContractSignatureType;
      clientSignatureImage?: string;
      lawyerSignatureImage?: string;
      signedByClientName?: string;
      signedByLawyerName?: string;
    }
  ): Promise<LawContract> {
    throw new Error("CONTRACT SIGNATURE = UNAVAILABLE: Assinatura digital ainda não configurada para este ambiente.");
  },
  async uploadPhysicalSignedContract(_id?: string, _file?: { fileName: string; fileUrl?: string }): Promise<LawContract> {
    throw new Error("CONTRACT GED = UNAVAILABLE: GED/Storage para contratos assinados ainda não foi validado.");
  },
  async deleteContract(id: string): Promise<boolean> {
    await archiveLawHubContract({ data: { contractId: id } });
    return true;
  },
};

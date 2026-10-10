export type ContractStatus = "minuta" | "aguardando_assinatura" | "assinado" | "cancelado";
export type ContractSignatureType = "tablet_touch" | "digital" | "upload_digitalizado" | "pendente";
export type ContractTemplateType = "civel" | "trabalhista" | "tributario" | "familia" | "geral";

export interface LawContract {
  id: string;
  contract_number: string; // Ex: CTR-2026/042
  process_id?: string;
  process_cnj?: string;
  process_title?: string;
  client_id?: string;
  client_name: string;
  client_document?: string; // CPF ou CNPJ
  client_rg?: string;
  client_civil_status?: string;
  client_profession?: string;
  client_email?: string;
  client_phone?: string;
  client_address?: string;
  lawyer_id?: string;
  lawyer_name: string;
  lawyer_oab: string;
  office_name: string;
  office_cnpj?: string;
  office_address?: string;
  template_type: ContractTemplateType;
  title: string;
  content: string; // Texto integral das cláusulas
  honorarios_fixos?: number;
  honorarios_exito_percentual?: number;
  honorarios_descricao?: string;
  forma_pagamento?: string;
  status: ContractStatus;
  signature_type?: ContractSignatureType;
  signed_at?: string;
  signed_by_client_name?: string;
  signed_by_lawyer_name?: string;
  client_signature_image?: string; // Data URL Base64 do desenho da assinatura
  lawyer_signature_image?: string;
  digital_certificate_hash?: string;
  uploaded_file_name?: string;
  uploaded_file_url?: string;
  created_at: string;
  updated_at?: string;
}

export interface ContractGenerationParams {
  process_id?: string;
  process_cnj?: string;
  process_title?: string;
  court?: string;
  vara?: string;
  case_value?: number;
  client_id?: string;
  client_name: string;
  client_document?: string;
  client_rg?: string;
  client_civil_status?: string;
  client_profession?: string;
  client_email?: string;
  client_phone?: string;
  client_address?: string;
  lawyer_name?: string;
  lawyer_oab?: string;
  office_name?: string;
  office_cnpj?: string;
  office_address?: string;
  template_type?: ContractTemplateType;
  honorarios_fixos?: number;
  honorarios_exito_percentual?: number;
  forma_pagamento?: string;
}

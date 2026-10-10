import React, { useState, useEffect } from "react";
import {
  X,
  FileSignature,
  User,
  Scale,
  DollarSign,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ContractTemplateType, LawContract } from "@/lib/lawhub/contract-types";
import { ContractService } from "@/lib/lawhub/contract-service";
import { listLawHubContractClients, listLawHubContractTemplates } from "@/lib/lawhub/contract.functions";
import type { LawClient } from "@/lib/lawhub/types";

interface NewContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (contract: LawContract) => void;
  initialTemplate?: ContractTemplateType;
  initialTemplateId?: string;
  initialClientId?: string;
  initialProcessId?: string;
}

export function NewContractModal({
  isOpen,
  onClose,
  onSuccess,
  initialTemplate = "civel",
  initialTemplateId,
  initialClientId,
  initialProcessId,
}: NewContractModalProps) {
  const [template, setTemplate] = useState<ContractTemplateType | "procuracao">(initialTemplate);
  const [clients, setClients] = useState<LawClient[]>([]);
  const [templates, setTemplates] = useState<Array<{ id: string; title: string; legal_area: string; content: string }>>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState(initialTemplateId || "");

  // Estados de carregamento e erro (sem mascaramento)
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [clientsError, setClientsError] = useState<string | null>(null);
  const [templatesError, setTemplatesError] = useState<string | null>(null);

  // Seleção e dados do cliente
  const [selectedClientId, setSelectedClientId] = useState<string>(initialClientId || "");
  const [clientName, setClientName] = useState("");
  const [clientDocument, setClientDocument] = useState("");
  const [clientRg, setClientRg] = useState("");
  const [clientCivilStatus, setClientCivilStatus] = useState("");
  const [clientProfession, setClientProfession] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientAddress, setClientAddress] = useState("");

  // Processo (preservando vínculo da origem quando fornecido)
  const [selectedProcessId, setSelectedProcessId] = useState<string>(initialProcessId || "");
  const [processCnj, setProcessCnj] = useState("");
  const [processTitle, setProcessTitle] = useState("");
  const [processVara, setProcessVara] = useState("");
  const [caseValue, setCaseValue] = useState<number | undefined>(undefined);

  // Parâmetros financeiros
  const [honorariosFixos, setHonorariosFixos] = useState("");
  const [honorariosExito, setHonorariosExito] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("");

  // Advogado responsável
  const [lawyerName, setLawyerName] = useState("");
  const [lawyerOab, setLawyerOab] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialProcessId) {
      setSelectedProcessId(initialProcessId);
    }
  }, [initialProcessId]);

  // Carregar lista de clientes e templates reais do LawHub
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoadingClients(true);
    setIsLoadingTemplates(true);
    setClientsError(null);
    setTemplatesError(null);
    setSelectedClientId(initialClientId || "");
    setSelectedTemplateId(initialTemplateId || "");

    listLawHubContractClients({ data: {} })
      .then((cls) => {
        if (!isMounted) return;
        const clientList = (cls || []) as unknown as LawClient[];
        setClients(clientList);
        if (initialClientId) {
          const found = clientList.find((c) => c.id === initialClientId);
          if (found) fillClientFields(found);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setClients([]);
        setClientsError("Serviço de clientes temporariamente indisponível.");
      })
      .finally(() => {
        if (isMounted) setIsLoadingClients(false);
      });

    listLawHubContractTemplates({ data: {} })
      .then((realTemplates) => {
        if (!isMounted) return;
        const tplList = (realTemplates || []) as unknown as typeof templates;
        setTemplates(tplList);

        if (initialTemplateId && tplList.length > 0) {
          const foundT = tplList.find((t) => t.id === initialTemplateId);
          if (foundT) setSelectedTemplateId(foundT.id);
        } else if (!initialTemplateId) {
          setSelectedTemplateId("");
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setTemplates([]);
        setTemplatesError("Serviço de modelos de contrato temporariamente indisponível.");
      })
      .finally(() => {
        if (isMounted) setIsLoadingTemplates(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, initialClientId, initialTemplateId]);

  const fillClientFields = (c: LawClient) => {
    setSelectedClientId(c.id);
    setClientName(c.name || "");
    setClientDocument(c.document || "");
    setClientRg(c.rg || "");
    setClientCivilStatus(c.marital_status || "brasileiro(a), maior");
    setClientProfession(c.profession || "");
    setClientEmail(c.email || "");
    setClientPhone(c.mobile || c.phone || "");
    
    const addrParts = [
      c.address,
      c.city ? `${c.city} - ${c.state || "PI"}` : "",
      c.zip_code ? `CEP ${c.zip_code}` : "",
    ].filter(Boolean);
    setClientAddress(addrParts.join(", ") || "Endereço em cadastro");
  };

  const handleSelectClient = (clientId: string) => {
    setSelectedClientId(clientId);
    if (!clientId) {
      setClientName("");
      setClientDocument("");
      setClientRg("");
      setClientCivilStatus("");
      setClientProfession("");
      setClientEmail("");
      setClientPhone("");
      setClientAddress("");
      return;
    }

    const c = clients.find((item) => item.id === clientId);
    if (c) {
      fillClientFields(c);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting) {
      return;
    }

    if (isLoadingClients || isLoadingTemplates) {
      toast.error("Os dados do contrato ainda estão sendo carregados. Aguarde a conclusão.");
      return;
    }

    if (clientsError || templatesError) {
      toast.error("Não é possível emitir contrato enquanto houver serviços indisponíveis.");
      return;
    }

    if (!selectedClientId) {
      toast.error("Por favor, selecione um cliente cadastrado.");
      return;
    }

    if (!selectedTemplateId) {
      toast.error("Por favor, selecione um modelo de contrato cadastrado.");
      return;
    }

    const selectedClient = clients.find((c) => c.id === selectedClientId);
    if (!selectedClient) {
      toast.error("Cliente selecionado não foi localizado na lista de clientes carregada.");
      return;
    }

    const selectedTemplate = templates.find((item) => item.id === selectedTemplateId);
    if (!selectedTemplate) {
      toast.error("Modelo de contrato selecionado não foi localizado.");
      return;
    }

    setIsSubmitting(true);
    try {
      const fixosNum = parseFloat(honorariosFixos.replace(/\./g, "").replace(",", ".")) || 0;
      const exitoNum = parseFloat(honorariosExito.replace(",", ".")) || 0;

      const newContract = await ContractService.createContract({
        process_id: selectedProcessId || undefined,
        process_cnj: processCnj.trim() || undefined,
        process_title: processTitle.trim() || undefined,
        vara: processVara.trim() || undefined,
        case_value: caseValue,
        client_id: selectedClient.id,
        client_name: clientName.trim(),
        client_document: clientDocument.trim() || undefined,
        client_rg: clientRg.trim() || undefined,
        client_civil_status: clientCivilStatus.trim() || undefined,
        client_profession: clientProfession.trim() || undefined,
        client_email: clientEmail.trim() || undefined,
        client_phone: clientPhone.trim() || undefined,
        client_address: clientAddress.trim() || undefined,
        lawyer_name: lawyerName.trim() || undefined,
        lawyer_oab: lawyerOab.trim() || undefined,
        template_type: "geral",
        honorarios_fixos: fixosNum,
        honorarios_exito_percentual: exitoNum,
        forma_pagamento: formaPagamento.trim() || undefined,
        template_id: selectedTemplate.id,
      });

      toast.success(`Contrato de honorários ${newContract.contract_number} gerado com sucesso!`);
      onSuccess(newContract);
      onClose();
    } catch (err: any) {
      toast.error("Erro ao gerar instrumento: " + (err.message || "Erro desconhecido."));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-850">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
              <FileSignature className="size-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Emitir Instrumento Jurídico & Contrato de Honorários
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Preenchimento automático com cadastro do cliente, processo CNJ e cláusulas forenses especializadas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Corpo com scroll */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {/* 1. Escolha do Modelo / Template */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
              1. Selecione o Modelo Forense Base:
            </label>
            {templatesError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
                <p className="font-semibold">Serviço de modelos indisponível</p>
                <p className="text-[11px] mt-0.5">{templatesError}</p>
              </div>
            ) : isLoadingTemplates ? (
              <p className="text-xs text-slate-500">Carregando modelos de contrato...</p>
            ) : templates.length === 0 ? (
              <p className="text-xs text-slate-500">Nenhum modelo de contrato ativo cadastrado para a sua conta.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {templates.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedTemplateId(item.id)}
                    className={cn(
                      "rounded-xl border p-3 text-left transition cursor-pointer flex flex-col justify-between",
                      selectedTemplateId === item.id
                        ? "border-blue-600 bg-blue-50/80 shadow-xs dark:border-blue-500 dark:bg-blue-950/40"
                        : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-white">{item.title}</span>
                      {selectedTemplateId === item.id && <CheckCircle2 className="size-3.5 text-blue-600" />}
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">{item.legal_area}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 2. Seleção e Dados do Contratante / Cliente */}
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-850/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <User className="size-3.5 text-blue-600" />
                2. Dados do Contratante (Cliente)
              </span>
              {clients.length > 0 && !clientsError && (
                <span className="text-[10px] text-slate-400">
                  {clients.length} clientes disponíveis no LawHub
                </span>
              )}
            </div>

            {/* Dropdown de Clientes Cadastrados */}
            {clientsError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
                <p className="font-semibold">Serviço de clientes indisponível</p>
                <p className="text-[11px] mt-0.5">{clientsError}</p>
              </div>
            ) : isLoadingClients ? (
              <p className="text-xs text-slate-500">Carregando clientes cadastrados...</p>
            ) : (
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Cliente Contratante (obrigatório cadastro prévio no LawHub) *:
                </label>
                <select
                  value={selectedClientId}
                  onChange={(e) => handleSelectClient(e.target.value)}
                  required
                  disabled={clients.length === 0}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">
                    {clients.length === 0
                      ? "-- Nenhum cliente cadastrado no LawHub --"
                      : "-- Selecione o Cliente Cadastrado * --"}
                  </option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.document ? `(${c.document})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Nome Completo / Razão Social *:
                </label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Ex: Ana Karla Carvalho de Araújo Costa Moura"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  CPF ou CNPJ:
                </label>
                <input
                  type="text"
                  value={clientDocument}
                  onChange={(e) => setClientDocument(e.target.value)}
                  placeholder="000.000.000-00"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  RG / Órgão Emissor:
                </label>
                <input
                  type="text"
                  value={clientRg}
                  onChange={(e) => setClientRg(e.target.value)}
                  placeholder="Ex: 3.456.789 SSP/PI"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Profissão & Estado Civil:
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="text"
                    value={clientProfession}
                    onChange={(e) => setClientProfession(e.target.value)}
                    placeholder="Ex: Servidora Pública"
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <input
                    type="text"
                    value={clientCivilStatus}
                    onChange={(e) => setClientCivilStatus(e.target.value)}
                    placeholder="Ex: casada"
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Endereço Residencial / Sede Completo:
                </label>
                <input
                  type="text"
                  value={clientAddress}
                  onChange={(e) => setClientAddress(e.target.value)}
                  placeholder="Rua, número, complemento, bairro, cidade e CEP"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* 3. Vinculação ao Processo Judicial */}
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-850/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Scale className="size-3.5 text-blue-600" />
                3. Processo Judicial / Demanda Envolvida
              </span>
              <span className="text-[10px] text-slate-400">
                {selectedProcessId ? "Vinculado pela origem" : "Contrato avulso"}
              </span>
            </div>

            {selectedProcessId ? (
              <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 text-xs text-blue-900 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300 flex items-center justify-between">
                <div>
                  <span className="font-bold">Processo vinculado pela origem</span>
                  <p className="text-[11px] text-blue-700 dark:text-blue-400 mt-0.5 font-mono">ID: {selectedProcessId}</p>
                </div>
                <span className="text-[10px] font-semibold uppercase bg-blue-100 dark:bg-blue-900/60 px-2 py-0.5 rounded text-blue-800 dark:text-blue-200">
                  Vinculado
                </span>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 p-3 text-xs text-slate-500">
                <span>Contrato avulso / sem processo vinculado pela origem (opcional para fase consultiva ou pré-processual).</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Número CNJ:
                </label>
                <input
                  type="text"
                  value={processCnj}
                  onChange={(e) => setProcessCnj(e.target.value)}
                  placeholder="0000000-00.0000.0.00.0000"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Juízo / Vara / Tribunal:
                </label>
                <input
                  type="text"
                  value={processVara}
                  onChange={(e) => setProcessVara(e.target.value)}
                  placeholder="Ex: 2ª Vara Cível da Comarca de Teresina - PI"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Título / Objeto da Demanda:
                </label>
                <input
                  type="text"
                  value={processTitle}
                  onChange={(e) => setProcessTitle(e.target.value)}
                  placeholder="Ex: Ação de Cobrança c/c Cumprimento de Sentença"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* 4. Condições Financeiras (Oculto se for Procuração) */}
          {template !== "procuracao" && (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-850/50">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <DollarSign className="size-3.5 text-emerald-600" />
                4. Cláusulas Financeiras & Honorários Advocatícios
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Honorários Fixos / Pró-Labore (R$):
                  </label>
                  <input
                    type="text"
                    value={honorariosFixos}
                    onChange={(e) => setHonorariosFixos(e.target.value)}
                    placeholder="Ex: 3.500,00"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Honorários de Êxito / Quota Litis (%):
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={honorariosExito}
                    onChange={(e) => setHonorariosExito(e.target.value)}
                    placeholder="Ex: 20"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Limite ético OAB: proveito líquido não inferior à remuneração
                  </span>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Condições e Forma de Pagamento:
                  </label>
                  <input
                    type="text"
                    value={formaPagamento}
                    onChange={(e) => setFormaPagamento(e.target.value)}
                    placeholder="Ex: R$ 1.500 no ato da assinatura e 3 parcelas de R$ 1.000 via Pix"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 5. Advogado Responsável */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Patrono Responsável:
              </label>
              <input
                type="text"
                value={lawyerName}
                onChange={(e) => setLawyerName(e.target.value)}
                placeholder="Ex: Dr(a). Nome do Patrono"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Inscrição OAB:
              </label>
              <input
                type="text"
                value={lawyerOab}
                onChange={(e) => setLawyerOab(e.target.value)}
                placeholder="Ex: OAB/UF 00.000"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>
        </form>

        {/* Rodapé de Ações */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-850">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Sparkles className="size-3.5 text-blue-600" />
            <span>Minuta vinculada a modelo persistido. Assinatura e GED indisponíveis neste bloco.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={
                isSubmitting ||
                !selectedClientId ||
                !selectedTemplateId ||
                !!clientsError ||
                !!templatesError ||
                isLoadingClients ||
                isLoadingTemplates
              }
              onClick={handleSubmit}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 font-bold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 transition cursor-pointer"
            >
              <FileSignature className="size-4" />
              <span>{isSubmitting ? "Gerando Minuta..." : "Gerar Instrumento Contratual"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

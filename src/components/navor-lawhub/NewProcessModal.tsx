import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Search,
  Plus,
  Sparkles,
  Zap,
  Building2,
  Lock,
  Globe2,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Scale,
  Clock,
  User,
  ExternalLink,
  Layers,
  KeyRound,
  ShieldAlert,
  HelpCircle,
  CheckSquare,
  Square,
  Info,
  ChevronRight,
  Fingerprint,
  Tag,
  UserCheck,
  Pencil,
  FolderOpen,
  Folder,
  Paperclip,
  Upload,
  Eye,
  EyeOff,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LawHubService, INITIAL_CLIENTS } from "@/lib/lawhub/lawhub-service";
import { DataJudService } from "@/lib/lawhub/datajud-service";
import { EscavadorService } from "@/lib/lawhub/escavador-service";
import { LegalProviderManager } from "@/lib/lawhub/legal-provider-manager";
import { formatCNJ, detectCourtFromCNJ } from "@/products/lawhub/domain/cnj-detector";
import type { LawProcess, ProcessSearchResultItem } from "@/lib/lawhub/types";
import { useNavigate } from "@tanstack/react-router";

const TRIBUNAIS_LISTA = [
  { group: "Justiça Estadual", items: [
    { code: "TJPI", name: "TJPI - Tribunal de Justiça do Piauí", system: "pje" },
    { code: "TJSP", name: "TJSP - Tribunal de Justiça de São Paulo", system: "esaj" },
    { code: "TJRJ", name: "TJRJ - Tribunal de Justiça do Rio de Janeiro", system: "pje" },
    { code: "TJMG", name: "TJMG - Tribunal de Justiça de Minas Gerais", system: "pje" },
    { code: "TJBA", name: "TJBA - Tribunal de Justiça da Bahia", system: "pje" },
    { code: "TJPR", name: "TJPR - Tribunal de Justiça do Paraná", system: "projudi" },
    { code: "TJRS", name: "TJRS - Tribunal de Justiça do Rio Grande do Sul", system: "eproc" },
    { code: "TJSC", name: "TJSC - Tribunal de Justiça de Santa Catarina", system: "eproc" },
    { code: "TJCE", name: "TJCE - Tribunal de Justiça do Ceará", system: "esaj" },
    { code: "TJMA", name: "TJMA - Tribunal de Justiça do Maranhão", system: "pje" },
    { code: "TJGO", name: "TJGO - Tribunal de Justiça de Goiás", system: "pje" },
    { code: "TJPE", name: "TJPE - Tribunal de Justiça de Pernambuco", system: "pje" },
    { code: "TJDFT", name: "TJDFT - Distrito Federal e Territórios", system: "pje" },
  ]},
  { group: "Justiça Federal", items: [
    { code: "TRF1", name: "TRF1 - 1ª Região (DF, PI, MA, GO, etc.)", system: "pje" },
    { code: "TRF2", name: "TRF2 - 2ª Região (RJ e ES)", system: "eproc" },
    { code: "TRF3", name: "TRF3 - 3ª Região (SP e MS)", system: "pje" },
    { code: "TRF4", name: "TRF4 - 4ª Região (RS, PR, SC)", system: "eproc" },
    { code: "TRF5", name: "TRF5 - 5ª Região (PE, CE, RN, PB, AL, SE)", system: "pje" },
    { code: "TRF6", name: "TRF6 - 6ª Região (Minas Gerais)", system: "pje" },
  ]},
  { group: "Justiça do Trabalho", items: [
    { code: "TRT22", name: "TRT22 - 22ª Região (Piauí)", system: "pje" },
    { code: "TRT2", name: "TRT2 - 2ª Região (São Paulo - Capital/Litoral)", system: "pje" },
    { code: "TRT15", name: "TRT15 - 15ª Região (Campinas/SP)", system: "pje" },
    { code: "TRT1", name: "TRT1 - 1ª Região (Rio de Janeiro)", system: "pje" },
    { code: "TRT3", name: "TRT3 - 3ª Região (Minas Gerais)", system: "pje" },
    { code: "TRT4", name: "TRT4 - 4ª Região (Rio Grande do Sul)", system: "pje" },
    { code: "TRT5", name: "TRT5 - 5ª Região (Bahia)", system: "pje" },
  ]},
  { group: "Tribunais Superiores", items: [
    { code: "STJ", name: "STJ - Superior Tribunal de Justiça", system: "pje" },
    { code: "STF", name: "STF - Supremo Tribunal Federal", system: "outro" },
    { code: "TST", name: "TST - Tribunal Superior do Trabalho", system: "pje" },
  ]}
];

interface NewProcessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (process: LawProcess) => void;
  onOpenOABSync?: () => void;
  initialCnj?: string;
  initialProcessData?: Partial<ProcessSearchResultItem | LawProcess>;
  initialMode?: "cnj" | "tribunal_orgao" | "lote_oab" | "manual" | "cadastro_manual";
}

export function NewProcessModal({
  isOpen,
  onClose,
  onSuccess,
  onOpenOABSync,
  initialCnj = "",
  initialProcessData,
  initialMode = "cnj",
}: NewProcessModalProps) {
  const navigate = useNavigate();

  // Tab Principal de Navegação
  const [activeTab, setActiveTab] = useState<"cnj" | "tribunal_orgao" | "lote_oab" | "cadastro_manual">(
    initialMode === "manual" || initialMode === "cadastro_manual" ? "cadastro_manual" : initialMode
  );

  // Estados da Modalidade 1: Busca pelo Número CNJ
  const [autoCnj, setAutoCnj] = useState(initialCnj ? formatCNJ(initialCnj) : "");
  const [isSearchingCourt, setIsSearchingCourt] = useState(false);
  const [foundCourtData, setFoundCourtData] = useState<any | null>(null);
  const [selectedClientForAuto, setSelectedClientForAuto] = useState("");

  // Estados de Conferência Prévia de Dados e Ajuste de Partes
  const [selectedPartyAsClient, setSelectedPartyAsClient] = useState<"autor" | "reu" | "outro">("autor");
  const [customClientName, setCustomClientName] = useState("");
  const [processTitle, setProcessTitle] = useState("");
  const [folderName, setFolderName] = useState("");
  const [autoInstance, setAutoInstance] = useState<"1grau" | "2grau" | "superior">("1grau");
  const [autoNotes, setAutoNotes] = useState("");
  const [autoMonitoring, setAutoMonitoring] = useState(true);
  const [responsibleLawyer, setResponsibleLawyer] = useState("Dr. Matheus Borges");
  const [selectedTags, setSelectedTags] = useState<string[]>(["Cível", "Monitoramento"]);
  const [newTagInput, setNewTagInput] = useState("");
  const [customCaseValue, setCustomCaseValue] = useState("");

  // Estados de Anexos Iniciais (Visíveis para Cliente e Advogado)
  const [initialAttachments, setInitialAttachments] = useState<Array<{
    id: string;
    name: string;
    file_name: string;
    file_size: string;
    category: string;
    visible_to_client: boolean;
    file_url?: string;
  }>>([]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newItems = Array.from(files).map((file, idx) => {
      const sizeInMB = file.size / (1024 * 1024);
      const formattedSize = sizeInMB >= 1 ? `${sizeInMB.toFixed(1)} MB` : `${Math.round(file.size / 1024)} KB`;

      let detectedCat = "geral";
      const lowerName = file.name.toLowerCase();
      if (lowerName.includes("peticao") || lowerName.includes("inicial")) detectedCat = "peticao";
      else if (lowerName.includes("procuracao")) detectedCat = "procuracao";
      else if (lowerName.includes("contrato")) detectedCat = "contrato";
      else if (lowerName.includes("comprovante") || lowerName.includes("residencia") || lowerName.includes("renda")) detectedCat = "comprovante";
      else if (lowerName.includes("rg") || lowerName.includes("cpf") || lowerName.includes("cnh")) detectedCat = "documento_pessoal";

      return {
        id: `att-${Date.now()}-${idx}`,
        name: file.name.replace(/\.[^/.]+$/, ""),
        file_name: file.name,
        file_size: formattedSize,
        category: detectedCat,
        visible_to_client: true, // Por padrão compartilhado com cliente e advogado
        file_url: URL.createObjectURL(file),
      };
    });

    setInitialAttachments((prev) => [...prev, ...newItems]);
    toast.success(`${newItems.length} documento(s) anexado(s) com sucesso!`);
    e.target.value = "";
  };

  const handleRemoveAttachment = (id: string) => {
    setInitialAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleToggleVisibility = (id: string) => {
    setInitialAttachments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, visible_to_client: !a.visible_to_client } : a))
    );
  };

  // Sincronizar dados recebidos via initialProcessData ou initialCnj
  useEffect(() => {
    if (isOpen) {
      if (initialProcessData) {
        const src = initialProcessData as any;
        const rawCnj = src.cnj || src.cnj_number || "";
        const formatted = rawCnj ? formatCNJ(rawCnj) : "";
        setAutoCnj(formatted);

        const autorName = src.autor || src.active_pole || src.title?.split(" x ")[0] || "";
        const reuName = src.reu || src.passive_pole || src.title?.split(" x ")[1] || "";

        setFoundCourtData({
          cnj: formatted,
          court: src.court || "TJPI",
          vara: src.vara || src.judicial_branch || "1ª Vara Cível",
          comarca: src.comarca || src.judicial_district || "Comarca Central",
          classe: src.classe || src.procedural_class || "Procedimento Comum Cível",
          autor: autorName,
          reu: reuName,
          lastMovement: src.lastMovement || src.last_movement || "Autos localizados via tribunal",
          movements: src.movements || [],
          caseValue: src.caseValue || src.case_value || 0,
        });

        setCustomClientName(src.client_name || autorName);
        setProcessTitle(src.title || (autorName && reuName ? `${autorName} x ${reuName}` : ""));
        setFolderName(src.folder_name || "");
        setAutoInstance(src.instance || "1grau");
        setSelectedTags(src.tags || ["Cível", "Monitoramento"]);
        
        const cValue = src.caseValue || src.case_value;
        if (cValue) {
          setCustomCaseValue(Number(cValue).toLocaleString("pt-BR", { minimumFractionDigits: 2 }));
        }

        setAutoMonitoring(src.monitoring_type !== "manual");
        setActiveTab("cnj");
      } else if (initialCnj) {
        setAutoCnj(formatCNJ(initialCnj));
      }
    }
  }, [isOpen, initialProcessData, initialCnj]);

  // Estados específicos da Pasta Manual
  const [manualResponsible, setManualResponsible] = useState("Dr. Matheus Borges");
  const [manualTags, setManualTags] = useState<string[]>(["Físico"]);
  const [manualNewTag, setManualNewTag] = useState("");

  // Membros do escritório para atribuição de responsável
  const OFFICE_LAWYERS = [
    "Dr. Matheus Borges",
    "Dra. Camila Vasconcelos",
    "Dr. Felipe Nogueira",
  ];

  // Tags disponíveis para seleção rápida
  const AVAILABLE_QUICK_TAGS = [
    "Urgente",
    "Liminar Deferida",
    "Cível",
    "Trabalhista",
    "Família",
    "Execução",
    "Consumidor",
    "Contratos",
    "Aguardando Sentença",
  ];

  // Detecção Inteligente do Tribunal a partir do CNJ digitado
  const detectedCourt = useMemo(() => {
    return detectCourtFromCNJ(autoCnj);
  }, [autoCnj]);

  // Estados da Modalidade 2: Busca por Tribunal / Órgão & Com Identificação
  const [selectedCourt, setSelectedCourt] = useState("TJPI");
  const [selectedInstance, setSelectedInstance] = useState<"1grau" | "2grau" | "superior">("1grau");
  const [authType, setAuthType] = useState<"publica" | "identificacao" | "segredo">("publica");
  const [courtSystemRule, setCourtSystemRule] = useState<"pje" | "esaj" | "eproc" | "projudi">("pje");
  
  // Credenciais do Tribunal (Identificação / Segredo)
  const [userCpf, setUserCpf] = useState("");
  const [courtPassword, setCourtPassword] = useState("");
  const [seedToken, setSeedToken] = useState("");
  const [useCertificateA1, setUseCertificateA1] = useState(false);
  const [balcaoVirtualPassword, setBalcaoVirtualPassword] = useState("");

  // Estados da Modalidade 3: Busca em Lote pela OAB
  const [oabNumber, setOabNumber] = useState("");
  const [oabUf, setOabUf] = useState("PI");
  const [isSearchingLote, setIsSearchingLote] = useState(false);
  const [loteResults, setLoteResults] = useState<any[]>([]);
  const [selectedLoteIds, setSelectedLoteIds] = useState<string[]>([]);
  const [loteSearched, setLoteSearched] = useState(false);

  // Estados da Modalidade 4: Cadastro Manual
  const [manualCnj, setManualCnj] = useState("");
  const [manualClient, setManualClient] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualAction, setManualAction] = useState("Procedimento Comum Cível");
  const [manualCourt, setManualCourt] = useState("5ª Vara Cível de Teresina");
  const [manualInstance, setManualInstance] = useState<"1grau" | "2grau" | "superior">("1grau");
  const [manualValue, setManualValue] = useState("");
  const [manualIsAdministrative, setManualIsAdministrative] = useState(false);
  const [manualNotes, setManualNotes] = useState("");

  // Prevenção de Duplicidade no Acervo
  const [duplicateProcess, setDuplicateProcess] = useState<LawProcess | null>(null);

  // Auto-ajustar sistema do tribunal quando tribunal mudar
  useEffect(() => {
    for (const group of TRIBUNAIS_LISTA) {
      const match = group.items.find((i) => i.code === selectedCourt);
      if (match) {
        setCourtSystemRule((match.system as any) || "pje");
        break;
      }
    }
  }, [selectedCourt]);

  // Se CNJ detectar tribunal, sincroniza
  useEffect(() => {
    if (detectedCourt?.courtInitials && detectedCourt.courtInitials !== "Tribunal Judicial") {
      setSelectedCourt(detectedCourt.courtInitials);
    }
  }, [detectedCourt]);

  // Checagem contínua de duplicidade
  useEffect(() => {
    const candidateNumber = activeTab === "cadastro_manual" ? manualCnj : autoCnj;
    if (candidateNumber.replace(/\D/g, "").length >= 12) {
      const match = LawHubService.checkDuplicateCNJ(candidateNumber);
      setDuplicateProcess(match || null);
    } else {
      setDuplicateProcess(null);
    }
  }, [autoCnj, manualCnj, activeTab]);

  // Sincronizar estado inicial ao abrir modal
  useEffect(() => {
    if (isOpen) {
      if (initialMode === "manual" || initialMode === "cadastro_manual") {
        setActiveTab("cadastro_manual");
      } else if (initialMode) {
        setActiveTab(initialMode);
      }
      if (initialCnj) {
        const formatted = formatCNJ(initialCnj);
        setAutoCnj(formatted);
        setManualCnj(formatted);
      }
    }
  }, [isOpen, initialMode, initialCnj]);

  if (!isOpen) return null;

  // 1. Execução de Busca no Tribunal por CNJ
  const handleSearchCourtCNJ = async () => {
    const cleanNumber = autoCnj.replace(/\D/g, "");
    if (cleanNumber.length < 15) {
      toast.error("Informe um número CNJ válido de 20 dígitos.");
      return;
    }

    setIsSearchingCourt(true);
    setFoundCourtData(null);
    toast.loading("Consultando base oficial do tribunal e DJEN...", { id: "search-court" });

    try {
      const courtName = detectedCourt?.courtInitials || selectedCourt || "TJPI";
      let resolvedData: any = null;

      const providerResult = await LegalProviderManager.searchProcessUnified(autoCnj);
      if (providerResult.success && providerResult.process) {
        const p = providerResult.process;
        resolvedData = {
          cnj: autoCnj,
          court: p.court,
          classe: p.procedural_class,
          vara: p.judicial_branch,
          comarca: p.judicial_district,
          autor: p.active_pole,
          reu: p.passive_pole,
          caseValue: p.case_value,
          lastMovement: p.last_movement,
          movements: p.movements || [],
          provider: providerResult.providerUsed,
        };
      }

      // Se nenhum web service retornou os autos reais, reporta fielmente ao usuário
      if (!resolvedData) {
        setIsSearchingCourt(false);
        toast.error("Processo não localizado nas bases oficiais integradas (Escavador / DataJud). Verifique a numeração CNJ ou cadastre os dados pela aba 'Cadastro Manual'.", { id: "search-court", duration: 5000 });
        return;
      }

      setFoundCourtData(resolvedData);
      setProcessTitle(`${resolvedData.autor} x ${resolvedData.reu}`);
      setCustomClientName(resolvedData.autor);
      setSelectedPartyAsClient("autor");
      setCustomCaseValue(resolvedData.caseValue ? String(resolvedData.caseValue) : "");
      toast.success(`Autos reais localizados no ${resolvedData.court}! Confira os dados antes de adicionar.`, { id: "search-court" });
    } catch {
      toast.error("Tribunal indisponível no momento. Você pode cadastrar e o radar tentará sincronizar em segundo plano.", { id: "search-court" });
    } finally {
      setIsSearchingCourt(false);
    }
  };

  // 2. Execução da Busca em Lote pela OAB
  const handleExecuteLoteOAB = async () => {
    if (!oabNumber.trim()) {
      toast.error("Informe o número da OAB para busca em lote.");
      return;
    }

    setIsSearchingLote(true);
    toast.loading(`Consultando acervo da OAB/${oabUf} nos tribunais e Escavador API...`, { id: "lote-oab" });

    try {
      // 1. Tentar busca real na Escavador API v2
      const escavadorRes = await EscavadorService.searchByOAB(oabNumber, oabUf);
      if (escavadorRes.success && escavadorRes.processes.length > 0) {
        const mapped = escavadorRes.processes.map((p, idx) => ({
          id: p.id || `escavador-lote-${idx}`,
          cnj: p.cnj_number,
          court: p.court,
          title: p.title,
          action: p.procedural_class,
          status: p.status === "arquivado" ? "Arquivado" : "Ativo",
          lastMove: p.last_movement,
          raw: p,
        }));
        setLoteResults(mapped);
        setSelectedLoteIds(mapped.map((m) => m.id));
        setLoteSearched(true);
        setIsSearchingLote(false);
        toast.success(`${mapped.length} processos reais localizados via Escavador API!`, { id: "lote-oab" });
        return;
      }
    } catch (jErr) {
      console.warn("Escavador OAB search failed:", jErr);
    }

    // Caso a busca no tribunal não localize processos para esta OAB, reporta com veracidade
    setIsSearchingLote(false);
    setLoteSearched(true);
    setLoteResults([]);
    setSelectedLoteIds([]);
    toast.info(`Nenhum processo localizado para a OAB/${oabUf} ${oabNumber} no datalake oficial. Verifique os dados ou cadastre os autos individualmente.`, { id: "lote-oab", duration: 5000 });
  };

  // Salvar Processo Importado (CNJ ou Tribunal)
  const handleSaveProcess = async (e: React.FormEvent) => {
    e.preventDefault();

    const cnjToSave = activeTab === "cadastro_manual" ? manualCnj : autoCnj;
    if (!cnjToSave.trim() && activeTab !== "cadastro_manual") {
      toast.error("Informe o número do processo.");
      return;
    }

    if (duplicateProcess) {
      toast.warning("Este processo já está cadastrado no seu acervo.");
      return;
    }

    const courtInfo = foundCourtData || {
      cnj: cnjToSave,
      court: detectedCourt?.courtInitials || selectedCourt,
      classe: "Procedimento Comum Cível",
      vara: "Vara Cível",
      comarca: "Capital",
      autor: "Autor / Exequente",
      reu: "Réu / Executado",
      lastMovement: "Importado via busca automática do NAVOR LawHub",
      movements: [],
    };

    const isSecretProcess = authType === "segredo" || authType === "identificacao";
    const finalClient = customClientName.trim() || selectedClientForAuto || (selectedPartyAsClient === "reu" ? courtInfo.reu : courtInfo.autor);
    const finalTitle = processTitle.trim() || `${courtInfo.autor} x ${courtInfo.reu}`;
    const finalPartyPosition = selectedPartyAsClient === "reu" ? "passivo" : "ativo";

    const newProc = await LawHubService.createProcess({
      client_id: undefined,
      client_name: finalClient,
      cnj_number: cnjToSave.trim(),
      folder_name: folderName.trim() || undefined,
      title: finalTitle,
      active_pole: courtInfo.autor,
      passive_pole: courtInfo.reu,
      party_position: finalPartyPosition,
      responsible_name: responsibleLawyer,
      tags: selectedTags,
      court: courtInfo.court || selectedCourt,
      instance: activeTab === "cnj" ? autoInstance : selectedInstance,
      judicial_branch: courtInfo.vara,
      judicial_district: courtInfo.comarca,
      procedural_class: courtInfo.classe,
      legal_area: "Cível",
      status: "em_andamento",
      is_secret: isSecretProcess,
      monitoring_type: autoMonitoring ? "automatico" : "manual",
      court_linked: autoMonitoring,
      court_sync_system: isSecretProcess
        ? `Autenticado (${courtSystemRule.toUpperCase()})`
        : `DataJud / ${detectedCourt?.systemDisplayName || "PJe Nacional"}`,
      notes: autoNotes.trim() || undefined,
      last_movement: courtInfo.lastMovement,
      movements: courtInfo.movements,
      case_value: customCaseValue ? parseFloat(customCaseValue.replace(/\D/g, "")) / 100 : courtInfo.caseValue,
    });

    if (initialProcessData?.id) {
      try {
        await LawHubService.deleteSearchResult(initialProcessData.id);
      } catch {}
    }

    // Salvar anexos iniciais vinculados ao processo com acesso compartilhado cliente e advogado
    if (initialAttachments.length > 0) {
      for (const att of initialAttachments) {
        LawHubService.addDocument({
          process_id: newProc.id,
          process_cnj: newProc.cnj_number,
          client_name: finalClient,
          title: att.name,
          name: att.name,
          file_name: att.file_name,
          file_size: att.file_size,
          category: att.category,
          visible_to_client: att.visible_to_client,
          date: new Date().toLocaleDateString("pt-BR"),
          created_at: new Date().toISOString(),
          created_by: responsibleLawyer,
          file_url: att.file_url || "#",
        });
      }
    }

    toast.success(`Processo ${newProc.cnj_number} cadastrado com monitoramento contínuo ativado!`);
    if (onSuccess) onSuccess(newProc);
    onClose();
  };

  // Salvar Importação em Lote OAB
  const handleImportLoteSelected = async () => {
    if (selectedLoteIds.length === 0) {
      toast.error("Selecione pelo menos um processo para importar.");
      return;
    }

    const toImport = loteResults.filter((r) => selectedLoteIds.includes(r.id));
    for (const item of toImport) {
      await LawHubService.createProcess({
        client_id: undefined,
        client_name: item.title.split(" x ")[0] || "Cliente Vinculado",
        cnj_number: item.cnj,
        title: item.title,
        active_pole: item.title.split(" x ")[0] || "Requerente",
        passive_pole: item.title.split(" x ")[1] || "Requerido",
        party_position: "ativo",
        court: item.court,
        instance: "1grau",
        judicial_branch: `${item.court} - Vara Cível`,
        procedural_class: item.action,
        legal_area: "Cível",
        status: "em_andamento",
        is_secret: false,
        monitoring_type: "automatico",
        court_linked: true,
        court_sync_system: "DataJud / DJEN",
        last_movement: item.lastMove,
      });
    }

    toast.success(`${toImport.length} processos importados com sucesso para o NAVOR LawHub!`);
    onClose();
    navigate({ to: "/lawhub/processos" });
  };

  // Salvar Cadastro Manual
  const handleSaveManual = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!manualCnj.trim() && !manualTitle.trim()) {
      toast.error("Informe pelo menos o número ou o título da pasta.");
      return;
    }

    if (duplicateProcess) {
      toast.warning("Este processo já está cadastrado no seu acervo.");
      return;
    }

    const newProc = await LawHubService.createProcess({
      client_id: undefined,
      client_name: manualClient.trim() || "Cliente a Definir",
      cnj_number: manualCnj.trim() || `INT-${Date.now()}`,
      title: manualTitle.trim() || `Pasta Manual - ${manualClient || "Sem Título"}`,
      active_pole: manualClient || "Requerente",
      passive_pole: "Parte Contrária",
      party_position: "ativo",
      responsible_name: manualResponsible,
      tags: manualTags,
      court: manualCourt.split(" ")[0] || "Órgão Interno",
      instance: manualInstance,
      judicial_branch: manualCourt,
      procedural_class: manualAction,
      legal_area: "Cível",
      case_value: manualValue ? parseFloat(manualValue.replace(/\D/g, "")) / 100 : undefined,
      status: "em_andamento",
      is_secret: false,
      monitoring_type: "manual",
      court_linked: false,
      court_sync_system: "Manual",
      is_administrative: manualIsAdministrative,
      notes: manualNotes,
      last_movement: "Cadastrado manualmente pelo advogado",
      movements: [
        {
          id: "mov-init-manual",
          date: new Date().toLocaleDateString("pt-BR"),
          text: "Ficha criada manualmente no acervo",
          instance: manualInstance === "1grau" ? "1º Grau" : "2º Grau",
        },
      ],
    });

    // Salvar anexos iniciais vinculados à pasta/processo com acesso compartilhado cliente e advogado
    if (initialAttachments.length > 0) {
      for (const att of initialAttachments) {
        LawHubService.addDocument({
          process_id: newProc.id,
          process_cnj: newProc.cnj_number,
          client_id: newProc.client_id,
          client_name: manualClient.trim() || "Cliente a Definir",
          title: att.name,
          name: att.name,
          file_name: att.file_name,
          file_size: att.file_size,
          category: att.category,
          visible_to_client: att.visible_to_client,
          date: new Date().toLocaleDateString("pt-BR"),
          created_at: new Date().toISOString(),
          created_by: manualResponsible,
          file_url: att.file_url || "#",
        });
      }
    }

    toast.success(`Pasta criada com sucesso! Você poderá vinculá-la a qualquer momento.`);
    if (initialAttachments.length > 0) {
      toast.info(`${initialAttachments.length} anexo(s) salvo(s) e disponibilizado(s) no portal!`);
    }
    if (onSuccess) onSuccess(newProc);
    onClose();
  };

  // Componente de Anexos Iniciais Compartilhados (Cliente & Advogado)
  const renderAttachmentsSection = () => (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 flex items-center justify-center">
            <Paperclip className="size-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>Documentos Iniciais & Anexos</span>
              <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                {initialAttachments.length} anexo(s)
              </span>
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Anexe peças processuais, procurações ou comprovantes. Documentos compartilhados ficam acessíveis para o cliente e advogado.
            </p>
          </div>
        </div>

        {/* Botão de Upload */}
        <label className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 px-3 py-1.5 text-xs font-bold transition cursor-pointer border border-blue-200/60 dark:border-blue-800/60 shadow-2xs">
          <Upload className="size-3.5" />
          <span>Anexar Arquivos</span>
          <input
            type="file"
            multiple
            onChange={handleFileUpload}
            className="sr-only"
            accept=".pdf,.docx,.doc,.jpg,.jpeg,.png"
          />
        </label>
      </div>

      {/* Lista de Arquivos Anexados */}
      {initialAttachments.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 p-3 text-center text-[11px] text-slate-400">
          Nenhum anexo adicionado ainda. Clique em "Anexar Arquivos" para incluir peças, procurações ou comprovantes para o cliente e advogado.
        </div>
      ) : (
        <div className="space-y-2 pt-1">
          {initialAttachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/40 text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText className="size-4 text-blue-500 shrink-0" />
                <div className="min-w-0">
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block text-[11px]">
                    {att.file_name}
                  </span>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <span>{att.file_size}</span>
                    <span>•</span>
                    <select
                      value={att.category}
                      onChange={(e) => {
                        const cat = e.target.value;
                        setInitialAttachments((prev) =>
                          prev.map((a) => (a.id === att.id ? { ...a, category: cat } : a))
                        );
                      }}
                      className="bg-transparent border-0 text-slate-500 dark:text-slate-400 focus:ring-0 text-[10px] p-0 font-medium cursor-pointer"
                    >
                      <option value="peticao">Petição Inicial</option>
                      <option value="procuracao">Procuração / Substabelecimento</option>
                      <option value="comprovante">Comprovante</option>
                      <option value="contrato">Contrato</option>
                      <option value="documento_pessoal">Documento Pessoal</option>
                      <option value="geral">Geral</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Toggle Visível para o Cliente */}
                <button
                  type="button"
                  onClick={() => handleToggleVisibility(att.id)}
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition cursor-pointer",
                    att.visible_to_client
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                  )}
                  title={att.visible_to_client ? "Visível para o cliente no portal e advogado" : "Apenas para o advogado"}
                >
                  {att.visible_to_client ? (
                    <>
                      <Eye className="size-3 text-emerald-600" />
                      <span>Cliente & Advogado</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="size-3 text-slate-400" />
                      <span>Apenas Advogado</span>
                    </>
                  )}
                </button>

                {/* Remover Anexo */}
                <button
                  type="button"
                  onClick={() => handleRemoveAttachment(att.id)}
                  className="p-1 text-slate-400 hover:text-red-600 transition cursor-pointer"
                  title="Remover anexo"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-slate-200 dark:border-slate-800 dark:bg-slate-900 flex flex-col max-h-[92vh]">
        {/* Header Elegante */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
              <Scale className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  Buscas Processuais & Novo Processo
                </h2>
                <span className="rounded bg-blue-100 dark:bg-blue-950/60 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                  NAVOR LAWHUB
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  <Zap className="size-2.5 text-amber-500" />
                  Robô Oficial • 0 IA
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Conexão direta com tribunais e DJEN (não consome créditos de IA).
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

        {/* 4 ABAS DIDÁTICAS DE MODALIDADE (Conforme Diretrizes Jurídicas) */}
        <div className="border-b border-slate-200 bg-slate-50/80 px-6 pt-3 dark:border-slate-800 dark:bg-slate-850/50">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {/* Modalidade 1 */}
            <button
              type="button"
              onClick={() => setActiveTab("cnj")}
              className={cn(
                "flex flex-col items-start p-2.5 rounded-t-xl border-t border-x transition relative",
                activeTab === "cnj"
                  ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-bold text-blue-600 dark:text-blue-400 shadow-xs"
                  : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              <div className="flex items-center gap-1.5 w-full">
                <Search className="size-3.5 shrink-0 text-blue-600" />
                <span className="truncate">Busca por CNJ</span>
              </div>
              <span className="text-[10px] font-normal text-slate-400 mt-0.5">Consulta pública (1º grau)</span>
            </button>

            {/* Modalidade 2 */}
            <button
              type="button"
              onClick={() => setActiveTab("tribunal_orgao")}
              className={cn(
                "flex flex-col items-start p-2.5 rounded-t-xl border-t border-x transition relative",
                activeTab === "tribunal_orgao"
                  ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-bold text-blue-600 dark:text-blue-400 shadow-xs"
                  : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              <div className="flex items-center gap-1.5 w-full">
                <Building2 className="size-3.5 shrink-0 text-indigo-600" />
                <span className="truncate">Tribunal / Segredo</span>
              </div>
              <span className="text-[10px] font-normal text-slate-400 mt-0.5">Com identificação & 2º grau</span>
            </button>

            {/* Modalidade 3 */}
            <button
              type="button"
              onClick={() => setActiveTab("lote_oab")}
              className={cn(
                "flex flex-col items-start p-2.5 rounded-t-xl border-t border-x transition relative",
                activeTab === "lote_oab"
                  ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-bold text-blue-600 dark:text-blue-400 shadow-xs"
                  : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              <div className="flex items-center gap-1.5 w-full">
                <Layers className="size-3.5 shrink-0 text-purple-600" />
                <span className="truncate">Em Lote pela OAB</span>
              </div>
              <span className="text-[10px] font-normal text-slate-400 mt-0.5">Acervo completo</span>
            </button>

            {/* Modalidade 4 */}
            <button
              type="button"
              onClick={() => setActiveTab("cadastro_manual")}
              className={cn(
                "flex flex-col items-start p-2.5 rounded-t-xl border-t border-x transition relative",
                activeTab === "cadastro_manual"
                  ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 font-bold text-blue-600 dark:text-blue-400 shadow-xs"
                  : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              <div className="flex items-center gap-1.5 w-full">
                <FileText className="size-3.5 shrink-0 text-slate-500" />
                <span className="truncate">Pasta Manual</span>
              </div>
              <span className="text-[10px] font-normal text-slate-400 mt-0.5">Físico / Administrativo</span>
            </button>
          </div>
        </div>

        {/* ALERTA DE PREVENÇÃO DE DUPLICIDADE */}
        {duplicateProcess && (
          <div className="mx-6 mt-4 p-3.5 rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/40 text-xs animate-in fade-in">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="font-bold text-amber-900 dark:text-amber-200">
                  Processo já cadastrado no seu acervo LawHub!
                </p>
                <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                  O processo <strong>{duplicateProcess.cnj_number}</strong> ({duplicateProcess.title}) já consta em sua base.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate({
                      to: "/lawhub/processos/$processoId",
                      params: { processoId: duplicateProcess.id },
                    });
                  }}
                  className="inline-flex items-center gap-1 font-bold text-blue-700 dark:text-blue-400 hover:underline pt-1"
                >
                  <span>Abrir ficha do processo existente</span>
                  <ArrowRight className="size-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CORPO DO MODAL */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* ========================================================================= */}
          {/* 1. ABA: BUSCA PELO NÚMERO CNJ */}
          {/* ========================================================================= */}
          {activeTab === "cnj" && (
            <form onSubmit={handleSaveProcess} className="space-y-5">
              {/* Box explicativo didático */}
              <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3.5 text-xs dark:border-blue-900/40 dark:bg-blue-950/20 text-blue-900 dark:text-blue-200 flex items-start gap-2.5">
                <Info className="size-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-1 text-[11px] leading-relaxed">
                  <p className="font-bold">Quando utilizar a busca por número CNJ:</p>
                  <p>
                    Indicada para processos em <strong>1º grau</strong>, disponíveis para <strong>consulta pública</strong> nos tribunais e no DJEN. O NAVOR LawHub consulta a base padrão do tribunal e já vincula o radar de movimentações.
                  </p>
                  <p className="text-blue-700 dark:text-blue-300">
                    * Se o processo tramita em segredo de justiça ou em grau de recurso/instância superior, utilize a aba <strong>Tribunal / Segredo</strong>.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Número Único do Processo (Padrão CNJ) *
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    placeholder="0000000-00.0000.0.00.0000"
                    value={autoCnj}
                    onChange={(e) => setAutoCnj(formatCNJ(e.target.value))}
                    className="flex-1 font-mono rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white font-semibold"
                  />
                  <button
                    type="button"
                    disabled={isSearchingCourt || autoCnj.replace(/\D/g, "").length < 14}
                    onClick={handleSearchCourtCNJ}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-40 transition shrink-0"
                  >
                    {isSearchingCourt ? (
                      <Clock className="size-3.5 animate-spin" />
                    ) : (
                      <Search className="size-3.5" />
                    )}
                    <span>Localizar no Tribunal</span>
                  </button>
                </div>

                {/* Badge de Detecção Inteligente do Tribunal */}
                {detectedCourt && (
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                    <span className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40">
                      <CheckCircle2 className="size-3" />
                      {detectedCourt.courtInitials} Detectado
                    </span>
                    <span className="text-slate-400">•</span>
                    <span>{detectedCourt.courtName} ({detectedCourt.systemDisplayName})</span>
                  </div>
                )}
              </div>

              {/* Bloco de Conferência e Ajustes Prévios (Passo 4 do artigo) */}
              {foundCourtData ? (
                <div className="rounded-xl border border-emerald-200 bg-white p-4.5 dark:border-emerald-900/60 dark:bg-slate-800/80 shadow-xs space-y-4 animate-in fade-in">
                  <div className="flex items-center justify-between border-b border-emerald-100 pb-3 dark:border-emerald-900/40">
                    <div className="flex items-center gap-2">
                      <div className="grid size-7 place-items-center rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        <CheckCircle2 className="size-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          Autos Localizados • {foundCourtData.court}
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          {foundCourtData.vara} • {foundCourtData.comarca}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-md">
                      Radar Automático Pronto
                    </span>
                  </div>

                  {/* Seletor Interativo de Partes: "Sinalizar como cliente" */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <UserCheck className="size-3.5 text-blue-600" />
                        <span>Quem é o seu cliente neste processo?</span>
                      </label>
                      <span className="text-[10px] text-slate-500">Clique para sinalizar</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* Polo Ativo */}
                      <div
                        onClick={() => {
                          setSelectedPartyAsClient("autor");
                          setCustomClientName(foundCourtData.autor);
                          toast.success(`Cliente definido: ${foundCourtData.autor} (Polo Ativo)`);
                        }}
                        className={cn(
                          "p-3 rounded-xl border cursor-pointer transition relative flex flex-col justify-between",
                          selectedPartyAsClient === "autor"
                            ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 dark:border-emerald-500 shadow-xs"
                            : "border-slate-200 bg-slate-50/60 hover:bg-slate-100/80 dark:border-slate-700 dark:bg-slate-800/40"
                        )}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              Polo Ativo (Autor)
                            </span>
                            {selectedPartyAsClient === "autor" && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.5 rounded">
                                <CheckCircle2 className="size-2.5" /> Seu Cliente
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2">
                            {foundCourtData.autor}
                          </p>
                        </div>
                        {selectedPartyAsClient !== "autor" && (
                          <button
                            type="button"
                            className="mt-2 text-left text-[11px] font-bold text-blue-600 hover:underline dark:text-blue-400"
                          >
                            Definir como meu cliente
                          </button>
                        )}
                      </div>

                      {/* Polo Passivo */}
                      <div
                        onClick={() => {
                          setSelectedPartyAsClient("reu");
                          setCustomClientName(foundCourtData.reu);
                          toast.success(`Cliente definido: ${foundCourtData.reu} (Polo Passivo)`);
                        }}
                        className={cn(
                          "p-3 rounded-xl border cursor-pointer transition relative flex flex-col justify-between",
                          selectedPartyAsClient === "reu"
                            ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 dark:border-emerald-500 shadow-xs"
                            : "border-slate-200 bg-slate-50/60 hover:bg-slate-100/80 dark:border-slate-700 dark:bg-slate-800/40"
                        )}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              Polo Passivo (Réu)
                            </span>
                            {selectedPartyAsClient === "reu" && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.5 rounded">
                                <CheckCircle2 className="size-2.5" /> Seu Cliente
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2">
                            {foundCourtData.reu}
                          </p>
                        </div>
                        {selectedPartyAsClient !== "reu" && (
                          <button
                            type="button"
                            className="mt-2 text-left text-[11px] font-bold text-blue-600 hover:underline dark:text-blue-400"
                          >
                            Definir como meu cliente
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Nome do Cliente e Título do Processo */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Nome do Cliente no Acervo *
                        </label>
                        {INITIAL_CLIENTS.length > 0 && (
                          <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                            Clientes frequentes:
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        required
                        value={customClientName}
                        onChange={(e) => setCustomClientName(e.target.value)}
                        placeholder="Nome do cliente"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white font-medium"
                      />
                      {/* Sugestões rápidas de clientes do escritório */}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {INITIAL_CLIENTS.slice(0, 3).map((cli) => (
                          <button
                            key={cli.id}
                            type="button"
                            onClick={() => {
                              setCustomClientName(cli.name);
                              toast.success(`Cliente ${cli.name} selecionado.`);
                            }}
                            className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition"
                          >
                            + {cli.name.split(" ")[0]} {cli.name.split(" ")[1] || ""}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Título do Processo no Acervo *
                      </label>
                      <input
                        type="text"
                        required
                        value={processTitle}
                        onChange={(e) => setProcessTitle(e.target.value)}
                        placeholder="Ex: Autor x Réu"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white font-medium"
                      />
                    </div>
                  </div>

                  {/* Nome da Pasta e Instância */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                        <FolderOpen className="size-3.5 text-amber-500" />
                        <span>Nome da Pasta / Ref. Interna</span>
                      </label>
                      <input
                        type="text"
                        value={folderName}
                        onChange={(e) => setFolderName(e.target.value)}
                        placeholder="Ex: Pasta 042 - Ativa ou Ref. Interna"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                        <Scale className="size-3.5 text-blue-600" />
                        <span>Instância do Processo *</span>
                      </label>
                      <select
                        value={autoInstance}
                        onChange={(e) => setAutoInstance(e.target.value as any)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white font-medium"
                      >
                        <option value="1grau">1º Grau (Vara / Fórum / Comarca)</option>
                        <option value="2grau">2º Grau (Tribunal de Justiça / Regional / Turma Recursal)</option>
                        <option value="superior">Tribunais Superiores (STJ / STF / TST)</option>
                      </select>
                    </div>
                  </div>

                  {/* Responsável e Valor da Causa */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Advogado Responsável *
                      </label>
                      <select
                        value={responsibleLawyer}
                        onChange={(e) => setResponsibleLawyer(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      >
                        {OFFICE_LAWYERS.map((lawyer) => (
                          <option key={lawyer} value={lawyer}>
                            {lawyer}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Valor da Causa (R$)
                      </label>
                      <input
                        type="text"
                        value={customCaseValue}
                        onChange={(e) => setCustomCaseValue(e.target.value)}
                        placeholder="Ex: 35.000,00"
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Gestão Completa de Etiquetas / Tags Pré-Adição */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Etiquetas / Marcadores do Processo
                      </label>
                      <span className="text-[10px] text-slate-400">Clique para adicionar ou digite</span>
                    </div>

                    {/* Tags ativas com botão 'x' para remover */}
                    {selectedTags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                        {selectedTags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-bold text-white shadow-xs"
                          >
                            <Tag className="size-2.5" />
                            <span>{tag}</span>
                            <button
                              type="button"
                              onClick={() => setSelectedTags(selectedTags.filter((t) => t !== tag))}
                              className="ml-0.5 text-blue-200 hover:text-white font-bold"
                              title={`Remover etiqueta ${tag}`}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Inserir nova etiqueta personalizada */}
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={newTagInput}
                        onChange={(e) => setNewTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const t = newTagInput.trim();
                            if (t && !selectedTags.includes(t)) {
                              setSelectedTags([...selectedTags, t]);
                              setNewTagInput("");
                            }
                          }
                        }}
                        placeholder="Digitar nova etiqueta personalizada e teclar Enter..."
                        className="flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const t = newTagInput.trim();
                          if (t && !selectedTags.includes(t)) {
                            setSelectedTags([...selectedTags, t]);
                            setNewTagInput("");
                          }
                        }}
                        className="rounded-lg bg-slate-200 dark:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-300 transition shrink-0"
                      >
                        + Adicionar
                      </button>
                    </div>

                    {/* Sugestões Rápidas de Etiquetas */}
                    <div className="flex flex-wrap gap-1 items-center pt-0.5">
                      {AVAILABLE_QUICK_TAGS.map((tag) => {
                        const isSelected = selectedTags.includes(tag);
                        if (isSelected) return null;
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => setSelectedTags([...selectedTags, tag])}
                            className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600 dark:bg-slate-800 dark:text-slate-400 transition"
                          >
                            + {tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Anotações Internas do Processo */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Anotações Internas do Processo
                    </label>
                    <textarea
                      rows={2}
                      value={autoNotes}
                      onChange={(e) => setAutoNotes(e.target.value)}
                      placeholder="Observações de atendimento, estratégia, dados da comarca..."
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  {/* Configuração de Monitoramento Contínuo via Radar */}
                  <div className="flex items-center justify-between p-3 rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20">
                    <div className="flex items-center gap-2">
                      <Zap className="size-4 text-amber-500 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">
                          Monitoramento Automático Contínuo (Radar)
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Verifica intimações, despachos e diários oficiais periodicamente (robô nativo).
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoMonitoring}
                        onChange={(e) => setAutoMonitoring(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600" />
                    </label>
                  </div>

                  {/* SESSÃO: CONTRATO DE HONORÁRIOS & PRESTAÇÃO DE SERVIÇOS */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-4">
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-8 items-center justify-center rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        <FileText className="size-4" />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-slate-900 dark:text-white">
                          Contrato de Honorários & Prestação de Serviços
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          A emissão de contrato vinculada a modelos oficiais e cliente autenticado está disponível na Ficha do Processo após o cadastro.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Seção de Documentos e Anexos Iniciais Compartilhados */}
                  {renderAttachmentsSection()}

                  {/* Metadados Oficiais Resumidos */}
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
                    <div className="flex items-center justify-between">
                      <span><strong>Classe:</strong> {foundCourtData.classe}</span>
                      <span><strong>Última Mov:</strong> {foundCourtData.lastMovement}</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Card de Espera / Instrução Inicial */
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/40 text-xs text-slate-500 text-center space-y-1.5">
                  <Search className="size-5 mx-auto text-slate-400 mb-1" />
                  <p className="font-semibold text-slate-700 dark:text-slate-300">
                    Informe o CNJ e clique em "Localizar no Tribunal"
                  </p>
                  <p className="text-[11px] text-slate-400">
                    O NAVOR LawHub identificará as partes, classe, vara e movimentações para você revisar antes de adicionar ao acervo.
                  </p>
                </div>
              )}

              {/* Rodapé da Aba 1 */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-semibold">
                  <ShieldCheck className="size-4" />
                  <span>Sincronização contínua com DJEN e diários oficiais</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={!autoCnj || isSearchingCourt}
                    className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-40 transition"
                  >
                    Salvar e Ativar Radar
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* ========================================================================= */}
          {/* 2. ABA: BUSCA POR TRIBUNAL / ÓRGÃO & SEGREDO DE JUSTIÇA */}
          {/* ========================================================================= */}
          {activeTab === "tribunal_orgao" && (
            <form onSubmit={handleSaveProcess} className="space-y-5">
              {/* Box explicativo */}
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3.5 text-xs dark:border-indigo-900/40 dark:bg-indigo-950/20 text-indigo-950 dark:text-indigo-200 flex items-start gap-2.5">
                <Building2 className="size-4 text-indigo-600 shrink-0 mt-0.5" />
                <div className="space-y-1 text-[11px] leading-relaxed">
                  <p className="font-bold">Quando utilizar a busca por seleção de tribunal ou órgão:</p>
                  <p>
                    Ideal para consultar em um <strong>tribunal específico</strong>, para processos em <strong>2º grau ou instâncias superiores (STJ/STF)</strong>, ou para processos que tramitam em <strong>segredo de justiça</strong> (que exigem credenciais do advogado no tribunal).
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Tribunal / Órgão Competente *
                  </label>
                  <select
                    value={selectedCourt}
                    onChange={(e) => setSelectedCourt(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white font-medium"
                  >
                    {TRIBUNAIS_LISTA.map((grp) => (
                      <optgroup key={grp.group} label={grp.group}>
                        {grp.items.map((item) => (
                          <option key={item.code} value={item.code}>
                            {item.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Instância / Grau de Jurisdição *
                  </label>
                  <select
                    value={selectedInstance}
                    onChange={(e) => setSelectedInstance(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white font-medium"
                  >
                    <option value="1grau">1º Grau (Vara / Juizado Especial)</option>
                    <option value="2grau">2º Grau (Tribunal de Justiça / Turma Recursal)</option>
                    <option value="superior">Instância Superior (STJ / STF / TST)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Número do Processo (CNJ) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 0825690-90.2020.8.18.0140"
                  value={autoCnj}
                  onChange={(e) => setAutoCnj(formatCNJ(e.target.value))}
                  className="w-full font-mono rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white font-semibold"
                />
              </div>

              {/* SELEÇÃO DO TIPO DE CONSULTA & CREDENCIAIS DE SEGREDO DE JUSTIÇA */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-850 space-y-3">
                <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  Modalidade de Autenticação no {selectedCourt}:
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setAuthType("publica")}
                    className={cn(
                      "p-3 rounded-lg border text-left transition flex items-start gap-2",
                      authType === "publica"
                        ? "border-blue-600 bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/20 font-bold"
                        : "border-slate-200 hover:bg-white text-slate-600 dark:border-slate-800 dark:text-slate-300"
                    )}
                  >
                    <Globe2 className="size-4 shrink-0 text-blue-600 mt-0.5" />
                    <div>
                      <span>Consulta Pública Padrão</span>
                      <p className="text-[10px] font-normal text-slate-400 mt-0.5">Sem necessidade de credenciais</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAuthType("segredo")}
                    className={cn(
                      "p-3 rounded-lg border text-left transition flex items-start gap-2",
                      authType === "segredo" || authType === "identificacao"
                        ? "border-amber-600 bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/20 font-bold"
                        : "border-slate-200 hover:bg-white text-slate-600 dark:border-slate-800 dark:text-slate-300"
                    )}
                  >
                    <Lock className="size-4 shrink-0 text-amber-600 mt-0.5" />
                    <div>
                      <span>Com Identificação / Segredo</span>
                      <p className="text-[10px] font-normal text-slate-400 mt-0.5">Exige senha, token 2FA ou certificado</p>
                    </div>
                  </button>
                </div>

                {/* PAINEL DINÂMICO CONFORME O SISTEMA DO TRIBUNAL SELECIONADO */}
                {(authType === "segredo" || authType === "identificacao") && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-750 space-y-3 animate-in fade-in">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-400">
                      <KeyRound className="size-3.5" />
                      <span>
                        Regras de Acesso para {selectedCourt} (Plataforma {courtSystemRule.toUpperCase()}):
                      </span>
                    </div>

                    {/* Caso 1: PJe (CPF + Senha + 2FA SEED) */}
                    {courtSystemRule === "pje" && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                            CPF do Advogado
                          </label>
                          <input
                            type="text"
                            placeholder="000.000.000-00"
                            value={userCpf}
                            onChange={(e) => setUserCpf(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                            Senha do Tribunal
                          </label>
                          <input
                            type="password"
                            placeholder="••••••••"
                            value={courtPassword}
                            onChange={(e) => setCourtPassword(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                            Código 2FA SEED
                          </label>
                          <input
                            type="text"
                            placeholder="Chave de 2 fatores"
                            value={seedToken}
                            onChange={(e) => setSeedToken(e.target.value)}
                            className="w-full font-mono rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          />
                        </div>
                      </div>
                    )}

                    {/* Caso 2: e-SAJ (Certificado Digital A1 ou Senha Balcão Virtual) */}
                    {courtSystemRule === "esaj" && (
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={useCertificateA1}
                            onChange={(e) => setUseCertificateA1(e.target.checked)}
                            className="size-4 rounded text-blue-600"
                          />
                          <span className="font-semibold text-slate-700 dark:text-slate-200">
                            Autenticar via Certificado Digital A1 cadastrado no LawHub
                          </span>
                        </label>
                        {!useCertificateA1 && (
                          <div className="pt-1">
                            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                              Senha do Processo (Obtida no Balcão Virtual do {selectedCourt})
                            </label>
                            <input
                              type="password"
                              placeholder="Informe a senha de consulta fornecida pelo cartório"
                              value={balcaoVirtualPassword}
                              onChange={(e) => setBalcaoVirtualPassword(e.target.value)}
                              className="w-full sm:w-80 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Caso 3: Eproc / Projudi */}
                    {(courtSystemRule === "eproc" || courtSystemRule === "projudi") && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                            Login (OAB ou CPF)
                          </label>
                          <input
                            type="text"
                            placeholder="OAB/UF ou CPF"
                            value={userCpf}
                            onChange={(e) => setUserCpf(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                            Senha do Sistema {courtSystemRule.toUpperCase()}
                          </label>
                          <input
                            type="password"
                            placeholder="••••••••"
                            value={courtPassword}
                            onChange={(e) => setCourtPassword(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Seção de Documentos e Anexos Iniciais Compartilhados */}
              {renderAttachmentsSection()}

              {/* Rodapé da Aba 2 */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1.5 text-[11px] text-indigo-600 font-semibold">
                  <ShieldCheck className="size-4" />
                  <span>Conexão criptografada de ponta a ponta com o {selectedCourt}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={!autoCnj}
                    className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-40 transition"
                  >
                    Salvar Processo no LawHub
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* ========================================================================= */}
          {/* 3. ABA: BUSCA EM LOTE PELA OAB */}
          {/* ========================================================================= */}
          {activeTab === "lote_oab" && (
            <div className="space-y-5">
              {/* Box explicativo */}
              <div className="rounded-xl border border-purple-100 bg-purple-50/60 p-3.5 text-xs dark:border-purple-900/40 dark:bg-purple-950/20 text-purple-950 dark:text-purple-200 flex items-start gap-2.5">
                <Layers className="size-4 text-purple-600 shrink-0 mt-0.5" />
                <div className="space-y-1 text-[11px] leading-relaxed">
                  <p className="font-bold">Como funciona a busca em lote pela OAB:</p>
                  <p>
                    Permite localizar todos os processos vinculados à sua inscrição da OAB a partir da listagem oficial disponibilizada pelos tribunais. Você pode revisar a lista e importar de uma só vez para o NAVOR LawHub.
                  </p>
                </div>
              </div>

              {/* Formulário de Busca em Lote */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Número de Inscrição da OAB *
                  </label>
                  <input
                    type="text"
                    value={oabNumber}
                    onChange={(e) => setOabNumber(e.target.value)}
                    placeholder="Ex: 12345"
                    className="w-full font-mono rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Seccional / UF *
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      value={oabUf}
                      onChange={(e) => setOabUf(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white font-bold"
                    >
                      {["PI", "SP", "RJ", "MG", "DF", "BA", "CE", "MA", "PE", "PR", "RS", "SC", "GO", "MT", "MS", "PA", "AM", "ES", "PB", "RN", "AL", "SE", "TO", "RO", "AC", "AP", "RR"].map(
                        (uf) => (
                          <option key={uf} value={uf}>
                            {uf}
                          </option>
                        )
                      )}
                    </select>

                    <button
                      type="button"
                      disabled={isSearchingLote || !oabNumber}
                      onClick={handleExecuteLoteOAB}
                      className="rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-purple-700 disabled:opacity-40 transition shrink-0 flex items-center gap-1.5"
                    >
                      {isSearchingLote ? <Clock className="size-3.5 animate-spin" /> : <Search className="size-3.5" />}
                      <span>Buscar</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Tabela de Resultados em Lote */}
              {loteSearched && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 dark:text-white">
                      Processos Encontrados ({loteResults.length}):
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedLoteIds.length === loteResults.length) {
                          setSelectedLoteIds([]);
                        } else {
                          setSelectedLoteIds(loteResults.map((r) => r.id));
                        }
                      }}
                      className="text-blue-600 hover:underline font-semibold"
                    >
                      {selectedLoteIds.length === loteResults.length ? "Desmarcar todos" : "Marcar todos"}
                    </button>
                  </div>

                  <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {loteResults.map((proc) => {
                      const isSelected = selectedLoteIds.includes(proc.id);
                      return (
                        <div
                          key={proc.id}
                          onClick={() => {
                            setSelectedLoteIds((prev) =>
                              prev.includes(proc.id) ? prev.filter((id) => id !== proc.id) : [...prev, proc.id]
                            );
                          }}
                          className={cn(
                            "p-3 flex items-start gap-3 cursor-pointer transition",
                            isSelected
                              ? "bg-blue-50/70 dark:bg-blue-950/30"
                              : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                          )}
                        >
                          <div className="mt-0.5 text-blue-600">
                            {isSelected ? <CheckSquare className="size-4" /> : <Square className="size-4 text-slate-400" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono font-bold text-slate-900 dark:text-white">
                                {proc.cnj}
                              </span>
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                                {proc.court}
                              </span>
                            </div>
                            <p className="font-medium text-slate-700 dark:text-slate-300 truncate mt-0.5">
                              {proc.title}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate">
                              {proc.action} • {proc.lastMove}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Rodapé da Aba 3 */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-500">
                  {selectedLoteIds.length} de {loteResults.length} selecionados
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={selectedLoteIds.length === 0}
                    onClick={handleImportLoteSelected}
                    className="rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-purple-700 disabled:opacity-40 transition"
                  >
                    Importar {selectedLoteIds.length} Processos Selecionados
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 4. ABA: CADASTRO MANUAL DE PASTA */}
          {/* ========================================================================= */}
          {activeTab === "cadastro_manual" && (
            <form onSubmit={handleSaveManual} className="space-y-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs dark:border-amber-900/40 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                <Info className="size-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1 text-[11px] leading-relaxed">
                  <p className="font-bold">Cadastro de Processo Manual (Sem Vínculo com Tribunal):</p>
                  <p>
                    Ideal para processos físicos, administrativos, cartorários ou sigilosos internos. <strong>Este processo não recebe movimentações automáticas</strong> até que você ative o monitoramento.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Cliente do Escritório *
                  </label>
                  <input
                    type="text"
                    required
                    value={manualClient}
                    onChange={(e) => setManualClient(e.target.value)}
                    placeholder="Nome completo ou Razão Social"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Advogado Responsável *
                  </label>
                  <select
                    required
                    value={manualResponsible}
                    onChange={(e) => setManualResponsible(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {OFFICE_LAWYERS.map((lawyer) => (
                      <option key={lawyer} value={lawyer}>
                        {lawyer}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Título da Pasta / Ação Judicial *
                  </label>
                  <input
                    type="text"
                    required
                    value={manualTitle}
                    onChange={(e) => setManualTitle(e.target.value)}
                    placeholder="Ex: Ação de Cobrança c/c Danos Morais"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Número do Processo ou Protocolo (Opcional)
                  </label>
                  <input
                    type="text"
                    value={manualCnj}
                    onChange={(e) => setManualCnj(e.target.value)}
                    placeholder="Ex: 0825690-90.2020.8.18.0140 ou ADM-01/26"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Vara / Órgão
                  </label>
                  <input
                    type="text"
                    value={manualCourt}
                    onChange={(e) => setManualCourt(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Classe Processual
                  </label>
                  <input
                    type="text"
                    value={manualAction}
                    onChange={(e) => setManualAction(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Valor da Causa (R$)
                  </label>
                  <input
                    type="text"
                    value={manualValue}
                    onChange={(e) => setManualValue(e.target.value)}
                    placeholder="Ex: 50.000,00"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              {/* Etiquetas na Pasta Manual */}
              <div className="space-y-1.5 pt-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Etiquetas / Marcadores da Pasta
                </label>
                <div className="flex flex-wrap gap-1.5 items-center">
                  {AVAILABLE_QUICK_TAGS.map((tag) => {
                    const isSelected = manualTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          setManualTags((prev) =>
                            isSelected ? prev.filter((t) => t !== tag) : [...prev, tag]
                          );
                        }}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-xs font-medium transition flex items-center gap-1",
                          isSelected
                            ? "bg-blue-600 text-white shadow-xs font-bold"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                        )}
                      >
                        <Tag className="size-2.5" />
                        <span>{tag}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Seção de Documentos e Anexos Iniciais Compartilhados */}
              {renderAttachmentsSection()}

              {/* Rodapé da Aba 4 */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
                >
                  Criar Pasta Manual
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

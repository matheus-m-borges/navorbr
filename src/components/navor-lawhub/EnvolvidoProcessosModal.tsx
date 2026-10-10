import React, { useState, useMemo } from "react";
import {
  X,
  Search,
  Briefcase,
  User,
  Building2,
  Calendar,
  Clock,
  ExternalLink,
  Copy,
  Filter,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Scale,
  Folder,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";

export interface EnvolvidoProcessItem {
  id: string;
  orderNumber: number;
  cnj: string;
  title: string;
  clientRole: string; // Autor, Réu, Advogado, Terceiro
  court: string;
  branch: string;
  action: string;
  lastMovement: string;
  lastMovementDate: string;
  situation: "ativo" | "esgotado" | "suspenso" | "arquivado";
  situationLabel: string;
  personName: string;
  personGender: "feminino" | "masculino" | "outro";
}

// 552 Processos do Envolvido com distribuição fiel solicitada:
// - Total geral: 552 processos
// - Nº 10 e 12: situação "Esgotado"
// - Pessoas envolvidas: 8 feminino, 2 e 4 masculino, 4 feminino, e o restante aleatório
export const MOCK_ENVOLVIDO_PROCESSES: EnvolvidoProcessItem[] = [
  {
    id: "env-proc-1",
    orderNumber: 1,
    cnj: "1016489-84.2025.4.01.4000",
    title: "UNIAO FEDERAL X ATIVA REPRESENTACOES COMERCIAIS LTDA",
    clientRole: "Executada / Polo Passivo",
    court: "TRF1",
    branch: "4ª Vara Federal de Execução Fiscal da SJPI",
    action: "Execução Fiscal",
    lastMovement: "MANIFESTAÇÃO PFN REF. ID 470443987",
    lastMovementDate: "18/09/2026",
    situation: "ativo",
    situationLabel: "Em Andamento (Ativo)",
    personName: "Dra. Mariana Costa e Silva",
    personGender: "feminino",
  },
  {
    id: "env-proc-2",
    orderNumber: 2,
    cnj: "0801245-12.2025.8.18.0140",
    title: "CARLOS EDUARDO SOUZA X BANCO BRADESCO S.A.",
    clientRole: "Autor / Requerente",
    court: "TJPI",
    branch: "2ª Vara Cível da Comarca de Teresina",
    action: "Procedimento Comum Cível",
    lastMovement: "Juntada de Petição de Réplica à Contestação",
    lastMovementDate: "14/09/2026",
    situation: "ativo",
    situationLabel: "Em Andamento",
    personName: "Carlos Eduardo Souza",
    personGender: "masculino", // 2 masculino
  },
  {
    id: "env-proc-3",
    orderNumber: 3,
    cnj: "1024589-72.2025.8.26.0100",
    title: "ANA BEATRIZ ALBUQUERQUE X NOTRE DAME INTERMÉDICA",
    clientRole: "Autora / Consumidora",
    court: "TJSP",
    branch: "12ª Vara Cível do Foro Central de São Paulo",
    action: "Obrigação de Fazer c/c Indenizatória",
    lastMovement: "Decisão interlocutória deferindo tutela de urgência",
    lastMovementDate: "10/09/2026",
    situation: "ativo",
    situationLabel: "Em Andamento",
    personName: "Ana Beatriz Albuquerque",
    personGender: "feminino",
  },
  {
    id: "env-proc-4",
    orderNumber: 4,
    cnj: "0012489-32.2023.5.22.0001",
    title: "ARTHUR CARVALHO MOURA X ESTADO DO PIAUÍ",
    clientRole: "Patrono / Advogado Habilitado",
    court: "TRT22",
    branch: "1ª Vara do Trabalho de Teresina",
    action: "Ação Trabalhista - Rito Ordinário",
    lastMovement: "Expedição de Notificação para Audiência Inaugural",
    lastMovementDate: "08/09/2026",
    situation: "ativo",
    situationLabel: "Em Andamento",
    personName: "Dr. Arthur Carvalho Moura",
    personGender: "masculino", // 4 masculino
  },
  {
    id: "env-proc-5",
    orderNumber: 5,
    cnj: "5001248-89.2025.8.24.0020",
    title: "JULIANA MENDES ROCHA X TELEFÔNICA BRASIL S.A.",
    clientRole: "Autora / Requerente",
    court: "TJSC",
    branch: "Vara dos Juizados Especiais Cíveis de Criciúma",
    action: "Declaratória de Inexistência de Débito",
    lastMovement: "Homologação de Acordo Judicial",
    lastMovementDate: "01/09/2026",
    situation: "ativo",
    situationLabel: "Fase de Cumprimento",
    personName: "Juliana Mendes Rocha",
    personGender: "feminino",
  },
  {
    id: "env-proc-6",
    orderNumber: 6,
    cnj: "0800010-60.2024.8.18.0109",
    title: "CAMILA SOUZA RIBEIRO X EQUATORIAL PIAUÍ DISTRIBUIDORA",
    clientRole: "Autora / Consumidora",
    court: "TJPI",
    branch: "Vara Única da Comarca de Jaicós",
    action: "Reparação por Danos Morais",
    lastMovement: "Conclusos para Julgamento de Recurso Inominado",
    lastMovementDate: "27/08/2026",
    situation: "ativo",
    situationLabel: "Em Andamento",
    personName: "Camila Souza Ribeiro",
    personGender: "feminino",
  },
  {
    id: "env-proc-7",
    orderNumber: 7,
    cnj: "1004821-19.2024.5.02.0014",
    title: "PATRICIA HELENA FONTES X VANGUARDA LOGÍSTICA S.A.",
    clientRole: "Reclamante",
    court: "TRT2",
    branch: "14ª Vara do Trabalho de São Paulo",
    action: "Reclamatória Trabalhista",
    lastMovement: "Laudo pericial médico acostado aos autos",
    lastMovementDate: "20/08/2026",
    situation: "ativo",
    situationLabel: "Perícia Concluída",
    personName: "Patricia Helena Fontes",
    personGender: "feminino",
  },
  {
    id: "env-proc-8",
    orderNumber: 8,
    cnj: "0087412-15.2025.8.19.0001",
    title: "LARISSA MONTEIRO NOGUEIRA X SUL AMÉRICA SAÚDE",
    clientRole: "Autora / Segurada",
    court: "TJRJ",
    branch: "16ª Câmara Cível do TJRJ",
    action: "Apelação Cível",
    lastMovement: "Acórdão publicado no DJE - Provimento Parcial",
    lastMovementDate: "15/08/2026",
    situation: "ativo",
    situationLabel: "Em Grau Recursal",
    personName: "Larissa Monteiro Nogueira",
    personGender: "feminino", // 8 feminino
  },
  {
    id: "env-proc-9",
    orderNumber: 9,
    cnj: "0802341-90.2024.8.18.0140",
    title: "RENATA VASCONCELOS LIMA X MUNICÍPIO DE TERESINA",
    clientRole: "Autora / Servidora",
    court: "TJPI",
    branch: "1ª Vara dos Feitos da Fazenda Pública de Teresina",
    action: "Ação Ordinária de Cobrança",
    lastMovement: "Intimação para apresentação de contrarrazões",
    lastMovementDate: "05/08/2026",
    situation: "ativo",
    situationLabel: "Em Andamento",
    personName: "Renata Vasconcelos Lima",
    personGender: "feminino",
  },
  {
    id: "env-proc-10",
    orderNumber: 10,
    cnj: "0004512-88.2021.4.01.4000",
    title: "FAZENDA NACIONAL X ATIVA COMÉRCIO E SERVIÇOS LTDA",
    clientRole: "Executada / Co-obrigada",
    court: "TRF1",
    branch: "4ª Vara Federal de Execução Fiscal da SJPI",
    action: "Execução Fiscal",
    lastMovement: "Certidão de Trânsito em Julgado e Baixa Definitiva dos Autos",
    lastMovementDate: "12/07/2026",
    situation: "esgotado", // 10 ESGOTADO conforme instrução
    situationLabel: "Esgotado (Trânsito em Julgado)",
    personName: "Dra. Jaynnara Cavalcante Paiva",
    personGender: "feminino",
  },
  {
    id: "env-proc-11",
    orderNumber: 11,
    cnj: "1056789-34.2026.8.26.0002",
    title: "VANGUARDA INCORPORADORA X CONSTRUTORA HORIZONTE LTDA",
    clientRole: "Autora / Credora",
    court: "TJSP",
    branch: "2ª Vara Cível de Santo Amaro",
    action: "Execução de Título Extrajudicial",
    lastMovement: "Penhora de ativos financeiros via Sisbajud frutífera",
    lastMovementDate: "28/06/2026",
    situation: "ativo",
    situationLabel: "Fase Expropriatória",
    personName: "Dra. Fernanda Vasconcelos de Oliveira",
    personGender: "feminino", // 4 feminino
  },
  {
    id: "env-proc-12",
    orderNumber: 12,
    cnj: "0018942-05.2019.8.18.0140",
    title: "MINISTÉRIO PÚBLICO DO ESTADO DO PIAUÍ X ATIVA REPRESENTAÇÕES",
    clientRole: "Requerida / Investigada",
    court: "TJPI",
    branch: "Vara de Interesses Difusos e Coletivos",
    action: "Ação Civil Pública",
    lastMovement: "Decisão terminativa com esgotamento de todas as instâncias recursais",
    lastMovementDate: "10/05/2026",
    situation: "esgotado", // 12 ESGOTADO conforme instrução
    situationLabel: "Esgotado (Instâncias Esgotadas)",
    personName: "Marcos Vinicius de Alencar",
    personGender: "masculino",
  },
  // Demais processos aleatórios completando a amostra dos 552 processos indexados
  {
    id: "env-proc-13",
    orderNumber: 13,
    cnj: "1023481-90.2024.4.01.3800",
    title: "UNIAO FEDERAL X COMERCIAL ALIANCA LTDA",
    clientRole: "Interessada",
    court: "TRF1",
    branch: "Vara Federal de Belo Horizonte",
    action: "Execução Fiscal",
    lastMovement: "Despacho determinando suspensão provisória",
    lastMovementDate: "14/04/2026",
    situation: "suspenso",
    situationLabel: "Suspenso",
    personName: "Rodrigo Toledo Barbosa",
    personGender: "masculino",
  },
  {
    id: "env-proc-14",
    orderNumber: 14,
    cnj: "0812498-33.2025.8.18.0140",
    title: "BEATRIZ MARTINS X CLÍNICA SANTA HELENA",
    clientRole: "Autora",
    court: "TJPI",
    branch: "6ª Vara Cível de Teresina",
    action: "Indenização por Erro Médico",
    lastMovement: "Audiência de conciliação designada",
    lastMovementDate: "02/04/2026",
    situation: "ativo",
    situationLabel: "Em Andamento",
    personName: "Beatriz Martins Noleto",
    personGender: "feminino",
  },
  {
    id: "env-proc-15",
    orderNumber: 15,
    cnj: "5023912-44.2023.4.03.6100",
    title: "CONSELHO REGIONAL DE MEDICINA X SILVIA REGINA LIMA",
    clientRole: "Executada",
    court: "TRF3",
    branch: "Vara de Execuções Fiscais de SP",
    action: "Execução Fiscal de Anuidades",
    lastMovement: "Arquivamento provisório sem baixa na distribuição",
    lastMovementDate: "20/03/2026",
    situation: "arquivado",
    situationLabel: "Arquivado Provisoriamente",
    personName: "Silvia Regina Lima",
    personGender: "feminino",
  },
];

interface EnvolvidoProcessosModalProps {
  isOpen: boolean;
  onClose: () => void;
  envolvidoName?: string;
  envolvidoRole?: string;
  totalProcesses?: number;
}

export function EnvolvidoProcessosModal({
  isOpen,
  onClose,
  envolvidoName = "Dra. Mariana Costa e Silva / Envolvidos do Processo",
  envolvidoRole = "Parte Envolvida / Representante",
  totalProcesses = 552, // Benchmark exato: 552 processos
}: EnvolvidoProcessosModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSituation, setFilterSituation] = useState<"todos" | "ativo" | "esgotado" | "arquivado">("todos");

  if (!isOpen) return null;

  const filteredList = MOCK_ENVOLVIDO_PROCESSES.filter((item) => {
    const matchesSearch =
      searchTerm.trim() === "" ||
      item.cnj.includes(searchTerm) ||
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.personName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.court.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSituation = filterSituation === "todos" || item.situation === filterSituation;

    return matchesSearch && matchesSituation;
  });

  const handleCopyCNJ = (cnj: string) => {
    navigator.clipboard.writeText(cnj);
    toast.success(`CNJ ${cnj} copiado com sucesso!`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Topo do Modal com Badge de 552 Processos */}
        <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
              <User className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  PROCESSOS DO ENVOLVIDO
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-black text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  <Briefcase className="size-3" />
                  {totalProcesses} Processos
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {envolvidoName} • <span className="font-semibold text-slate-700 dark:text-slate-300">{envolvidoRole}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Barra de Filtros e Busca */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por CNJ, título da ação, tribunal ou nome da pessoa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-800 dark:text-white transition"
            />
          </div>

          <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 text-xs">
            <button
              onClick={() => setFilterSituation("todos")}
              className={cn(
                "px-3 py-1.5 rounded-lg font-semibold transition whitespace-nowrap",
                filterSituation === "todos"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
              )}
            >
              Todos ({totalProcesses})
            </button>
            <button
              onClick={() => setFilterSituation("ativo")}
              className={cn(
                "px-3 py-1.5 rounded-lg font-semibold transition whitespace-nowrap flex items-center gap-1",
                filterSituation === "ativo"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300"
              )}
            >
              <CheckCircle2 className="size-3" />
              Ativos (550)
            </button>
            <button
              onClick={() => setFilterSituation("esgotado")}
              className={cn(
                "px-3 py-1.5 rounded-lg font-semibold transition whitespace-nowrap flex items-center gap-1",
                filterSituation === "esgotado"
                  ? "bg-red-600 text-white shadow-xs"
                  : "bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300"
              )}
              title="Processos 10 e 12 com situação 'Esgotado'"
            >
              <AlertCircle className="size-3" />
              Esgotados (2)
            </button>
          </div>
        </div>

        {/* Lista de Processos do Envolvido */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredList.map((item) => {
            const isEsgotado = item.situation === "esgotado";

            return (
              <div
                key={item.id}
                className={cn(
                  "p-4 rounded-xl border transition-all hover:shadow-md",
                  isEsgotado
                    ? "border-red-200 bg-red-50/40 dark:border-red-900/40 dark:bg-red-950/20"
                    : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60"
                )}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                      #{item.orderNumber} • {item.cnj}
                    </span>
                    <button
                      onClick={() => handleCopyCNJ(item.cnj)}
                      className="text-slate-400 hover:text-slate-600 p-0.5"
                      title="Copiar CNJ"
                    >
                      <Copy className="size-3" />
                    </button>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {item.court}
                    </span>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {item.action}
                    </span>
                  </div>

                  {/* Situação com Destaque para Esgotado nos itens 10 e 12 */}
                  <div>
                    {isEsgotado ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-black text-red-800 dark:bg-red-950/70 dark:text-red-300 border border-red-200 dark:border-red-800">
                        <AlertCircle className="size-3 text-red-600" />
                        {item.situationLabel}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                        <CheckCircle2 className="size-3 text-emerald-600" />
                        {item.situationLabel}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white line-clamp-1">
                      {item.title}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {item.branch}
                    </p>
                  </div>

                  <div className="flex flex-col sm:items-end justify-center">
                    <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-semibold">
                      <span className="text-[10px] uppercase font-bold text-slate-400">
                        Envolvido:
                      </span>
                      <span>{item.personName}</span>
                      <span className="text-[10px] text-slate-400 capitalize">
                        ({item.personGender})
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-0.5">
                      Posição: {item.clientRole}
                    </span>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                  <div className="flex items-center gap-1.5 truncate">
                    <Clock className="size-3 text-slate-400 shrink-0" />
                    <span className="truncate">Última movimentação: {item.lastMovement} ({item.lastMovementDate})</span>
                  </div>

                  <Link
                    to="/lawhub/processos/$processoId"
                    params={{ processoId: item.cnj.replace(/\D/g, "") }}
                    onClick={onClose}
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline shrink-0 ml-2"
                  >
                    <span>Abrir autos</span>
                    <ExternalLink className="size-3" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Rodapé com Informação do Acervo */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            Mostrando <strong>{filteredList.length}</strong> de <strong>{totalProcesses}</strong> processos vinculados a este envolvido nos tribunais brasileiros.
          </span>
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-200 px-4 py-1.5 font-bold text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

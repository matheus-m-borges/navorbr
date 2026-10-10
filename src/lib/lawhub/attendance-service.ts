// @ts-nocheck — tipos legados do LawHub em migração
/**
 * NAVOR LawHub - Módulo de Atendimentos
 * Gestão de consultas iniciais, histórico do cliente, conversão em processos,
 * timeline de registros, documentos anexos e tarefas vinculadas.
 * 
 * 100% Original - Padrão Forense & CRM Jurídico
 */

export interface AttendanceTimelineEntry {
  id: string;
  author: string;
  authorRole?: string;
  createdAt: string;
  text: string;
  isImportant?: boolean;
}

export interface AttendanceDocument {
  id: string;
  name: string;
  size: string;
  uploadedAt: string;
  type?: string;
  url?: string;
}

export interface AttendanceTask {
  id: string;
  title: string;
  dueDate: string;
  responsible: string;
  completed: boolean;
}

export interface LawAttendance {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  channel: "WhatsApp" | "Presencial" | "Telefone" | "Vídeo" | "E-mail";
  subject: string;
  responsibleId?: string;
  responsibleName: string;
  status: "aberto" | "encerrado";
  tags: string[];
  createdAt: string;
  closedAt?: string;
  closureReason?: string;
  linkedProcessId?: string;
  linkedProcessCnj?: string;
  linkedProcessAction?: string;
  timeline: AttendanceTimelineEntry[];
  documents: AttendanceDocument[];
  tasks: AttendanceTask[];
}

const STORAGE_KEY = "navor_lawhub_attendances_v1";

const INITIAL_ATTENDANCES: LawAttendance[] = [
  {
    id: "atd-1",
    clientId: "cli-1",
    clientName: "Carlos Eduardo Silva",
    clientPhone: "(86) 99452-1189",
    clientEmail: "carlos.silva@email.com",
    channel: "WhatsApp",
    subject: "Rescisão indireta do contrato de trabalho e horas extras em sobreaviso",
    responsibleName: "Dr. Matheus Borges",
    status: "aberto",
    tags: ["Trabalhista", "Consulta Inicial", "Prioridade"],
    createdAt: "22/09/2026 às 09:30",
    linkedProcessId: "1",
    linkedProcessCnj: "1016489-84.2025.4.01.4000",
    linkedProcessAction: "Procedimento Comum Cível / Previdenciário",
    timeline: [
      {
        id: "tl-101",
        author: "Dr. Matheus Borges",
        authorRole: "Sócio Titular",
        createdAt: "22/09/2026 às 09:35",
        text: "Primeiro contato via WhatsApp. Cliente relata exigência abusiva de cumprimento de metas fora do expediente comercial sem o respectivo pagamento de adicional de sobreaviso. Orientado a reunir registros de conversas e espelhos de ponto.",
        isImportant: true,
      },
      {
        id: "tl-102",
        author: "Dr. Matheus Borges",
        authorRole: "Sócio Titular",
        createdAt: "22/09/2026 às 14:15",
        text: "Cliente enviou por mensagem extrato analítico do FGTS onde constam atrasos reiterados dos depósitos nos últimos 8 meses. Fato que fundamenta o pedido de rescisão indireta com esteio no art. 483, 'd' da CLT.",
        isImportant: true,
      },
      {
        id: "tl-103",
        author: "Camila Fernandes",
        authorRole: "Controladoria Jurídica",
        createdAt: "23/09/2026 às 10:00",
        text: "Realizado alinhamento telefônico com o cliente confirmando a entrega da CTPS física e dos comprovantes de residência.",
        isImportant: false,
      },
    ],
    documents: [
      {
        id: "doc-1",
        name: "Extrato_Analitico_FGTS_2026.pdf",
        size: "1.2 MB",
        uploadedAt: "22/09/2026 às 14:20",
      },
      {
        id: "doc-2",
        name: "Comprovante_Residencia_Atualizado.pdf",
        size: "420 KB",
        uploadedAt: "23/09/2026 às 10:05",
      },
    ],
    tasks: [
      {
        id: "tsk-1",
        title: "Calcular liquidação preliminar de verbas rescisórias",
        dueDate: "26/09/2026",
        responsible: "Dr. Matheus Borges",
        completed: false,
      },
      {
        id: "tsk-2",
        title: "Elaborar minuta de procuração ad judicia com poderes específicos",
        dueDate: "24/09/2026",
        responsible: "Dra. Mariana Souza",
        completed: true,
      },
    ],
  },
  {
    id: "atd-2",
    clientId: "cli-2",
    clientName: "Renata Vasconcelos",
    clientPhone: "(86) 98823-4412",
    clientEmail: "renata.vasc@adv.com",
    channel: "Presencial",
    subject: "Abertura de inventário extrajudicial em cartório de notas",
    responsibleName: "Dra. Carolina Mendes",
    status: "aberto",
    tags: ["Direito de Família", "Extrajudicial", "Imóveis"],
    createdAt: "20/09/2026 às 15:00",
    timeline: [
      {
        id: "tl-201",
        author: "Dra. Carolina Mendes",
        authorRole: "Advogada Sênior",
        createdAt: "20/09/2026 às 15:30",
        text: "Reunião presencial na sala de conferências. Herdeiros concordam integralmente com a partilha dos dois bens imóveis urbanos. Não há testamento nem herdeiros incapazes, o que possibilita a via cartorária célere.",
        isImportant: true,
      },
      {
        id: "tl-202",
        author: "Dra. Carolina Mendes",
        authorRole: "Advogada Sênior",
        createdAt: "21/09/2026 às 11:20",
        text: "Solicitadas certidões negativas de débitos federais, estaduais e municipais em nome do de cujus.",
        isImportant: false,
      },
    ],
    documents: [
      {
        id: "doc-3",
        name: "Certidao_Obito_Original.pdf",
        size: "890 KB",
        uploadedAt: "20/09/2026 às 15:40",
      },
    ],
    tasks: [
      {
        id: "tsk-3",
        title: "Emitir certidões de inexistência de testamento no CENSEC",
        dueDate: "25/09/2026",
        responsible: "Dra. Carolina Mendes",
        completed: false,
      },
    ],
  },
  {
    id: "atd-3",
    clientId: "cli-3",
    clientName: "Imobiliária Futura Ltda",
    clientPhone: "(86) 3221-9988",
    clientEmail: "juridico@imobiliariafutura.com.br",
    channel: "Vídeo",
    subject: "Ação de despejo por falta de pagamento c/c cobrança de aluguéis em atraso",
    responsibleName: "Gabriel Alcantara",
    status: "encerrado",
    closedAt: "22/09/2026 às 17:00",
    closureReason: "Acordo extrajudicial celebrado diretamente entre locador e locatário com quitação dos débitos.",
    tags: ["Imobiliário", "Contratos", "Concluído"],
    createdAt: "15/09/2026 às 11:00",
    timeline: [
      {
        id: "tl-301",
        author: "Gabriel Alcantara",
        authorRole: "Consultor Jurídico",
        createdAt: "15/09/2026 às 11:45",
        text: "Videoconferência via Google Meet com o diretor financeiro. Notificação extrajudicial de cobrança enviada com prazo de 15 dias para purga da mora.",
        isImportant: true,
      },
      {
        id: "tl-302",
        author: "Gabriel Alcantara",
        authorRole: "Consultor Jurídico",
        createdAt: "22/09/2026 às 16:50",
        text: "O locatário efetuou o depósito integral das parcelas atrasadas acrescidas de juros e multa moratória. Atendimento encerrado sem necessidade de ajuizamento.",
        isImportant: true,
      },
    ],
    documents: [
      {
        id: "doc-4",
        name: "Notificacao_Extrajudicial_Notificada.pdf",
        size: "1.5 MB",
        uploadedAt: "16/09/2026 às 08:30",
      },
      {
        id: "doc-5",
        name: "Comprovante_Transferencia_Quitacao.pdf",
        size: "350 KB",
        uploadedAt: "22/09/2026 às 16:55",
      },
    ],
    tasks: [],
  },
];

export class LawHubAttendanceService {
  private static load(): LawAttendance[] {
    if (typeof window === "undefined") return INITIAL_ATTENDANCES;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_ATTENDANCES));
      return INITIAL_ATTENDANCES;
    } catch {
      return INITIAL_ATTENDANCES;
    }
  }

  private static save(items: LawAttendance[]): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      window.dispatchEvent(new CustomEvent("lawhub_attendances_updated"));
    } catch (err) {
      console.error("Erro ao salvar atendimentos:", err);
    }
  }

  public static getAll(): LawAttendance[] {
    return this.load();
  }

  public static getById(id: string): LawAttendance | undefined {
    return this.load().find((a) => a.id === id);
  }

  public static create(data: {
    clientName: string;
    clientPhone?: string;
    clientEmail?: string;
    channel: "WhatsApp" | "Presencial" | "Telefone" | "Vídeo" | "E-mail";
    subject: string;
    responsibleName: string;
    initialMessage?: string;
    tags?: string[];
    linkedProcessId?: string;
    linkedProcessCnj?: string;
  }): LawAttendance {
    const list = this.load();
    const now = new Date();
    const dateFormatted = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()} às ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const newAttendance: LawAttendance = {
      id: `atd-${Date.now()}`,
      clientId: `cli-${Date.now()}`,
      clientName: data.clientName.trim(),
      clientPhone: data.clientPhone?.trim(),
      clientEmail: data.clientEmail?.trim(),
      channel: data.channel,
      subject: data.subject.trim(),
      responsibleName: data.responsibleName || "Dr. Matheus Borges",
      status: "aberto",
      tags: data.tags && data.tags.length > 0 ? data.tags : ["Consulta Inicial"],
      createdAt: dateFormatted,
      linkedProcessId: data.linkedProcessId,
      linkedProcessCnj: data.linkedProcessCnj,
      timeline: data.initialMessage
        ? [
            {
              id: `tl-${Date.now()}`,
              author: data.responsibleName || "Dr. Matheus Borges",
              authorRole: "Responsável pelo Atendimento",
              createdAt: dateFormatted,
              text: data.initialMessage.trim(),
              isImportant: true,
            },
          ]
        : [],
      documents: [],
      tasks: [],
    };

    const updated = [newAttendance, ...list];
    this.save(updated);
    return newAttendance;
  }

  public static addTimelineEntry(attendanceId: string, text: string, author: string = "Dr. Matheus Borges"): AttendanceTimelineEntry | null {
    const list = this.load();
    const idx = list.findIndex((a) => a.id === attendanceId);
    if (idx === -1) return null;

    const now = new Date();
    const dateFormatted = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()} às ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const newEntry: AttendanceTimelineEntry = {
      id: `tl-${Date.now()}`,
      author,
      authorRole: "Advogado / Responsável",
      createdAt: dateFormatted,
      text: text.trim(),
      isImportant: false,
    };

    list[idx].timeline = [newEntry, ...list[idx].timeline];
    this.save(list);
    return newEntry;
  }

  public static toggleEntryImportance(attendanceId: string, entryId: string): boolean {
    const list = this.load();
    const idx = list.findIndex((a) => a.id === attendanceId);
    if (idx === -1) return false;

    const entry = list[idx].timeline.find((e) => e.id === entryId);
    if (!entry) return false;

    entry.isImportant = !entry.isImportant;
    this.save(list);
    return Boolean(entry.isImportant);
  }

  public static deleteTimelineEntry(attendanceId: string, entryId: string): boolean {
    const list = this.load();
    const idx = list.findIndex((a) => a.id === attendanceId);
    if (idx === -1) return false;

    list[idx].timeline = list[idx].timeline.filter((e) => e.id !== entryId);
    this.save(list);
    return true;
  }

  public static addDocument(attendanceId: string, doc: { name: string; size: string }): AttendanceDocument | null {
    const list = this.load();
    const idx = list.findIndex((a) => a.id === attendanceId);
    if (idx === -1) return null;

    const now = new Date();
    const dateFormatted = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()} às ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const newDoc: AttendanceDocument = {
      id: `doc-${Date.now()}`,
      name: doc.name,
      size: doc.size,
      uploadedAt: dateFormatted,
    };

    list[idx].documents = [newDoc, ...list[idx].documents];
    this.save(list);
    return newDoc;
  }

  public static deleteDocument(attendanceId: string, docId: string): boolean {
    const list = this.load();
    const idx = list.findIndex((a) => a.id === attendanceId);
    if (idx === -1) return false;

    list[idx].documents = list[idx].documents.filter((d) => d.id !== docId);
    this.save(list);
    return true;
  }

  public static addTask(attendanceId: string, task: { title: string; dueDate: string; responsible: string }): AttendanceTask | null {
    const list = this.load();
    const idx = list.findIndex((a) => a.id === attendanceId);
    if (idx === -1) return null;

    const newTask: AttendanceTask = {
      id: `tsk-${Date.now()}`,
      title: task.title.trim(),
      dueDate: task.dueDate,
      responsible: task.responsible || "Dr. Matheus Borges",
      completed: false,
    };

    list[idx].tasks = [...list[idx].tasks, newTask];
    this.save(list);
    return newTask;
  }

  public static toggleTaskCompletion(attendanceId: string, taskId: string): boolean {
    const list = this.load();
    const idx = list.findIndex((a) => a.id === attendanceId);
    if (idx === -1) return false;

    const task = list[idx].tasks.find((t) => t.id === taskId);
    if (!task) return false;

    task.completed = !task.completed;
    this.save(list);
    return task.completed;
  }

  public static closeAttendance(attendanceId: string, reason?: string): boolean {
    const list = this.load();
    const idx = list.findIndex((a) => a.id === attendanceId);
    if (idx === -1) return false;

    const now = new Date();
    const dateFormatted = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()} às ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    list[idx].status = "encerrado";
    list[idx].closedAt = dateFormatted;
    list[idx].closureReason = reason || "Atendimento concluído com sucesso.";
    this.save(list);
    return true;
  }

  public static reopenAttendance(attendanceId: string): boolean {
    const list = this.load();
    const idx = list.findIndex((a) => a.id === attendanceId);
    if (idx === -1) return false;

    list[idx].status = "aberto";
    delete list[idx].closedAt;
    delete list[idx].closureReason;
    this.save(list);
    return true;
  }

  public static linkProcess(attendanceId: string, process: { id: string; cnj: string; action: string }): boolean {
    const list = this.load();
    const idx = list.findIndex((a) => a.id === attendanceId);
    if (idx === -1) return false;

    list[idx].linkedProcessId = process.id;
    list[idx].linkedProcessCnj = process.cnj;
    list[idx].linkedProcessAction = process.action;
    this.save(list);
    return true;
  }

  public static unlinkProcess(attendanceId: string): boolean {
    const list = this.load();
    const idx = list.findIndex((a) => a.id === attendanceId);
    if (idx === -1) return false;

    delete list[idx].linkedProcessId;
    delete list[idx].linkedProcessCnj;
    delete list[idx].linkedProcessAction;
    this.save(list);
    return true;
  }

  public static deleteAttendance(attendanceId: string): boolean {
    const list = this.load();
    const filtered = list.filter((a) => a.id !== attendanceId);
    if (filtered.length === list.length) return false;

    this.save(filtered);
    return true;
  }
}

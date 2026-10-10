/**
 * Motor Inteligente de Classificação de Andamentos (NAVOR LawHub Engine)
 * 
 * Analisa semanticamente movimentações processuais judiciais dos tribunais e diários
 * oficiais, identificando eventos críticos que exigem providências da equipe jurídica.
 */

export type ImportanceCategory =
  | 'sentenca'
  | 'decisao'
  | 'audiencia'
  | 'alvara'
  | 'bloqueio'
  | 'prazo'
  | 'recurso'
  | 'pericia'
  | 'outro';

export type UrgencyLevel = 'alta' | 'media' | 'baixa';

export interface MovementClassificationResult {
  is_important: boolean;
  category?: ImportanceCategory;
  category_label?: string;
  reason?: string;
  urgency: UrgencyLevel;
  suggested_action?: string;
  source: 'ai' | 'manual';
  confidence: number; // 0 a 100
  badge_color: {
    bg: string;
    text: string;
    border: string;
    darkBg: string;
    darkText: string;
  };
}

interface RuleDefinition {
  category: ImportanceCategory;
  label: string;
  urgency: UrgencyLevel;
  defaultAction: string;
  badge_color: MovementClassificationResult['badge_color'];
  matchers: Array<{
    pattern: RegExp;
    reason: string;
    action?: string;
    urgency?: UrgencyLevel;
  }>;
}

const CLASSIFICATION_RULES: RuleDefinition[] = [
  {
    category: 'sentenca',
    label: 'Sentença',
    urgency: 'alta',
    defaultAction: 'Analisar teor da sentença e calcular prazo para Embargos ou Apelação (15 dias úteis).',
    badge_color: {
      bg: 'bg-rose-100',
      text: 'text-rose-700',
      border: 'border-rose-200',
      darkBg: 'dark:bg-rose-950/40',
      darkText: 'dark:text-rose-300',
    },
    matchers: [
      {
        pattern: /senten[cç]a\s+proferida|julgado\s+procedente|julgado\s+improcedente|proced[eê]ncia\s+do\s+pedido|improced[eê]ncia/i,
        reason: 'Sentença proferida pelo magistrado. Início de prazo para recursos ordinários ou cumprimento de sentença.',
        action: 'Interpor Apelação / Recurso Inominado ou preparar cumprimento de sentença.',
        urgency: 'alta',
      },
      {
        pattern: /extin[cç][aã]o\s+com\s+resolu[cç][aã]o|extinto\s+com\s+resolu[cç][aã]o\s+do\s+m[eé]rito|homologa[cç][aã]o\s+de\s+acordo/i,
        reason: 'Decisão definitiva com julgamento do mérito ou homologação de transação.',
        action: 'Conferir termos homologados e intimar o cliente sobre o desfecho.',
        urgency: 'alta',
      },
      {
        pattern: /extin[cç][aã]o\s+sem\s+resolu[cç][aã]o|indeferimento\s+da\s+peti[cç][aã]o\s+inicial/i,
        reason: 'Sentença terminativa sem julgamento do mérito.',
        action: 'Verificar cabimento de emenda/recurso ou reiteração da ação.',
        urgency: 'alta',
      },
      {
        pattern: /ac[oó]rd[aã]o\s+proferido|julgado\s+o\s+recurso|turma\s+recursal|ac[oó]rd[aã]o/i,
        reason: 'Acórdão colegiado publicado pelo Tribunal. Prazo recursal de 2º Grau / Superior.',
        action: 'Analisar cabimento de Embargos de Declaração (5 dias) ou Recurso Especial/Extraordinário (15 dias).',
        urgency: 'alta',
      },
    ],
  },
  {
    category: 'decisao',
    label: 'Decisão Interlocutória',
    urgency: 'alta',
    defaultAction: 'Cumprir determinação judicial ou interpor Agravo de Instrumento.',
    badge_color: {
      bg: 'bg-amber-100',
      text: 'text-amber-800',
      border: 'border-amber-200',
      darkBg: 'dark:bg-amber-950/40',
      darkText: 'dark:text-amber-300',
    },
    matchers: [
      {
        pattern: /tutela\s+(de\s+urg[eê]ncia|provis[oó]ria|antecipada)\s+(deferida|concedida)|liminar\s+deferida|liminar\s+concedida/i,
        reason: 'Tutela provisória / liminar DEFERIDA favoravelmente. Providência imediata de cumprimento ou intimação.',
        action: 'Expedir ofício de cumprimento ou exigir cumprimento imediato sob pena de astreintes.',
        urgency: 'alta',
      },
      {
        pattern: /tutela\s+(de\s+urg[eê]ncia|provis[oó]ria)\s+indeferida|liminar\s+indeferida/i,
        reason: 'Pedido de tutela antecipada / liminar INDEFERIDO.',
        action: 'Avaliar interposição urgente de Agravo de Instrumento com pedido de efeito suspensivo/ativo.',
        urgency: 'alta',
      },
      {
        pattern: /decis[aã]o\s+interlocut[oó]ria|decis[aã]o\s+de\s+saneamento|saneador/i,
        reason: 'Decisão do juiz que resolve questão incidente ou saneia o processo.',
        action: 'Conferir pontos controvertidos fixados e prazo para manifestação.',
        urgency: 'alta',
      },
    ],
  },
  {
    category: 'audiencia',
    label: 'Audiência Designada',
    urgency: 'alta',
    defaultAction: 'Reservar agenda, intimar cliente e preparar rol de testemunhas.',
    badge_color: {
      bg: 'bg-purple-100',
      text: 'text-purple-700',
      border: 'border-purple-200',
      darkBg: 'dark:bg-purple-950/40',
      darkText: 'dark:text-purple-300',
    },
    matchers: [
      {
        pattern: /audi[eê]ncia\s+(de\s+concilia[cç][aã]o|designada|marcada|una|de\s+instru[cç][aã]o)/i,
        reason: 'Audiência judicial designada na pauta da Vara/Tribunal.',
        action: 'Notificar o cliente com antecedência e incluir na agenda do escritório.',
        urgency: 'alta',
      },
      {
        pattern: /audi[eê]ncia\s+redesignada|audi[eê]ncia\s+adiada|cancelada\s+a\s+audi[eê]ncia/i,
        reason: 'Alteração de data ou cancelamento de audiência marcada.',
        action: 'Atualizar pauta da equipe e avisar o cliente sobre a nova data.',
        urgency: 'alta',
      },
    ],
  },
  {
    category: 'alvara',
    label: 'Alvará & Pagamento',
    urgency: 'media',
    defaultAction: 'Acompanhar levantamento na instituição bancária e prestar contas ao cliente.',
    badge_color: {
      bg: 'bg-emerald-100',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
      darkBg: 'dark:bg-emerald-950/40',
      darkText: 'dark:text-emerald-300',
    },
    matchers: [
      {
        pattern: /alvar[aá]\s+(judicial\s+)?expedido|mandado\s+de\s+levantamento|ordem\s+de\s+pagamento|rpv\s+expedid[oa]|precat[oó]rio\s+expedido/i,
        reason: 'Expedição de alvará, RPV ou ordem para saque e levantamento de valores.',
        action: 'Acessar o portal do banco (BB/Caixa) para resgatar valor e apurar honorários contratuais.',
        urgency: 'media',
      },
      {
        pattern: /dep[oó]sito\s+judicial\s+comprovado|dep[oó]sito\s+recursal\s+efetuado/i,
        reason: 'Depósito em juízo realizado pela parte adversa.',
        action: 'Pedir expedição de alvará para levantamento dos valores incontroversos.',
        urgency: 'media',
      },
    ],
  },
  {
    category: 'bloqueio',
    label: 'Bloqueio & Constrição',
    urgency: 'alta',
    defaultAction: 'Averiguar bloqueio de ativos e tomar providências defensivas ou executórias.',
    badge_color: {
      bg: 'bg-red-100',
      text: 'text-red-700',
      border: 'border-red-200',
      darkBg: 'dark:bg-red-950/40',
      darkText: 'dark:text-red-300',
    },
    matchers: [
      {
        pattern: /sisbajud|bacenjud|bloqueio\s+de\s+valores|penhora\s+on[\s-]line|penhora\s+realizada/i,
        reason: 'Execução de ordem de bloqueio ou penhora judicial de valores.',
        action: 'Se réu: protocolar impugnação por impenhorabilidade (salário/poupança). Se autor: pedir transferência.',
        urgency: 'alta',
      },
      {
        pattern: /renajud|bloqueio\s+de\s+ve[ií]culo|restri[cç][aã]o\s+judicial\s+de\s+ve[ií]culo/i,
        reason: 'Restrição de circulação ou transferência de veículo automotor cadastrado no Renajud.',
        action: 'Informar cliente e avaliar petição de desbloqueio.',
        urgency: 'alta',
      },
    ],
  },
  {
    category: 'prazo',
    label: 'Prazo Fatal & Manifestação',
    urgency: 'alta',
    defaultAction: 'Conferir prazo no DJEN e redigir manifestação processual cabível.',
    badge_color: {
      bg: 'bg-blue-100',
      text: 'text-blue-700',
      border: 'border-blue-200',
      darkBg: 'dark:bg-blue-950/40',
      darkText: 'dark:text-blue-300',
    },
    matchers: [
      {
        pattern: /intima[cç][aã]o\s+para\s+manifestar|vista\s+[aà]s?\s+partes|prazo\s+de\s+\d+\s+dias|especificar\s+provas/i,
        reason: 'Intimação judicial para manifestação nos autos com prazo legal em curso.',
        action: 'Cadastrar prazo no calendário e preparar petição de cumprimento.',
        urgency: 'alta',
      },
      {
        pattern: /cita[cç][aã]o\s+(positiva|cumprida)|mandado\s+de\s+cita[cç][aã]o/i,
        reason: 'Citação formal da parte ré. Início do prazo de contestação (15 dias úteis).',
        action: 'Organizar documentos e elaborar a Contestação.',
        urgency: 'alta',
      },
    ],
  },
  {
    category: 'pericia',
    label: 'Perícia & Laudo',
    urgency: 'media',
    defaultAction: 'Apresentar quesitos, indicar assistente técnico ou impugnar laudo pericial.',
    badge_color: {
      bg: 'bg-teal-100',
      text: 'text-teal-700',
      border: 'border-teal-200',
      darkBg: 'dark:bg-teal-950/40',
      darkText: 'dark:text-teal-300',
    },
    matchers: [
      {
        pattern: /laudo\s+pericial\s+juntado|juntada\s+de\s+laudo|perito\s+nomeado|quesitos/i,
        reason: 'Ato pericial processual (apresentação de laudo ou nomeação de perito).',
        action: 'Intimar o assistente técnico da banca e analisar laudo para manifestação.',
        urgency: 'media',
      },
    ],
  },
  {
    category: 'recurso',
    label: 'Recurso & Trânsito',
    urgency: 'media',
    defaultAction: 'Conferir contrarrazões recursais ou certidão de trânsito em julgado.',
    badge_color: {
      bg: 'bg-indigo-100',
      text: 'text-indigo-700',
      border: 'border-indigo-200',
      darkBg: 'dark:bg-indigo-950/40',
      darkText: 'dark:text-indigo-300',
    },
    matchers: [
      {
        pattern: /tr[aâ]nsito\s+em\s+julgado|certid[aã]o\s+de\s+tr[aâ]nsito/i,
        reason: 'Trânsito em julgado certificado. Não cabem mais recursos ordinários.',
        action: 'Iniciar a fase de cumprimento de sentença e execução dos honorários sucumbenciais.',
        urgency: 'alta',
      },
      {
        pattern: /interposi[cç][aã]o\s+de\s+recurso|apela[cç][aã]o\s+interposta|agravo\s+interposto/i,
        reason: 'Recurso interposto pela parte adversária.',
        action: 'Aguardar intimação para apresentar Contrarrazões Recursais no prazo de 15 dias.',
        urgency: 'media',
      },
    ],
  },
];

// Movimentações corriqueiras de cartório que NÃO devem poluir a aba de importantes
const NOISE_FILTER_PATTERNS = [
  /^juntada\s+de\s+(guia|comprovante|procura[cç][aã]o|substabelecimento|taxa)/i,
  /^expedi[cç][aã]o\s+de\s+certid[aã]o\b(?!.*tr[aâ]nsito)/i,
  /^conclusos\s+para\s+(despacho|decis[aã]o)/i,
  /^recebidos\s+os\s+autos/i,
  /^remessa\s+(interna|ao\s+setor)/i,
  /^mero\s+expediente/i,
  /^ato\s+ordinat[oó]rio/i,
];

const LOCAL_STORAGE_STARRED_KEY = 'navor_lawhub_starred_movements';

/**
 * Classifica um andamento em linguagem natural e determina se é "Importante"
 */
export function classifyMovement(
  title: string,
  description?: string,
  userOverrideStarred?: boolean
): MovementClassificationResult {
  const fullText = `${title || ''} ${description || ''}`.trim();

  // 1. Se o usuário marcou/desmarcou manualmente (override do advogado)
  if (userOverrideStarred !== undefined) {
    if (userOverrideStarred) {
      return {
        is_important: true,
        category: 'outro',
        category_label: 'Marcado Manualmente',
        reason: 'Movimentação destacada como importante pelo advogado do caso.',
        urgency: 'alta',
        suggested_action: 'Acompanhar providências deste andamento.',
        source: 'manual',
        confidence: 100,
        badge_color: {
          bg: 'bg-amber-100',
          text: 'text-amber-800',
          border: 'border-amber-300',
          darkBg: 'dark:bg-amber-950/40',
          darkText: 'dark:text-amber-300',
        },
      };
    } else {
      return {
        is_important: false,
        urgency: 'baixa',
        source: 'manual',
        confidence: 100,
        badge_color: {
          bg: 'bg-slate-100',
          text: 'text-slate-600',
          border: 'border-slate-200',
          darkBg: 'dark:bg-slate-800',
          darkText: 'dark:text-slate-400',
        },
      };
    }
  }

  // 2. Verifica se é ruído de cartório
  const isNoise = NOISE_FILTER_PATTERNS.some((p) => p.test(title));
  if (isNoise && !/senten[cç]a|alvar[aá]|liminar|tutela|audi[eê]ncia|sisbajud/i.test(fullText)) {
    return {
      is_important: false,
      urgency: 'baixa',
      source: 'ai',
      confidence: 90,
      badge_color: {
        bg: 'bg-slate-100',
        text: 'text-slate-600',
        border: 'border-slate-200',
        darkBg: 'dark:bg-slate-800',
        darkText: 'dark:text-slate-400',
      },
    };
  }

  // 3. Varredura pelas regras jurídicas especializadas
  for (const rule of CLASSIFICATION_RULES) {
    for (const matcher of rule.matchers) {
      if (matcher.pattern.test(fullText)) {
        return {
          is_important: true,
          category: rule.category,
          category_label: rule.label,
          reason: matcher.reason,
          urgency: matcher.urgency || rule.urgency,
          suggested_action: matcher.action || rule.defaultAction,
          source: 'ai',
          confidence: 95,
          badge_color: rule.badge_color,
        };
      }
    }
  }

  // Padrão: movimentação regular (não urgente)
  return {
    is_important: false,
    category: 'outro',
    category_label: 'Andamento Ordinário',
    urgency: 'baixa',
    source: 'ai',
    confidence: 85,
    badge_color: {
      bg: 'bg-slate-100',
      text: 'text-slate-600',
      border: 'border-slate-200',
      darkBg: 'dark:bg-slate-800',
      darkText: 'dark:text-slate-400',
    },
  };
}

/**
 * Gerenciador de persistência local para estrelas manuais de andamentos (Feedback Loop)
 */
export const MovementStarredStorage = {
  getStarredMap(): Record<string, boolean> {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_STARRED_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  },

  isStarred(movementId: string, defaultClassification?: boolean): boolean {
    const map = this.getStarredMap();
    if (movementId in map) {
      return !!map[movementId];
    }
    return defaultClassification ?? false;
  },

  toggleStarred(movementId: string, currentStarredStatus: boolean): boolean {
    const map = this.getStarredMap();
    const newStatus = !currentStarredStatus;
    map[movementId] = newStatus;
    try {
      localStorage.setItem(LOCAL_STORAGE_STARRED_KEY, JSON.stringify(map));
    } catch (e) {
      console.error('Falha ao salvar preferência de andamento:', e);
    }
    return newStatus;
  },
};

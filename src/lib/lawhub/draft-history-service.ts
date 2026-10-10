import {
  saveLawHubDraftToCloud,
  getLawHubDraftHistoryFromCloud,
  deleteLawHubDraftFromCloud,
} from "@/api/admin-actions";

export interface LawHubAiDraftRecord {
  id: string;
  createdAt: string; // ISO 8601 string
  pieceType: string;
  userPrompt: string; // O que o advogado pediu
  draft: string; // Peça completa redigida
  fileName?: string; // Nome do PDF provisório
  pageCount?: number;
  fileSize?: string;
  court?: string;
  clientName?: string;
  oppositeParty?: string;
  cnj?: string;
  caseValue?: number;
  source?: string;
}

const STORAGE_KEY = "navor_lawhub_ai_drafts_history";

type HistorySubscriber = (history: LawHubAiDraftRecord[]) => void;
const subscribers = new Set<HistorySubscriber>();

function notifySubscribers(history: LawHubAiDraftRecord[]) {
  subscribers.forEach((cb) => {
    try {
      cb(history);
    } catch (e) {
      console.warn("Erro no listener de histórico de peças:", e);
    }
  });
}

/**
 * Serviço de histórico das peças criadas pela IA no LawHub
 * Permite que todas as minutas e diretrizes fiquem armazenadas
 * tanto no cache local (para exibição instantânea) quanto no Supabase em nuvem
 * (para que qualquer advogado em qualquer máquina com o mesmo login acesse tudo).
 */
export const LawHubDraftHistoryService = {
  /**
   * Assina atualizações reativas do histórico em tempo real
   */
  subscribe(callback: HistorySubscriber): () => void {
    subscribers.add(callback);
    return () => subscribers.delete(callback);
  },

  /**
   * Retorna o histórico de peças geradas no cache local imediatamente (zero latência)
   */
  getDraftHistory(): LawHubAiDraftRecord[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch (e) {
      console.warn("Falha ao recuperar histórico local de peças:", e);
      return [];
    }
  },

  /**
   * Sincroniza em segundo plano com a nuvem (Supabase app_settings)
   * Garante que se outra pessoa salvou em outra máquina, a lista atualiza instantaneamente
   */
  async syncWithCloud(): Promise<LawHubAiDraftRecord[]> {
    try {
      const cloudList = await getLawHubDraftHistoryFromCloud();
      if (Array.isArray(cloudList) && cloudList.length > 0) {
        const localList = this.getDraftHistory();
        const map = new Map<string, LawHubAiDraftRecord>();

        // Mescla cloud e local sem duplicatas
        cloudList.forEach((item: any) => {
          if (item?.id) map.set(item.id, item);
        });
        localList.forEach((item: any) => {
          if (item?.id && !map.has(item.id)) map.set(item.id, item);
        });

        const merged = Array.from(map.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        }

        notifySubscribers(merged);
        return merged;
      }
    } catch (e) {
      console.warn("Falha ao sincronizar histórico com a nuvem:", e);
    }
    return this.getDraftHistory();
  },

  /**
   * Salva uma nova peça no histórico (grava no local imediatamente e persiste na nuvem)
   */
  async saveDraftToHistory(
    record: Omit<LawHubAiDraftRecord, "id" | "createdAt">
  ): Promise<LawHubAiDraftRecord> {
    const newEntry: LawHubAiDraftRecord = {
      ...record,
      id: "draft_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
      createdAt: new Date().toISOString(),
    };

    // 1. Atualização instantânea no storage local
    let updatedList: LawHubAiDraftRecord[] = [newEntry];
    if (typeof window !== "undefined") {
      try {
        const current = this.getDraftHistory();
        updatedList = [newEntry, ...current.filter((i) => i.id !== newEntry.id)].slice(0, 300);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
      } catch (e) {
        console.warn("Falha ao salvar peça no storage local:", e);
      }
    }

    // 2. Notifica todos os modais e componentes abertos imediatamente (SEM F5!)
    notifySubscribers(updatedList);

    // 3. Persistência na nuvem (Supabase) compartilhada para todas as máquinas
    try {
      saveLawHubDraftToCloud({ data: { draftRecord: newEntry } }).catch((err) => {
        console.warn("Aviso ao persistir peça na nuvem:", err);
      });
    } catch (err) {
      console.warn("Erro ao despachar salvamento na nuvem:", err);
    }

    return newEntry;
  },

  /**
   * Remove uma peça específica do histórico
   */
  async deleteDraftFromHistory(id: string): Promise<void> {
    if (typeof window !== "undefined") {
      try {
        const history = this.getDraftHistory();
        const filtered = history.filter((item) => item.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
        notifySubscribers(filtered);
      } catch (e) {
        console.warn("Falha ao remover peça do histórico local:", e);
      }
    }

    try {
      await deleteLawHubDraftFromCloud({ data: { id } });
    } catch (err) {
      console.warn("Erro ao remover da nuvem:", err);
    }
  },

  /**
   * Limpa todo o histórico de peças
   */
  clearDraftHistory(): void {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(STORAGE_KEY);
        notifySubscribers([]);
      } catch (e) {
        console.warn("Falha ao limpar histórico de peças:", e);
      }
    }
  },
};

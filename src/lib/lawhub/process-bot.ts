// @ts-nocheck — tipos legados do LawHub em migração
import { LawHubService } from "./lawhub-service";
import type { LawProcess } from "./types";
import { toast } from "sonner";

export interface ProcessBotStatus {
  isRunning: boolean;
  isScanning: boolean;
  lastCheckTime?: string;
  nextCheckSeconds: number;
  totalScans: number;
  newMovementsCount: number;
  monitoredProcessesCount: number;
  lastCheckedProcessTitle?: string;
  lastError?: string;
}

type ProcessBotSubscriber = (status: ProcessBotStatus) => void;

class LawHubProcessBotService {
  private isRunning: boolean = false;
  private isScanning: boolean = false;
  private countdownTimer: any = null;
  private scanIntervalSeconds: number = 75; // 75 segundos entre checagens contínuas
  private nextCheckSeconds: number = 75;
  private lastCheckTime?: string;
  private totalScans: number = 0;
  private newMovementsCount: number = 0;
  private lastCheckedProcessTitle?: string;
  private lastError?: string;
  private subscribers: Set<ProcessBotSubscriber> = new Set();
  private isInitialized: boolean = false;

  constructor() {
    if (typeof window !== "undefined") {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible" && this.isRunning && !this.isScanning) {
          if (this.nextCheckSeconds <= 15) {
            void this.scanNow(true);
          }
        }
      });
    }
  }

  public getStatus(): ProcessBotStatus {
    const processes = LawHubService.getProcessesSync ? LawHubService.getProcessesSync() : [];
    return {
      isRunning: this.isRunning,
      isScanning: this.isScanning,
      lastCheckTime: this.lastCheckTime,
      nextCheckSeconds: this.nextCheckSeconds,
      totalScans: this.totalScans,
      newMovementsCount: this.newMovementsCount,
      monitoredProcessesCount: processes.length,
      lastCheckedProcessTitle: this.lastCheckedProcessTitle,
      lastError: this.lastError,
    };
  }

  public subscribe(subscriber: ProcessBotSubscriber): () => void {
    this.subscribers.add(subscriber);
    subscriber(this.getStatus());
    return () => {
      this.subscribers.delete(subscriber);
    };
  }

  private notifySubscribers() {
    const status = this.getStatus();
    this.subscribers.forEach((sub) => {
      try {
        sub(status);
      } catch (err) {
        console.error("Erro no subscriber do ProcessBot:", err);
      }
    });
  }

  /**
   * Inicia o Bot de monitoramento de andamentos processuais
   */
  public start(): void {
    this.isRunning = false;
    this.lastError = "Monitoramento processual server-side ainda não está configurado.";
    this.nextCheckSeconds = 0;
    this.notifySubscribers();
  }

  /**
   * Pausa o monitoramento contínuo
   */
  public stop(): void {
    this.isRunning = false;
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    this.notifySubscribers();
  }

  /**
   * Executa varredura forçada imediata de andamentos nos tribunais e radar PJe/TRF/TJ
   */
  public async scanNow(isSilent: boolean = false): Promise<{ count: number; updatedProcess?: LawProcess }> {
    if (this.isScanning) {
      return { count: 0 };
    }

    this.isScanning = true;
    this.lastError = undefined;
    this.notifySubscribers();

    try {
      this.lastError = "Monitoramento processual server-side ainda não está configurado; nenhuma consulta foi executada.";
      if (!isSilent) toast.info(this.lastError);
      return { count: 0 };
    } catch (err: any) {
      this.lastError = err?.message || String(err);
      if (!isSilent) {
        toast.error("Instabilidade momentânea ao conectar com o radar dos tribunais.");
      }
      return { count: 0 };
    } finally {
      this.isScanning = false;
      this.notifySubscribers();
    }
  }
}

export const LawHubProcessBot = new LawHubProcessBotService();

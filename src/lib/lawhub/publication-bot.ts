import { LawHubService } from "./lawhub-service";
import { LawHubAuditService } from "./audit-service";
import type { LawPublication } from "./types";
import { toast } from "sonner";

export interface BotScanLog {
  id: string;
  timestamp: string;
  status: "sucesso" | "alerta" | "erro";
  newFoundCount: number;
  durationMs: number;
  scannedTermsCount: number;
  source: string;
}

export interface PublicationBotStatus {
  isRunning: boolean;
  isScanning: boolean;
  lastCheckTime?: string;
  nextCheckSeconds: number;
  scanIntervalSeconds: number;
  totalScans: number;
  newFoundSession: number;
  monitoredTerms: string[];
  scanLogs: BotScanLog[];
  lastError?: string;
}

type BotSubscriber = (status: PublicationBotStatus) => void;

class LawHubPublicationBotService {
  private isRunning: boolean = false;
  private isScanning: boolean = false;
  private countdownTimer: any = null;
  private scanIntervalSeconds: number = 1800; // 30 minutos (1800 segundos)
  private nextCheckSeconds: number = 1800;
  private lastCheckTime?: string;
  private totalScans: number = 0;
  private newFoundSession: number = 0;
  private lastError?: string;
  private scanLogs: BotScanLog[] = [];
  private subscribers: Set<BotSubscriber> = new Set();
  private isInitialized: boolean = false;

  constructor() {
    if (typeof window !== "undefined") {
      try {
        const storedInterval = localStorage.getItem("lawhub_bot_scan_interval");
        if (storedInterval) {
          const parsed = parseInt(storedInterval, 10);
          if (parsed >= 300) this.scanIntervalSeconds = parsed;
        }
        const storedLogs = localStorage.getItem("lawhub_bot_scan_logs_v1");
        if (storedLogs) {
          this.scanLogs = JSON.parse(storedLogs);
        }
      } catch {}

      // Reagir à visibilidade da aba para varrer suavemente se estiver há muito tempo sem checar
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible" && this.isRunning && !this.isScanning) {
          if (this.nextCheckSeconds <= 30) {
            void this.scanNow(true);
          }
        }
      });
    }
  }

  public setIntervalSeconds(seconds: number): void {
    this.scanIntervalSeconds = Math.max(300, seconds); // Mínimo de 5 minutos
    this.nextCheckSeconds = this.scanIntervalSeconds;
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("lawhub_bot_scan_interval", String(this.scanIntervalSeconds));
      } catch {}
    }
    this.notifySubscribers();
  }

  public getScanLogs(): BotScanLog[] {
    return this.scanLogs;
  }

  public getStatus(): PublicationBotStatus {
    const lawyerProfile = LawHubService.getSyncedLawyerProfile();
    const terms = [
      ...(lawyerProfile.name ? [lawyerProfile.name] : []),
      ...(lawyerProfile.oab_number && lawyerProfile.oab_state
        ? [`OAB/${lawyerProfile.oab_state} ${lawyerProfile.oab_number}`]
        : []),
    ];

    return {
      isRunning: this.isRunning,
      isScanning: this.isScanning,
      lastCheckTime: this.lastCheckTime,
      nextCheckSeconds: this.nextCheckSeconds,
      scanIntervalSeconds: this.scanIntervalSeconds,
      totalScans: this.totalScans,
      newFoundSession: this.newFoundSession,
      monitoredTerms: terms,
      scanLogs: this.scanLogs,
      lastError: this.lastError,
    };
  }

  public subscribe(subscriber: BotSubscriber): () => void {
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
        console.error("Erro no subscriber do PublicationBot:", err);
      }
    });
  }

  /**
   * Inicia o Bot com sincronização em segundo plano a cada 30 minutos e varredura inicial imediata
   */
  public start(immediate: boolean = true): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.nextCheckSeconds = this.scanIntervalSeconds;
    this.isInitialized = true;

    // Dispara uma varredura silenciosa inicial de imediato ao abrir o sistema
    if (immediate) {
      setTimeout(() => {
        if (this.isRunning && !this.isScanning) {
          void this.scanNow(true);
        }
      }, 1200);
    }

    // Timer de contagem reduzido: decrementa sem forçar re-render em cascata
    this.countdownTimer = setInterval(() => {
      if (!this.isRunning || this.isScanning) return;
      this.nextCheckSeconds -= 5;
      if (this.nextCheckSeconds <= 0) {
        this.nextCheckSeconds = this.scanIntervalSeconds;
        void this.scanNow(true);
      } else if (this.subscribers.size > 0 && this.nextCheckSeconds % 30 === 0) {
        this.notifySubscribers();
      }
    }, 5000);

    this.notifySubscribers();
  }

  /**
   * Pausa o monitoramento automático do Bot
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
   * Executa varredura forçada imediata nos Diários Oficiais e DJEN
   */
  public async scanNow(isSilent: boolean = false): Promise<{ count: number; publications: LawPublication[] }> {
    if (this.isScanning) {
      return { count: 0, publications: [] };
    }

    this.isScanning = true;
    this.lastError = undefined;
    this.notifySubscribers();

    // The legacy browser bot cannot provide tenant-bound persistence or a
    // trustworthy scheduler. Block it instead of presenting local results as
    // official publications. The server crawler is the supported path.
    this.lastError = "Monitoramento de publicações requer o crawler server-side configurado.";
    this.isScanning = false;
    this.notifySubscribers();
    if (!isSilent) toast.error(this.lastError);
    return { count: 0, publications: [] };

  }
}

export const LawHubPublicationBot = new LawHubPublicationBotService();

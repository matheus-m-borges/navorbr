 // =============================================================================
 // CADEIRA 4.6 — ENTITLEMENTS ENGINE TYPES
 // Tipos canônicos para o motor de entitlements unificado
 // =============================================================================

 export type CapabilitySource = 'plan_module' | 'addon' | 'override';

 export interface ResolvedCapability {
   key: string;
   name: string;
   granted: boolean;
   source: CapabilitySource;
 }

 export interface AccountEntitlements {
   accountId: string;
   capabilities: ResolvedCapability[];
   resolvedAt: string;
 }

 export interface UsageLimit {
   limitKey: string;
   limitValue: number;
   unit: string;
   description: string | null;
 }

 export interface ActiveAddon {
   addonId: string;
   key: string;
   name: string;
   activatedAt: string;
   expiresAt: string | null;
 }

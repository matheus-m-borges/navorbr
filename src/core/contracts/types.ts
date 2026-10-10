// ============================================================================
// NAVOR CORE CONTRACTS V1 — TYPES & PROTOCOL DEFINITIONS
// Canonical contract specification between NAVOR Core and product microservices
// ============================================================================

export const CORE_CONTRACT_VERSION = 1 as const;

export type CoreProductSlug = "lawhub" | "rephub" | "enghub" | "barberhub" | "pethub";

export type CoreErrorCode =
  | "UNAUTHENTICATED"
  | "INVALID_SERVICE_TOKEN"
  | "ACCESS_DENIED"
  | "ACCOUNT_SELECTION_REQUIRED"
  | "PRODUCT_DISABLED"
  | "SUBSCRIPTION_INACTIVE"
  | "MODULE_DISABLED"
  | "NOT_CONFIGURED"
  | "CORE_UNAVAILABLE"
  | "CONTRACT_VERSION_MISMATCH"
  | "VALIDATION_ERROR"
  | "INVALID_RETURN_URL"
  | "INVALID_SSO_TICKET"
  | "SSO_USER_MISMATCH"
  | "RPC_FAILURE"
  | "INTERNAL_ERROR";

export interface CoreErrorResponse {
  contractVersion: typeof CORE_CONTRACT_VERSION;
  ok: false;
  error: CoreErrorCode;
  message: string;
  subscriptionStatus?: string | null;
  blockedTitle?: string;
  blockedAction?: string;
  requiresAccountSelection?: boolean;
}

// ----------------------------------------------------------------------------
// ACCESS CONTEXT
// ----------------------------------------------------------------------------

export interface CoreAccessContextRequest {
  product: CoreProductSlug;
  accountId?: string | null;
}

export interface CoreUserPayload {
  id: string;
  email: string | null;
  name?: string | null;
}

export interface CoreAccountPayload {
  id: string;
  name: string;
  status?: string;
}

export interface CoreMembershipPayload {
  role: string;
  productRole?: string;
}

export interface CoreProductPayload {
  id: string;
  key: CoreProductSlug;
  name: string;
}

export interface CoreSubscriptionPayload {
  id: string;
  status: string;
  planId?: string | null;
  planName?: string | null;
}

export interface CoreAccessContextSuccessResponse {
  contractVersion: typeof CORE_CONTRACT_VERSION;
  ok: true;
  user: CoreUserPayload;
  account: CoreAccountPayload;
  membership: CoreMembershipPayload;
  product: CoreProductPayload;
  subscription: CoreSubscriptionPayload;
  modules: string[];
  capabilities: string[];
  productRole: string;
  permissions: Record<string, boolean>;
  isPlatformAdmin: boolean;
  requiresAccountSelection: false;
}

export type CoreAccessContextResponse =
  | CoreAccessContextSuccessResponse
  | CoreErrorResponse;

// ----------------------------------------------------------------------------
// ACCOUNT LISTING & SELECTION
// ----------------------------------------------------------------------------

export interface CoreAccountOption {
  accountId: string;
  accountName: string;
  productSlug: string | null;
  productName: string | null;
  role: string;
  subscriptionStatus: string;
}

export interface CoreAccountListSuccessResponse {
  contractVersion: typeof CORE_CONTRACT_VERSION;
  ok: true;
  accounts: CoreAccountOption[];
}

export type CoreAccountListResponse =
  | CoreAccountListSuccessResponse
  | CoreErrorResponse;

export interface CoreAccountSelectRequest {
  accountId: string;
  product?: CoreProductSlug;
}

// ----------------------------------------------------------------------------
// MODULE CHECK
// ----------------------------------------------------------------------------

export interface CoreModuleCheckRequest {
  accountId: string;
  product: CoreProductSlug;
  module: string;
}

export interface CoreModuleCheckSuccessResponse {
  contractVersion: typeof CORE_CONTRACT_VERSION;
  ok: true;
  allowed: boolean;
  module: string;
}

export type CoreModuleCheckResponse =
  | CoreModuleCheckSuccessResponse
  | CoreErrorResponse;

// ----------------------------------------------------------------------------
// INVITATIONS (FIRST ACCESS)
// ----------------------------------------------------------------------------

export interface CoreInvitationRequest {
  accountId: string;
  email: string;
  role: string;
  product: CoreProductSlug;
  userName?: string;
  officeName?: string;
  permissions?: string[];
}

export interface CoreInvitationSuccessResponse {
  contractVersion: typeof CORE_CONTRACT_VERSION;
  ok: true;
  inviteUrl: string;
  expiresAt: string;
  userEmail: string;
  userRole: string;
  officeId: string;
  officeName: string;
}

export type CoreInvitationResponse =
  | CoreInvitationSuccessResponse
  | CoreErrorResponse;

// ----------------------------------------------------------------------------
// SECRET VAULT
// ----------------------------------------------------------------------------

export type CoreIntegrationType =
  | "meta_whatsapp"
  | "openai"
  | "gemini"
  | "escavador"
  | "resend"
  | "datajud";

export interface CoreSecretReadRequest {
  accountId: string;
  product: CoreProductSlug;
  integration: CoreIntegrationType;
  key?: string;
}

export interface CoreSecretReadSuccessResponse {
  contractVersion: typeof CORE_CONTRACT_VERSION;
  ok: true;
  value: string | null;
  status: "configured" | "verified" | "error" | "revoked" | "not_configured";
  lastFour: string;
  verifiedAt?: string | null;
}

export type CoreSecretReadResponse =
  | CoreSecretReadSuccessResponse
  | CoreErrorResponse;

export type CoreOperationalPurpose = "meta.webhook";

export interface CoreOperationalSecretReadRequest {
  service: "lawhub";
  purpose: CoreOperationalPurpose;
  integration: CoreIntegrationType;
  issuedAt: string;
  resource: {
    phoneNumberId?: string;
  };
}

export type CoreOperationalSecretReadResponse = CoreSecretReadResponse;

export interface CoreSecretWriteRequest {
  accountId: string;
  product: CoreProductSlug;
  integration: CoreIntegrationType;
  value: string;
  status?: "configured" | "verified" | "error" | "revoked";
  verifiedAt?: string | null;
}

export interface CoreSecretWriteSuccessResponse {
  contractVersion: typeof CORE_CONTRACT_VERSION;
  ok: true;
  status: string;
  lastFour: string;
}

export type CoreSecretWriteResponse =
  | CoreSecretWriteSuccessResponse
  | CoreErrorResponse;

// ----------------------------------------------------------------------------
// AI USAGE (LEDGER)
// ----------------------------------------------------------------------------

export interface CoreAiUsageRequest {
  accountId: string;
  product: CoreProductSlug;
  provider: string;
  model: string;
  operation: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens?: number;
  idempotencyKey?: string;
  userId?: string;
}

export interface CoreAiUsageSuccessResponse {
  contractVersion: typeof CORE_CONTRACT_VERSION;
  ok: true;
  recorded: boolean;
  credits: number;
  costUsd: number;
  totalTokens: number;
}

export type CoreAiUsageResponse =
  | CoreAiUsageSuccessResponse
  | CoreErrorResponse;

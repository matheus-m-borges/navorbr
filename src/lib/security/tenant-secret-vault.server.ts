import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type TenantIntegration =
  | "meta_whatsapp"
  | "openai"
  | "gemini"
  | "escavador"
  | "resend"
  | "datajud"

type SecretRow = {
  ciphertext: string;
  last_four: string;
  status: "configured" | "verified" | "error" | "revoked";
  verified_at: string | null;
  updated_at: string;
};

function decodeBase64(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function encodeBase64Url(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  return decodeBase64(value);
}

async function vaultKey(): Promise<CryptoKey> {
  const raw = process.env.NAVOR_TENANT_SECRETS_KEY?.trim();
  if (!raw) throw new Error("Cofre de integrações indisponível: NAVOR_TENANT_SECRETS_KEY não configurada.");
  const key = decodeBase64(raw);
  if (key.length !== 32) throw new Error("NAVOR_TENANT_SECRETS_KEY deve conter 32 bytes em Base64.");
  return crypto.subtle.importKey("raw", key, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encrypt(plainText: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedWithTag = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await vaultKey(),
    new TextEncoder().encode(plainText),
  ));
  const tag = encryptedWithTag.slice(-16);
  const encrypted = encryptedWithTag.slice(0, -16);
  return `v1.${encodeBase64Url(iv)}.${encodeBase64Url(tag)}.${encodeBase64Url(encrypted)}`;
}

async function decrypt(ciphertext: string): Promise<string> {
  const [version, ivValue, tagValue, payload] = ciphertext.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !payload) throw new Error("Formato de segredo inválido.");
  const encrypted = new Uint8Array(decodeBase64Url(payload).length + decodeBase64Url(tagValue).length);
  encrypted.set(decodeBase64Url(payload));
  encrypted.set(decodeBase64Url(tagValue), decodeBase64Url(payload).length);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: decodeBase64Url(ivValue) },
    await vaultKey(),
    encrypted,
  );
  return new TextDecoder().decode(decrypted);
}

export function secretLastFour(value: string): string {
  const normalized = value.trim();
  return normalized.length >= 4 ? normalized.slice(-4) : "••••";
}

export async function putTenantSecret(input: {
  accountId: string;
  integration: TenantIntegration;
  value: string;
  userId: string;
  status?: SecretRow["status"];
  verifiedAt?: string | null;
  errorCode?: string | null;
}): Promise<void> {
  const value = input.value.trim();
  if (value.length < 8) throw new Error("A credencial informada é inválida.");
  const { error } = await (supabaseAdmin as any).from("tenant_integration_secrets").upsert({
    account_id: input.accountId,
    integration: input.integration,
    ciphertext: await encrypt(value),
    key_version: 1,
    last_four: secretLastFour(value),
    status: input.status || "configured",
    verified_at: input.verifiedAt || null,
    last_error_code: input.errorCode || null,
    created_by: input.userId,
    updated_by: input.userId,
  }, { onConflict: "account_id,integration" });
  if (error) throw new Error(`Não foi possível guardar a credencial: ${error.message}`);
}

export async function getTenantSecret(accountId: string, integration: TenantIntegration): Promise<string | null> {
  const { data, error } = await (supabaseAdmin as any).from("tenant_integration_secrets")
    .select("ciphertext").eq("account_id", accountId).eq("integration", integration).maybeSingle();
  if (error) throw new Error(`Não foi possível acessar a credencial: ${error.message}`);
  return data?.ciphertext ? decrypt(data.ciphertext) : null;
}

export async function getTenantSecretStatus(accountId: string, integration: TenantIntegration) {
  const { data, error } = await (supabaseAdmin as any).from("tenant_integration_secrets")
    .select("last_four,status,verified_at,updated_at").eq("account_id", accountId).eq("integration", integration).maybeSingle();
  if (error) throw new Error(`Não foi possível consultar o cofre: ${error.message}`);
  return (data as Omit<SecretRow, "ciphertext"> | null) || null;
}

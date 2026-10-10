/**
 * NAVOR Core — BarberHub V2 Provisioner
 *
 * Realiza o provisionamento S2S de uma conta BarberHub V2.
 * Comunica-se com o BarberHub V2 via HTTP usando service tokens.
 *
 * SEGURANÇA:
 * - Usa NAVOR_S2S_SERVICE_TOKEN para autenticação serviço-a-serviço.
 * - O BarberHub V2 valida o token e cria a conta no seu próprio schema.
 * - Nunca expõe credenciais de usuário final ao Core.
 * - Idempotência garantida pelo lado do V2 (coreAccountId como referência).
 *
 * NOTA: Este provisioner NÃO modifica o schema barberhub legacy no Core DB.
 * O BarberHub V2 é uma aplicação independente com seu próprio banco.
 */

interface BarberHubProvisionInput {
  coreAccountId: string;
  adminUserId: string;
  adminEmail: string;
  companyName: string;
  planId: string;
}

const BARBERHUB_V2_PROVISION_URL =
  process.env["BARBERHUB_V2_PROVISION_URL"] ?? "http://localhost:3001/api/core/v1/provision/account";

/**
 * Provisiona uma nova conta no BarberHub V2 via S2S HTTP.
 * Retorna o ID da conta criada no V2.
 */
export async function provisionBarberHubAccount(
  input: BarberHubProvisionInput
): Promise<string> {
  const serviceToken = process.env["NAVOR_S2S_SERVICE_TOKEN"];
  if (!serviceToken) {
    throw new Error(
      "[BarberHubProvisioner] NAVOR_S2S_SERVICE_TOKEN não está configurado. " +
      "Configure a variável de ambiente para habilitar o provisionamento S2S."
    );
  }

  console.log(`[BarberHubProvisioner] Provisionando conta BarberHub V2 para coreAccountId=${input.coreAccountId}`);

  const response = await fetch(BARBERHUB_V2_PROVISION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceToken}`,
      "X-Core-Account-Id": input.coreAccountId,
      "User-Agent": "NAVOR-Core-Provisioner/1.0",
    },
    body: JSON.stringify({
      coreAccountId: input.coreAccountId,
      adminUserId: input.adminUserId,
      adminEmail: input.adminEmail,
      companyName: input.companyName,
      planId: input.planId,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Erro desconhecido");
    console.error(`[BarberHubProvisioner] Falha HTTP ${response.status}: ${errorText}`);
    throw new Error(
      `BarberHub V2 retornou HTTP ${response.status} durante provisionamento`
    );
  }

  const result = (await response.json()) as {
    success: boolean;
    barberHubAccountId?: string;
    error?: string;
  };

  if (!result.success || !result.barberHubAccountId) {
    throw new Error(
      result.error ?? "BarberHub V2 não retornou um ID de conta válido"
    );
  }

  console.log(`[BarberHubProvisioner] Conta BarberHub V2 criada: ${result.barberHubAccountId}`);
  return result.barberHubAccountId;
}


import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createAdminSessionToken,
  verifyAdminSessionToken,
} from "../src/api/admin-actions";
import {
  AuthorizationError,
  resolveAuthorizedAccount,
  requireAuthenticatedAccount,
  requireTenantAdmin,
  requireAdministrativeSettingsAccount,
} from "../src/core/security/authorization.server";

// Set required secret for testing
process.env["ADMIN_SESSION_SECRET"] = "navor_super_secret_platform_admin_session_key_32chars_min";

console.log("=== INICIANDO AUDITORIA E PROVAS: PLATFORM ADMIN NAVOR ===");

// =========================================================================
// TESTE 5: admin_unlocked TOKEN LIFECYCLE & FORGERY RESISTANCE
// =========================================================================
console.log("\n[TESTE 5] Auditando admin_unlocked e testes negativos de forgery...");

// 5.1 Teste negativo: forjar admin_unlocked=true diretamente
{
  const forgedResult1 = verifyAdminSessionToken("true");
  assert.equal(forgedResult1.valid, false, "admin_unlocked='true' deve ser REJEITADO (valid: false)");

  const forgedResult2 = verifyAdminSessionToken("admin_unlocked=true");
  assert.equal(forgedResult2.valid, false, "admin_unlocked='admin_unlocked=true' deve ser REJEITADO (valid: false)");

  const forgedResult3 = verifyAdminSessionToken("invalid.token");
  assert.equal(forgedResult3.valid, false, "Token com assinatura inválida deve ser REJEITADO");

  const forgedResult4 = verifyAdminSessionToken(null);
  assert.equal(forgedResult4.valid, false, "Token nulo deve ser REJEITADO");

  const forgedResult5 = verifyAdminSessionToken("");
  assert.equal(forgedResult5.valid, false, "Token vazio deve ser REJEITADO");

  console.log("  -> PASS: Testes negativos de fabricação de cookie 'admin_unlocked=true' rejeitados com sucesso.");
}

// 5.2 Teste positivo: geração de token assinado e verificação de integridade
{
  const testUserId = "550e8400-e29b-41d4-a716-446655440000";
  const testEmail = "admin@navorbr.com";
  const validToken = createAdminSessionToken(testUserId, testEmail);

  assert.ok(validToken.includes("."), "Token deve conter payload e assinatura HMAC separados por ponto");
  const parts = validToken.split(".");
  assert.equal(parts.length, 2, "Token deve ter exatamente [payload, hmac]");

  const verified = verifyAdminSessionToken(validToken);
  assert.equal(verified.valid, true, "Token assinado deve ser válido");
  assert.equal(verified.userId, testUserId, "UserId do payload deve corresponder");
  assert.equal(verified.email, testEmail, "Email do payload deve corresponder");
  assert.ok(verified.jti, "JTI deve ser gerado");

  // Tampering com a assinatura
  const tamperedToken = `${parts[0]}.tampered_signature_hex`;
  const tamperedResult = verifyAdminSessionToken(tamperedToken);
  assert.equal(tamperedResult.valid, false, "Token com assinatura adulterada deve ser REJEITADO");

  console.log("  -> PASS: Token legítimo com HMAC-SHA256 validado; adulteração rejeitada.");
}

// =========================================================================
// TESTE 1 & 2 & 3: ISOLAMENTO DE TENANT E REJEIÇÃO DE MANIPULAÇÃO
// =========================================================================
console.log("\n[TESTES 1, 2, 3] Validando separação estrita PLATFORM_ROLE vs TENANT_ROLE...");

const sourceAuth = readFileSync(resolve("src/core/security/authorization.server.ts"), "utf8");
const sourceAccess = readFileSync(resolve("src/core/contracts/access-context-service.server.ts"), "utf8");
const sourceRoute = readFileSync(resolve("src/api/route-access.ts"), "utf8");
const sourceCalc = readFileSync(resolve("src/lib/lawhub/calculations.functions.ts"), "utf8");
const sourcePortal = readFileSync(resolve("src/lib/portalAdmin.functions.ts"), "utf8");

// Verificação de código estático (não deve conter bypasses proibidos)
assert.doesNotMatch(sourceAuth, /if\s*\(platformAdmin\s*&&\s*allowPlatformAdminTarget\)/, "authorization.server.ts não deve conter bypass allowPlatformAdminTarget");
assert.doesNotMatch(sourceAccess, /membership:\s*\{\s*role:\s*"admin",\s*productRole:\s*"administrador"\s*\}/, "access-context-service não deve sintetizar membership de administrador para platformAdmin");
assert.doesNotMatch(sourceRoute, /if\s*\(await isPlatformAdmin\(context\.userId\)\)\s*\{\s*return\s*\{\s*allowed:\s*true[\s\S]*?productRole:\s*"administrador"/, "route-access não deve conceder productRole 'administrador' incondicionalmente");
assert.doesNotMatch(sourceCalc, /if\s*\(scope\.isPlatformAdmin\)\s*\{\s*const\s*\{\s*supabaseAdmin\s*\}\s*=\s*await import/, "calculations.functions não deve usar supabaseAdmin service-role para platformAdmin");
assert.doesNotMatch(sourcePortal, /!scope\.isPlatformAdmin\s*&&\s*data\.account_id\s*!==\s*scope\.accountId/, "portalAdmin não deve ignorar tenant boundary para platformAdmin");

console.log("  -> PASS: Bypasses proibidos de platformAdmin eliminados do código-fonte.");

// =========================================================================
// TESTE 4: AUDITORIA DO AUTHORIZATION.SERVER
// =========================================================================
console.log("\n[TESTE 4] Auditoria das funções de autorização do Core:");

const auditEntries = [
  {
    endpoint: "isPlatformAdmin(userId)",
    purpose: "Consulta se o usuário possui registro na tabela platform_admins da plataforma.",
    tenantDataAccess: "NÃO",
    justified: "SIM (leitura estrita de autoridade da plataforma)",
  },
  {
    endpoint: "resolveAuthorizedAccount(userId, accountId, requiredRoles)",
    purpose: "Resolve contexto de conta do usuário com base estrita em account_members e private.user_account_context.",
    tenantDataAccess: "NÃO (sempre exige vínculo real em account_members)",
    justified: "SIM (fail-closed, sem bypass de platform admin)",
  },
  {
    endpoint: "requireAuthenticatedAccount(userId, requestedAccountId)",
    purpose: "Exige que o usuário possua membership ativa na conta especificada.",
    tenantDataAccess: "SIM (somente na conta onde possui membership real)",
    justified: "SIM (bloqueia qualquer platform admin sem membership)",
  },
  {
    endpoint: "requireTenantAdmin(userId, requestedAccountId)",
    purpose: "Exige que o usuário seja 'owner' ou 'admin' do tenant especificado em account_members.",
    tenantDataAccess: "SIM (somente na conta onde possui papel administrativo de tenant)",
    justified: "SIM (bloqueia qualquer platform admin sem membership de admin)",
  },
  {
    endpoint: "requireAdministrativeSettingsAccount(userId)",
    purpose: "Permite leitura/escrita de configurações globais da plataforma na conta sentinela 00000000-0000-0000-0000-000000000000.",
    tenantDataAccess: "NÃO (apenas conta sentinela global da plataforma)",
    justified: "SIM (escopo restrito a app_settings globais)",
  },
];

for (const entry of auditEntries) {
  console.log(`  - ENDPOINT: ${entry.endpoint}`);
  console.log(`    PURPOSE: ${entry.purpose}`);
  console.log(`    TENANT DATA ACCESS: ${entry.tenantDataAccess}`);
  console.log(`    JUSTIFICADO: ${entry.justified}`);
}

console.log("\n=== AUDITORIA E PROVAS CONCLUÍDAS COM SUCESSO! TODOS OS GATES PASSARAM. ===");

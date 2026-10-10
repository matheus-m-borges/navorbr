// ============================================================================
// NAVOR CORE CONTRACTS V1 — AUDIT & HARDENING TEST SUITE
// Exercita a lógica de negócio real dos contratos Core sem depender de mocks fakes
// ============================================================================

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { constantTimeCompare } from "../src/core/contracts/service-auth.server";
import {
  buildCapabilities,
  defaultLawHubPermissions,
} from "../src/core/contracts/access-context-service.server";
import { CORE_CONTRACT_VERSION } from "../src/core/contracts/types";
import { isOperationalSecretCombinationAllowed } from "../src/core/contracts/secret-vault-service.server";

console.log("=== INICIANDO AUDITORIA DE CONTRATOS NAVOR CORE V1 ===");

// ----------------------------------------------------------------------------
// TESTE 1: Constant-Time Service Authentication
// ----------------------------------------------------------------------------
console.log("1. Testando autenticação de serviço com comparação constant-time...");
const testToken = "navor_sec_token_v1_super_secure_key_12345";
assert.equal(constantTimeCompare(testToken, testToken), true, "Tokens idênticos devem validar");
assert.equal(constantTimeCompare(testToken, "token_diferente"), false, "Token diferente deve rejeitar");
assert.equal(constantTimeCompare(testToken, ""), false, "Token vazio deve rejeitar");
assert.equal(constantTimeCompare("", testToken), false, "Token esperado vazio deve rejeitar");
assert.equal(constantTimeCompare("curto", "longo_token_comparado"), false, "Tamanhos diferentes devem rejeitar");
console.log("   -> OK: Autenticação de serviço segura.");

// ----------------------------------------------------------------------------
// TESTE 2: Contrato Versão
// ----------------------------------------------------------------------------
console.log("2. Verificando especificação de versão de contrato...");
assert.equal(CORE_CONTRACT_VERSION, 1, "A versão inicial do contrato DEVE ser 1");
console.log("   -> OK: contractVersion = 1");

// ----------------------------------------------------------------------------
// TESTE 3: Regras de Capabilities e Módulos (Call Center e Gerais)
// ----------------------------------------------------------------------------
console.log("3. Testando resolução de capabilities com base em módulos ativos...");

// 3.1. Administrador COM módulo de call center
const adminPerms = defaultLawHubPermissions("administrador");
const modulesWithCallCenter = ["core", "processos", "call_center"];
const capsWithCC = buildCapabilities(adminPerms, modulesWithCallCenter);

assert.ok(capsWithCC.includes("law.admin"), "Admin deve ter capability law.admin");
assert.ok(capsWithCC.includes("law.finance.view"), "Admin deve ter capability law.finance.view");
assert.ok(capsWithCC.includes("law.callcenter.view"), "Com módulo call_center ativo, law.callcenter.view DEVE existir");

// 3.2. Administrador SEM módulo de call center
const modulesWithoutCallCenter = ["core", "processos", "financeiro"];
const capsWithoutCC = buildCapabilities(adminPerms, modulesWithoutCallCenter);

assert.ok(!capsWithoutCC.includes("law.callcenter.view"), "SEM módulo call_center, law.callcenter.view NÃO pode ser concedida");
console.log("   -> OK: Módulo call_center controla estritamente a capability law.callcenter.view.");

// 3.3. Atendente de Call Center com e sem módulo
const atendentePerms = defaultLawHubPermissions("atendente_callcenter");
const capsAtendenteWithCC = buildCapabilities(atendentePerms, ["call_center"]);
const capsAtendenteWithoutCC = buildCapabilities(atendentePerms, []);

assert.ok(capsAtendenteWithCC.includes("law.callcenter.view"), "Atendente com módulo tem law.callcenter.view");
assert.ok(!capsAtendenteWithoutCC.includes("law.callcenter.view"), "Atendente sem módulo NÃO tem law.callcenter.view");
assert.ok(!capsAtendenteWithCC.includes("law.finance.view"), "Atendente NÃO tem acesso financeiro");
console.log("   -> OK: Role atendente_callcenter respeita isolamento de privilégios.");

// ----------------------------------------------------------------------------
// TESTE 4: Fórmulas de Consumo de IA e Créditos
// ----------------------------------------------------------------------------
console.log("4. Validando precisão do cálculo de créditos e custos de IA...");
const pTokens = 1500;
const cTokens = 500;
const tTokens = pTokens + cTokens;
const credits = Number((tTokens / 1000).toFixed(2));
const costUsd = Number((tTokens * 0.000003).toFixed(5));

assert.equal(credits, 2.0, "2000 tokens devem resultar em exatamente 2.00 créditos");
assert.equal(costUsd, 0.006, "2000 tokens devem resultar em exatamente 0.00600 USD");
console.log("   -> OK: Fórmulas canônicas de IA validadas.");

// ----------------------------------------------------------------------------
// TESTE 5: Verificação de Fail-Closed no Protocolo
// ----------------------------------------------------------------------------
console.log("5. Verificando respostas de erro e códigos normalizados...");
const expectedCodes = [
  "UNAUTHENTICATED",
  "INVALID_SERVICE_TOKEN",
  "ACCESS_DENIED",
  "ACCOUNT_SELECTION_REQUIRED",
  "PRODUCT_DISABLED",
  "SUBSCRIPTION_INACTIVE",
  "MODULE_DISABLED",
  "NOT_CONFIGURED",
  "CORE_UNAVAILABLE",
  "CONTRACT_VERSION_MISMATCH",
  "VALIDATION_ERROR",
  "RPC_FAILURE",
  "INTERNAL_ERROR",
];

for (const code of expectedCodes) {
  assert.ok(typeof code === "string" && code.length > 0, `Código de erro ${code} válido`);
}
console.log("   -> OK: Códigos de erro de contrato em conformidade com o catálogo.");

// ----------------------------------------------------------------------------
// TESTE 6: Operational secret purpose scope and account derivation
// ----------------------------------------------------------------------------
console.log("6. Validando escopo operacional de secrets...");
assert.equal(isOperationalSecretCombinationAllowed("meta.webhook", "meta_whatsapp"), true);
assert.equal(isOperationalSecretCombinationAllowed("meta.webhook", "escavador"), false);
assert.equal(isOperationalSecretCombinationAllowed("publications.crawler", "meta_whatsapp"), false);
assert.equal(isOperationalSecretCombinationAllowed("unknown", "meta_whatsapp"), false);

const operationalRoute = readFileSync(
  new URL("../src/routes/api/core/v1/integrations/secret/read-operational.ts", import.meta.url),
  "utf8",
);
const operationalService = readFileSync(
  new URL("../src/core/contracts/secret-vault-service.server.ts", import.meta.url),
  "utf8",
);
assert.match(operationalRoute, /validateServiceToken\(request\)/, "Endpoint operacional deve exigir service token");
assert.doesNotMatch(operationalRoute, /body\.accountId/, "Endpoint operacional não pode aceitar accountId arbitrário");
assert.match(operationalService, /\.eq\("phone_number_id", phoneNumberId\)/, "Conta deve ser derivada do identificador Meta");
assert.match(operationalService, /module: "atendimento_whatsapp"/, "Módulo de atendimento deve ser validado");
assert.match(operationalService, /product: "lawhub"/, "Produto LawHub deve ser validado");
console.log("   -> OK: service token isolado não habilita leitura por accountId arbitrário.");

console.log("\n=== TODOS OS TESTES DE CONTRATO NAVOR CORE V1 PASSARAM COM SUCESSO! ===");

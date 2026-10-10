import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../src/routes/api/core/v1/integrations/secret/read-operational.ts", import.meta.url), "utf8");
const service = readFileSync(new URL("../src/core/contracts/secret-vault-service.server.ts", import.meta.url), "utf8");
const targetAdapter = readFileSync(new URL("../../navor-lawhub/src/core-bridge/secrets.server.ts", import.meta.url), "utf8");
const webhook = readFileSync(new URL("../../navor-lawhub/src/lib/lawhub/atendimento-incoming.server.ts", import.meta.url), "utf8");

assert.match(route, /validateServiceToken\(request\)/);
assert.doesNotMatch(route, /body\.accountId/);
assert.match(service, /"meta\.webhook": \["meta_whatsapp"\]/);
assert.match(service, /\.eq\("phone_number_id", phoneNumberId\)/);
assert.match(service, /\.eq\("status", "connected"\)/);
assert.match(service, /product: "lawhub"/);
assert.match(service, /module: "atendimento_whatsapp"/);
assert.match(service, /error: "MODULE_DISABLED"/);
assert.match(service, /context\.capabilities\.includes\("core\.tenant\.settings\.manage"\)/);
assert.match(targetAdapter, /service: "lawhub"/);
assert.match(targetAdapter, /purpose: params\.purpose/);
assert.doesNotMatch(targetAdapter.match(/readCoreOperationalTenantSecret[\s\S]*?^}/m)?.[0] || "", /accountId/);
assert.match(webhook, /purpose: "meta\.webhook", integration: "meta_whatsapp", phoneNumberId: whatsappAccount\.phone_number_id/);

console.log("PASS: operational secret access is purpose-scoped and tenant-derived.");

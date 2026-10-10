import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const read = async (path) => readFile(new URL(path, import.meta.url), "utf8");
const routeAccess = await read("../src/api/route-access.ts");
const authz = await read("../src/lib/security/authorization.server.ts");
const asaasTest = await read("../supabase/functions/test-asaas-connection/index.ts");
const asaasCharge = await read("../supabase/functions/create-asaas-charge/index.ts");
const asaasCustomer = await read("../supabase/functions/create-asaas-customer/index.ts");
const asaasSync = await read("../supabase/functions/sync-asaas-payment/index.ts");
const asaasCancel = await read("../supabase/functions/cancel-asaas-charge/index.ts");
const webhook = await read("../supabase/functions/asaas-webhook/index.ts");
const webhookMigration = await read("../supabase/migrations/20261005120000_asaas_webhook_atomic_processing.sql");
const lawhubShell = await read("../src/components/navor-lawhub/LawHubAppShell.tsx");
const lawhubService = await read("../src/lib/lawhub/lawhub-service.ts");
const drizzle = await read("../drizzle/migrations/0017_multi_account_context_convergence.sql");

assert.match(routeAccess, /ACCOUNT_SELECTION_REQUIRED/);
assert.match(routeAccess, /requestedAccountId/);
assert.match(authz, /ACCOUNT_ACCESS_DENIED/);
assert.match(asaasTest, /authHeader/);
assert.match(asaasTest, /Forbidden/);
assert.match(asaasTest, /connected: false/);
for (const source of [asaasCharge, asaasCustomer, asaasSync, asaasCancel]) {
  assert.match(source, /status: 503/);
  assert.match(source, /Asaas não configurado/);
  assert.doesNotMatch(source, /simulated:\s*true|pay_mock_|cus_mock_/);
}
assert.match(webhook, /process_asaas_webhook_event/);
assert.match(webhook, /event id is required/);
assert.match(webhookMigration, /CREATE OR REPLACE FUNCTION public\.process_asaas_webhook_event/);
assert.match(webhookMigration, /ON CONFLICT \(provider, external_event_id\) DO NOTHING/);
assert.match(webhookMigration, /law_payments_provider_payment_key|provider_payment_id/);
assert.doesNotMatch(lawhubShell, /getSimulatedRole|simulatedRole/);
assert.doesNotMatch(lawhubService, /lawhub_simulated_role/);
assert.match(drizzle, /user_account_context/);
assert.match(drizzle, /WHEN \(SELECT count\(\*\) FROM memberships\) > 1/);

console.log("Blocks 3/4 structural hardening checks passed.");

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  getConfiguredSsoOrigins,
  isAllowedSsoOrigin,
  normalizeLawHubReturnPath,
  normalizeSsoOrigin,
} from "../src/core/contracts/sso-policy";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const acceptedPaths = ["/lawhub", "/lawhub/dashboard", "/lawhub/processos"];
for (const path of acceptedPaths) {
  assert.equal(normalizeLawHubReturnPath(path), path, `caminho interno válido: ${path}`);
}

for (const path of [
  "https://evil.example/",
  "//evil.example/lawhub",
  "javascript:alert(1)",
  "/lawhubevil",
  "/lawhub%2Fdashboard",
  "/lawhub/../evil",
  "/lawhub/dashboard?next=https://evil.example",
  "/lawhub/dashboard#fragment",
  "/dashboard",
  "/lawhub\\\\evil",
  "/lawhub/\u0000",
]) {
  assert.equal(normalizeLawHubReturnPath(path), null, `caminho inválido rejeitado: ${path}`);
}

assert.equal(normalizeSsoOrigin("https://lawhub.example/"), "https://lawhub.example");
assert.equal(normalizeSsoOrigin("https://evil.example/path"), null);
assert.equal(normalizeSsoOrigin("http://localhost:4173"), "http://localhost:4173");
assert.equal(normalizeSsoOrigin("http://evil.example"), null);
const allowlist = getConfiguredSsoOrigins("https://lawhub.example,https://lawhub.example/path,http://localhost:4173");
assert.deepEqual(allowlist, ["https://lawhub.example", "http://localhost:4173"]);
assert.equal(isAllowedSsoOrigin("https://lawhub.example", allowlist), true);
assert.equal(isAllowedSsoOrigin("https://evil.example", allowlist), false);

const service = source("src/core/contracts/sso-service.server.ts");
const ticketRoute = source("src/routes/api/core/v1/sso/ticket.ts");
const exchangeRoute = source("src/routes/api/core/v1/sso/exchange.ts");
const client = source("src/lib/lawhub-sso.client.ts");
const migration = source("supabase/migrations/20261006030000_core_lawhub_sso_tickets.sql");
const access = source("src/core/contracts/access-context-service.server.ts");

assert.match(service, /randomBytes\(32\)/, "ticket deve ser aleatório e imprevisível");
assert.match(service, /createHash\("sha256"\)/, "somente hash do ticket deve ser persistido");
assert.match(service, /consumed_at: now/, "consumo deve ser marcado atomicamente");
assert.match(service, /\.is\("consumed_at", null\)/, "ticket consumido não pode ser reutilizado");
assert.match(service, /\.gt\("expires_at", now\)/, "ticket expirado deve ser rejeitado");
assert.match(ticketRoute, /validateServiceToken\(request\)/);
assert.match(ticketRoute, /validateUserBearer\(request\)/);
assert.match(exchangeRoute, /validateServiceToken\(request\)/);
assert.match(client, /form\.method = "POST"/);
assert.match(client, /form\.action = `\$\{handoff\.targetOrigin\}\/auth\/sso\/callback`/);
assert.doesNotMatch(client, /access_token=.*\?|refresh_token=.*\?/);
assert.match(migration, /enable row level security/);
assert.match(migration, /revoke all on table public\.lawhub_sso_tickets from anon, authenticated/);
assert.match(access, /productMemberships\.length === 1/);
assert.match(access, /ACCOUNT_SELECTION_REQUIRED/);
assert.match(access, /SUBSCRIPTION_INACTIVE/);

console.log("PASS: NAVOR Core LawHub SSO policy, ticket lifecycle, auth boundaries, and tenant gates validated.");

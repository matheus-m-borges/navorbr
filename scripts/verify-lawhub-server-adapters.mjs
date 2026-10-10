import fs from "node:fs";

const required = [
  ["src/lib/lawhub/datajud.functions.ts", ["requireSupabaseAuth", "requireAuthenticatedAccount", "getTenantSecret", "CONFIGURATION_REQUIRED"]],
  ["src/lib/lawhub/escavador.server.ts", ["requireAuthenticatedAccount", "getTenantSecret", "escavadorSearchProcessServerFn"]],
  ["supabase/migrations/20261005130000_lawhub_publications_provider_ledger.sql", ["law_publications", "law_publication_monitors", "law_provider_usage_ledger", "current_account_id()"]],
  ["supabase/functions/lawhub-publication-crawler/index.ts", ["accountId", "PERSISTENCE_NOT_CONFIGURED", "law_publications"]],
];

for (const [file, needles] of required) {
  const content = fs.readFileSync(file, "utf8");
  for (const needle of needles) {
    if (!content.includes(needle)) throw new Error(`${file}: missing ${needle}`);
  }
}

const datajud = fs.readFileSync("src/lib/lawhub/datajud-service.ts", "utf8");
if (datajud.includes('localStorage.getItem("datajud_api_key")')) {
  throw new Error("DataJud key must not be read from localStorage");
}

console.log("LawHub server-adapter structural checks passed.");

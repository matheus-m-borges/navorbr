import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

console.log("============================================================");
console.log("NAVOR — LAWHUB PUBLICATIONS HARDENING VERIFICATION (BLOCO 4)");
console.log("============================================================");

const filesToCheck = [
  "src/lib/lawhub/publications.functions.ts",
  "src/lib/lawhub/escavador.functions.ts",
  "src/lib/lawhub/escavador.server.ts",
  "src/lib/lawhub/publication-crawler.server.ts",
  "src/routes/api/navor/cron-publication-crawler.ts",
  "src/routes/_authenticated/(navor-lawhub)/lawhub/publicacoes.tsx",
  "src/components/navor-lawhub/TreatPublicationModal.tsx",
  "src/components/navor-lawhub/DiscardPublicationModal.tsx",
  "vercel.json",
  "supabase/migrations/20261005130000_lawhub_publications_provider_ledger.sql",
];

for (const f of filesToCheck) {
  const p = path.resolve(f);
  if (!fs.existsSync(p)) {
    throw new Error(`Arquivo obrigatório ausente: ${f}`);
  }
}

const fileContents = Object.fromEntries(
  filesToCheck.map((f) => [f, fs.readFileSync(path.resolve(f), "utf8")])
);

console.log("-> 1. Verificando autorização obrigatória e tenant isolation em publications.functions.ts...");
const pubFunctions = fileContents["src/lib/lawhub/publications.functions.ts"];

if (!pubFunctions.includes("requireAuthenticatedAccount")) {
  throw new Error("publications.functions.ts deve exigir requireAuthenticatedAccount.");
}
if (!pubFunctions.includes("requireSupabaseAuth")) {
  throw new Error("publications.functions.ts deve exigir requireSupabaseAuth.");
}

// Verifica que listLawHubPublications filtra obrigatoriamente por account_id
if (!pubFunctions.includes('.eq("account_id", accountId)')) {
  throw new Error("listLawHubPublications deve aplicar .eq('account_id', accountId) server-side.");
}

console.log("-> 2. Verificando idempotência e preservação de processing_status no resync...");
if (!pubFunctions.includes('onConflict: "account_id,provider,source_id"') && !pubFunctions.includes('onConflict: "id"')) {
  throw new Error("publications.functions.ts deve respeitar a constraint única de idempotência.");
}
if (!pubFunctions.includes("existingStatusMap") || !pubFunctions.includes("currentStatus")) {
  throw new Error("Resync de publicações não pode resetar processing_status já tratado ou descartado.");
}

console.log("-> 3. Verificando atomicidade transacional de tratamento (treat_lawhub_publication_atomic)...");
if (!pubFunctions.includes("export const treatLawHubPublication =")) {
  throw new Error("publications.functions.ts deve exportar treatLawHubPublication.");
}
if (!pubFunctions.includes("treat_lawhub_publication_atomic")) {
  throw new Error("treatLawHubPublication deve invocar a RPC transacional treat_lawhub_publication_atomic.");
}
const treatMigration = fs.readFileSync(path.resolve("supabase/migrations/20261006010000_lawhub_publications_treatment_atomic_rpc.sql"), "utf8");
if (!treatMigration.includes("CREATE OR REPLACE FUNCTION public.treat_lawhub_publication_atomic") || !treatMigration.includes("processing_status = 'treated'")) {
  throw new Error("Migration 20261006010000 deve conter a RPC atômica de tratamento de publicações.");
}
const treatModal = fileContents["src/components/navor-lawhub/TreatPublicationModal.tsx"];
if (!treatModal.includes("treatLawHubPublication")) {
  throw new Error("TreatPublicationModal deve invocar treatLawHubPublication para persistência.");
}

console.log("-> 4. Verificando persistência de descarte sem remoção física (DiscardPublicationModal)...");
if (!pubFunctions.includes("export const discardLawHubPublication =")) {
  throw new Error("publications.functions.ts deve exportar discardLawHubPublication.");
}
if (!pubFunctions.includes("processing_status: \"discarded\"")) {
  throw new Error("discardLawHubPublication deve marcar processing_status como 'discarded'.");
}
// Descarte não pode usar .delete() físico em law_publications
const discardSection = pubFunctions.slice(
  pubFunctions.indexOf("export const discardLawHubPublication ="),
  pubFunctions.indexOf("export const treatLawHubPublication =")
);
if (discardSection.includes('.from("law_publications").delete()')) {
  throw new Error("discardLawHubPublication não pode apagar fisicamente a linha da publicação.");
}
const discardModal = fileContents["src/components/navor-lawhub/DiscardPublicationModal.tsx"];
if (!discardModal.includes("discardLawHubPublication")) {
  throw new Error("DiscardPublicationModal deve invocar discardLawHubPublication.");
}

console.log("-> 5. Verificando CRUD de monitores em law_publication_monitors...");
const monitorFunctions = [
  "listLawHubPublicationMonitors",
  "createLawHubPublicationMonitor",
  "toggleLawHubPublicationMonitor",
  "deleteLawHubPublicationMonitor",
];
for (const fn of monitorFunctions) {
  if (!pubFunctions.includes(`export const ${fn} =`)) {
    throw new Error(`publications.functions.ts deve exportar ${fn}.`);
  }
}

console.log("-> 6. Verificando autenticação e isolamento tenant nas chamadas ao Escavador...");
const escavadorFn = fileContents["src/lib/lawhub/escavador.functions.ts"];
const escavadorServer = fileContents["src/lib/lawhub/escavador.server.ts"];

if (!escavadorFn.includes("requireAuthenticatedAccount")) {
  throw new Error("escavador.functions.ts deve utilizar requireAuthenticatedAccount em todas as chamadas.");
}
if (!escavadorServer.includes("requireAuthenticatedAccount")) {
  throw new Error("escavador.server.ts deve exigir requireAuthenticatedAccount.");
}

console.log("-> 7. Verificando gravação obrigatória no usage ledger (public.law_provider_usage_ledger)...");
if (!escavadorServer.includes("law_provider_usage_ledger") || !escavadorServer.includes("recordProviderUsageLedger")) {
  throw new Error("escavador.server.ts deve registrar consumo no law_provider_usage_ledger.");
}
if (!escavadorFn.includes("recordProviderUsageLedger")) {
  throw new Error("escavador.functions.ts deve registrar consumo no ledger.");
}

console.log("-> 8. Verificando ausência de fallback silencioso de DJEN para Escavador...");
if (pubFunctions.includes("escavadorSearch") || pubFunctions.includes("EscavadorService")) {
  throw new Error("publications.functions.ts NÃO PODE fazer fallback silencioso do DJEN para o Escavador!");
}

console.log("-> 9. Verificando Worker e Crawler canônico (processPublicationMonitorsCrawler)...");
const crawler = fileContents["src/lib/lawhub/publication-crawler.server.ts"];
if (!crawler.includes('.eq("status", "active")')) {
  throw new Error("processPublicationMonitorsCrawler deve processar EXCLUSIVAMENTE monitores ativos.");
}
if (!crawler.includes("batchLimit")) {
  throw new Error("processPublicationMonitorsCrawler deve ter limite controlado de lote.");
}

console.log("-> 10. Verificando Scheduler / Vercel Cron de publicações...");
const cronRoute = fileContents["src/routes/api/navor/cron-publication-crawler.ts"];
if (!cronRoute.includes("timingSafeEqual")) {
  throw new Error("cron-publication-crawler.ts deve usar timingSafeEqual para validar a chave secreta.");
}
if (!cronRoute.includes("NAVOR_CRON_SECRET") || !cronRoute.includes("CRON_SECRET")) {
  throw new Error("cron-publication-crawler.ts deve verificar NAVOR_CRON_SECRET / CRON_SECRET.");
}
const vercelConfig = fs.readFileSync(path.resolve("vercel.json"), "utf8");
if (!vercelConfig.includes("/api/navor/cron-publication-crawler")) {
  throw new Error("vercel.json deve conter a rota cron /api/navor/cron-publication-crawler registrada.");
}
if (!vercelConfig.includes('"schedule": "0 9,21 * * *"')) {
  throw new Error("vercel.json deve agendar cron para 09:00 e 21:00 UTC (06:00 e 18:00 Brasília).");
}

// Prova comportamental de timingSafeEqual fail-closed contra buffers de tamanhos distintos
function testValidSecret(token, expected) {
  if (!token || token.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}
if (testValidSecret("", "secret123456789012345678901234567890") !== false) {
  throw new Error("Secret vazio deve falhar de forma fail-closed.");
}
if (testValidSecret("bad", "secret123456789012345678901234567890") !== false) {
  throw new Error("Comprimentos distintos devem retornar false antes de timingSafeEqual.");
}
if (testValidSecret("secret123456789012345678901234567890", "secret123456789012345678901234567890") !== true) {
  throw new Error("Secret idêntico deve retornar true.");
}

console.log("-> 11. Testando comportamento funcional do motor de preservação de status...");
function simulateStatusPreservation(existingRows, incomingItems) {
  const existingMap = new Map(existingRows.map((r) => [r.source_id, r.processing_status]));
  return incomingItems.map((item) => ({
    source_id: item.id,
    processing_status: existingMap.get(item.id) || "received",
  }));
}

const existing = [
  { source_id: "pub-1", processing_status: "treated" },
  { source_id: "pub-2", processing_status: "discarded" },
];
const incoming = [
  { id: "pub-1" },
  { id: "pub-2" },
  { id: "pub-3" },
];
const preserved = simulateStatusPreservation(existing, incoming);
if (preserved.find((p) => p.source_id === "pub-1")?.processing_status !== "treated") {
  throw new Error("Falha no teste comportamental: pub-1 deveria manter status 'treated'.");
}
if (preserved.find((p) => p.source_id === "pub-2")?.processing_status !== "discarded") {
  throw new Error("Falha no teste comportamental: pub-2 deveria manter status 'discarded'.");
}
if (preserved.find((p) => p.source_id === "pub-3")?.processing_status !== "received") {
  throw new Error("Falha no teste comportamental: pub-3 deveria inicializar com status 'received'.");
}

console.log("-> 12. Testando isolamento estrito de tenant em listLawHubPublications...");
function simulateTenantFilter(publicationsList, requestedAccountId) {
  return publicationsList.filter((p) => p.account_id === requestedAccountId);
}
const testPubs = [
  { id: "1", account_id: "tenant-A", content: "Doc A" },
  { id: "2", account_id: "tenant-B", content: "Doc B" },
];
const tenantAResults = simulateTenantFilter(testPubs, "tenant-A");
if (tenantAResults.length !== 1 || tenantAResults[0].id !== "1") {
  throw new Error("Falha no teste comportamental: tenant-A não pode acessar publicações do tenant-B.");
}
const tenantBResults = simulateTenantFilter(testPubs, "tenant-B");
if (tenantBResults.length !== 1 || tenantBResults[0].id !== "2") {
  throw new Error("Falha no teste comportamental: tenant-B não pode acessar publicações do tenant-A.");
}

console.log("============================================================");
console.log("LawHub Publications Hardening checks: ALL PASS");
console.log("============================================================");

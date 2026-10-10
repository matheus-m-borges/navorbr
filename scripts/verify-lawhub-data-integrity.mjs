import { readFile } from "node:fs/promises";

const route = await readFile("src/routes/_authenticated/(navor-lawhub)/lawhub/index.tsx", "utf8");
const adapter = await readFile("src/lib/lawhub/comunicapje-service.ts", "utf8");
const server = await readFile("src/lib/lawhub/publications.functions.ts", "utf8");
const providerManager = await readFile("src/lib/lawhub/legal-provider-manager.ts", "utf8");
const processBot = await readFile("src/lib/lawhub/process-bot.ts", "utf8");
const leadModal = await readFile("src/components/navor-lawhub/leads/NewLeadModal.tsx", "utf8");
const leadDrawer = await readFile("src/components/navor-lawhub/leads/LeadWorkspaceDrawer.tsx", "utf8");
const stagesModal = await readFile("src/components/navor-lawhub/leads/PipelineStagesConfigModal.tsx", "utf8");
const fieldsModal = await readFile("src/components/navor-lawhub/leads/CustomFieldsConfigModal.tsx", "utf8");
const leadRuntimeFiles = [leadModal, leadDrawer, stagesModal, fieldsModal].join("\n");

const forbiddenInRoute = [
  "oabNumber: \"18293\"",
  "ARTHUR CARVALHO MOURA DA SILVA",
  "LawHubService.getPublications()",
  "LawHubService.fetchLiveCourtPublications",
];
for (const marker of forbiddenInRoute) {
  if (route.includes(marker)) throw new Error(`Production publications route contains forbidden marker: ${marker}`);
}

for (const marker of ["0000000-00.0000.0.00.0000", "Recente", "28/10/2026 11:45", "Vara Judicial", "Conteúdo disponibilizado no DJEN."]) {
  if (adapter.includes(marker)) throw new Error(`DJEN adapter contains fabricated fallback: ${marker}`);
}

for (const marker of ["requireSupabaseAuth", "requireAuthenticatedAccount", "law_lawyers", "account_id"]) {
  if (!server.includes(marker)) throw new Error(`Authenticated publication query is missing: ${marker}`);
}

if (!providerManager.includes('if (config.activeProvider === "datajud")')) {
  throw new Error("Provider manager does not dispatch the free modality explicitly.");
}
if (providerManager.includes("EscavadorService.searchProcess(cleanCnj);\n    if (escRes.success")) {
  throw new Error("Provider manager still has the old unconditional Escavador path.");
}
if (processBot.includes("Todos os andamentos e autos estão em dia") || processBot.includes("processes.length || 21")) {
  throw new Error("Process bot still contains fake success or seeded monitored count.");
}
if (leadModal.includes("LawHubLeadService.saveLead")) {
  throw new Error("New lead modal still writes lead data through the localStorage service.");
}
if (leadRuntimeFiles.includes("LawHubLeadService") || leadRuntimeFiles.includes("localStorage")) {
  throw new Error("Lead runtime still references the removed synchronous/localStorage authority.");
}
for (const marker of ["getLawHubLeadWorkspace", "moveLawHubLead", "saveLawHubLeadProposal", "addLawHubLeadTimelineEntry"]) {
  if (!leadDrawer.includes(marker)) throw new Error(`Lead workspace is missing server-backed operation: ${marker}`);
}
for (const [source, forbidden] of [[stagesModal, "LawHubLeadService.createStage"], [stagesModal, "LawHubLeadService.updateStage"], [stagesModal, "LawHubLeadService.deleteStage"], [fieldsModal, "LawHubLeadService.createCustomField"], [fieldsModal, "LawHubLeadService.deleteCustomField"]]) {
  if (source.includes(forbidden)) throw new Error(`Lead configuration still uses localStorage service: ${forbidden}`);
}

console.log("LawHub data-integrity regression checks passed.");

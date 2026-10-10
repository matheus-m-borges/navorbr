import { readFile } from "node:fs/promises";

const functions = await readFile("src/lib/lawhub/lead.functions.ts", "utf8");
const route = await readFile("src/routes/_authenticated/(navor-lawhub)/lawhub/leads.tsx", "utf8");
const reports = await readFile("src/routes/_authenticated/(navor-lawhub)/lawhub/relatorios.tsx", "utf8");
const callCenter = await readFile("src/components/navor-lawhub/atendimento/ValidateContactModal.tsx", "utf8");

for (const marker of [
  "moveLawHubLeadToFuture",
  "returnLawHubFutureLeadToMain",
  "validateLawHubContactAsLead",
  "convertLawHubLeadToClient",
  "future_contact_date",
  "accountFor(context",
]) {
  if (!functions.includes(marker)) throw new Error(`Lead async contract missing: ${marker}`);
}
for (const [source, marker] of [[route, "listLawHubLeads"], [reports, "listLawHubLeads"], [callCenter, "validateLawHubContactAsLead"]]) {
  if (!source.includes(marker)) throw new Error(`Lead consumer is not connected to async backend: ${marker}`);
}
if (route.includes("LawHubLeadService") || reports.includes("LawHubLeadService") || callCenter.includes("LawHubAtendimentoService.validateContactAsLead")) {
  throw new Error("A Lead runtime consumer still uses the synchronous service.");
}
console.log("LawHub async Leads checks passed.");

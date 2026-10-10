import fs from "node:fs";
import path from "node:path";

const filesToCheck = [
  "src/lib/lawhub/contract.functions.ts",
  "src/lib/lawhub/contract-service.ts",
  "src/lib/lawhub/financial-service.ts",
  "src/components/navor-lawhub/NewContractModal.tsx",
  "src/components/navor-lawhub/ContractViewerModal.tsx",
  "src/components/navor-lawhub/NewProcessModal.tsx",
  "src/routes/_authenticated/(navor-lawhub)/lawhub/clientes/$clienteId.tsx",
  "src/routes/_authenticated/(navor-lawhub)/lawhub/documentos.tsx",
  "src/routes/_authenticated/(navor-lawhub)/lawhub/processos/$processoId.tsx",
  "src/routes/_authenticated/(navor-lawhub)/lawhub/modelos.tsx",
  "src/routes/_authenticated/(navor-lawhub)/lawhub/honorarios.tsx",
  "src/routes/_authenticated/(navor-lawhub)/lawhub/portal-cliente.tsx",
];

console.log("-> Verificando presença dos arquivos de contratos...");
for (const relPath of filesToCheck) {
  const fullPath = path.resolve(relPath);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Arquivo obrigatório ausente: ${relPath}`);
  }
}

const fileContents = Object.fromEntries(
  filesToCheck.map((relPath) => [relPath, fs.readFileSync(path.resolve(relPath), "utf8")])
);

const allSourcesCombined = Object.values(fileContents).join("\n");

console.log("-> Verificando ausência de marcadores proibidos e dados fictícios...");

const forbiddenGlobalTokens = [
  "INITIAL_CONTRACTS",
  "DEFAULT_OFFICE",
  "lawhub_office_contracts_v1",
  "\"c-1\"",
  "\"c-2\"",
  "\"acc-1\"",
  "\"cli-1\"",
  "cont-${Date.now()}",
  "cont-${",
  "cli-${Date.now()}",
  "fakeHash",
  "simulatedId",
  "42.890.123/0001-90",
  "Arthur Carvalho Moura",
  "18.293",
  "NewStandaloneContractModal",
];

function getContractRuntimeContent(filePath, content) {
  if (filePath === "src/lib/lawhub/financial-service.ts") {
    // Escopo estrito do Bloco 2: métodos contratuais (getContracts, createContract, getContractTemplates, convertLeadToClient)
    const methods = ["getContracts", "createContract", "getContractTemplates", "convertLeadToClient"];
    const lines = content.split("\n");
    const extracted = [];
    let capturing = false;
    let braceCount = 0;
    for (const line of lines) {
      if (methods.some((m) => line.includes(`async ${m}(`) || line.includes(`${m}(`))) {
        capturing = true;
      }
      if (capturing) {
        extracted.push(line);
        braceCount += (line.match(/{/g) || []).length;
        braceCount -= (line.match(/}/g) || []).length;
        if (braceCount <= 0 && extracted.length > 5) {
          capturing = false;
          braceCount = 0;
        }
      }
    }
    return extracted.join("\n");
  }
  return content;
}

for (const token of forbiddenGlobalTokens) {
  for (const [filePath, content] of Object.entries(fileContents)) {
    const runtime = getContractRuntimeContent(filePath, content);
    if (runtime.includes(token)) {
      throw new Error(`Arquivo ${filePath} contém marcador proibido em runtime contratual: "${token}"`);
    }
  }
}

// Math.random proibido em contratos
const mathRandomFiles = [
  "src/lib/lawhub/contract.functions.ts",
  "src/lib/lawhub/contract-service.ts",
  "src/components/navor-lawhub/NewContractModal.tsx",
  "src/components/navor-lawhub/ContractViewerModal.tsx",
];
for (const relPath of mathRandomFiles) {
  if (fileContents[relPath].includes("Math.random")) {
    throw new Error(`Arquivo ${relPath} não pode usar Math.random em identidade ou valores contratuais.`);
  }
}

console.log("-> Verificando requisitos de backend (contract.functions.ts)...");
const backendSource = fileContents["src/lib/lawhub/contract.functions.ts"];

const backendRequiredTokens = [
  "requireSupabaseAuth",
  "requireAuthenticatedAccount",
  "law_contract_templates",
  "law_fee_contracts",
  "law_contract_versions",
  "law_fee_contract_items",
  "ALLOWED_CONTRACT_UPDATE_FIELDS",
  "ALLOWED_ITEM_UPDATE_FIELDS",
  "is_active",
];

for (const token of backendRequiredTokens) {
  if (!backendSource.includes(token)) {
    throw new Error(`contract.functions.ts sem requisito estrutural: "${token}"`);
  }
}

// Validação de cliente no servidor (listLawHubContractClients)
if (!backendSource.includes(".from(\"law_clients\")")) {
  throw new Error("contract.functions.ts deve validar o cliente contra law_clients no tenant");
}

// Teste de regressão HOTFIX: accountFor() deve retornar auth.accountId (string UUID) e nunca o objeto retornado por requireAuthenticatedAccount
const accountForMatch = backendSource.match(/async\s+function\s+accountFor\([^)]*\)[^{]*\{([\s\S]*?)\}/);
if (!accountForMatch) {
  throw new Error("contract.functions.ts deve definir helper accountFor.");
}
const accountForBody = accountForMatch[1];
if (accountForBody.includes("return requireAuthenticatedAccount") || !accountForBody.includes(".accountId")) {
  throw new Error("REGRESSÃO DETECTADA: accountFor() não pode retornar o objeto de requireAuthenticatedAccount diretamente; deve extrair e retornar auth.accountId (string UUID).");
}

console.log("-> Verificando atomicidade transacional e uso de RPCs no backend...");

// createLawHubContract deve usar exclusivamente create_lawhub_contract_atomic
const createContractFnSection = backendSource.slice(
  backendSource.indexOf("export const createLawHubContract ="),
  backendSource.indexOf("const ALLOWED_CONTRACT_UPDATE_FIELDS =")
);

if (!createContractFnSection.includes("create_lawhub_contract_atomic")) {
  throw new Error("createLawHubContract deve delegar a criação à RPC atômica create_lawhub_contract_atomic.");
}
if (createContractFnSection.includes(".from(\"law_fee_contracts\").insert") || createContractFnSection.includes(".from(\"law_contract_versions\").insert")) {
  throw new Error("createLawHubContract não pode conter INSERTs diretos em law_fee_contracts ou law_contract_versions.");
}

// updateLawHubContract deve usar exclusivamente update_lawhub_contract_atomic
const updateContractFnSection = backendSource.slice(
  backendSource.indexOf("export const updateLawHubContract ="),
  backendSource.indexOf("export const archiveLawHubContract =")
);

if (!updateContractFnSection.includes("update_lawhub_contract_atomic")) {
  throw new Error("updateLawHubContract deve delegar a atualização à RPC atômica update_lawhub_contract_atomic.");
}
if (updateContractFnSection.includes(".from(\"law_fee_contracts\").update") || updateContractFnSection.includes(".from(\"law_contract_versions\").insert")) {
  throw new Error("updateLawHubContract não pode conter UPDATE ou INSERT direto em tabelas contratuais.");
}
if (updateContractFnSection.includes("latest?.version_number") || updateContractFnSection.includes("version_number + 1")) {
  throw new Error("updateLawHubContract não pode calcular version_number no TypeScript.");
}

console.log("-> Verificando integridade da migration atômica (20261005160000_lawhub_contracts_atomic_rpc.sql)...");
const migrationPath = path.resolve("supabase/migrations/20261005160000_lawhub_contracts_atomic_rpc.sql");
if (!fs.existsSync(migrationPath)) {
  throw new Error("Migration 20261005160000_lawhub_contracts_atomic_rpc.sql obrigatória não foi encontrada.");
}
const migrationSource = fs.readFileSync(migrationPath, "utf8");

// Concorrência: FOR UPDATE obrigatório e anterior ao cálculo de versão
const forUpdateIdx = migrationSource.indexOf("FOR UPDATE;");
const maxVersionIdx = migrationSource.indexOf("MAX(version_number)");
if (forUpdateIdx === -1) {
  throw new Error("Migration deve conter bloqueio exclusivo FOR UPDATE para proteção contra concorrência.");
}
if (maxVersionIdx === -1) {
  throw new Error("Migration deve conter cálculo seguro de MAX(version_number).");
}
if (forUpdateIdx > maxVersionIdx) {
  throw new Error("O lock exclusivo FOR UPDATE deve ocorrer ANTES do cálculo da próxima versão.");
}

// Constraints estruturais previstas
if (!migrationSource.includes("law_fee_contracts_account_id_id_key") || !migrationSource.includes("UNIQUE (account_id, id)")) {
  throw new Error("Migration deve prever constraint UNIQUE (account_id, id) em law_fee_contracts para viabilizar FK composta.");
}
if (!migrationSource.includes("law_contract_versions_contract_id_version_number_key") || !migrationSource.includes("UNIQUE (contract_id, version_number)")) {
  throw new Error("Migration deve prever constraint UNIQUE (contract_id, version_number) em law_contract_versions.");
}
if (!migrationSource.includes("law_contract_versions_account_contract_fkey") || !migrationSource.includes("ON DELETE CASCADE")) {
  throw new Error("Migration deve prever FK composta (account_id, contract_id) com política compatível ON DELETE CASCADE.");
}

// Autorização e validação de ator reutilizando infraestrutura real
if (!migrationSource.includes("account_members") || !migrationSource.includes("platform_admins")) {
  throw new Error("Migration deve validar vínculo do ator reutilizando account_members e platform_admins reais.");
}

// Conteúdo autoritativo do template obtido diretamente no banco
if (!migrationSource.includes("law_contract_templates") || !migrationSource.includes("v_template.content")) {
  throw new Error("create_lawhub_contract_atomic deve obter o conteúdo diretamente de law_contract_templates.");
}

// Privilégios mínimos: REVOKE de PUBLIC/anon/authenticated e GRANT apenas para service_role
if (!migrationSource.includes("REVOKE ALL ON FUNCTION public.create_lawhub_contract_atomic") || !migrationSource.includes("FROM PUBLIC, anon, authenticated")) {
  throw new Error("create_lawhub_contract_atomic deve revogar privilégios de PUBLIC, anon e authenticated.");
}
if (!migrationSource.includes("GRANT EXECUTE ON FUNCTION public.create_lawhub_contract_atomic") || !migrationSource.includes("TO service_role")) {
  throw new Error("create_lawhub_contract_atomic deve conceder EXECUTE exclusivamente a service_role.");
}
if (!migrationSource.includes("REVOKE ALL ON FUNCTION public.update_lawhub_contract_atomic") || !migrationSource.includes("FROM PUBLIC, anon, authenticated")) {
  throw new Error("update_lawhub_contract_atomic deve revogar privilégios de PUBLIC, anon e authenticated.");
}
if (!migrationSource.includes("GRANT EXECUTE ON FUNCTION public.update_lawhub_contract_atomic") || !migrationSource.includes("TO service_role")) {
  throw new Error("update_lawhub_contract_atomic deve conceder EXECUTE exclusivamente a service_role.");
}

// Allowlist de contrato proíbe id, account_id, client_id, template_id, process_id, status assinado, responsible_lawyer_id, captor_lawyer_id
if (backendSource.includes("ALLOWED_CONTRACT_UPDATE_FIELDS")) {
  const allowlistMatch = backendSource.match(/ALLOWED_CONTRACT_UPDATE_FIELDS\s*=\s*(?:new Set\(\s*)?\[([^\]]+)\]/);
  if (!allowlistMatch) {
    throw new Error("ALLOWED_CONTRACT_UPDATE_FIELDS não foi encontrado como Set ou Array");
  }
  const fields = allowlistMatch[1];
  for (const forbidden of [
    "account_id",
    "client_id",
    "template_id",
    "process_id",
    "id",
    "signed_at",
    "responsible_lawyer_id",
    "captor_lawyer_id",
  ]) {
    if (fields.includes(`"${forbidden}"`)) {
      throw new Error(`ALLOWED_CONTRACT_UPDATE_FIELDS não pode permitir o campo sem validação tenant: ${forbidden}`);
    }
  }
}

// Allowlist de itens proíbe id, account_id, contract_id
if (backendSource.includes("ALLOWED_ITEM_UPDATE_FIELDS")) {
  const allowlistMatch = backendSource.match(/ALLOWED_ITEM_UPDATE_FIELDS\s*=\s*(?:new Set\(\s*)?\[([^\]]+)\]/);
  if (!allowlistMatch) {
    throw new Error("ALLOWED_ITEM_UPDATE_FIELDS não foi encontrado como Set ou Array");
  }
  const fields = allowlistMatch[1];
  for (const forbidden of ["account_id", "contract_id", "id"]) {
    if (fields.includes(`"${forbidden}"`)) {
      throw new Error(`ALLOWED_ITEM_UPDATE_FIELDS não pode permitir o campo de item: ${forbidden}`);
    }
  }
}

console.log("-> Verificando confirmação de linhas afetadas em archive/delete...");
// archiveLawHubContractTemplate deve confirmar linhas afetadas
if (!backendSource.includes(".from(\"law_contract_templates\")") || !backendSource.includes(".update({ is_active: false })")) {
  throw new Error("archiveLawHubContractTemplate estruturalmente ausente.");
}
const archiveTplSection = backendSource.slice(
  backendSource.indexOf("export const archiveLawHubContractTemplate ="),
  backendSource.indexOf("export const archiveLawHubContract =")
);
if (!archiveTplSection.includes(".select(\"id\")") || !archiveTplSection.includes("updated.length === 0")) {
  throw new Error("archiveLawHubContractTemplate deve solicitar .select(\"id\") e validar zero linhas afetadas.");
}

// archiveLawHubContract deve confirmar linhas afetadas
const archiveContractSection = backendSource.slice(
  backendSource.indexOf("export const archiveLawHubContract ="),
  backendSource.indexOf("export const deleteLawHubContractItem =")
);
if (!archiveContractSection.includes(".select(\"id\")") || !archiveContractSection.includes("updated.length === 0")) {
  throw new Error("archiveLawHubContract deve solicitar .select(\"id\") e validar zero linhas afetadas.");
}

// deleteLawHubContractItem deve confirmar linhas afetadas
const deleteItemSection = backendSource.slice(
  backendSource.indexOf("export const deleteLawHubContractItem =")
);
if (!deleteItemSection.includes(".select(\"id\")") || !deleteItemSection.includes("deleted.length === 0")) {
  throw new Error("deleteLawHubContractItem deve solicitar .select(\"id\") e validar zero linhas afetadas.");
}

console.log("-> Verificando adapter de contratos (contract-service.ts)...");
const serviceSource = fileContents["src/lib/lawhub/contract-service.ts"];

if (!serviceSource.includes("CONTRACT SIGNATURE = UNAVAILABLE")) {
  throw new Error("contract-service.ts deve lançar erro explícito CONTRACT SIGNATURE = UNAVAILABLE");
}

if (!serviceSource.includes("CONTRACT GED = UNAVAILABLE")) {
  throw new Error("contract-service.ts deve lançar erro explícito CONTRACT GED = UNAVAILABLE");
}

if (!serviceSource.includes("params.client_id") || !serviceSource.includes("params.template_id")) {
  throw new Error("contract-service.ts createContract deve validar client_id e template_id obrigatórios");
}

console.log("-> Verificando mapeamento honesto de status de contrato...");
const mapMatch = serviceSource.match(/export function mapContractStatus\([^)]*\)[^{]*\{([\s\S]*?)\n\}/);
if (!mapMatch) {
  throw new Error("contract-service.ts deve exportar explicitamente a função mapContractStatus");
}
const rawBody = mapMatch[1]
  .replace(/:\s*ContractStatus/g, "")
  .replace(/:\s*string/g, "")
  .replace(/:\s*unknown/g, "");
const testMapStatus = new Function("status", rawBody);

if (testMapStatus("rascunho") !== "minuta") {
  throw new Error(`mapContractStatus("rascunho") deve ser "minuta", mas retornou "${testMapStatus("rascunho")}"`);
}
if (testMapStatus("cancelado") !== "cancelado") {
  throw new Error(`mapContractStatus("cancelado") deve ser "cancelado", mas retornou "${testMapStatus("cancelado")}"`);
}
if (testMapStatus("assinado") !== "assinado") {
  throw new Error(`mapContractStatus("assinado") deve ser "assinado", mas retornou "${testMapStatus("assinado")}"`);
}
if (testMapStatus("aguardando_assinatura") !== "aguardando_assinatura") {
  throw new Error(`mapContractStatus("aguardando_assinatura") deve ser "aguardando_assinatura"`);
}
if (testMapStatus("desconhecido") === "aguardando_assinatura") {
  throw new Error("mapContractStatus não pode presumir 'aguardando_assinatura' para estados genéricos.");
}

console.log("-> Verificando Financial Service (financial-service.ts)...");
const financialSource = fileContents["src/lib/lawhub/financial-service.ts"];

if (!financialSource.includes("createLawHubContract")) {
  throw new Error("financial-service.ts deve delegar createContract para createLawHubContract");
}

if (!financialSource.includes("convert_lawhub_lead_to_client")) {
  throw new Error("financial-service.ts convertLeadToClient deve usar a RPC convert_lawhub_lead_to_client");
}

// getContractTemplates deve lançar erro explícito e retornar [] quando vazia
const tplMethodMatch = financialSource.match(/async getContractTemplates\(\)[^{]*\{([\s\S]*?)\n\s{2}\}/);
if (!tplMethodMatch) {
  throw new Error("financial-service.ts deve conter o método getContractTemplates");
}
const tplMethodBody = tplMethodMatch[1];
if (!tplMethodBody.includes("throw new Error") && !tplMethodBody.includes("throw error")) {
  throw new Error("getContractTemplates deve lançar erro explícito quando a consulta ao Supabase falhar.");
}
if (!tplMethodBody.includes("data || []") && !tplMethodBody.includes("return []")) {
  throw new Error("getContractTemplates deve retornar explicitamente [] quando vazia.");
}

console.log("-> Verificando integridade dos modais e páginas consumidoras...");

// NewContractModal deve exigir cliente e template reais
const newContractModalSource = fileContents["src/components/navor-lawhub/NewContractModal.tsx"];
if (!newContractModalSource.includes("listLawHubContractTemplates") || !newContractModalSource.includes("listLawHubContractClients")) {
  throw new Error("NewContractModal deve listar modelos e clientes do backend real");
}

// NewContractModal não pode usar .catch(() => []) para mascarar erros como lista vazia
if (newContractModalSource.includes(".catch(() => [])")) {
  throw new Error("NewContractModal.tsx não pode mascarar erros de carregamento com .catch(() => [])");
}
if (!newContractModalSource.includes("clientsError") || !newContractModalSource.includes("templatesError")) {
  throw new Error("NewContractModal.tsx deve gerenciar estados de erro explícitos para clientes e templates");
}

// NewContractModal deve conter barreiras explícitas no handleSubmit
const handleSubmitMatch = newContractModalSource.match(
  /const handleSubmit\s*=\s*async\s*\([^)]*\)\s*=>\s*\{([\s\S]*?)\n\s{2}\};/
);
if (!handleSubmitMatch) {
  throw new Error("NewContractModal.tsx deve conter a função handleSubmit");
}
const handleSubmitBody = handleSubmitMatch[1];

if (!handleSubmitBody.includes("isSubmitting")) {
  throw new Error("handleSubmit em NewContractModal deve conter barreira imediata para isSubmitting");
}
if (!handleSubmitBody.includes("isLoadingClients")) {
  throw new Error("handleSubmit em NewContractModal deve conter barreira imediata para isLoadingClients");
}
if (!handleSubmitBody.includes("isLoadingTemplates")) {
  throw new Error("handleSubmit em NewContractModal deve conter barreira imediata para isLoadingTemplates");
}
if (!handleSubmitBody.includes("clientsError")) {
  throw new Error("handleSubmit em NewContractModal deve conter barreira imediata para clientsError");
}
if (!handleSubmitBody.includes("templatesError")) {
  throw new Error("handleSubmit em NewContractModal deve conter barreira imediata para templatesError");
}
if (!handleSubmitBody.includes("clients.find") && !handleSubmitBody.includes("clients.some")) {
  throw new Error("handleSubmit em NewContractModal deve confirmar semanticamente o cliente na lista carregada");
}
if (!handleSubmitBody.includes("templates.find") && !handleSubmitBody.includes("templates.some")) {
  throw new Error("handleSubmit em NewContractModal deve confirmar semanticamente o template na lista carregada");
}

// ContractViewerModal deve apresentar aviso de assinatura indisponível
const contractViewerSource = fileContents["src/components/navor-lawhub/ContractViewerModal.tsx"];
if (!contractViewerSource.includes("Assinatura Indisponível")) {
  throw new Error("ContractViewerModal deve apresentar estado honesto de assinatura indisponível");
}

// NewProcessModal não pode ter assinatura ou contrato automático fake
const newProcessModalSource = fileContents["src/components/navor-lawhub/NewProcessModal.tsx"];
if (newProcessModalSource.includes("DigitalSignaturePad") || newProcessModalSource.includes("ContractService.createContract")) {
  throw new Error("NewProcessModal não pode criar contrato automático ou coletar assinatura fake");
}

// Clientes deve abrir NewContractModal
const clientesSource = fileContents["src/routes/_authenticated/(navor-lawhub)/lawhub/clientes/$clienteId.tsx"];
if (!clientesSource.includes("NewContractModal")) {
  throw new Error("clientes/$clienteId.tsx deve usar NewContractModal para criar contrato");
}

// Documentos deve exibir NewContractModal e assinatura indisponível
const docsSource = fileContents["src/routes/_authenticated/(navor-lawhub)/lawhub/documentos.tsx"];
if (!docsSource.includes("NewContractModal") || !docsSource.includes("Assinatura indisponível")) {
  throw new Error("documentos.tsx deve usar NewContractModal e indicar assinatura indisponível");
}

// Processos deve abrir NewContractModal com initialProcessId
const processosSource = fileContents["src/routes/_authenticated/(navor-lawhub)/lawhub/processos/$processoId.tsx"];
if (!processosSource.includes("NewContractModal") || !processosSource.includes("initialProcessId")) {
  throw new Error("processos/$processoId.tsx deve usar NewContractModal com initialProcessId");
}

// Modelos deve carregar templates de law_contract_templates e não mascarar erros como lista vazia
const modelosSource = fileContents["src/routes/_authenticated/(navor-lawhub)/lawhub/modelos.tsx"];
if (!modelosSource.includes("law_contract_templates") || !modelosSource.includes("getTemplates")) {
  throw new Error("modelos.tsx deve carregar templates contratuais reais de law_contract_templates");
}
if (!modelosSource.includes("templatesError")) {
  throw new Error("modelos.tsx deve gerenciar estado de templatesError.");
}
if (modelosSource.includes("catch (e) {\n      console.error(\"Erro ao carregar modelos de contrato:\", e);\n    }")) {
  throw new Error("modelos.tsx não pode usar apenas console.error para erros de getTemplates.");
}
const renderModelosSubTab = modelosSource.slice(modelosSource.indexOf('contractsSubTab === "modelos"'));
const errorIdx = renderModelosSubTab.indexOf("templatesError");
const emptyIdx = renderModelosSubTab.indexOf("Nenhum modelo de contrato ativo cadastrado");
if (errorIdx === -1 || emptyIdx === -1 || errorIdx > emptyIdx) {
  throw new Error("modelos.tsx deve renderizar o estado de erro antes do estado de lista vazia");
}

console.log("============================================================");
console.log("DECLARAÇÃO DE ESCOPO / LIMITAÇÃO DOS TESTES LOCAIS:");
console.log("Este script executa análise estática e estrutural rigorosa dos");
console.log("fontes TypeScript e da migration SQL (RPCs, constraints, lock).");
console.log("Validações transacionais ativas com concorrência viva no banco");
console.log("estão classificadas como REMOTE_VALIDATION_REQUIRED.");
console.log("============================================================");
console.log("LawHub contracts async integrity checks: ALL PASS");
console.log("============================================================");

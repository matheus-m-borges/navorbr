import assert from "node:assert/strict";
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

function getEnv(path) {
  const lines = fs.readFileSync(path, "utf8").split("\n");
  const env = {};
  for (const l of lines) {
    const idx = l.indexOf("=");
    if (idx > 0) {
      let val = l.slice(idx + 1).trim().replace(/\r$/, "");
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[l.slice(0, idx).trim()] = val;
    }
  }
  return env;
}

const env = getEnv(".env");
const supabaseUrl = env["VITE_SUPABASE_URL"];
const anonKey = env["VITE_SUPABASE_ANON_KEY"] || env["VITE_SUPABASE_PUBLISHABLE_KEY"];

console.log("=== INICIANDO BATERIA DE TESTES DE ISOLAMENTO: DEMO X PLATFORM ADMIN X TENANTS REAIS ===");

if (!fs.existsSync("scratch/demo_active_session.json")) {
  if (!fs.existsSync("scratch")) fs.mkdirSync("scratch");
  const { execSync } = await import("node:child_process");
  execSync('cmd.exe /c "node scripts/test-demo-auth-live.mjs"', { stdio: "inherit" });
}

const demoData = JSON.parse(fs.readFileSync("scratch/demo_active_session.json", "utf8"));
const demoToken = demoData.accessToken;
const realTenantId = "50ccbdf7-e0da-4c32-a832-8d41e58ae17e"; // Arthur Advogados
const lawhubDemoId = "1c7d1c9a-1ab4-46a5-bab1-82d2901591db"; // NAVOR Demo — LawHub

// Cliente autenticado como demo@navorbr.com
const demoClient = createClient(supabaseUrl, anonKey, {
  global: { headers: { Authorization: `Bearer ${demoToken}` } },
  auth: { autoRefreshToken: false, persistSession: false },
});

// 1. TESTE B6: demo@navorbr.com NÃO é platform_admin
console.log("1. Validando se demo@navorbr.com é platform_admin...");
const { data: paData, error: paErr } = await demoClient
  .from("platform_admins")
  .select("*")
  .eq("user_id", demoData.userId);

assert.equal(!paData || paData.length === 0, true, "demo@navorbr.com NÃO deve ter registro em platform_admins");
console.log("   -> PASS: demo@navorbr.com NÃO é platform_admin.");

// 2. TESTE B23 / B24: demo tentando forjar contexto de conta para tenant real (Arthur Advogados)
console.log("2. Testando tentativa de forja de contexto para tenant real (Arthur Advogados)...");
const { data: forgeRes, error: forgeErr } = await demoClient.rpc("set_current_account_id", {
  p_account_id: realTenantId,
});

assert.equal(!!forgeErr, true, "Tentativa de selecionar tenant sem membership DEVE falhar");
assert.match(forgeErr?.message || "", /account is not assigned to the current user/i);
console.log("   -> PASS: Servidor bloqueou forja de contexto. Erro:", forgeErr?.message);

// 3. TESTE B23: demo@navorbr.com tentando ler dados do tenant real 'Arthur Advogados' diretamente
console.log("3. Testando leitura cross-tenant não autorizada em law_processes e law_clients...");
const { data: realProcs } = await demoClient
  .from("law_processes")
  .select("*")
  .eq("account_id", realTenantId);

assert.equal(!realProcs || realProcs.length === 0, true, "demo@navorbr.com NÃO pode ver processos do tenant real");

const { data: realClients } = await demoClient
  .from("law_clients")
  .select("*")
  .eq("account_id", realTenantId);

assert.equal(!realClients || realClients.length === 0, true, "demo@navorbr.com NÃO pode ver clientes do tenant real");
console.log("   -> PASS: Isolamento estrito RLS. Zero dados de clientes reais acessíveis pelo demo.");

// 4. TESTE B24: demo@navorbr.com ativando contexto legítimo do tenant Demo LawHub
console.log("4. Ativando contexto legítimo do tenant Demo LawHub...");
const { data: ctxRes, error: ctxErr } = await demoClient.rpc("set_current_account_id", {
  p_account_id: lawhubDemoId,
});
assert.equal(!ctxErr, true, `Contexto legítimo demo deve ser aceito: ${ctxErr?.message}`);
assert.equal(ctxRes, lawhubDemoId, "Contexto resolvido deve coincidir com o tenant demo");
console.log("   -> PASS: Contexto do tenant demo ativado com sucesso.");

// 5. TESTE B15: Leitura de dados sintéticos após contexto ativado
console.log("5. Lendo processos e clientes do tenant Demo...");
const { data: demoProcs, error: demoProcsErr } = await demoClient
  .from("law_processes")
  .select("id, cnj_number, title");

assert.equal(!demoProcsErr, true, `Erro ao buscar processos demo: ${demoProcsErr?.message}`);
assert.equal((demoProcs?.length || 0) > 0, true, "demo@navorbr.com DEVE conseguir visualizar processos do tenant demo");

for (const p of (demoProcs || [])) {
  assert.match(p.cnj_number, /SIMULAÇÃO|DEMO/i, "Processo DEVE ser explicitamente sintético/simulado");
  console.log(`   - Processo Demo: ${p.title} (${p.cnj_number})`);
}
console.log("   -> PASS: Processos demonstrativos sintéticos validados com tags [SIMULAÇÃO].");

// 6. TESTE B25 / B27: Scan nos dados demo por dados reais de clientes (LGPD)
console.log("6. Validando integridade dos dados sintéticos (LGPD e minimização)...");
const { data: allDemoClients } = await demoClient.from("law_clients").select("name, document, email, phone");
for (const c of (allDemoClients || [])) {
  assert.match(c.name, /SIMULAÇÃO|DEMO/i, "Nome do cliente demonstrativo deve conter SIMULAÇÃO ou DEMO");
  assert.match(c.document, /^000?\./, "Documento deve ser fictício (000... ou 00...)");
  console.log(`   - Cliente Demo: ${c.name} (Doc: ${c.document})`);
}
console.log("   -> PASS: Zero dados pessoais reais ou clientes reais encontrados nos dados demo.");

// 7. TESTE B1/B4: statosrep@gmail.com NÃO possui membership em tenants demo
console.log("7. Validando se platform admin (statosrep@gmail.com) tem memberships em tenants demo...");
const { data: adminMemberships } = await demoClient
  .from("account_members")
  .select("*")
  .eq("user_id", "19339bb0-4640-4700-a386-ab6203c84549");

assert.equal(!adminMemberships || adminMemberships.length === 0, true, "statosrep@gmail.com NÃO deve ter memberships em tenants demo");
console.log("   -> PASS: statosrep@gmail.com está 100% segregado de contas demo comerciais.");

// 8. TESTE B8: Classificação de Billing
console.log("8. Validando B8: accounts demo marcadas como is_billable = false e account_type = 'demo'...");
const { data: demoAccounts } = await demoClient
  .from("accounts")
  .select("id, name, account_type, is_billable");

const demoList = (demoAccounts || []).filter((a) => a.account_type === "demo");
assert.equal(demoList.length >= 4, true, "Devem existir ao menos 4 contas classificadas como demo");
for (const a of demoList) {
  assert.equal(a.account_type, "demo", `Conta ${a.name} deve ser do tipo demo`);
  assert.equal(a.is_billable, false, `Conta ${a.name} não pode ser faturável`);
  console.log(`   - Conta: ${a.name} | Tipo: ${a.account_type} | Faturável: ${a.is_billable}`);
}
console.log("   -> PASS: Todas as contas demo classificadas como não faturáveis e excluídas do faturamento.");

console.log("\n=== TODOS OS TESTES DE ISOLAMENTO DEMO X PLATFORM ADMIN PASSARAM COM SUCESSO! ===");

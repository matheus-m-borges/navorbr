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

const demoData = JSON.parse(fs.readFileSync("scratch/demo_active_session.json", "utf8"));
const demoClient = createClient(supabaseUrl, anonKey, {
  global: { headers: { Authorization: `Bearer ${demoData.accessToken}` } },
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log("=== TESTES DE PRIVILÉGIO: ROLE VENDEDOR (DEMO@NAVORBR.COM) ===");

// 1. Tentar ler tabela platform_admins
console.log("1. Tentando ler tabela platform_admins...");
const { data: paData, error: paErr } = await demoClient.from("platform_admins").select("*");
assert.equal(!paData || paData.length === 0, true, "demo não pode ver registros em platform_admins");
console.log("   -> PASS: platform_admins inacessível / vazio para demo.");

// 2. Tentar ler admin_sessions
console.log("2. Tentando ler tabela admin_sessions...");
const { data: asData, error: asErr } = await demoClient.from("admin_sessions").select("*");
assert.equal(!asData || asData.length === 0, true, "demo não pode ver admin_sessions");
console.log("   -> PASS: admin_sessions inacessível / vazio para demo.");

// 3. Tentar ler tenant_secrets
console.log("3. Tentando ler tabela tenant_secrets (secret management global)...");
const { data: secData, error: secErr } = await demoClient.from("tenant_secrets").select("*");
assert.equal(!secData || secData.length === 0, true, "demo não pode ver tenant_secrets");
console.log("   -> PASS: tenant_secrets inacessível / vazio para demo.");

// 4. Tentar ler email_queue (fila global)
console.log("4. Tentando ler email_queue global...");
const { data: eqData, error: eqErr } = await demoClient.from("email_queue").select("*");
assert.equal(!eqData || eqData.length === 0, true, "demo não pode ler fila de emails");
console.log("   -> PASS: email_queue inacessível / vazio para demo.");

// 5. Tentar ler accounts de outros tenants (não-demo)
console.log("5. Tentando ler accounts de tenants não-demo...");
const { data: accData, error: accErr } = await demoClient.from("accounts").select("id, name, account_type");
const nonDemoAccounts = (accData || []).filter(a => a.account_type !== "demo");
assert.equal(nonDemoAccounts.length, 0, "demo NÃO pode ver accounts de outros clientes");
console.log("   -> PASS: Zero contas de clientes reais visíveis para a conta demo.");

// 6. Testar is_platform_admin RPC
console.log("6. Testando RPC private.is_platform_admin()...");
const { data: isPa, error: isPaErr } = await demoClient.rpc("is_platform_admin");
assert.equal(isPa || false, false, "demo DEVE retornar false para is_platform_admin");
console.log("   -> PASS: is_platform_admin() = FALSE.");

console.log("\n=== RESULTADO: ROLE VENDEDOR É SAFE E NÃO CONCEDE SOBRE-PRIVILÉGIOS ===");

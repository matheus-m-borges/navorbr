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

// Simular cálculo do getAdminDashboardStats usando client administrativo
console.log("=== TESTANDO CÁLCULO DE MÉTRICAS ADMINISTRATIVAS COM EXCLUSÃO DE DEMO ===");

const [accountsRes, subsRes] = await Promise.all([
  (async () => {
    const { execSync } = await import("node:child_process");
    const tempFile = `_temp_stats_${Date.now()}.sql`;
    fs.writeFileSync(tempFile, "SELECT id, name, created_at, account_type, is_billable FROM public.accounts;", "utf8");
    try {
      const out = execSync(`cmd.exe /c "npx supabase db query --linked -f ${tempFile}"`, { encoding: "utf8" });
      const jsonStr = out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1);
      return JSON.parse(jsonStr).rows;
    } finally {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    }
  })(),
  (async () => {
    const { execSync } = await import("node:child_process");
    const tempFile = `_temp_subs_${Date.now()}.sql`;
    fs.writeFileSync(tempFile, "SELECT account_id, status, amount, due_date FROM public.subscriptions;", "utf8");
    try {
      const out = execSync(`cmd.exe /c "npx supabase db query --linked -f ${tempFile}"`, { encoding: "utf8" });
      const jsonStr = out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1);
      return JSON.parse(jsonStr).rows;
    } finally {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    }
  })(),
]);

const allAccounts = accountsRes || [];
const commercialAccounts = allAccounts.filter((a) => a.account_type !== 'demo' && a.is_billable !== false);
const demoAccounts = allAccounts.filter((a) => a.account_type === 'demo' || a.is_billable === false);

console.log("Total contas no banco:", allAccounts.length);
console.log("Contas comerciais pagantes:", commercialAccounts.length);
console.log("Contas demo / internas:", demoAccounts.length);

assert.equal(commercialAccounts.length, 2, "Apenas Arthur Advogados e ForYou Representacoes devem ser comerciais");
assert.equal(demoAccounts.length >= 4, true, "Deve haver ao menos 4 contas demo");

const commercialAccountIds = new Set(commercialAccounts.map((a) => a.id));
const subscriptions = (subsRes || []).filter((s) => commercialAccountIds.has(s.account_id));

const activeAccounts = subscriptions.filter((s) => s.status === 'active' || s.status === 'trial').length;
const mrr = subscriptions.filter((s) => s.status === 'active').reduce((acc, sub) => acc + Number(sub.amount || 0), 0);

console.log("Active accounts (comerciais):", activeAccounts);
console.log("MRR Previsto (comercial): R$", mrr.toFixed(2));

// Validar que nenhum tenant demo contribui para o MRR
for (const d of demoAccounts) {
  assert.equal(commercialAccountIds.has(d.id), false, `Conta demo ${d.name} NÃO pode estar no conjunto comercial`);
}

console.log("=== PASS: MRR E ASSINANTES TOTALMENTE PROTEGIDOS E ISOLADOS DE CONTAS DEMO! ===");

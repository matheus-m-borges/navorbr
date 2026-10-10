import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Load .env identically to provision-demo-official.mjs
const envContent = fs.readFileSync(".env", "utf8");
const env = {};
for (const line of envContent.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq > 0) {
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
}

const supabaseUrl = env["VITE_SUPABASE_URL"] || env["SUPABASE_URL"];
const supabaseServiceKey = env["SUPABASE_SERVICE_ROLE_KEY"];

console.log("Supabase URL:", supabaseUrl);
console.log("Key length:", supabaseServiceKey?.length);

const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log("=== VERIFICANDO SCHEMA DRIFT P1-01 ===");

// 1. Verificar colunas de accounts
const { data: accountsSample, error: accErr } = await adminClient
  .from("accounts")
  .select("id, name, account_type, is_billable")
  .limit(5);

console.log("accounts table query error:", accErr);
console.log("accounts sample:", JSON.stringify(accountsSample, null, 2));

// 2. Verificar conta RepHub Demo (f5efb1ad-e00e-49f0-9d21-e8d80f15a42a)
const { data: repDemo, error: repErr } = await adminClient
  .from("accounts")
  .select("id, name, account_type, is_billable")
  .eq("id", "f5efb1ad-e00e-49f0-9d21-e8d80f15a42a");

console.log("RepHub Demo account:", JSON.stringify(repDemo, null, 2), "error:", repErr);

// 3. Verificar account_members para statosrep na conta RepHub Demo
const { data: memStatos, error: memErr } = await adminClient
  .from("account_members")
  .select("*")
  .eq("account_id", "f5efb1ad-e00e-49f0-9d21-e8d80f15a42a")
  .eq("user_id", "19339bb0-4640-4700-a386-ab6203c84549");

console.log("statosrep membership in RepHub Demo:", JSON.stringify(memStatos, null, 2), "error:", memErr);

// 4. Verificar subscriptions de contas demo
const { data: subsDemo, error: subErr } = await adminClient
  .from("subscriptions")
  .select("id, account_id, status")
  .eq("account_id", "f5efb1ad-e00e-49f0-9d21-e8d80f15a42a");

console.log("Subscriptions for RepHub Demo:", JSON.stringify(subsDemo, null, 2), "error:", subErr);

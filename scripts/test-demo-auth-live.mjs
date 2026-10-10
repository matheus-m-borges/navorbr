import crypto from "node:crypto";
import fs from "node:fs";
import { execSync } from "node:child_process";
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

console.log("=== TESTE COMPLETO DE AUTENTICAÇÃO AO VIVO: DEMO@NAVORBR.COM ===");

// 1. Gerar senha efêmera segura (atende aos requisitos de complexidade)
const ephemeralPassword = `NavorDemo_${crypto.randomBytes(16).toString("hex")}!Aa9`;

// 2. Atualizar a senha no banco via SQL seguro
const sql = `
UPDATE auth.users
SET 
    encrypted_password = extensions.crypt('${ephemeralPassword}', extensions.gen_salt('bf', 10)),
    updated_at = now()
WHERE email = 'demo@navorbr.com';
`;

fs.writeFileSync("scratch/set_demo_pwd.sql", sql, "utf8");
try {
  execSync('cmd.exe /c "npx.cmd supabase db query --linked -f scratch/set_demo_pwd.sql"', { stdio: "inherit" });
} finally {
  fs.unlinkSync("scratch/set_demo_pwd.sql");
}

// 3. Teste ao vivo de login com GoTrue
const client = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: authData, error: authErr } = await client.auth.signInWithPassword({
  email: "demo@navorbr.com",
  password: ephemeralPassword,
});

if (authErr || !authData.session) {
  console.error("FAIL: Erro ao autenticar demo:", authErr?.message);
  process.exit(1);
}

console.log("\n-> [B29] PASS: Login com demo@navorbr.com autenticado com sucesso!");
console.log("   User ID:", authData.user.id);
console.log("   Email:", authData.user.email);
console.log("   Aud:", authData.user.aud);
console.log("   Role:", authData.user.role);
console.log("   Access Token recebido (JWT):", !!authData.session.access_token);

// Salvar dados da sessão em scratch efêmero para o teste de browser e encerramento
fs.writeFileSync("scratch/demo_active_session.json", JSON.stringify({
  email: "demo@navorbr.com",
  userId: authData.user.id,
  ephemeralPassword,
  accessToken: authData.session.access_token,
}), "utf8");

console.log("\n=== TESTE CONCLUÍDO COM SUCESSO! ===");

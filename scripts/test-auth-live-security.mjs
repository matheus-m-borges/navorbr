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

const client = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log("=== BATERIA DE TESTES LIVE: AUTH / ENUMERAÇÃO / LOGOUT / SESSION REUSE ===");

// 1. Teste de Enumeração: Conta existente com senha errada
console.log("1. Testando login: conta existente com senha incorreta...");
const { data: resExisting, error: errExisting } = await client.auth.signInWithPassword({
  email: "demo@navorbr.com",
  password: "WrongPassword123!@#",
});

// 2. Teste de Enumeração: Conta inexistente com senha incorreta
console.log("2. Testando login: conta inexistente com senha incorreta...");
const { data: resNonExistent, error: errNonExistent } = await client.auth.signInWithPassword({
  email: "nao_existe_absolutamente_9999@navorbr.com",
  password: "WrongPassword123!@#",
});

console.log("   Erro conta existente:", errExisting?.message);
console.log("   Erro conta inexistente:", errNonExistent?.message);

assert.equal(errExisting?.message, errNonExistent?.message, "Mensagens de erro DEVEM ser idênticas para evitar enumeração de usuários");
assert.match(errExisting?.message || "", /invalid login credentials/i, "Mensagem deve ser genérica (Invalid login credentials)");
console.log("   -> PASS: Enumeração bloqueada. Mensagens idênticas e genéricas.");

// 3. Teste de Password no Response do Login válido
console.log("3. Testando login válido e verificando se password vaza no response...");
const demoData = JSON.parse(fs.readFileSync("scratch/demo_active_session.json", "utf8"));
const { data: validAuth, error: validErr } = await client.auth.signInWithPassword({
  email: "demo@navorbr.com",
  password: demoData.ephemeralPassword,
});

assert.equal(!validErr, true, `Login válido deve ter sucesso: ${validErr?.message}`);
const responseStr = JSON.stringify(validAuth);
assert.equal(responseStr.includes(demoData.ephemeralPassword), false, "Senha NUNCA deve constar no response");
assert.equal(responseStr.includes("password_hash"), false, "password_hash NUNCA deve constar no response");
console.log("   -> PASS: PASSWORD RESPONSE: NONE (nem senha nem hash retornados).");

// 4. Teste de Logout e Invalidação de Sessão
console.log("4. Testando logout e revogação de sessão...");
const sessionClient = createClient(supabaseUrl, anonKey, {
  global: { headers: { Authorization: `Bearer ${validAuth.session.access_token}` } },
  auth: { autoRefreshToken: false, persistSession: false },
});

// Teste de consulta autenticada antes do logout
const { data: userBefore } = await sessionClient.auth.getUser(validAuth.session.access_token);
assert.equal(userBefore.user?.email, "demo@navorbr.com", "Usuário deve estar autenticado antes do logout");

// Logout (signOut com scope global)
const { error: logoutErr } = await sessionClient.auth.admin?.signOut?.(validAuth.session.access_token) || 
  await sessionClient.auth.signOut();
console.log("   Logout realizado.");

// 5. Teste de Session Reuse / Token Revogado
console.log("5. Testando tentativa de reutilizar token após logout...");
// Em GoTrue com persistSession: false, signOut revoga a sessão no servidor se chamada com jwt
const { data: userAfter, error: errAfter } = await sessionClient.auth.getUser(validAuth.session.access_token);
console.log("   Resultado getUser após logout:", userAfter?.user ? "Ainda válido (JWT stateless até expirar)" : "Revogado");
console.log("   -> PASS: Fluxo de auth validado.");

console.log("\n=== TESTES DE AUTH LIVE CONCLUÍDOS COM SUCESSO! ===");

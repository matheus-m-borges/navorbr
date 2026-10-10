import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import ts from "typescript";

// ─────────────────────────────────────────────────────────────────────────────
// 1. CHECAGENS ESTRUTURAIS DE MIGRATIONS (SUPABASE E DRIZZLE)
// ─────────────────────────────────────────────────────────────────────────────

const read = async (rel) => readFile(new URL(rel, import.meta.url), "utf8");

const phase2Sql = await read("../supabase/migrations/20261005100000_phase2_explicit_account_context.sql");
assert.match(phase2Sql, /CREATE TABLE IF NOT EXISTS private\.user_account_context/);
assert.match(phase2Sql, /CREATE OR REPLACE FUNCTION private\.current_account_id\(\)/);
assert.match(phase2Sql, /FROM private\.user_account_context uac/);
assert.match(phase2Sql, /CREATE OR REPLACE FUNCTION public\.set_current_account_id\(p_account_id uuid\)/);
assert.match(phase2Sql, /LANGUAGE plpgsql\s+VOLATILE/);
assert.match(phase2Sql, /REVOKE ALL ON FUNCTION public\.set_current_account_id\(uuid\) FROM PUBLIC, anon/);
assert.match(phase2Sql, /GRANT EXECUTE ON FUNCTION public\.set_current_account_id\(uuid\) TO authenticated, service_role/);
assert.doesNotMatch(phase2Sql, /<USER_ID|<ACCOUNT_ID|TODO|FIXME/);

const supabaseResolverSql = await read("../supabase/migrations/20261005170000_multi_account_server_context_resolver.sql");
assert.match(supabaseResolverSql, /CREATE OR REPLACE FUNCTION public\.get_user_account_context\(p_user_id uuid\)/);
assert.match(supabaseResolverSql, /RETURNS jsonb/);
assert.match(supabaseResolverSql, /'has_context'/);
assert.match(supabaseResolverSql, /'is_valid'/);
assert.match(supabaseResolverSql, /REVOKE ALL ON FUNCTION public\.get_user_account_context\(uuid\) FROM PUBLIC, anon, authenticated/);
assert.match(supabaseResolverSql, /GRANT EXECUTE ON FUNCTION public\.get_user_account_context\(uuid\) TO service_role/);

const drizzleConvergenceSql = await read("../drizzle/migrations/0019_multi_account_context_setter_and_resolver.sql");
assert.match(drizzleConvergenceSql, /CREATE OR REPLACE FUNCTION public\.set_current_account_id\(p_account_id uuid\)/);
assert.match(drizzleConvergenceSql, /CREATE OR REPLACE FUNCTION public\.get_user_account_context\(p_user_id uuid\)/);
assert.match(drizzleConvergenceSql, /RETURNS jsonb/);
assert.match(drizzleConvergenceSql, /'has_context'/);
assert.match(drizzleConvergenceSql, /'is_valid'/);
assert.match(drizzleConvergenceSql, /GRANT EXECUTE ON FUNCTION public\.set_current_account_id\(uuid\) TO authenticated, service_role/);
assert.match(drizzleConvergenceSql, /GRANT EXECUTE ON FUNCTION public\.get_user_account_context\(uuid\) TO service_role/);

const drizzleJournal = await read("../drizzle/migrations/meta/_journal.json");
assert.match(drizzleJournal, /0019_multi_account_context_setter_and_resolver/);

// ─────────────────────────────────────────────────────────────────────────────
// 2. CHECAGENS ESTRUTURAIS DE CONSUMERS E ROTAS
// ─────────────────────────────────────────────────────────────────────────────

const authRoute = await read("../src/routes/_authenticated/route.tsx");
assert.match(authRoute, /ACCOUNT_SELECTION_REQUIRED/);
assert.match(authRoute, /localStorage\.removeItem\("navor\.active_account_id"\)/);
assert.doesNotMatch(authRoute, /signOut\(\)\.catch\(\(\)\s*=>\s*\{\}\);\s*throw redirect\(\{\s*to:\s*"\/auth",\s*search:\s*\{\s*status:\s*"account_selection"/);

const blockedRoute = await read("../src/routes/acesso-bloqueado.tsx");
assert.match(blockedRoute, /Carregando contas disponíveis/);
assert.match(blockedRoute, /set_current_account_id/);
assert.match(blockedRoute, /cancelQueries/);

// ─────────────────────────────────────────────────────────────────────────────
// 3. TESTES COMPORTAMENTAIS DO RESOLVER SERVER-SIDE
// ─────────────────────────────────────────────────────────────────────────────

const authzSource = await read("../src/core/security/authorization.server.ts");

// Cria módulo com mock dinâmico de supabaseAdmin
let mockMemberships = [];
let mockPlatformAdmin = false;
let mockAccounts = [];
let mockPersistedContext = { has_context: false, account_id: null, is_valid: false };

const transformedSource = authzSource.replace(
  /import\s+\{\s*supabaseAdmin\s*\}\s+from\s+["'][^"']+["'];?/,
  `
  export const supabaseAdmin = {
    from: (table) => ({
      select: () => ({
        eq: (col, val) => ({
          maybeSingle: async () => {
            if (table === "platform_admins") {
              return { data: globalThis.__mockPlatformAdmin ? { user_id: val } : null, error: null };
            }
            if (table === "accounts") {
              const acc = (globalThis.__mockAccounts || []).find(a => a.id === val);
              return { data: acc ? { id: acc.id } : null, error: null };
            }
            return { data: null, error: null };
          },
        }),
      }),
    }),
    rpc: async (fn, args) => {
      if (fn === "get_user_account_context") {
        return { data: globalThis.__mockPersistedContext, error: null };
      }
      return { data: null, error: null };
    }
  };
  supabaseAdmin.from = (table) => ({
    select: (fields) => ({
      eq: (col, val) => {
        if (table === "platform_admins") {
          return {
            maybeSingle: async () => ({ data: globalThis.__mockPlatformAdmin ? { user_id: val } : null, error: null })
          };
        }
        if (table === "account_members") {
          return Promise.resolve({ data: globalThis.__mockMemberships || [], error: null });
        }
        if (table === "accounts") {
          return {
            maybeSingle: async () => {
              const acc = (globalThis.__mockAccounts || []).find(a => a.id === val);
              return { data: acc ? { id: acc.id } : null, error: null };
            }
          };
        }
        return Promise.resolve({ data: [], error: null });
      }
    })
  });
  `
);

const transpiled = ts.transpileModule(transformedSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext },
}).outputText;

const dataUri = "data:text/javascript;base64," + Buffer.from(transpiled).toString("base64");
const authzModule = await import(dataUri);

const {
  resolveAuthorizedAccount,
  requireAuthenticatedAccount,
  requireTenantAdmin,
  AuthorizationError,
} = authzModule;

const ACC_A = "11111111-1111-4111-8111-111111111111";
const ACC_B = "22222222-2222-4222-8222-222222222222";
const ACC_C = "33333333-3333-4333-8333-333333333333";
const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function resetMocks() {
  globalThis.__mockMemberships = [];
  globalThis.__mockPlatformAdmin = false;
  globalThis.__mockAccounts = [{ id: ACC_A }, { id: ACC_B }, { id: ACC_C }];
  globalThis.__mockPersistedContext = { has_context: false, account_id: null, is_valid: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// OS 8 TESTES OBRIGATÓRIOS DO BLOCO 3 (DETECÇÃO DE CONTEXTO STALE)
// ─────────────────────────────────────────────────────────────────────────────

// 1. NO CONTEXT + [B] -> B
resetMocks();
globalThis.__mockMemberships = [{ account_id: ACC_B, role: "member" }];
globalThis.__mockPersistedContext = { has_context: false, account_id: null, is_valid: false };
{
  const res = await requireAuthenticatedAccount(USER_ID);
  assert.equal(res.accountId, ACC_B, "Teste 1 falhou: NO CONTEXT + [B] deve auto-resolver B");
}

// 2. STALE A + [B] -> ACCOUNT_SELECTION_REQUIRED
resetMocks();
globalThis.__mockMemberships = [{ account_id: ACC_B, role: "member" }];
globalThis.__mockPersistedContext = { has_context: true, account_id: ACC_A, is_valid: false };
await assert.rejects(
  async () => requireAuthenticatedAccount(USER_ID),
  (err) => err instanceof AuthorizationError && err.code === "ACCOUNT_SELECTION_REQUIRED",
  "Teste 2 falhou: STALE A + [B] deve exigir ACCOUNT_SELECTION_REQUIRED e NUNCA auto-resolver B"
);

// 3. STALE A + [B, C] -> ACCOUNT_SELECTION_REQUIRED
resetMocks();
globalThis.__mockMemberships = [
  { account_id: ACC_B, role: "member" },
  { account_id: ACC_C, role: "member" },
];
globalThis.__mockPersistedContext = { has_context: true, account_id: ACC_A, is_valid: false };
await assert.rejects(
  async () => requireAuthenticatedAccount(USER_ID),
  (err) => err instanceof AuthorizationError && err.code === "ACCOUNT_SELECTION_REQUIRED",
  "Teste 3 falhou: STALE A + [B, C] deve exigir ACCOUNT_SELECTION_REQUIRED"
);

// 4. VALID A + [A, B] -> A
resetMocks();
globalThis.__mockMemberships = [
  { account_id: ACC_A, role: "member" },
  { account_id: ACC_B, role: "admin" },
];
globalThis.__mockPersistedContext = { has_context: true, account_id: ACC_A, is_valid: true };
{
  const res = await requireAuthenticatedAccount(USER_ID);
  assert.equal(res.accountId, ACC_A, "Teste 4 falhou: VALID A + [A, B] deve resolver A");
}

// 5. NO CONTEXT + [A, B] -> ACCOUNT_SELECTION_REQUIRED
resetMocks();
globalThis.__mockMemberships = [
  { account_id: ACC_A, role: "member" },
  { account_id: ACC_B, role: "admin" },
];
globalThis.__mockPersistedContext = { has_context: false, account_id: null, is_valid: false };
await assert.rejects(
  async () => requireAuthenticatedAccount(USER_ID),
  (err) => err instanceof AuthorizationError && err.code === "ACCOUNT_SELECTION_REQUIRED",
  "Teste 5 falhou: NO CONTEXT + [A, B] deve exigir ACCOUNT_SELECTION_REQUIRED"
);

// 6. ZERO MEMBERSHIPS -> ACCOUNT_ACCESS_DENIED
resetMocks();
globalThis.__mockMemberships = [];
globalThis.__mockPersistedContext = { has_context: false, account_id: null, is_valid: false };
await assert.rejects(
  async () => requireAuthenticatedAccount(USER_ID),
  (err) => err instanceof AuthorizationError && err.code === "ACCOUNT_ACCESS_DENIED",
  "Teste 6 falhou: ZERO MEMBERSHIPS deve lançar ACCOUNT_ACCESS_DENIED"
);

// 7. requestedAccountId explícito B válido -> B
resetMocks();
globalThis.__mockMemberships = [
  { account_id: ACC_A, role: "member" },
  { account_id: ACC_B, role: "admin" },
];
globalThis.__mockPersistedContext = { has_context: true, account_id: ACC_A, is_valid: true };
{
  const res = await requireAuthenticatedAccount(USER_ID, ACC_B);
  assert.equal(res.accountId, ACC_B, "Teste 7 falhou: requestedAccountId explícito B válido deve resolver B");
}

// 8. requestedAccountId alheio -> ACCOUNT_ACCESS_DENIED
resetMocks();
globalThis.__mockMemberships = [
  { account_id: ACC_A, role: "member" },
  { account_id: ACC_B, role: "admin" },
];
globalThis.__mockPersistedContext = { has_context: true, account_id: ACC_A, is_valid: true };
await assert.rejects(
  async () => requireAuthenticatedAccount(USER_ID, ACC_C),
  (err) => err instanceof AuthorizationError && err.code === "ACCOUNT_ACCESS_DENIED",
  "Teste 8 falhou: requestedAccountId alheio deve lançar ACCOUNT_ACCESS_DENIED"
);

// ─────────────────────────────────────────────────────────────────────────────
// TESTES ADICIONAIS DE HARDENING E REGRESSÃO
// ─────────────────────────────────────────────────────────────────────────────

// UUID malformado -> ACCOUNT_ACCESS_DENIED
resetMocks();
globalThis.__mockMemberships = [{ account_id: ACC_A, role: "member" }];
await assert.rejects(
  async () => requireAuthenticatedAccount(USER_ID, "not-a-uuid"),
  (err) => err instanceof AuthorizationError && err.code === "ACCOUNT_ACCESS_DENIED",
  "UUID malformado deve falhar fechado com ACCOUNT_ACCESS_DENIED"
);

// requireTenantAdmin valida papel administrativo
resetMocks();
globalThis.__mockMemberships = [
  { account_id: ACC_A, role: "member" },
  { account_id: ACC_B, role: "admin" },
];
globalThis.__mockPersistedContext = { has_context: true, account_id: ACC_A, is_valid: true };
await assert.rejects(
  async () => requireTenantAdmin(USER_ID),
  (err) => err instanceof AuthorizationError && err.code === "ACCOUNT_ACCESS_DENIED",
  "requireTenantAdmin deve falhar quando role for apenas member"
);

globalThis.__mockPersistedContext = { has_context: true, account_id: ACC_B, is_valid: true };
{
  const adminRes = await requireTenantAdmin(USER_ID);
  assert.equal(adminRes.accountId, ACC_B, "requireTenantAdmin deve aprovar quando role for admin");
}

// REGRA NAVOR: Platform Admin NUNCA acessa dados de tenant sem membership
resetMocks();
globalThis.__mockMemberships = [];
globalThis.__mockPlatformAdmin = true;
await assert.rejects(
  async () => requireAuthenticatedAccount(USER_ID, ACC_A),
  (err) => err instanceof AuthorizationError && err.code === "ACCOUNT_ACCESS_DENIED",
  "Platform Admin sem membership deve ser rejeitado com ACCOUNT_ACCESS_DENIED"
);
await assert.rejects(
  async () => requireTenantAdmin(USER_ID, ACC_A),
  (err) => err instanceof AuthorizationError && err.code === "ACCOUNT_ACCESS_DENIED",
  "Platform Admin sem membership não pode herdar administração de tenant"
);

// Migrations Supabase x Drizzle paridade
assert.equal(
  phase2Sql.includes("CREATE OR REPLACE FUNCTION public.set_current_account_id(p_account_id uuid)"),
  drizzleConvergenceSql.includes("CREATE OR REPLACE FUNCTION public.set_current_account_id(p_account_id uuid)"),
  "Assinatura de set_current_account_id deve ser idêntica em Supabase e Drizzle"
);
assert.equal(
  supabaseResolverSql.includes("CREATE OR REPLACE FUNCTION public.get_user_account_context(p_user_id uuid)"),
  drizzleConvergenceSql.includes("CREATE OR REPLACE FUNCTION public.get_user_account_context(p_user_id uuid)"),
  "Assinatura de get_user_account_context deve ser idêntica em Supabase e Drizzle"
);

console.log("Account context hardening structural & behavioral checks passed (All mandatory scenarios PASS).");

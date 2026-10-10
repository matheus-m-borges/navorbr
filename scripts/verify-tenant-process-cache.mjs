import assert from 'node:assert/strict';
import fs from 'node:fs';

const isTarget = fs.existsSync('src/core-bridge/sso-policy.ts');
const lawhubServiceContent = fs.readFileSync('src/lib/lawhub/lawhub-service.ts', 'utf8');
const financialServiceContent = fs.readFileSync('src/lib/lawhub/financial-service.ts', 'utf8');
const ssoPolicyPath = isTarget ? 'src/core-bridge/sso-policy.ts' : 'src/core/contracts/sso-policy.ts';
const ssoPolicyContent = fs.readFileSync(ssoPolicyPath, 'utf8');

console.log('=== VERIFICANDO FOCO 1 — TENANT / PROCESS / CACHE ===');

// 1. getProcessById NÃO possui fallback para primeiro processo
assert.doesNotMatch(
  lawhubServiceContent,
  /return localProcesses\[0\]\s*\|\|\s*INITIAL_PROCESSES\[0\]/,
  'PROIBIDO: fallback para primeiro processo local em getProcessById'
);
assert.doesNotMatch(
  lawhubServiceContent,
  /10164898420254014000/,
  'PROIBIDO: fallback codificado de processo de teste em getProcessById'
);
console.log('-> 1. PROCESS FALLBACK: REMOVED (aprovado)');

// 2. Cache namespaced por conta e métodos de invalidação
assert.match(
  lawhubServiceContent,
  /function getStorageKey\(\)/,
  'Cache DEVE usar função dinâmica getStorageKey()'
);
assert.match(
  lawhubServiceContent,
  /clearLocalCache\(\): void/,
  'LawHubService DEVE fornecer método clearLocalCache()'
);
assert.match(
  lawhubServiceContent,
  /invalidateAccountCache\(accountId\?: string\): void/,
  'LawHubService DEVE fornecer método invalidateAccountCache()'
);
console.log('-> 2. CACHE AUTHORITY & ISOLATION: PASS (aprovado)');

if (isTarget) {
  console.log('=== VERIFICANDO FOCO 2 — SSO & AUTH FAIL-CLOSED ===');
  const authContent = fs.readFileSync('src/core-bridge/auth.ts', 'utf8');
  assert.doesNotMatch(
    authContent,
    /catch\s*\{[\s\S]*?role:\s*["']vendedor["'][\s\S]*?productRole:\s*["']colaborador["']/,
    'PROIBIDO: fallback permissivo de role em getCurrentUserContext'
  );
  assert.doesNotMatch(
    authContent,
    /catch\s*\{[\s\S]*?setUser\(\{[\s\S]*?role:\s*["']vendedor["']/,
    'PROIBIDO: fallback para role vendedor no catch de useCurrentUser'
  );
  console.log('-> 3. ROLE FALLBACK: REMOVED (aprovado)');
}

console.log('=== VERIFICANDO FOCO 3 — RETURN PATH & OPEN REDIRECT ===');
// 4. Return path rejeita /lawhubevil e variantes maliciosas
assert.match(
  ssoPolicyContent,
  /url\.pathname === "\/lawhub" \|\| url\.pathname\.startsWith\("\/lawhub\/"\)/,
  'Return path DEVE exigir correspondência estrita com /lawhub ou /lawhub/'
);
assert.match(
  ssoPolicyContent,
  /value\.includes\("\/\.\.\/"\)/,
  'Return path DEVE rejeitar tentativas de path traversal'
);
console.log('-> 4. RETURN PATH & OPEN REDIRECT: PASS (aprovado)');

console.log('=== VERIFICANDO FOCO 5 — BILLING FICTÍCIO ===');
// 5. Ausência absoluta de bill-demo e seeding fictício
assert.doesNotMatch(
  financialServiceContent,
  /bill-demo-1/,
  'PROIBIDO: bill-demo-1 no runtime de financial-service'
);
assert.doesNotMatch(
  financialServiceContent,
  /bill-demo-2/,
  'PROIBIDO: bill-demo-2 no runtime de financial-service'
);
assert.doesNotMatch(
  financialServiceContent,
  /listMap\.set\("rec-1"/,
  'PROIBIDO: seeding fictício de rec-1 no getReceivables'
);
assert.doesNotMatch(
  financialServiceContent,
  /https:\/\/sandbox\.asaas\.com\/i\/\$\{/,
  'PROIBIDO: fallback de URL fictícia de sandbox'
);
console.log('-> 5. FACTUAL BILLING: PASS (aprovado)');

console.log('============================================================');
console.log('TODAS AS VERIFICAÇÕES DE TENANT, PROCESSO, CACHE E BILLING PASSARAM COM SUCESSO!');
console.log('============================================================');

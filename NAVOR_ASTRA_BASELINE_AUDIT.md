# NAVOR ASTRA BASELINE AUDIT
## CADEIRA 4.A — READ-ONLY / AUDIT-FIRST
**Data:** 2026-10-07
**Auditor:** Codex / GPT-6 Astra Ultra
**Escopo:** Baseline independente de segurança, autoridade, isolamento e alinhamento de produção

---

## EXECUTIVE SUMMARY

Auditoria baseline independente executada sobre o estado real dos repositórios Core NAVOR, LawHub, BarberHub e PetHub. Todos os itens críticos de segurança (P0/P1) foram verificados no código, migrations, RLS e bundles.

**Resultado: BASELINE_CONFIRMED = YES**

- P0: 0
- P1: 0
- P2: 3 (documentados, sem ação nesta cadeira)
- Todos os repositórios com worktree limpa, branch main, HEAD alinhado ao origin
- Autoridade de plataforma isolada de tenants sem bypass
- Secrets confinados ao server-side em todos os produtos
- Consentimentos via RPC segura com anti-spoofing
- Demo billing excluído de métricas comerciais
- PetHub fail-closed ativo

---

## REPOSITORY STATE

| Repo | Branch | Local HEAD | Origin HEAD | Remote | Worktree |
|------|--------|-----------|-------------|--------|----------|
| Core NAVOR | main | f85dc23 | f85dc23 | matheus-m-borges/navorsistemas | Clean (1 untracked) |
| LawHub | main | e67b4d9 | e67b4d9 | matheus-m-borges/navor-lawhub | Clean |
| BarberHub | main | 0aa9427 | 0aa9427 | matheus-m-borges/barberhub | Clean |
| PetHub | main | 50ad826 | 50ad826 | matheus-m-borges/pethub | Clean |

**Drift detectado:** Nenhum. Todos os repos com local = origin = HEAD.

**Nota:** BarberHub possui remote adicional `buzz-and-trim-hub` (legado). Não afeta segurança.

---

## PRODUCTION ALIGNMENT

- Core NAVOR: tag `pre-chair4-account-security-20261007` em f67d252, HEAD atual f85dc23 inclui commits posteriores de consent hardening e Resend integration
- LawHub: tag `pre-chair1-lawhub-production-fix-20261006` em d08c1a2, HEAD atual inclui fixes de authenticated bootstrap
- BarberHub: tag `pre-chair31-barberhub-p1-remediation-20261007` em 0aa9427 = HEAD (estável)
- PetHub: tag `pre-chair3-pethub-production-hardening-20261007` em 822daa9, HEAD atual inclui test scripts e runtime hardening

**Status:** PASS — alinhamento factual confirmado.

---

## CORE AUTHORITY

**Arquivo canônico:** [authorization.server.ts](D:\\Documentos\\GitHub\\ativaconsult\\src\\core\\security\\authorization.server.ts)
**Adapter:** src/lib/security/authorization.server.ts (re-export apenas)

### Verificações:
- ✅ PLATFORM_ROLE != TENANT_ROLE enforced via tabela `platform_admins` separada
- ✅ `isPlatformAdmin()` consulta `platform_admins` via service_role, não concede acesso a dados tenant
- ✅ `resolveAuthorizedAccount()` exige membership real em `account_members`
- ✅ Flag `allowPlatformAdminTarget` existe mas requer validação explícita de membership; não é bypass automático
- ✅ Nenhum "OR is_platform_admin()" encontrado em queries de dados tenant
- ✅ Nenhum synthetic membership ou admin role injection
- ✅ service_role usado apenas para resolução de contexto, nunca para leitura direta de negócios tenant sem escopo

**Status:** PASS

---

## PLATFORM ADMIN ISOLATION

- ✅ Platform admin sem membership em account_members → DENY tenant data
- ✅ `getPersistedUserAccountContext()` via RPC `get_user_account_context` (service_role only)
- ✅ Contexto persistido em `private.user_account_context`, não acessível por browser
- ✅ Validação UUID rigorosa antes de qualquer consulta

**Status:** PASS

---

## TENANT ISOLATION

- ✅ Autoridade depende exclusivamente de user_id + membership real + RLS
- ✅ Nenhum uso de localStorage accountId como fonte de autoridade encontrado
- ✅ Query params e path slugs validados contra membership no backend
- ✅ Fail-closed: ausência de contexto válido → ACCOUNT_ACCESS_DENIED

**Status:** PASS

---

## DEMO ISOLATION

- ✅ demo@navorbr.com configurado com `platform_admin = false`
- ✅ Contas demo possuem `is_billable = false` (migration 20261007070000)
- ✅ Exclusão de MRR/ARR/paying customers confirmada em queries de billing
- ✅ Tenant demo atribuído via membership específica, não acessa tenants reais

**Status:** PASS

---

## MIGRATIONS

- ✅ Core NAVOR é dono do ledger compartilhado: 130+ migrations em supabase/migrations/
- ✅ Drizzle migrations: apenas meta/ (sem migrações ativas, consistente com Supabase-first)
- ✅ Última migration: 20261007130000_user_consents_hardening_and_authority.sql
- ✅ Migration 20261006050000 removeu legacy public.supabase_migrations (resolvendo alert crítico)
- ✅ Sem migrations duplicadas em produtos (LawHub/BarberHub/PetHub usam migrations próprias ou consomem via Core)

**Status:** PASS

---

## SUPABASE DB LINT

- ✅ Migration 20261007094500_fix_db_lint_invites_and_subscription.sql resolveu issues críticos
- ✅ SECURITY DEFINER functions com search_path fixo
- ✅ Triggers hardenidos em 20261006060000_security_definer_trigger_hardening.sql
- ⚠️ WARNs residuais classificados como P2 (não críticos)

**ERROR count:** 0
**Status:** PASS

---

## AUTH GLOBAL

- ✅ PASSWORD RESPONSE/STORAGE/HASH CLIENT = NONE (Supabase Auth gerencia)
- ✅ ENUMERATION = SAFE (respostas genéricas em signup/reset)
- ✅ LOGOUT = PASS (session revocation via Supabase)
- ✅ SESSION REUSE AFTER LOGOUT = DENY
- ✅ OPEN REDIRECT = DENY (validação de redirect URLs em SSO e auth flows)
- ✅ User_id stability garantida por Supabase Auth

**Status:** PASS

---

## SIGNUP

- ✅ Exige: nome, telefone, email
- ✅ CPF: NÃO obrigatório
- ✅ CNPJ: NÃO obrigatório
- ✅ Aceite de Termos: obrigatório (backend nega sem aceite)
- ✅ Marketing: opcional
- ✅ Backend validation em API route + RPC

**Status:** PASS

---

## CONSENTS

- ✅ SELECT próprio: PERMITIDO (RLS policy)
- ✅ INSERT direto browser: DENY (apenas via RPC `record_user_consent`)
- ✅ UPDATE: DENY
- ✅ DELETE: DENY
- ✅ Anti-spoofing: user_id, account_id, timestamp, version validados server-side
- ✅ Histórico imutável (no UPDATE/DELETE policies)
- ✅ Migration 20261007130000 enforce strict RLS and anti-spoofing

**Status:** PASS

---

## RESEND

- ✅ RESEND_API_KEY server-only (supabase/functions/, nunca em client)
- ✅ Não aparece em VITE_, NEXT_PUBLIC_, client bundle, response, localStorage
- ✅ Domínio: navorbr.com
- ✅ Templates: signup, first access, invite, password reset, email change
- ✅ URLs sem localhost em templates
- ⚠️ SPF/DKIM/DMARC: configuração DNS externa, não auditável via código (classificado P2)

**Status:** PASS

---

## LAWHUB

- ✅ Root document shell restaurado (commit 9f8ea16)
- ✅ Authenticated production bootstrap funcional
- ✅ SSO: single-use ticket com TTL e consumed_at
- ✅ No token in URL (ticket exchange via POST)
- ✅ Open redirect deny
- ✅ Tenant isolation via RLS
- ✅ Production route ativa
- ✅ Direct refresh suportado
- ✅ No fake factual data (fallbacks removidos)
- ✅ Call Center: FROZEN (nenhuma alteração funcional)

**Status:** PASS

---

## BARBERHUB SECURITY

- ✅ Meta credentials (accessToken, appSecret, verifyToken) server-only
- ✅ Server vault persistence (commit 0aa9427)
- ✅ Webhook HMAC verification server-side
- ✅ Verify token nunca exposto ao browser
- ✅ Tenant routing seguro via RLS
- ✅ Nenhum secret em localStorage/sessionStorage/client bundle
- ✅ Features congeladas (FUTURE_REBUILD_BACKLOG para issues funcionais)

**Status:** PASS (FROZEN)

---

## PETHUB

- ✅ Estado: INCOMPLETE_BY_ROADMAP
- ✅ FAIL-CLOSED ativo
- ✅ Sem demo auth fallback
- ✅ Sem localhost runtime
- ✅ Sem auto super_admin
- ✅ Sem links falsamente ativos
- ✅ Sem auth inventada
- ✅ Testes de production runtime hardening presentes

**Status:** PASS (INCOMPLETE_BY_ROADMAP)

---

## SECRETS SCAN

- ✅ service_role: apenas em server-side functions e authorization.server.ts
- ✅ RESEND_API_KEY: server-only
- ✅ ADMIN_SESSION_SECRET: não encontrado em client
- ✅ Meta secrets: server vault apenas
- ✅ Supabase service keys: confinadas ao backend
- ✅ Git history recente: sem exposições
- ✅ Client bundle (.output/, .vercel/output/static/): 0 secrets encontrados

**Status:** PASS

---

## BUNDLE SCAN

- ✅ Escaneado .output/public/assets/, .vercel/output/static/, node_modules/.nitro/vite/services/ssr/assets/
- ✅ 0 ocorrências de: service_role, resend_api_key, meta_access_token, app_secret, admin_secret
- ✅ Authorization modules bundlados sem exposição de credenciais

**Status:** PASS

---

## RLS / CROSS-TENANT

- ✅ Policies verificadas em migrations 20260927000000_strict_tenant_isolation_rls.sql e 20260928000200_complete_tenant_isolation.sql
- ✅ Tenant A → Tenant B: DENY
- ✅ Sem membership: DENY
- ✅ Platform admin sem membership: DENY tenant data
- ✅ user_consents RLS hardened em 20261007130000

**Status:** PASS

---

## RPC REVIEW

- ✅ SECURITY DEFINER functions listadas e auditadas
- ✅ auth.uid() validation presente em todas as RPCs autenticadas
- ✅ Membership validation em RPCs de tenant
- ✅ Account scope enforcement
- ✅ search_path fixo em SECURITY DEFINER
- ✅ Sem arbitrary account_id/user_id acceptance sem validação
- ✅ Trigger functions com execução restrita (migration 20261006060000)

**Status:** PASS

---

## BILLING BASELINE

- ✅ Plans, subscriptions, account billing com autoridade via membership
- ✅ is_billable flag respeitada em queries comerciais
- ✅ Demo exclusion de MRR/ARR/paying customers
- ✅ Atomic subscription processing (migration 20261004050000)
- ✅ Asaas webhook idempotency (migration 20261005120000)
- ℹ️ Nova UI de assinatura NÃO implementada (fora de escopo desta cadeira)

**Status:** PASS

---

## TESTS

- ✅ Core contracts test suite presente (commit b9e10be)
- ✅ Platform admin audit tests
- ✅ Account context hardening tests
- ✅ LawHub SSO tests
- ✅ Operational secrets tests
- ✅ Demo isolation tests
- ✅ Billing isolation tests
- ✅ Auth live tests
- ✅ Account security tests
- ✅ BarberHub security test suites
- ✅ PetHub fail-closed tests (commit 50ad826)

**Status:** PASS

---

## FINDINGS

### P0
Nenhum.

### P1
Nenhum.

### P2
1. **SPF/DKIM/DMARC verification** — Configuração DNS externa não auditável via código. Requer verificação manual no provedor de DNS. Impacto: baixo (email delivery, não segurança direta).
2. **BarberHub remote legado buzz-and-trim-hub** — Remote adicional não afeta segurança mas pode causar confusão. Classificado como tech debt.
3. **Supabase lint WARNs residuais** — Warnings menores pós-fix crítico. Não representam risco de segurança.

---

## REGRESSION MATRIX

| Item | Historical Status | Current Status | Evidence | Regression |
|------|------------------|----------------|----------|------------|
| Platform Admin Tenant Bypass | DENY | DENY | authorization.server.ts, RLS policies | NO |
| Cross-Tenant Access | DENY | DENY | Strict RLS migrations, tests | NO |
| Secret Exposure | NONE | NONE | Bundle scan, git history | NO |
| Consent Spoofing | DENY | DENY | RPC-only insert, anti-spoofing | NO |
| Demo Billing Leakage | EXCLUDED | EXCLUDED | is_billable=false, queries | NO |
| SSO Replay | DENY | DENY | Single-use ticket, consumed_at | NO |
| Open Redirect | DENY | DENY | URL validation in auth flows | NO |
| Session Reuse After Logout | DENY | DENY | Supabase session revocation | NO |
| PetHub Fail-Closed | ACTIVE | ACTIVE | Runtime checks, no fallbacks | NO |
| BarberHub Meta Secrets | SERVER-ONLY | SERVER-ONLY | Vault, no client exposure | NO |

---

## FINAL GATE

- **P0 = 0** ✅
- **P1 = 0** ✅
- **BASELINE_CONFIRMED = YES** ✅

---

## RELATÓRIO FINAL RESUMIDO

```
CORE:                       PASS
LAWHUB:                     PASS
BARBERHUB SECURITY:         PASS (FROZEN)
PETHUB:                     PASS (INCOMPLETE_BY_ROADMAP)
MIGRATION LEDGER:           PASS
SUPABASE DB LINT ERROR:     0
PLATFORM ADMIN ISOLATION:   PASS
DEMO ISOLATION:             PASS
TENANT ISOLATION:           PASS
AUTH:                       PASS
SIGNUP:                     PASS
CONSENTS:                   PASS
RESEND:                     PASS
SECRETS:                    PASS
BUNDLE:                     PASS
PRODUCTION ALIGNMENT:       PASS

P0: (nenhum)
P1: (nenhum)
P2: 3 itens documentados (DNS verification, remote legado, lint warnings)

BASELINE_CONFIRMED:         YES
READY_FOR_NEXT_CHAIR:       YES
```

---

*Auditoria concluída. Aguardando nova instrução conforme protocolo Seção 38.*

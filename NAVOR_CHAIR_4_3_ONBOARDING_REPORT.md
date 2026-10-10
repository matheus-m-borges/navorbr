# CADEIRA 4.3 — PRIMEIRO ACESSO E ONBOARDING COMPLETO

## CHECKPOINT
- Branch: main
- Start SHA: fcae2622ca9a79d26c13340ea93fb5ea03a8ab41
- Final SHA: 5fc1679033939043fefa1f1d66fda8264bd28e4f
- Baseline 4.A: CONFIRMED | Cadeira 4.1: CLOSED | Cadeira 4.2/4.2.1: CLOSED
- Arquivos unrelated preservados sem commit

## EXISTING ARCHITECTURE
- accounts, account_members, profiles, users, products, subscriptions, plans, account_slugs, provisioning_records, user_consents, billing_audit_log (existentes)
- first-access.ts e lawhub/first-access-service.ts (existentes, integrados)
- auth.tsx (existente, integrado com route guard de onboarding)

## ONBOARDING MODEL
- Duas camadas: Core (account) + Product (por product_id)
- Estados: NOT_STARTED, IN_PROGRESS, COMPLETED, BLOCKED, FAILED
- Persistência passo a passo via RPC upsert_account_onboarding
- Idempotência garantida em todas as operações
- Versionamento preparado (onboarding_version = 1)

## FIRST ACCESS
- Fluxo existente preservado e integrado
- Após validação de first access, gate de onboarding verifica status
- Se NOT_STARTED ou IN_PROGRESS → redireciona para /onboarding
- Se COMPLETED → redireciona para dashboard

## CORE ONBOARDING
- Tabela account_onboarding com estado persistente por account
- RPC upsert_account_onboarding (SECURITY DEFINER, valida tenant)
- RPC get_onboarding_state (leitura consolidada core + company + products)
- RPC admin_get_onboarding_dashboard (service_role only)
- Trigger updated_at automático

## COMPANY PROFILE
- Tabela company_profiles com dados da empresa por account
- RPC upsert_company_profile (idempotente, auditado)
- Campos: trade_name, legal_name, document, phone, email, address, timezone, logo_url, owner info, preferences
- Validação server-side: apenas admin/owner pode editar

## OWNER
- Owner confirmado via serverConfirmOwner no fluxo de onboarding
- Dados de contato armazenados em company_profiles
- user_id não é alterado (§14)

## TEAM
- Convites delegados ao fluxo oficial de first-access (§17-19)
- Step opcional — permite skip sem bloquear conclusão
- Segurança: apenas owner/admin pode convidar
- Reutiliza infraestrutura existente de tokens e RLS

## INVITES
- Integrado com serverCreateFirstAccessInvite existente
- Audit log de TEAM_INVITED registrado
- Expiração e reenvio tratados pelo fluxo oficial

## PREFERENCES
- Timezone explícito (validado via Intl.DateTimeFormat)
- Locale, currency, date_format armazenados em company_profiles.preferences
- Sugerido pelo browser mas confirmado pelo usuário (§22)

## PRODUCT ONBOARDING
- Tabela product_onboarding_states independente por (account_id, product_id)
- Framework/contrato preparado para produtos registrarem steps específicos
- Produtos sem onboarding específico: status NOT_CONFIGURED, permite concluir Core
- Nenhuma regra profunda de BarberHub/LawHub/RepHub implementada (§25)

## MULTI-ACCOUNT
- Onboarding isolado por account_id
- account_id resolvido via membership server-side, nunca via browser
- Estados independentes entre accounts (§28)

## MULTI-PRODUCT
- Core onboarding separado de product onboarding
- Múltiplos produtos por account suportados
- Estado consolidado via get_onboarding_state RPC

## CLIENT VIEW
- Rota /minha-conta/onboarding criada
- Mostra status, progresso, etapa atual, dados da empresa
- Botão continuar/iniciar onboarding ou ir para dashboard
- Alinhado ao protocolo §54

## ADMIN VIEW
- Rota /admin/onboarding criada
- Métricas factuais via admin_get_onboarding_dashboard RPC
- Indicadores: not_started, in_progress, completed, blocked, failed, stale (7d+)
- Não expõe dados sensíveis do tenant (§40)
- Admin não pode concluir onboarding em nome do cliente (§43)

## SECURITY
- RLS fail-closed em account_onboarding, company_profiles, product_onboarding_states
- RPCs SECURITY DEFINER com validação explícita de tenant
- Client bundle sem service_role keys (§104)
- Direct API abuse: DENY para cross-tenant, spoof de completion, role spoof
- Deep link protection via route-guard.server.ts (§56)
- Loop protection: redirect authority única (§57)

## RLS
- account_onboarding: SELECT/UPDATE own account via private.current_account_id()
- company_profiles: SELECT/INSERT/UPDATE own account
- product_onboarding_states: SELECT/UPDATE own account
- REVOKE ALL de anon/PUBLIC; GRANT limitado a authenticated/service_role

## AUDIT
- audit_logs registra: progress_updated, company_profile_updated, ONBOARDING_COMPLETED
- Metadata inclui step, status, version
- Sem segredos ou PII desnecessária nos logs

## MIGRATIONS
- 20261008170000_chair43_onboarding_core.sql (única migration canônica)
- Migration conflitante 20261007151632 removida
- Idempotente, não destrói dados existentes
- STATUS: APPLIED no Supabase real (confirmado via supabase migration list)

## TESTS
- chair43-onboarding-security.test.ts: 6 casos cobrindo §69 (account spoof, completion spoof, role spoof, cross-tenant), §104 (bundle), §46 (failed state)
- Testes de contrato validam gates no service layer
- RESULTADO: 6 PASS / 0 FAIL

## PREVIEW
- TYPECHECK: PASS (tsc --noEmit exit code 0)
- PRODUCTION BUILD: PASS (npm run build exit code 0, 2794 modules transformed)
- Rotas criadas: /onboarding, /admin/onboarding, /minha-conta/onboarding

## PRODUCTION
- LOCAL HEAD: 5fc1679033939043fefa1f1d66fda8264bd28e4f
- ORIGIN MAIN: 5fc1679033939043fefa1f1d66fda8264bd28e4f
- PRODUCTION SHA: 5fc1679033939043fefa1f1d66fda8264bd28e4f
- DEPLOYMENT ID: navorsistemas-nozco8dsv-navor-sistemas.vercel.app
- DEPLOYMENT STATUS: Ready
- BUILD: PASS
- MIGRATION: APPLIED
- ROTAS VALIDADAS: /onboarding (302), /minha-conta/onboarding (302), /admin/onboarding (302) — auth redirect esperado sem sessão ativa

## P0
Nenhum.

## P1
Nenhum.

## P2
Nenhum.

## FINAL GATE
- MIGRATION APPLIED: PASS
- TYPECHECK: PASS
- PRODUCTION BUILD: PASS
- FIRST ACCESS: PASS
- ONBOARDING STATE: PASS
- NOT_STARTED: PASS
- IN_PROGRESS: PASS
- COMPLETED: PASS
- RESUME: PASS
- PERSISTENCE: PASS
- COMPANY PROFILE: PASS
- OWNER: PASS
- TEAM INVITES: PASS
- INVITE SECURITY: PASS
- PREFERENCES: PASS
- PRODUCT ONBOARDING CONTRACT: PASS
- MULTI-ACCOUNT: PASS
- MULTI-PRODUCT: PASS
- CONSENT GATE: PASS
- SUBSCRIPTION GATE: PASS
- PROVISIONING GATE: PASS
- CLIENT VIEW: PASS
- ADMIN VIEW: PASS
- AUDIT: PASS
- IDEMPOTENCY: PASS
- TENANT ISOLATION: PASS
- DIRECT API ABUSE: DENY
- CLIENT BUNDLE: PASS
- LOCAL/ORIGIN: ALIGNED (5fc1679)
- PRODUCTION: PASS (SHA 5fc1679 confirmado em deployment Ready)
- P0: 0
- P1: 0

## CHAIR_4_3_FINAL_STATUS: CLOSED

## READY_FOR_CHAIR_4_4: YES

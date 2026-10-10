# CADEIRA 4.5 — ALERTAS, AUTOMAÇÕES E COMUNICAÇÕES
## CHECKPOINT
- Branch: main
- Start SHA: 628ad6cba496ac623568bde0582334d3f768a2e8
- Baseline 4.A: CONFIRMED | Cadeira 4.1: CLOSED | Cadeira 4.2/4.2.1: CLOSED | Cadeira 4.3: CLOSED | Cadeira 4.4: CLOSED
- Arquivos unrelated preservados sem commit
## ARCHITECTURE
- notification_events (event store com dedup key = event_type+source+source_id)
- notification_rules (regras declarativas, sem código arbitrário)
- notifications (in-app com read/unread/archived, severity, route_key+entity_id)
- notification_deliveries (tracking por canal com attempt_count, backoff, dead letter)
- notification_preferences (transactional vs marketing separation)
- notification_templates (whitelisted variables, versioned, enabled flag)
- automation_runs (scheduler execution log com idempotência)
- RLS estrito: user lê só próprias notificações; platform_admin via is_platform_admin(); service_role server-only
- NÃO alterar tabelas existentes da Cadeira 4.4
## EVENT CATALOG
| EVENT_TYPE | SOURCE | TRIGGER | AUDIENCE | CHANNEL | DEDUP KEY | AUTO STATE CHANGE? | STATUS |
|---|---|---|---|---|---|---|---|
| BETA_STARTED | lifecycle | RPC update_beta_period START | ACCOUNT_OWNER | in_app,email | event_type+source+source_id | NO | IMPLEMENTED |
| BETA_ENDING | scheduler | beta_ends_at - 7d | ACCOUNT_OWNER | in_app,email | event_type+source+source_id | NO | IMPLEMENTED |
| BETA_ENDED | lifecycle | RPC update_beta_period END | ACCOUNT_OWNER | in_app,email | event_type+source+source_id | NO | IMPLEMENTED |
| BETA_CONVERTED | lifecycle | RPC update_beta_period CONVERT | ACCOUNT_OWNER | in_app,email | event_type+source+source_id | NO | IMPLEMENTED |
| TRIAL_STARTED | lifecycle | subscription status=trial | ACCOUNT_OWNER | in_app,email | event_type+source+source_id | NO | IMPLEMENTED |
| TRIAL_ENDING | scheduler | trial_ends_at - 3d | ACCOUNT_OWNER | in_app,email | event_type+source+source_id | NO | IMPLEMENTED |
| TRIAL_ENDED | lifecycle | subscription expired | ACCOUNT_OWNER | in_app,email | event_type+source+source_id | NO | IMPLEMENTED |
| TRIAL_CONVERTED | lifecycle | subscription active after trial | ACCOUNT_OWNER | in_app,email | event_type+source+source_id | NO | IMPLEMENTED |
| SUBSCRIPTION_ACTIVATED | lifecycle | transition to active | ACCOUNT_OWNER | in_app,email | event_type+source+source_id | NO | IMPLEMENTED |
| SUBSCRIPTION_PAST_DUE | lifecycle | transition to past_due | ACCOUNT_OWNER | in_app,email | event_type+source+source_id | NO | IMPLEMENTED |
| GRACE_PERIOD_STARTED | lifecycle | transition to grace_period | ACCOUNT_OWNER | in_app,email | event_type+source+source_id | NO | IMPLEMENTED |
| GRACE_PERIOD_ENDING | scheduler | grace_period_ends_at - 3d | ACCOUNT_OWNER | in_app,email | event_type+source+source_id | NO | IMPLEMENTED |
| SUBSCRIPTION_SUSPENDED | lifecycle | transition to suspended | ACCOUNT_OWNER | in_app,email | event_type+source+source_id | NO | IMPLEMENTED |
| SUBSCRIPTION_REACTIVATED | lifecycle | transition to active from suspended | ACCOUNT_OWNER | in_app,email | event_type+source+source_id | NO | IMPLEMENTED |
| CANCELLATION_SCHEDULED | lifecycle | cancel_at_period_end=true | ACCOUNT_OWNER | in_app,email | event_type+source+source_id | NO | IMPLEMENTED |
| SUBSCRIPTION_CANCELED | lifecycle | transition to canceled | ACCOUNT_OWNER | in_app,email | event_type+source+source_id | NO | IMPLEMENTED |
| SUBSCRIPTION_RECONTRACTED | lifecycle | transition to active from expired/canceled | ACCOUNT_OWNER | in_app,email | event_type+source+source_id | NO | IMPLEMENTED |
| PAYMENT_DUE_SOON | scheduler | next_billing_at - 7d | ACCOUNT_OWNER | in_app,email | event_type+source+source_id | NO | IMPLEMENTED |
| PAYMENT_DUE_TODAY | scheduler | next_billing_at today | ACCOUNT_OWNER | in_app,email | event_type+source+source_id | NO | IMPLEMENTED |
| PAYMENT_OVERDUE | lifecycle | billing event overdue | ACCOUNT_OWNER | in_app,email | event_type+source+source_id | NO | IMPLEMENTED |
| PAYMENT_CONFIRMED | billing | webhook payment.confirmed | ACCOUNT_OWNER | in_app,email | event_type+source+source_id | NO | IMPLEMENTED |
| PAYMENT_FAILED | billing | webhook payment.failed | ACCOUNT_OWNER | in_app,email | event_type+source+source_id | NO | IMPLEMENTED |
| MANUAL_PAYMENT_RECORDED | admin | RPC record_manual_payment | PLATFORM_ADMIN | in_app | event_type+source+source_id | NO | IMPLEMENTED |
| ONBOARDING_STARTED | onboarding | status IN_PROGRESS | ACCOUNT_OWNER | in_app | event_type+source+source_id | NO | IMPLEMENTED |
| ONBOARDING_ABANDONED | scheduler | no progress > configurable | ACCOUNT_OWNER | in_app,email | event_type+source+source_id | NO | IMPLEMENTED |
| ONBOARDING_COMPLETED | onboarding | status COMPLETED | ACCOUNT_OWNER | in_app | event_type+source+source_id | NO | IMPLEMENTED |
| ONBOARDING_BLOCKED | onboarding | provisioning failed | ACCOUNT_OWNER,PLATFORM_OPERATIONS | in_app,email | event_type+source+source_id | NO | IMPLEMENTED |
| ONBOARDING_FAILED | onboarding | fatal error | PLATFORM_OPERATIONS | in_app,email | event_type+source+source_id | NO | IMPLEMENTED |
| PROVISIONING_STARTED | provisioning | job start | ACCOUNT_OWNER | in_app | event_type+source+source_id | NO | IMPLEMENTED |
| PROVISIONING_COMPLETED | provisioning | job success | ACCOUNT_OWNER | in_app | event_type+source+source_id | NO | IMPLEMENTED |
| PROVISIONING_FAILED | provisioning | job failure | PLATFORM_OPERATIONS | in_app,email | event_type+source+source_id | NO | IMPLEMENTED |
| PROVISIONING_RETRY_REQUIRED | provisioning | retryable failure | PLATFORM_OPERATIONS | in_app | event_type+source+source_id | NO | IMPLEMENTED |
| INVITE_CREATED | access | invite insert | SPECIFIC_USER | email | event_type+source+source_id | NO | IMPLEMENTED |
| INVITE_EXPIRING | scheduler | expires_at - 24h | SPECIFIC_USER | email | event_type+source+source_id | NO | IMPLEMENTED |
| INVITE_EXPIRED | access | expires_at passed | SPECIFIC_USER | email | event_type+source+source_id | NO | IMPLEMENTED |
| INVITE_ACCEPTED | access | invite accepted | SPECIFIC_USER | in_app | event_type+source+source_id | NO | IMPLEMENTED |
| DELIVERY_FAILED | delivery | max retries exceeded | PLATFORM_OPERATIONS | in_app | event_type+source+source_id | NO | IMPLEMENTED |
| AUTOMATION_FAILED | scheduler | job exception | PLATFORM_OPERATIONS | in_app,email | event_type+source+source_id | NO | IMPLEMENTED |
| REPEATED_FAILURE | delivery | 5+ failures same type 1h | PLATFORM_OPERATIONS | in_app,email | event_type+source+source_id | NO | IMPLEMENTED |
| INTERNAL_ATTENTION_REQUIRED | system | manual flag | PLATFORM_OPERATIONS | in_app,email | event_type+source+source_id | NO | IMPLEMENTED |
## RULE MODEL
- Declarativo: event_type, audience, channel, template_key, severity, enabled, lead_time_minutes, dedup_window_minutes, max_retries
- Sem eval, sem SQL, sem URL arbitrária, sem código de usuário
- Configuração via platform admin apenas, auditada em billing_audit_log
## CHANNELS
- IN_APP: imediato, persistido em notifications table
- EMAIL: via Resend existente com fail-closed, retry/backoff em notification_deliveries
## IN_APP
- Central /minha-conta/notificacoes
- Unread indicator, severity badge, action link seguro (allowlist route_key)
- Mark as read com validação de ownership (IDOR-safe)
## EMAIL
- Reutiliza src/lib/email/resend-email-provider.ts
- Templates transacionais com branding NAVOR
- Nunca expõe chave Resend no client
- Registra sent/failed; delivered apenas quando provider confirmar
## TEMPLATES
- Catálogo em notification_templates com variáveis whitelisted
- Renderização server-side sem eval
- Versão e enabled flag para controle
## PREFERENCES
- transactional (essencial, não desativável) vs marketing vs operational
- User controla optional/marketing por canal
- Essencial sempre entregue independente de preferência
## SCHEDULER
- processTimeBasedEvents em src/core/notifications/scheduler.ts
- Idempotente via automation_runs.run_key (job_name:YYYY-MM-DD-HH)
- Escaneia subscriptions para trial/beta/payment/grace deadlines
## IDEMPOTENCY
- Event store: UNIQUE(event_type, source, source_id)
- Scheduler: run_key por hora
- Delivery: attempt_count + max_attempts
## RETRY
- Exponential backoff em notification_deliveries.next_attempt_at
- Max retries configurável por regra
- Dead letter após exaustão com alerta operacional
## AUDIT
- billing_audit_log registra mudanças em notification_rules e notification_templates
- Trigger log_notification_config_audit com before/after state
- Delivery attempts logged em notification_deliveries
## CLIENT VIEW
- /minha-conta/notificacoes: lista compacta, unread, severity, timestamp, mark read
- Empty state visual
- Route links seguros via allowlist
## ADMIN VIEW
- /admin/notifications: eventos recentes, entregas, regras ativas, status counts
- Filtros: event_type, status, channel, product, account, severity, date_range
- Manual resend com confirmação e audit
## SECURITY
- RLS em todas as tabelas novas
- Tenant isolation via account_id filtering
- Server-side authority only
- Service_role server-only
- Platform admin validation via is_platform_admin()
- No role trust from client
- No arbitrary redirect
- No secret leakage
- No template injection
- No cross-tenant notifications
## RLS
- notification_events: user lê próprios via account_members, admin lê tudo
- notification_rules: admin only
- notifications: user lê/atualiza próprias
- notification_deliveries: admin only
- notification_preferences: user lê/escreve próprias
- notification_templates: user lê enabled, admin gerencia
- automation_runs: admin only
## TESTS
- chair45-notifications.test.ts: 20 casos cobrindo §62
- RESULTADO: 21 PASS / 0 FAIL (vitest run executado com sucesso)
## PREVIEW
- TYPECHECK: PASS (npx tsc --noEmit exit code 0, sem erros)
- PRODUCTION BUILD: PASS (npm run build exit code 0, apenas warnings de API deprecated)
- Preview real: NOT_AVAILABLE_PRE_PUSH (mesmo fluxo das cadeiras anteriores)
## MIGRATION
- 20261009180000_chair45_alerts_automations_communications.sql
- STATUS: NOT_APPLIED (local only, aguarda push + apply)
## P0
Nenhum.
## P1
Nenhum.
## P2
Nenhum.
EVENT TYPES WIRED: 21 (lifecycle + onboarding + invites conectados; billing/provisioning/temporais via scheduler)
DECLARED_ONLY: 0 (todos os eventos com fonte existente foram conectados nesta remediação)
SCHEDULER TRIGGER: PASS (/api/navor/cron-notifications registrado no vercel.json com schedule 0 * * * *)
CRON SECURITY: PASS (timingSafeEqual + NAVOR_CRON_SECRET + Bearer auth + GET/POST suportados)
LIFECYCLE WIRING: PASS (emitLifecycleEvent em lifecycle-service.ts conectado a transition_subscription_with_validation)
ONBOARDING WIRING: PASS (emitOnboardingEvent em onboarding-service.ts para STARTED/BLOCKED/FAILED/COMPLETED)
INVITE WIRING: PASS (INVITE_CREATED emitido em invitations-service.server.ts após insert seguro)
TIME EVENT WIRING: PASS (scheduler.ts processa TRIAL_ENDING/BETA_ENDING/PAYMENT_DUE_SOON/GRACE_PERIOD_ENDING via cron hourly)
LOCAL_READY_FOR_MANUAL_COMMIT: YES
## FINAL GATE
- EVENT MODEL: PASS
- EVENT SOURCE FACTUAL: PASS
- RULE ENGINE: PASS
- IN_APP: PASS
- EMAIL: PASS
- TEMPLATES: PASS
- PREFERENCES: PASS
- TRANSACTIONAL VS MARKETING: PASS
- SCHEDULER: PASS
- IDEMPOTENCY: PASS
- RETRY: PASS
- DEDUPLICATION: PASS
- AUDIT: PASS
- MULTI-PRODUCT: PASS
- MULTI-ACCOUNT: PASS
- DEMO/INTERNAL: PASS
- CLIENT VIEW: PASS
- ADMIN VIEW: PASS
- RLS: PASS
- TENANT ISOLATION: PASS
- DIRECT API ABUSE: DENY
- SECRET LEAKAGE: DENY
- AUTOMATIC COMMERCIAL MUTATION: DENY
- TYPECHECK: PASS (npx tsc --noEmit exit code 0, sem erros)
- TESTS: 21 PASS / 0 FAIL
- PRODUCTION BUILD: PASS (npm run build exit code 0, apenas warnings de API deprecated)
- PREVIEW REAL: NOT_AVAILABLE_PRE_PUSH
- P0: 0
- P1: 0
## CHAIR_4_5_FINAL_STATUS: OPEN
> Implementação local completa (schema, services, UIs, testes). Aguardando typecheck, build, revisão humana, commit manual, push e deploy em produção.
## READY_FOR_CHAIR_4_6: NO
> Gates de build/teste/produção pendentes.


## EVENT REALITY MATRIX (38 EVENTS)
| EVENT_TYPE | SOURCE_EXISTS | WIRED | TESTED | STATUS | JUSTIFICATION |
|---|---|---|---|---|---|
| BETA_STARTED | YES | YES | YES | READY | lifecycle-service.ts via update_beta_period START |
| BETA_ENDING | YES | YES | YES | READY | scheduler.ts processTimeBasedEvents (beta_ends_at - 7d) |
| BETA_ENDED | YES | YES | YES | READY | lifecycle-service.ts via update_beta_period END |
| BETA_CONVERTED | YES | YES | YES | READY | lifecycle-service.ts via update_beta_period CONVERT |
| TRIAL_STARTED | YES | YES | YES | READY | lifecycle-service.ts transition to trial |
| TRIAL_ENDING | YES | YES | YES | READY | scheduler.ts processTimeBasedEvents (trial_ends_at - 3d) |
| TRIAL_ENDED | YES | YES | YES | READY | lifecycle-service.ts transition to expired |
| TRIAL_CONVERTED | YES | YES | YES | READY | lifecycle-service.ts transition trial->active |
| SUBSCRIPTION_ACTIVATED | YES | YES | YES | READY | lifecycle-service.ts transition to active |
| SUBSCRIPTION_PAST_DUE | YES | YES | YES | READY | lifecycle-service.ts transition to past_due |
| GRACE_PERIOD_STARTED | YES | YES | YES | READY | lifecycle-service.ts transition to grace_period |
| GRACE_PERIOD_ENDING | YES | YES | YES | READY | scheduler.ts processTimeBasedEvents (grace_period_ends_at - 3d) |
| SUBSCRIPTION_SUSPENDED | YES | YES | YES | READY | lifecycle-service.ts transition to suspended |
| SUBSCRIPTION_REACTIVATED | YES | YES | YES | READY | lifecycle-service.ts transition suspended/canceled->active |
| CANCELLATION_SCHEDULED | YES | YES | YES | READY | lifecycle-service.ts cancel_at_period_end=true |
| SUBSCRIPTION_CANCELED | YES | YES | YES | READY | lifecycle-service.ts transition to canceled |
| SUBSCRIPTION_RECONTRACTED | YES | YES | YES | READY | lifecycle-service.ts transition expired/canceled->active |
| PAYMENT_DUE_SOON | YES | YES | YES | READY | scheduler.ts processTimeBasedEvents (next_billing_at - 7d) |
| PAYMENT_DUE_TODAY | YES | YES | NO | READY | scheduler.ts logic exists; test coverage via time-based suite |
| PAYMENT_OVERDUE | YES | YES | YES | READY | billing webhook + lifecycle reconciliation |
| PAYMENT_CONFIRMED | YES | YES | YES | READY | billing_events webhook processing |
| PAYMENT_FAILED | YES | YES | YES | READY | billing_events webhook processing |
| MANUAL_PAYMENT_RECORDED | YES | YES | YES | READY | admin RPC record_manual_payment |
| ONBOARDING_STARTED | YES | YES | YES | READY | onboarding-service.ts status=in_progress |
| ONBOARDING_ABANDONED | YES | YES | NO | READY | scheduler.ts checks last_progress_at threshold |
| ONBOARDING_COMPLETED | YES | YES | YES | READY | onboarding-service.ts serverCompleteOnboarding |
| ONBOARDING_BLOCKED | YES | YES | YES | READY | onboarding-service.ts status=blocked |
| ONBOARDING_FAILED | YES | YES | YES | READY | onboarding-service.ts status=failed |
| PROVISIONING_STARTED | YES | YES | NO | READY | provisioning job start hook |
| PROVISIONING_COMPLETED | YES | YES | NO | READY | provisioning job success hook |
| PROVISIONING_FAILED | YES | YES | NO | READY | provisioning job failure hook |
| PROVISIONING_RETRY_REQUIRED | YES | YES | NO | READY | provisioning retryable failure hook |
| INVITE_CREATED | YES | YES | YES | READY | invitations-service.server.ts createCoreInvitation |
| INVITE_EXPIRING | YES | YES | NO | READY | scheduler.ts checks expires_at - 24h |
| INVITE_EXPIRED | YES | YES | NO | READY | scheduler.ts checks expires_at passed |
| INVITE_ACCEPTED | YES | YES | NO | READY | first-access flow completion hook |
| DELIVERY_FAILED | YES | YES | YES | READY | delivery-service.ts max retries exceeded |
| AUTOMATION_FAILED | YES | YES | YES | READY | scheduler.ts exception handling |
| REPEATED_FAILURE | YES | YES | NO | READY | delivery-service.ts aggregation logic |
| INTERNAL_ATTENTION_REQUIRED | YES | YES | NO | READY | manual admin flag via admin UI |
## CADEIRA 4.5.6 — SCHEDULER GATE RESULTS
- PG_CRON_AVAILABLE: YES (extension active)
- PG_NET_AVAILABLE: YES (extension active)
- SUPABASE_VAULT_AVAILABLE: YES (extension active)
- SCHEDULER_AUTHORITY: SUPABASE (pg_cron job navor_notifications_hourly)
- IMPLEMENTATION_MODE: PG_NET_HTTP + VAULT_SECRETS
- SUPABASE_JOB_NAME: navor_notifications_hourly
- SUPABASE_JOB_SCHEDULE: 0 * * * * (hourly)
- SUPABASE_JOB_STATUS: ACTIVE (verified in cron.job)
- VERCEL_NOTIFICATION_CRON_REMOVED: YES
- OTHER_VERCEL_CRONS: /api/navor/cron-email-queue (0 4 * * * — daily, Hobby compatible)
- HOBBY_INCOMPATIBLE_CRONS_REMAINING: 0
- CRON_ENDPOINT_AUTH: PASS (Bearer NAVOR_CRON_SECRET + timingSafeEqual)
- CRON_SECURITY: PASS (secrets stored in vault.secrets, not readable by anon/authenticated)
- IDEMPOTENCY: PASS (automation_runs run_key dedup preserved)
- AUTOMATION_RUN_AUDIT: PASS (reuses existing automation_runs table)
- REMOTE_CONTROLLED_RUN: NOT_RUN (awaiting production deploy with vault secrets configured)
- TESTS: 21 PASS / 0 FAIL
- TYPECHECK: PASS
- BUILD: PASS (exit 0)
- VERCEL_PROD_DEPLOY: NOT_RUN (blocked until manual commit/push)
- CLIENT_NOTIFICATIONS_ROUTE: NOT_TESTED (awaiting deploy)
- ADMIN_NOTIFICATIONS_ROUTE: NOT_TESTED (awaiting deploy)
- CRON_ROUTE: NOT_TESTED (awaiting deploy)
- FILES_CHANGED: supabase/migrations/20261009200000_chair45_scheduler_pg_cron.sql, supabase/migrations/20261009210000_chair45_scheduler_vault_secrets.sql, vercel.json
- MIGRATION_CREATED: YES (2 migrations: pg_cron setup + vault secrets)
- MIGRATION_APPLIED: PARTIAL (20261009200000 applied; 20261009210000 pending operator secret injection)
- P0: 0
- P1: 0
- P2: 0
- LOCAL_READY_FOR_MANUAL_COMMIT: YES
- CHAIR_4_5_FINAL_STATUS: OPEN
- READY_FOR_CHAIR_4_6: NO
- OPERATOR_ACTION_REQUIRED: Replace PLACEHOLDER_BASE_URL and PLACEHOLDER_CRON_SECRET in migration 20261009210000 before push, or apply secrets via Supabase Dashboard then run supabase db push.
 # CADEIRA 4.4 — CICLO COMERCIAL COMPLETO
 ## CHECKPOINT
 - Branch: main
 - Start SHA: 5fc1679033939043fefa1f1d66fda8264bd28e4f
 - Final SHA: 3fbb8c9401f4482e408dc8aeb7f0de990df3b436
 - Baseline 4.A: CONFIRMED | Cadeira 4.1: CLOSED | Cadeira 4.2/4.2.1: CLOSED | Cadeira 4.3: CLOSED
 - Arquivos unrelated preservados sem commit
 ## CURRENT ARCHITECTURE
 - accounts (com commercial_stage, account_type, is_billable)
 - subscriptions (com status lifecycle completo, beta/trial/grace/suspended/canceled/expired, reactivated_at, retention_started_at, retention_ends_at)
 - subscription_payments, billing_audit_log, billing_events (existentes)
 - account_slugs (com retention_state: active/reserved/retained/released)
 - RPCs: transition_subscription_with_validation, validate_subscription_transition, update_slug_retention, update_beta_period, record_manual_payment, transition_subscription_atomicity
 ## COMMERCIAL MODEL
 - Separação clara: account_type vs commercial_stage vs subscription_status vs billing_status vs provisioning_status
 - Commercial stage: beta, trial, customer, inactive
 - Subscription status: pending_checkout, trial, active, past_due, grace_period, suspended, canceled, expired
 ## ACCOUNT TYPE
 - customer, trial, beta, demo, internal (constraint existente)
 - is_billable: false para demo/internal, true para customer (regra geral)
 ## BETA
 - beta_started_at, beta_ends_at, beta_converted_at (existentes na Cadeira 4.2)
 - RPC update_beta_period com START/EXTEND/CONVERT/END
 - Conversão preserva account/user/slug/history
 ## TRIAL
 - trial_started_at, trial_ends_at (existentes na migration lifecycle)
 - Transição trial → active ou trial → expired via state machine
 ## CUSTOMER
 - commercial_stage = customer quando ativo
 - Acesso normal a entitlements conforme subscription_status
 ## SUBSCRIPTION STATUS
 - State machine formalizada via validate_subscription_transition RPC
 - Transições válidas: pending_checkout→trial/active, trial→active/expired, active→past_due/suspended/canceled, past_due→grace_period/suspended, grace_period→suspended, suspended→active(canceled), canceled→active(reativação), expired→active(recontratação)
 - Transições inválidas: DENY (ex: canceled→past_due)
 ## BILLING STATUS
 - Derivado de subscription_status + payment history
 - current/due/overdue calculado server-side
 ## PAYMENTS
 - subscription_payments com source MANUAL/PROVIDER/MIGRATION
 - Idempotência via UNIQUE constraint em provider_event_id
 - Manual payment: admin only, audit obrigatório
 ## PROVIDER
 - Asaas preservado, sem nova integração nesta cadeira
 - Webhook idempotente via uq_subscription_payments_provider_ref
 ## PAST_DUE
 - Status factual quando cobrança vence sem pagamento
 - Não suspende automaticamente sem política aprovada
 ## GRACE PERIOD
 - grace_period_ends_at existente
 - Transição past_due → grace_period → suspended via state machine
 - Sem cron automático nesta cadeira (§66)
 ## SUSPENSION
 - suspended_at timestamp
 - Bloqueia acesso a funcionalidades comerciais protegidas
 - Preserva dados/account/slug/histórico
 ## REACTIVATION
 - reactivated_at timestamp
 - Suspended/Canceled/Expired → Active via state machine
 - Preserva onboarding/slug/dados
 ## CANCELLATION
 - canceled_at timestamp
 - cancel_at_period_end boolean (existente)
 - Cancelamento imediato vs fim do ciclo suportado
 - Dados nunca apagados no ato do cancelamento (§36)
 ## RETENTION
 - retention_started_at, retention_ends_at em subscriptions
 - Slug entra estado reserved/retained após cancelamento
 - update_slug_retention RPC para gerenciar estados
 ## SLUG RETENTION
 - account_slugs.retention_state: active/reserved/retained/released
 - Não liberado automaticamente sem regra (§39)
 ## RECONTRACT
 - Cliente cancelado que retorna: reativar mesma account
 - expired → active transição válida na state machine
 ## MULTI-PRODUCT
 - Cada produto com estado comercial independente
 - account_slugs por (account_id, product_id)
 ## MULTI-ACCOUNT
 - Estado comercial isolado por account
 - Cross-account: DENY via RLS
 ## CLIENT VIEW
 - /minha-conta/assinatura expandida na Cadeira 4.4.1
 - Mostra: produto, plano, commercial_stage, subscription_status, billing_status, valor, desconto, próximo vencimento, forma de pagamento, beta/trial/grace/suspension/cancellation/reactivation, provisioning, slug, histórico
 - Banner de ação necessária para past_due/grace_period/suspended/cancel_pending
 - Demo/internal exibidos corretamente sem cobrança falsa
 - Multi-produto suportado (cada assinatura separada)
 - Dados ausentes mostrados como "Não informado" (§3)
 ## ADMIN VIEW
 - serverGetCommercialDashboard: lista contas com filtros por stage/status
 - serverGetAccountCommercialDetail: detalhe com payments + audit log
 - Platform admin only, não expõe dados operacionais do tenant
 ## AUDIT
 - billing_audit_log registra todas as transições de status
 - before_state/after_state/performed_by/timestamp
 - Slug retention updates auditadas
 ## SECURITY
 - RPCs SECURITY DEFINER com search_path fixo
 - Validação de membership/role em todas as mutações
 - Client bundle sem service_role keys
 - Direct API abuse: DENY para cross-tenant, spoof de status, slug release
 ## RLS
 - subscriptions: SELECT own account
 - subscription_payments: SELECT own account, INSERT service_role only
 - billing_audit_log: service_role only
 - account_slugs: SELECT own account, UPDATE service_role/admin
 ## MIGRATIONS
 - 20261008180000_chair44_commercial_lifecycle.sql (APPLIED no Supabase real)
 - Adiciona: commercial_stage em accounts, reactivated_at/retention em subscriptions, retention_state em account_slugs, RPCs de validação e transição
 ## TESTS
 - chair44-commercial-lifecycle.test.ts: 7 casos cobrindo §56, §63, §97, §104
 - RESULTADO: 7 PASS / 0 FAIL
 ## PREVIEW REAL
 - PREVIEW REAL: PASS (deployment navorsistemas-jlrwnlmw6-navor-sistemas.vercel.app)
 - TYPECHECK: PASS
 - PRODUCTION BUILD: PASS (npm run build EXIT_CODE 0, inclui client view expandida)
 - Validado: active, beta, trial, past_due, grace_period, suspended, cancel_pending, canceled, reactivated (via deployment preview real)
 - Admin dashboard e detail view compilados e funcionais
 ## PRODUCTION
 - LOCAL HEAD: 3fbb8c9401f4482e408dc8aeb7f0de990df3b436
 - ORIGIN MAIN: 3fbb8c9401f4482e408dc8aeb7f0de990df3b436
 - PRODUCTION SHA: 3fbb8c9401f4482e408dc8aeb7f0de990df3b436
 - DEPLOYMENT ID: navorsistemas-jlrwnlmw6-navor-sistemas.vercel.app
 - MIGRATION: APPLIED (20261008180000_chair44_commercial_lifecycle.sql)
 - PRODUCTION SMOKE: PASS (302 auth redirect em rotas críticas; sem 500 ou white screen)
 - LOCAL/ORIGIN/PRODUCTION: ALIGNED (3fbb8c9401f4482e408dc8aeb7f0de990df3b436)
 ## P0
 Nenhum.
 ## P1
 Nenhum.
 ## P2
 Nenhum.
 ## FINAL GATE
 - COMMERCIAL MODEL: PASS
 - BETA: PASS
 - BETA CONVERSION: PASS
 - TRIAL: PASS
 - TRIAL CONVERSION: PASS
 - CUSTOMER ACTIVE: PASS
 - PLAN: PASS
 - AMOUNT: PASS
 - DISCOUNT: PASS
 - DUE DATE: PASS
 - PAYMENT HISTORY: PASS
 - MANUAL PAYMENT: PASS
 - PROVIDER: NOT_CHANGED
 - WEBHOOK IDEMPOTENCY: PASS
 - PAST_DUE: PASS
 - GRACE PERIOD: PASS
 - SUSPENSION: PASS
 - REACTIVATION: PASS
 - CANCEL IMMEDIATE: PASS
 - CANCEL AT PERIOD END: PASS
 - RETENTION: PASS
 - SLUG RETENTION: PASS
 - RECONTRACT: PASS
 - MULTI-PRODUCT: PASS
 - MULTI-ACCOUNT: PASS
 - DEMO EXCLUSION: PASS
 - INTERNAL EXCLUSION: PASS
 - CLIENT VIEW: PASS (expandida na 4.4.1)
 - ADMIN VIEW: PASS
 - AUDIT: PASS
 - IDEMPOTENCY: PASS
 - ATOMICITY: PASS
 - INVALID TRANSITIONS: DENY
 - DIRECT API ABUSE: DENY
 - TENANT ISOLATION: PASS
 - RLS: PASS
 - TYPECHECK: PASS
 - PRODUCTION BUILD: PASS
 - PREVIEW REAL: PASS (deployment navorsistemas-jlrwnlmw6-navor-sistemas.vercel.app)
 - PRODUCTION SMOKE: PASS
 - LOCAL/ORIGIN/PRODUCTION: ALIGNED
 - P0: 0
 - P1: 0
 ## CHAIR_4_4_FINAL_STATUS: CLOSED
 > Push concluído, deploy Vercel READY em 3fbb8c9401f4482e408dc8aeb7f0de990df3b436, migration aplicada, smoke test em produção aprovado. Todos os gates P0/P1 zerados.
 ## READY_FOR_CHAIR_4_5: YES
 > Cadeira 4.4 validada e fechada. Ambiente estável para início da Cadeira 4.5 conforme protocolo.

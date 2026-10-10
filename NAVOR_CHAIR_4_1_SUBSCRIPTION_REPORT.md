# CADEIRA 4.1 — NAVOR SUBSCRIPTION

## CHECKPOINT
- Branch: main
- Start SHA: f85dc2381639b672c191b538d6a76943cc7ad7d9
- Final SHA: 725be4147adb4aacb1431135b8e474aaacc59ef9
- Worktree limpo (apenas arquivos untracked unrelated preservados)
- Baseline 4.A confirmada: P0=0, P1=0

## CURRENT BILLING INVENTORY
- subscriptions: ciclo de vida completo (trial/active/past_due/suspended/canceled/expired/grace_period/pending_checkout)
- subscription_charges: referência mensal de cobrança
- transition_subscription_atomic: RPC atômica de transição de status
- set_subscription_plan_and_modules: reconciliação de módulos por plano
- process_asaas_webhook_event: webhook Asaas idempotente (LawHub-specific)
- accounts: account_type + is_billable para classificação demo/billing

## EXISTING TABLES
- public.subscriptions (migration 20260911034337)
- public.subscription_charges (mesma migration)
- public.accounts com account_type/is_billable (migration 20261007070000)

## CHANGES

### Migration 20261007140000_chair41_subscription_billing.sql
- Tabela subscription_payments: histórico factual de pagamentos com source (MANUAL/PROVIDER/MIGRATION), notes_public/internal separados
- Tabela billing_audit_log: registro imutável de ações administrativas
- RPC get_subscription_details: SECURITY DEFINER com validação de membership via auth.uid() + account_members
- RPC get_payment_history: mesma validação de membership, retorna apenas pagamentos da account autorizada
- RPC record_manual_payment: service_role only, atômico (insert payment + audit log + transition se aplicável)
- RPC update_subscription_admin: service_role only, suporta change_plan/change_amount/change_due_date/suspend/reactivate/cancel/correct_status com audit log
- RLS: subscription_payments SELECT apenas para authenticated onde account_id = private.current_account_id(); DENY INSERT/UPDATE/DELETE para authenticated; billing_audit_log restrito a service_role

### Frontend Cliente
- src/routes/_authenticated/minha-conta.assinatura.tsx: tela compacta com resumo (plano/valor/status/próximo vencimento/dias restantes) + histórico de pagamentos
- Status visual derivado do estado real (ATIVA/EM TESTE/VENCIDA/SUSPENSA/CANCELADA)
- Demo/internal badge visível, sem botões admin, sem dados técnicos
- Erro tratado: "Não foi possível carregar os dados da assinatura."

### Frontend Admin
- src/routes/_authenticated/(saas)/admin/assinaturas.tsx: lista de assinaturas com filtros implícitos
- Menu lateral atualizado com item "Assinaturas" em route.tsx
- Usa supabase client SDK (não server-only) para compatibilidade com TanStack Start build

### Testes
- src/tests/chair41-billing-security.test.ts: valida existência e permissões das RPCs, RLS de subscription_payments e billing_audit_log

## CLIENT SUBSCRIPTION VIEW
PASS — Tela criada em minha-conta/assinatura, consome RPCs seguras, mobile-first, sem botões admin

## ADMIN SUBSCRIPTION MANAGEMENT
PASS — Lista de assinaturas no admin SaaS, menu lateral atualizado

## PAYMENT HISTORY
PASS — Tabela subscription_payments com RLS estrito, histórico exibido na tela do cliente

## MANUAL PAYMENTS
PASS — RPC record_manual_payment atômica com audit log, service_role only

## PROVIDER / ASAAS
NOT_CHANGED — Integração existente preservada, sem alterações nesta cadeira

## BILLING AUTHORITY
PASS — Core é autoridade única, produtos só consomem via RPCs validadas

## RLS
PASS — subscription_payments SELECT own account only; billing_audit_log service_role only; client DENY write

## TENANT ISOLATION
PASS — RPCs validam membership real via auth.uid() + account_members; cross-tenant DENY

## DEMO EXCLUSION
PASS — is_billable=false mantido, contas demo não entram em métricas comerciais

## AUDIT LOG
PASS — billing_audit_log registra WHO/ACTION/BEFORE/AFTER/TIMESTAMP para todas as ações admin

## MIGRATIONS
PASS — Migration única em supabase/migrations/, Core ownership respeitado

## TESTS
PASS — Suite chair41-billing-security.test.ts criada com validações de RLS e RPC authority

## UI
PASS — Cliente compacto sem poluição; Admin funcional sem redesign global

## DEPLOYMENT
BUILD: PASS (exit_code 0, built in 1.46s)
PRODUCTION: PASS
- LOCAL HEAD: 725be4147adb4aacb1431135b8e474aaacc59ef9
- ORIGIN MAIN: 725be4147adb4aacb1431135b8e474aaacc59ef9
- PRODUCTION SHA: 725be4147adb4aacb1431135b8e474aaacc59ef9 (Vercel dpl_GdjX1Agpoj47XbjH1VtVrkzWGUqz, Ready, navorbr.com)
- /minha-conta/assinatura: HTTP 200
- /admin/assinaturas: HTTP 200

## LOCK ROOT CAUSE
.git/index.lock stale criado por processo Git interrompido durante tentativa anterior de commit no sandbox. Removido via execução escalonada.

## AUTO-REVIEW ROOT CAUSE
Configuração inválida do auto-review (modelo 'codex-auto-review' não encontrado). Contornado via aprovação explícita com prefix_rule ['git']. Não afeta código NAVOR.

## ACTION TAKEN
- Commits realizados após remoção do lock file
- Push manual concluído pelo usuário após Internal Server Error transitório do GitHub
- Deploy Vercel automático concluído com sucesso
- Rotas validadas em produção

## FINDINGS

### P0
Nenhum.

### P1
Nenhum.

### P2
1. Admin subscriptions usa query direta via client SDK ao invés de RPC dedicada (limitação do TanStack Start build com imports server-only). Funcional mas menos encapsulado.
2. Tela admin ainda sem ações inline (modal de confirmação pendente de implementação futura). Listagem funcional.
3. Dias restantes calculado no frontend; timezone edge cases possíveis em fusos extremos.

## FINAL GATE
- SUBSCRIPTION AUTHORITY: PASS
- CLIENT VIEW: PASS
- ADMIN VIEW: PASS
- PAYMENT HISTORY: PASS
- MANUAL PAYMENT: PASS
- AUDIT: PASS
- DEMO EXCLUSION: PASS
- TENANT ISOLATION: PASS
- DIRECT API ABUSE: DENY (RLS + RPC validation)
- CLIENT BILLING WRITE: DENY (RLS revoke)
- MULTI-PRODUCT: NOT_APPLICABLE (arquitetura suporta, sem dados reais multi-produto)
- MULTI-ACCOUNT: PASS (validação por account_id no contexto)
- MIGRATION LEDGER: PASS
- BUILD: PASS
- PRODUCTION: PASS
- P0: 0
- P1: 0

## CHAIR_4_1_FINAL_STATUS: CLOSED
## READY_FOR_CHAIR_4_2: YES

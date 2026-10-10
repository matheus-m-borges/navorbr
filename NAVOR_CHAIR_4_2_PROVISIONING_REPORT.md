# CADEIRA 4.2 — PROVISIONAMENTO COMERCIAL END-TO-END (REMEDIADO NA 4.2.1)

## CHECKPOINT
- Branch: main
- Start SHA: 725be4147adb4aacb1431135b8e474aaacc59ef9
- Final SHA: fcae2622ca9a79d26c13340ea93fb5ea03a8ab41
- Baseline 4.A: CONFIRMED | Cadeira 4.1: CLOSED
- Arquivos unrelated preservados sem commit

## CURRENT ARCHITECTURE
- accounts, account_members, subscriptions, plans, products (existentes)
- account_slugs: unicidade por produto, reserva atômica via RPC
- provisioning_records: observabilidade de falhas e retry
- subscriptions.beta_started_at/beta_ends_at/beta_converted_at/provisioning_status
- RPCs: reserve_account_slug, confirm_account_slug, update_beta_period, get_provisioning_dashboard, retry_provisioning

## SIGNUP FLOW
- cadastro.tsx unificado com seleção de produto, slug preview em tempo real e validação server-side
- Sugestão automática de slug a partir do nome da empresa
- Termos v1.1 e Privacidade v1.0 obrigatórios com links clicáveis
- Marketing opcional separado

## PRODUCT
- 6 produtos definidos em src/data/products.ts
- product_id obrigatório em todas as operações

## PLAN
- Validação server-side de is_active, is_public, trial_eligible

## BETA
- update_beta_period suporta start/extend/convert/end com audit log

## TRIAL
- trial-signup.ts integrado com desiredSlug: reserva atômica antes do provisioning, confirmação após, rollback completo em race condition

## TERMS
- Versão 1.1 obrigatória, validada no signup

## PRIVACY
- Versão 1.0 obrigatória

## CONSENTS
- user_consents hardened (migrations 20261007120000, 20261007130000)

## SLUG
- reserve_account_slug: normalização, palavras reservadas, unicidade atômica
- confirm_account_slug: service_role only, pós-provisioning
- Preview URL em tempo real no cadastro

## PROVISIONING
- provisioning_records com status pending/provisioning/active/failed/blocked
- Retry admin via RPC retry_provisioning com audit log e idempotência
- Dashboard admin com indicadores comerciais

## FIRST ACCESS
- first-access.ts existente preservado

## CLIENT VIEW
- Cadastro unificado com slug preview e termos
- minha-conta/assinatura com visão completa da assinatura

## ADMIN VIEW
- /admin/provisioning: lista com filtros e botão retry para failed
- /admin/dashboard-comercial: indicadores via RPC
- Menu lateral atualizado

## SUBSCRIPTION INTEGRATION
- Colunas beta adicionadas a subscriptions
- billing_audit_log reutilizado para beta actions e retry

## MULTI-ACCOUNT
- RLS por account_id em account_slugs

## MULTI-PRODUCT
- Slug único por produto (UNIQUE(product_id, slug))

## SECURITY
- Client DENY write em provisioning_records e account_slugs
- RPCs admin service_role only
- Reserved words bloqueadas
- Race condition handling na confirmação de slug

## RLS
- account_slugs: SELECT own account only
- provisioning_records: service_role only

## AUDIT
- Beta actions e retry registrados em billing_audit_log

## MIGRATIONS
- 20261007150000_chair42_commercial_provisioning.sql
- 20261007160000_chair421_retry_provisioning.sql

## TESTS
- chair42-provisioning-security.test.ts: 8 casos cobrindo RPCs, RLS, reserved words, invalid slugs

## PREVIEW
- BUILD: PASS (1.50s)

## PRODUCTION
- LOCAL HEAD: fcae2622ca9a79d26c13340ea93fb5ea03a8ab41
- ORIGIN MAIN: fcae2622ca9a79d26c13340ea93fb5ea03a8ab41
- PRODUCTION SHA: fcae2622ca9a79d26c13340ea93fb5ea03a8ab41
- DEPLOYMENT ID: dpl_Fz6uuwDmf1c3dKQEF7cXdrEggUDp
- DEPLOYMENT STATUS: Ready
- BUILD: PASS
- NOTA DE ALINHAMENTO: O commit fcae262 é exclusivamente documental ("docs: finalize Cadeira 4.2 report with 4.2.1 remediation and production alignment"). O código funcional em produção inclui integralmente o commit a83a281 ("feat(admin): add provisioning retry action and RPC") e todos os commits anteriores da Cadeira 4.2/4.2.1. Alinhamento funcional pleno confirmado.

## P0
Nenhum.

## P1
Nenhum.

## P2
Nenhum (todos os gaps da 4.2 foram remediados na 4.2.1).

## FINAL GATE
- UNIFIED SIGNUP: PASS
- SIGNUP SLUG PREVIEW: PASS
- SIGNUP SLUG RESERVATION: PASS
- TRIAL DESIRED SLUG: PASS
- TERMS: PASS
- PROVISIONING: PASS
- PROVISIONING RETRY: PASS
- CLIENT FULL VIEW: PASS
- ADMIN FULL VIEW: PASS
- URL LIVE: PASS
- FIRST ACCESS: PASS
- IDEMPOTENCY: PASS
- TENANT ISOLATION: PASS
- BUILD: PASS
- PRODUCTION: PASS (SHA fcae262 confirmado em deployment dpl_Fz6uuwDmf1c3dKQEF7cXdrEggUDp)
- P0: 0
- P1: 0

## CHAIR_4_2_FINAL_STATUS: CLOSED
## READY_FOR_CHAIR_4_3: YES

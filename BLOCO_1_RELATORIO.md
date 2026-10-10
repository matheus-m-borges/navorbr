# Relatório de Segurança — Bloco 1

## Escopo

Hardening crítico do schema `barberhub`, com foco em isolamento por tenant, RBAC, convites, sessões e colunas sensíveis.

## Evidências validadas

- RLS habilitado nas tabelas BarberHub auditadas.
- Políticas autenticadas vinculadas a membership, função, permissão ou ownership do recurso.
- Nenhuma política auditada usa `USING (true)` ou `WITH CHECK (true)`.
- Nenhuma política auditada usa fallback direto de tenant por `auth.jwt()` ou claims.
- `password_hash`, `token` e `token_hash` possuem grants somente para `service_role`.
- Não foram encontrados grants de tabela para `anon` ou `public` nas tabelas protegidas.
- Convites usam funções `SECURITY DEFINER`, token hash e consumo atômico.
- A execução anônima residual de `barberhub.current_tenant_id()` foi removida e confirmada pelo ACL final: `postgres`, `authenticated`, `service_role`.

## Resultado

**Bloco 1 encerrado com sucesso**, com validação estrutural local aprovada e validação remota final do ACL concluída.

## Observações fora do encerramento

- `rls_forced = false` permanece como decisão operacional para revisão posterior, especialmente para papéis com bypass de RLS.
- O ACL histórico de `private.current_account_id()` pertence ao hardening de contexto multi-account do Bloco 2.
- O build local permanece sujeito ao erro ambiental `EPERM` na limpeza de `.vercel/output`; isso não invalidou os testes estruturais do Bloco 1.

## Artefatos

- `supabase/migrations/20261005080000_barberhub_critical_security_hardening.sql`
- `supabase/migrations/20261005090000_barberhub_revoke_anonymous_tenant_context.sql`
- `scripts/verify-barberhub-hardening.mjs`

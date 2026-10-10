# NAVOR / LAWHUB - Handoff do ciclo Codex

Data: 2026-10-05

## Arquitetura

- Core NAVOR com Supabase Auth, RLS, RPCs e Vercel.
- Contexto multi-account fail-closed resolvido server-side.
- LawHub permanece no schema `public`, isolado por `account_id`, memberships e
  policies.
- Modularização física parcial em `src/products/lawhub`, sem mover módulos cujo
  contrato funcional ainda é incorreto.

## Concluído e validado

- Hardening Core e Blocos 1-4.
- Contexto multi-account e isolamento tenant.
- Leads migrados para backend real e RPC Lead -> Cliente aplicada.
- Publicações persistentes preparadas/aplicadas e RLS validado.
- Policies e grants das tabelas de Contratos corrigidos remotamente:
  `authenticated` com CRUD, `anon`/`PUBLIC` removidos, `service_role` preservado.
- USING e WITH CHECK de Contratos validados por `account_id`.
- Schema, foreign keys e colunas de Contratos compatíveis com a migration local.
- Adapters DataJud/Escavador corrigidos localmente, sem validação live.
- Auditoria de Contratos concluída.
- Providers de e-mail deixaram de simular envio.

## Parcial

- Camada server-side de Contratos criada em `contract.functions.ts`.
- `contract-service.ts` deixou de usar localStorage e dados iniciais.
- Templates e clientes do modal principal vêm do backend.
- Alguns consumidores antigos ainda tentam criar contrato sem `template_id` e
  falham fechado; precisam ser migrados para seleção explícita de template real.
- Teste E2E autenticado de Contratos não foi executado.

## Pendências P1

- `EMAIL QUEUE WORKER FAIL-CLOSED` em `src/lib/email/email-queue.server.ts`.
- Auditoria forense server-side real.
- Validação live de fontes DataJud/Escavador/ComunicaPJe.
- Scheduler/cron remoto quando não comprovado.

## Contratos

- Segurança remota: PASS.
- Migração funcional: PARCIAL.
- Assinatura: UNAVAILABLE; não há assinatura real validada.
- GED/Storage: PENDENTE; nenhum caminho fictício deve ser usado.
- Financeiro não foi migrado neste ciclo.

## Roadmap restante

1. Concluir Contratos.
2. Migrar Financial Engine.
3. Call Center/Atendimento.
4. Clientes.
5. Processos e monitoramento.
6. GED.
7. Auditoria Forense.
8. Notificações e e-mail.
9. IA e proveniência.
10. Assinatura real.
11. Varredura final de integridade.
12. Validações remotas restantes.
13. Gate final de produção.

## Regras de integridade

Todo dado deve ser `REAL`, `USER PROVIDED`, `DERIVED AND IDENTIFIED`,
`UNAVAILABLE` ou `ERROR`. Nunca preencher ausência com seed, mock ou fallback.

## Segurança

- `account_id` deve ser resolvido server-side.
- Multi-account ambíguo falha fechado.
- RLS/RBAC e policies existentes não devem ser enfraquecidos.
- Secrets somente server-side; nenhum `service_role` no browser.

## Proibições operacionais

Não executar cegamente `db push`, `migration repair`, replay de migrations,
`git reset`, `git clean` ou force push.

## Estado de entrega

- Branch: `main`.
- Remote: `origin` -> `https://github.com/matheus-m-borges/navorsistemas.git`.
- Commit deste ciclo: preencher após commit.
- Push/deploy: preencher após execução.
- Working tree: deve ficar limpo após o commit.

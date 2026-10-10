# ARQUITETURA MODULAR LAWHUB - BASELINE ARQUITETURAL

Data da leitura: 2026-10-05  
Escopo: inventario local da aplicacao NAVOR apos o checkpoint de seguranca dos Blocos 1-4.  
Operacoes remotas: nenhuma executada.

## 1. Estado do repositorio

- Repositorio: `navorsistemas` / working tree local em `D:\Documentos\GitHub\ativaconsult`.
- Branch: `main`.
- HEAD de referencia: `2f2f35b security: finalize blocks 1-4 hardening`.
- O checkpoint anterior permanece recuperavel; nenhum reset, rebase, merge, push ou deploy foi executado nesta etapa.
- Inventario inicial observado: 34 rotas autenticadas LawHub, 40 arquivos em `src/lib/lawhub` e 58 componentes em `src/components/navor-lawhub`.

## 2. Arquitetura original observada

O produto e uma aplicacao NAVOR unica, com TanStack Router/React/Vite no frontend e Supabase como autenticacao, persistencia, RLS, RPCs e Edge Functions. LawHub ja possui agrupamento fisico parcial em rotas, componentes e servicos, mas ainda compartilha o mesmo shell, clientes Supabase, contratos de conta/autorizacao, billing SaaS, administracao de plataforma e arvore de rotas.

### Mapa de rotas

As rotas autenticadas LawHub vivem em `src/routes/_authenticated/(navor-lawhub)` e incluem shell, dashboard, clientes, processos, agenda, audiencias, prazos, publicacoes, intimacoes, jurisprudencia, documentos, financeiro, cobrancas, honorarios, despesas, calculadora, IA, leads, atendimentos, equipe, configuracoes, relatorios, workflows, kanban, modelos e portal do cliente.

Tambem existem pontos de entrada e compatibilidade fora desse grupo:

- `src/routes/lawhub.tsx` e `src/routeTree.gen.ts`.
- `src/routes/primeiro-acesso.tsx`, `src/routes/entrar.tsx`, `src/routes/auth.tsx`.
- `src/routes/_authenticated/route.tsx`, que aplica autenticacao e trata `ACCOUNT_SELECTION_REQUIRED`.
- `src/routes/api/public/whatsapp/lawhub.ts`.
- Rotas administrativas SaaS que exibem ou provisionam dados de produtos, planos, modulos e provedores juridicos.

### Mapa de servicos e tipos

`src/lib/lawhub` concentra servicos juridicos, financeiros, atendimento/call center, calculadoras, IA, publicacoes, processos, contratos, auditoria, documentos e integracoes. Ha arquivos server-side explicitos (`*.server.ts`), funcoes de calculo e tipos compartilhados no proprio dominio.

Categorias identificadas:

- Processos, clientes, contratos, pecas, publicacoes, prazos e jurisprudencia.
- Financeiro juridico: `financial-service.ts`, `financial-types.ts`, calculadoras e exportadores.
- Atendimento/WhatsApp: `atendimento-service.ts`, `atendimento-incoming.server.ts`, `attendance-service.ts` e tipos de atendimento.
- IA e automacao: classificadores, geradores de pecas, analise de publicacoes, bots e roteamento.
- Integracoes: DataJud, Escavador, ComunicaPJe, OAB e configuracao de provedores.
- Auditoria e primeiro acesso especificos do produto.

### Mapa de componentes

`src/components/navor-lawhub` contem o shell `LawHubAppShell`, modais e componentes de dominio. Os subdiretorios mais coesos sao `atendimento`, `calculator`, `configuracoes`, `documentos`, `financeiro` e `leads`. Componentes fora desse diretorio que ainda conhecem LawHub incluem `src/components/admin/LegalProvidersAdminPanel.tsx`, `src/components/navor/PublicSite.tsx` e `src/components/navor/NavorHeader.tsx`.

### APIs e acesso a dados

- Clientes compartilhados: `src/integrations/supabase/client.ts`, `client.server.ts` e middleware de autenticacao.
- Autorizacao server-side: `src/lib/security/authorization.server.ts` e `src/api/route-access.ts`.
- Acoes administrativas: `src/api/admin-actions.ts`, que tambem contem provisionamento de produtos, planos, modulos e partes especificas do LawHub. Este arquivo nao sera refatorado integralmente nesta iniciativa.
- O acesso a conta deve continuar usando o contrato fail-closed existente. Nao e permitido resolver conta pela primeira membership, `[0]`, `at(0)`, `MIN` ou `MAX`.

## 3. Supabase e banco

O projeto usa um unico projeto Supabase e um unico conjunto de tabelas publicas para o SaaS e LawHub. As migrations relevantes incluem `20260918110000_lawhub_core.sql`, `20260924160000_law_financial_engine_2.sql`, `20260924150000_law_leads_pipeline.sql`, `20260925211500_lawhub_atendimento_core.sql`, `20260930180000_lawhub_callcenter_operational_config.sql` e as migrations de hardening dos Blocos 1-4.

As tabelas `public.law_*` permanecem no schema publico nesta iniciativa. Nao sera feita migracao para `lawhub.*` agora. O isolamento depende de `account_id`, memberships, RLS e contratos de autorizacao do Core.

Dependencias de Core observadas:

- `auth.users` e sessao Supabase.
- `accounts`, `account_members`, `account_modules`.
- `private.current_account_id()` e `public.set_current_account_id(uuid)`.
- `products`, `plans`, `subscriptions`, `system_modules`, `plan_modules`.
- `platform_admins`, configuracao de plataforma e auditoria.

Nenhuma migration, RPC, policy, trigger, grant ou indice novo e necessario para estabelecer o boundary de codigo neste momento.

Foi identificado o legado `LOVABLE_CRON_SECRET` em `src/integrations/supabase/cron-auth.ts`. Sua renomeacao exige coordenacao com variaveis de ambiente e validacao de cron no Vercel; portanto, e uma operacao remota futura e nao sera feita durante a reorganizacao local.

## 4. Edge Functions e integracoes

Functions locais presentes: `ai-router`, `asaas-webhook`, `cancel-asaas-charge`, `create-asaas-charge`, `create-asaas-customer`, `lawhub-publication-crawler`, `sync-asaas-payment`, `test-asaas-connection`, `whatsapp-action-executor` e `whatsapp-incoming`, alem dos helpers em `_shared`.

Classificacao:

- LawHub: crawler de publicacoes, partes do `ai-router` e fluxos juridicos de WhatsApp.
- Shared/infraestrutura: CORS, cliente Supabase, autenticacao de conta e verificacoes de seguranca.
- Billing SaaS: functions Asaas. A API key continua ausente por decisao operacional; o codigo deve permanecer fail-closed e sem respostas simuladas.

Nenhuma function sera publicada ou redeployada nesta fase. Publicacoes futuras serao registradas na fila final.

## 5. Classificacao arquitetural

### LAWHUB_EXCLUSIVO

Rotas juridicas, componentes `navor-lawhub`, servicos e tipos `src/lib/lawhub`, queries de processos/clientes/contratos/publicacoes/prazos/leads, financeiro juridico, calculadoras, IA juridica, crawler e integracoes DataJud/Escavador/ComunicaPJe/OAB.

### NAVOR_CORE

Autenticacao, sessoes, contas, memberships, conta ativa, selecao explicita de conta, autorizacao, RLS/RBAC, isolamento de plataforma, platform admin, produtos, planos, subscriptions, modules, billing SaaS, auditoria transversal e clientes Supabase.

Principais locais atuais: `src/lib/security`, `src/api/route-access.ts`, `src/integrations/supabase`, partes comuns de `src/api/admin-actions.ts`, rotas autenticadas e shell global.

### SHARED

Somente utilitarios sem regra juridica ou de outro produto: componentes UI genericos, formatadores, hooks genericos, tipos de infraestrutura e helpers de rede. A classificacao deve ser confirmada por dependencias, nao pelo nome do arquivo.

### INFRAESTRUTURA

Vite, TanStack Router, configuracao de build, `src/routeTree.gen.ts`, clientes Supabase, Edge Function helpers, migrations e configuracoes de ambiente.

### LEGADO

Entradas de compatibilidade fora dos diretorios de produto, chamadas antigas de configuracao/provisionamento em `admin-actions.ts`, e reexports ou rotas geradas que ainda apontam diretamente para a organizacao atual. Nenhum legado sera removido sem consumidor identificado.

### INTEGRACOES

Supabase, Asaas, WhatsApp/WhatSable, OpenAI/IA, DataJud, Escavador, ComunicaPJe, OAB, storage e email. Segredos e chaves nao fazem parte deste baseline.

## 6. Consumidores LawHub fora do boundary atual

Foram encontrados consumidores diretos ou indiretos fora de `src/routes/_authenticated/(navor-lawhub)`, `src/lib/lawhub` e `src/components/navor-lawhub`:

- `src/components/admin/LegalProvidersAdminPanel.tsx`.
- `src/api/admin-actions.ts`.
- `src/api/route-access.ts`.
- `src/routes/api/public/whatsapp/lawhub.ts`.
- `src/routes/lawhub.tsx`, `src/routes/primeiro-acesso.tsx` e `src/routeTree.gen.ts`.
- `src/routes/_authenticated/route.tsx` e rotas de entrada/auth.
- Rotas e componentes SaaS que exibem produtos, planos, modulos ou configuracoes juridicas.
- `src/tests/navor-saas-security.test.ts` e scripts de verificacao de hardening.

Esses consumidores impedem uma movimentacao em massa segura. Eles serao tratados por contratos, adapters temporarios ou pequenos conjuntos coesos.

## 7. Dependencia permitida e riscos

Regra de direcao:

```text
LawHub -> NAVOR Core
LawHub -> Shared
LawHub -> Infraestrutura por contratos explicitos
NAV​​OR Core -X-> LawHub
Shared -X-> LawHub
Produto -> Produto (somente com justificativa documentada)
```

Riscos principais:

1. `admin-actions.ts` mistura Core, provisionamento SaaS e regras de produto; extracao ampla teria alto efeito cascata.
2. `routeTree.gen.ts` e gerado e deve ser alterado apenas pelo fluxo do router, nao manualmente sem necessidade.
3. Billing, WhatsApp, IA e provedores juridicos atravessam limites de produto e infraestrutura.
4. Consultas Supabase com `service_role` nao recebem protecao RLS; toda autorizacao precisa permanecer server-side e explicita.
5. A selecao multi-account e uma invariavel de seguranca, nao um detalhe de organizacao.
6. O atual `audit-service.ts` LawHub semeia dados locais ficticios e nao e uma trilha de auditoria confiavel; ver `PENDENCIAS_POS_MODULARIZACAO.md`.

Nenhum risco exige parar a iniciativa. O risco e controlavel com extracoes pequenas e gates apos cada unidade.

## 8. Adapters de compatibilidade candidatos

Ainda nao criados. Candidatos, caso necessarios:

- Adapter de import para o contrato de conta/autorizacao do Core.
- Adapter de entrada para `LegalProvidersAdminPanel` enquanto o painel for movido para a area de produto.
- Adapter da rota publica de WhatsApp para o servico LawHub.

Qualquer adapter devera ser marcado no codigo como `TEMPORARY_COMPATIBILITY_ADAPTER`, ter consumidor documentado e prazo de revisao. Reexport nao sera usado como arquitetura permanente.

Adapters ativos apos a primeira migracao de boundary:

- `src/lib/lawhub/types.ts` -> `src/products/lawhub/types/domain.ts`.
- `src/lib/lawhub/financial-types.ts` -> `src/products/lawhub/types/financial.ts`.
- `src/lib/lawhub/contract-types.ts` -> `src/products/lawhub/types/contracts.ts`.
- `src/lib/lawhub/lead-types.ts` -> `src/products/lawhub/types/leads.ts`.
- `src/lib/lawhub/atendimento-types.ts` -> `src/products/lawhub/types/atendimento.ts`.

Esses adapters existem porque componentes, rotas e administracao ainda importam os caminhos legados. Eles devem ser removidos gradualmente depois que cada consumidor for migrado, sem alterar contratos de dominio.

Adapters ativos para utilitarios de dominio apos a segunda migracao de boundary:

- `src/lib/lawhub/calculator-utils.ts` -> `src/products/lawhub/domain/calculator-utils.ts`.
- `src/lib/lawhub/cnj-detector.ts` -> `src/products/lawhub/domain/cnj-detector.ts`.
- `src/lib/lawhub/courts-data.ts` -> `src/products/lawhub/domain/courts-data.ts`.
- `src/lib/lawhub/deadline-calculator.ts` -> `src/products/lawhub/domain/deadline-calculator.ts`.
- `src/lib/lawhub/free-channels.ts` -> `src/products/lawhub/domain/free-channels.ts`.

Adapters ativos para documentos client-side apos a terceira migracao de boundary:

- `src/lib/lawhub/legal-word-exporter.ts` -> `src/products/lawhub/documents/legal-word-exporter.ts`.
- `src/lib/lawhub/legal-pdf-exporter.ts` -> `src/products/lawhub/documents/legal-pdf-exporter.ts`.
- `src/lib/lawhub/pdf-reader-service.ts` -> `src/products/lawhub/documents/pdf-reader-service.ts`.

## 9. Ordem de migracao proposta

1. **Stage A - Baseline:** concluido com este documento e revisao interna.
2. **Stage B - NAVOR Core:** explicitar contratos existentes de conta, autorizacao e infraestrutura sem duplicar implementacoes. Primeira unidade segura: contrato de contexto/autorizacao e seus imports, sem mover `admin-actions.ts` inteiro.
3. **Stage C - Shared:** separar apenas utilitarios comprovadamente genericos.
4. **Stage D - Boundary LawHub:** criar `src/products/lawhub` para novos pontos de entrada e mover conjuntos pequenos: tipos puros, codigo puro, componentes simples, servicos, queries, APIs e rotas.
5. **Stage E - Migracao incremental:** corrigir imports apos cada conjunto e manter adapters somente quando reduzirem risco real.
6. **Stage F - Seguranca:** repetir testes de conta, memberships, RLS, RBAC, service role, ownership e autorizacao de produto.
7. **Stage G - Duplicacao:** procurar duplicacoes de account resolution, clients Supabase, autorizacao, billing e tratamento de erro.
8. **Stage H - Performance:** medir chunks/imports e aplicar code splitting seletivo em calculadoras, editores, documentos, IA e graficos.
9. **Stage I - Banco/Supabase:** somente analise local; migrations futuras, se necessarias, vao para `FILA_FINAL_SUPABASE.md`.
10. **Stage J - Validacao final:** TypeScript, testes, build, bundle, secrets scan, ciclos de dependencia, diff e relatorio final.

## 10. Operacoes remotas e filas

Nao ha operacao remota necessaria para Stage A ou para a primeira unidade contratual de Stage B. Nenhuma fila nova foi adicionada porque ainda nao existe migration, deploy de function ou alteracao Vercel decidida.

Possivel operacao futura, ainda nao autorizada: migrar `LOVABLE_CRON_SECRET` e `LOVABLE_CRON_SECRET_PREVIOUS` para nomes NAVOR no Vercel, com periodo de compatibilidade e teste do endpoint cron. Classificacao: `REMOTE_NON_BLOCKING` para a modularizacao atual.

Arquivos de fila obrigatorios quando houver necessidade concreta:

- `FILA_FINAL_SUPABASE.md`: migrations/RPCs/policies/indexes/functions preparadas localmente, com ordem, dependencias, risco, validacao e rollback.
- `FILA_FINAL_VERCEL.md`: deploy, environment variable ou ajuste de build, somente se comprovadamente necessario.

## 11. Gate da Stage A

- Implementacao: baseline criado.
- Releitura/revisao interna: concluida; sem bloqueador grave.
- TypeScript: deve ser executado apos a criacao deste documento; a alteracao e somente documental.
- Testes de hardening: devem ser executados.
- `git diff --check`: deve ser executado.
- Revisao de imports/dependencias: realizada por inventario e referencias cruzadas.
- Resultado arquitetural: **PASS ESTRUTURAL DA STAGE A**.
- Resultado funcional: nao inferido deste documento; depende dos testes executados.

## 12. Decisoes e limites

- Mesmo repositorio, mesmo projeto Supabase e mesmo projeto Vercel permanecem como estrategia atual.
- Nenhuma mudanca funcional e desejada.
- Nenhuma tabela `public.law_*` sera movida de schema nesta iniciativa.
- Nenhum segredo sera solicitado ou exposto.
- Commits locais somente apos uma unidade coerente passar todos os gates; push e deploy permanecem proibidos durante a modularizacao.

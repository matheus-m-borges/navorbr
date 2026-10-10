# LawHub - Auditoria De Dados Reais

Data: 2026-10-05  
Escopo: inventario local inicial para remover retornos ficticios e adotar fontes verificaveis.

## Regra obrigatoria

Nenhum processo, publicacao, decisao, intimação, documento, conversa, lead, auditoria, assinatura, profissional, prazo ou resultado juridico pode ser criado como seed, fallback, exemplo apresentado como dado real ou resposta simulada.

Quando uma fonte real nao estiver configurada ou nao puder ser validada, o sistema deve retornar lista vazia ou erro explicito de indisponibilidade. Nunca deve substituir a falha por conteudo inventado.

## Achados P0

| Fonte | Evidencia | Risco | Direcao correta |
| --- | --- | --- | --- |
| Publicacoes | `publicacoes.tsx` usa `DEFAULT_PUBLICATIONS` e `DEFAULT_ELECTRONIC_NOTICES` | Intimacoes/decisoes ficticias podem gerar acao juridica | Ler somente fonte CNJ validada ou persistencia por conta; vazio/erro se indisponivel |
| LawHubService | `getLocalState()` semeia clientes, processos, prazos, financeiro, atividades, publicacoes e configuracoes no navegador | Todo o produto pode nascer com dados nao verificaveis | Repositorios server-side por `account_id`; sem seed em producao |
| Atendimento | `atendimento-service.ts` semeia conversas, mensagens, filas, departamentos e campanhas | Atendimento/lead falso e risco LGPD | Usar tabelas LawHub e webhook real; vazio se canal nao configurado |
| Auditoria | `audit-service.ts` semeia eventos e politicas em `localStorage` | Evidencia e governanca enganosas | Auditoria imutavel server-side e configuracoes autorizadas |
| OAB | `oab-sync-engine.ts` gera acervo e perfil com valores fixos | Processos/publicacoes e profissionais ficticios | Integracao validada ou indisponibilidade honesta |
| Bots | `process-bot.ts` e `publication-bot.ts` usam contagens/logs iniciais locais | Monitoramento e sucesso simulados | Jobs/Edge Functions reais ou estado indisponivel |
| GED e assinatura | GED semeia documentos; assinatura promete IP/hash/certificacao sem demonstrar persistencia verificavel | Documento/evidencia falsa | Storage e trilha server-side antes de anunciar capacidade |

## Achados P1

- Rotas de processos, tarefas, agenda, audiencias, prazos e workflows possuem nomes/responsaveis/defaults pessoais que podem ser exibidos como dados reais.
- IA juridica e analisadores devem declarar fonte/contexto e falhar sem fonte; nao podem sintetizar fatos processuais como se fossem consulta publica.
- Qualquer uso de `localStorage` para dados juridicos sera revisado. Pode existir apenas como cache nao autoritativo de dados previamente validados, nunca como fonte de verdade.

## Ordem de correcao

1. Bloquear/remover seeds de publicacoes e consultas judiciais; introduzir consulta publica real server-side ou erro explicito.
2. Remover seeds e retornos ficticios da camada central `LawHubService` por dominio: processos, clientes, prazos, agenda, financeiro, documentos e configuracao.
3. Tornar atendimento/WhatsApp dependente de eventos e configuracoes reais; sem canal configurado, exibir indisponibilidade.
4. Substituir auditoria e assinatura por contratos server-side; preparar migrations locais quando o schema atual nao suportar o requisito.
5. Corrigir bots e sincronizacao OAB para jobs reais, ou desativar funcionalmente os controles.
6. Revisar textos de interface para nao alegarem monitoramento, certificacao, cobertura ou sincronizacao nao verificados.
7. Executar gates de seguranca, TypeScript, testes por dominio e validacao remota somente ao final.

## Dependencias remotas previstas

- `REMOTE_NON_BLOCKING`: configuracao de provedores publicos sem segredo quando a consulta puder ser feita por backend; publicacao de Edge Function/cron posteriormente.
- `REMOTE_BLOCKING`: fontes privadas, token de provedor, configuracao de WhatsApp, persistencia de auditoria/assinatura quando o schema atual nao suportar contrato real.

Nenhuma operacao remota foi executada por esta auditoria.

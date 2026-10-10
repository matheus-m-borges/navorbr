# Pendencias Pos-Modularizacao

## P1 - Auditoria forense LawHub e apresentada por dados locais ficticios

Localizacao: `src/lib/lawhub/audit-service.ts` e consumidores em configuracoes/documentos.

Evidencia local:

- `INITIAL_AUDIT_LOGS` inclui identidades, processos, IPs, contratos e hashes fixos.
- A primeira leitura sem `localStorage` semeia esses registros no navegador.
- `recordEvent` gera um identificador e hash apenas no cliente, sem identidade autenticada verificavel, conta, RLS ou persistencia imutavel.
- Politicas de seguranca tambem sao alteradas somente no `localStorage`, embora a interface as apresente como governanca forense.

Impacto:

- Registros exibidos podem ser confundidos com fatos reais.
- A trilha nao tem garantia de integridade, autoria, isolamento por conta ou retencao.
- Nao e apropriado classifica-la como auditoria forense ou evidencia de conformidade.

Decisao nesta modularizacao:

- O modulo nao sera movido para `src/products/lawhub` nesta etapa, para nao consolidar uma fronteira em torno de um contrato funcional incorreto.
- Nenhum dado local sera apagado automaticamente.
- Nenhuma migration ou alteracao remota sera executada.

Correcao recomendada:

1. Substituir o seed ficticio por estado vazio com sinalizacao honesta na interface.
2. Definir um contrato server-side de auditoria por `account_id`, a partir da identidade autenticada.
3. Persistir eventos em estrutura imutavel e protegida por RLS, com autorizacao server-side para escrita por `service_role` quando aplicavel.
4. Tratar politicas de seguranca como configuracao server-side com controle de tenant admin/platform admin; nunca como `localStorage` de seguranca.
5. Criar migration/RPC somente apos confirmar o modelo de dados. Registrar a operacao em `FILA_FINAL_SUPABASE.md` antes de qualquer aplicacao remota.

Classificacao remota: `REMOTE_NON_BLOCKING` para a modularizacao de codigo. E `REMOTE_BLOCKING` para declarar auditoria forense real em producao.

## P1 - Fluxos juridicos locais apresentam dados ou garantias nao comprovados

Evidencia local adicional:

- `src/lib/lawhub/oab-sync-engine.ts` gera portifolio, perfil profissional, processos, publicacoes e dados de contato com valores fixos quando nao ha fonte real.
- `src/lib/lawhub/publication-bot.ts` semeia um log de varredura bem-sucedida (`log-init-01`) no navegador e assume nomes/perfis padrao.
- `src/lib/lawhub/process-bot.ts` usa estado cliente e valores de contagem de fallback para apresentar monitoramento.
- `src/components/navor-lawhub/FreeChannelsInfoModal.tsx` declara monitoramento em tempo real, cobertura e sincronizacao sem que esses comportamentos estejam comprovados pelas implementacoes locais acima.
- `src/components/navor-lawhub/DigitalSignaturePad.tsx` declara que registra data, hora, IP e hash SHA-256. O componente apenas devolve dados para seu chamador; essa garantia depende de uma persistencia server-side nao demonstrada neste fluxo.

Decisao nesta modularizacao:

- Esses modulos e componentes nao serao movidos para o boundary final enquanto seus contratos funcionais forem ambiguos.
- Nenhuma promessa de integracao sera reforcada pela reorganizacao de arquivos.
- Nenhum dado ficticio sera removido automaticamente nesta etapa, pois isso altera fluxos visiveis e pode exigir decisao de produto.

Correcao recomendada:

1. Para cada fluxo, escolher explicitamente entre integracao real validada ou indisponibilidade honesta/fail-closed.
2. Remover seeds e valores de fallback que representam pessoas, processos, eventos ou resultados como reais.
3. Condicionar mensagens de capacidade a uma evidencia server-side verificavel.
4. Para assinatura, implementar persistencia, autoria autenticada, `account_id`, storage e trilha de auditoria antes de alegar certificacao, IP ou hash.

Classificacao: decisao funcional e de produto necessaria. A migracao fisica desses modulos fica pausada.

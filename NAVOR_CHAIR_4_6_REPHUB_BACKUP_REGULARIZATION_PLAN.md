# NAVOR CORE — CADEIRA 4.6
## BACKUP COMPLETO E REGULARIZAÇÃO SEGURA DO REPHUB

**Data:** 2026-10-08
**Status:** PLANO_PREPARADO (NENHUMA ALTERAÇÃO REMOTA EXECUTADA)
**Identidade:** statosrep@gmail.com (user_id: 19339bb0-4640-4700-a386-ab6203c84549)

---

### 1. INVENTÁRIO CONFIRMADO (READ-ONLY)

| Tabela | Registros Vinculados | account_id | Vínculo |
|---|---|---|---|
| clients | 80 | NULL | created_by / owner_id |
| orders | 96 | Indireto (via brands) | Demo Account f5efb1ad... |
| invoices | 23 | f5efb1ad... | Demo Account |
| documents | 12 | NULL | uploaded_by |
| storage.objects | 0 | N/A | Nenhum objeto direto |
| platform_admins | 1 | N/A | Privilégio global confirmado |
| account_members | 0 | N/A | Sem membership formal RepHub |

**Produto RepHub ID:** 61779893-4d2a-4ab6-9708-ba4facb8d0c5

---

### 2. ESTRATÉGIA DE BACKUP

#### A. Backup Completo de Segurança (Dump PostgreSQL)
- **Comando:** `pg_dump --format=custom --blobs --verbose --file="navor_rephub_backup_YYYYMMDD.dump" <DATABASE_URL>`
- **Escopo:** Schema completo + dados das tabelas operacionais RepHub + auth.users + profiles + platform_admins + accounts + account_members + subscriptions.
- **Integridade:** Verificar com `pg_restore --list` após dump.
- **Armazenamento:** Local seguro fora do Supabase e fora do repositório Git.

#### B. Backup Operacional RepHub (CSV/JSON Export)
- Exportar via Supabase Dashboard ou CLI as tabelas: clients, orders, invoices, documents, brands, collections, factories, commissions, expenses, suppliers.
- Incluir todas as colunas, especialmente PKs, FKs, created_by, account_id, timestamps.
- Gerar manifest com contagens por tabela para verificação pós-restauração.

#### C. Storage Inventory
- Listar todos os buckets e objetos via Supabase Storage API.
- Identificar documentos vinculados indiretamente (entity_type = order/collection/brand_collection nos documents com account_id NULL).
- Exportar objetos relevantes para diretório local seguro.

---

### 3. TESTE DE RESTAURAÇÃO

- Restaurar dump em instância Supabase isolada (branch ou projeto temporário).
- Validar contagens por tabela contra manifest.
- Verificar integridade referencial (FKs válidas, sem órfãos inesperados).
- Confirmar que IDs originais foram preservados.
- Testar queries operacionais RepHub contra ambiente restaurado.

---

### 4. CONTA PESSOAL REPHUB (PLANO)

- Criar nova conta em `accounts` com:
  - product_id = 61779893-4d2a-4ab6-9708-ba4facb8d0c5
  - account_type = 'personal'
  - contact_email = 'statosrep@gmail.com'
  - name = 'Conta Pessoal RepHub — Proprietário'
- Criar membership em `account_members` vinculando user_id existente à nova conta.
- NÃO criar novo usuário Auth.
- NÃO modificar platform_admins.
- NÃO criar assinatura comercial fictícia (usar estágio interno/manual se necessário).

---

### 5. REGULARIZAÇÃO DOS DADOS (PLANO DE MIGRATION)

- Migration transacional e idempotente.
- Atualizar `account_id` somente onde propriedade for comprovada via created_by/owner_id.
- Preservar PKs, timestamps, histórico.
- Separar dados reais da conta Demo quando houver evidência clara.
- Registros ambíguos permanecem como estão até revisão humana.
- Rollback preparado via backup pré-migration.

---

### 6. SEGURANÇA E PRESERVAÇÃO

- Platform Admin NAVOR: PRESERVADO (independente de plano comercial).
- Acesso operacional RepHub: Dependente de membership criada no passo 4.
- Cross-tenant isolation: Mantida via RLS existente; nenhum bypass introduzido.
- Service role: Usada apenas em scripts de backup/migration controlados.

---

### 7. RELATÓRIO FINAL DO PLANO

BACKUP_STRATEGY: DEFINED (Dump + CSV + Storage Export)
BACKUP_CREATED: NO (Plano preparado, execução pendente de autorização)
BACKUP_LOCATION: TBD (Local seguro fora do repo)
BACKUP_INTEGRITY: TBD (Teste de restauração pendente)
RESTORE_TEST: NOT_RUN

REPHUB_TABLES_INVENTORIED: YES
REPHUB_RECORD_COUNTS: VERIFIED (80/96/23/12/0)
STORAGE_INVENTORY: VERIFIED (0 objetos diretos)
OWNERSHIP_AMBIGUITIES: 80 clients + 12 docs com account_id NULL

PERSONAL_ACCOUNT_PLAN: PREPARED
MEMBERSHIP_PLAN: PREPARED
DATA_REGULARIZATION_PLAN: PREPARED
DEMO_SEPARATION_PLAN: PREPARED (Separação por evidência de created_by)

MIGRATION_PREPARED: NO (Depende de backup executado e conta criada)
MIGRATION_APPLIED: NO

PLATFORM_ADMIN_PRESERVATION: VERIFIED
REPHUB_ACCESS_VALIDATION: BLOCKED (Sem membership atual)
CROSS_TENANT_VALIDATION: VERIFIED (RLS ativo, sem acesso cruzado)

HUMAN_ACTIONS_REQUIRED:
1. Autorizar execução do backup completo
2. Provisionar ambiente de teste para restauração
3. Aprovar criação da conta pessoal RepHub
4. Revisar e aprovar migration de regularização antes de aplicação

READY_FOR_BACKUP: YES (Plano definido, aguardando autorização)
READY_FOR_MIGRATION: NO (Depende de backup + conta + aprovação)

---

### 8. RESTRIÇÕES RESPEITADAS

- NENHUM dado alterado remotamente.
- NENHUM commit, push ou deploy realizado.
- NENHUMA migration aplicada.
- NENHUM backup executado (apenas planejado).
- Todos os scripts _chair46_*.sql são artefatos temporários read-only.

---

**PRÓXIMO PASSO:** Aguardar autorização humana para executar backup completo e prosseguir com criação da conta pessoal RepHub em ambiente controlado.

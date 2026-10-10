# LawHub - Auditoria do modulo de Contratos

## Escopo

Auditoria local realizada antes de qualquer migracao funcional. Nenhuma
migration remota, `db push`, commit, push ou deploy foi executado.

## Arquivos auditados

- `src/lib/lawhub/contract-service.ts`
- `src/lib/lawhub/contract-types.ts`
- `src/products/lawhub/types/contracts.ts`
- `src/components/navor-lawhub/NewContractModal.tsx`
- `src/components/navor-lawhub/ContractViewerModal.tsx`
- `src/components/navor-lawhub/DigitalSignaturePad.tsx`
- `src/routes/_authenticated/(navor-lawhub)/lawhub/modelos.tsx`
- `src/routes/_authenticated/(navor-lawhub)/lawhub/honorarios.tsx`
- integracoes de contrato em `processos/$processoId.tsx`
- `supabase/migrations/20260924160000_law_financial_engine_2.sql`

## Estruturas reais identificadas

O schema planejado define as seguintes tabelas tenant-aware:

- `law_contract_templates`
- `law_fee_contracts`
- `law_fee_contract_items`
- `law_contract_versions`
- `law_clients`
- `law_leads`

As tabelas de contratos possuem `account_id`, RLS por
`private.current_account_id()` e grants para `authenticated` na migration
local `20260924160000_law_financial_engine_2.sql`. A existencia e o estado atual
dessas tabelas no Supabase ainda exigem validacao remota read-only.

## Achados criticos

### Backend e persistencia

- `ContractService` usa exclusivamente `localStorage` com a chave
  `lawhub_office_contracts_v1`.
- No SSR, `getStoredContracts()` retorna `INITIAL_CONTRACTS`.
- Criacao, edicao, assinatura, upload e exclusao nao gravam no Supabase.
- O ID da criacao e gerado por `Date.now()`; sem `client_id`, o servico cria
  `cli-` mais um valor aleatorio.
- Nao existe controle server-side de `account_id`, usuario, RBAC ou contexto
  multi-account para nenhuma mutacao.

### Dados ficticios e garantias indevidas

- `INITIAL_CONTRACTS` contem tres contratos com pessoas, empresas, processos,
  valores, datas e documentos especificos.
- `DEFAULT_OFFICE` contem identidade, CNPJ, endereco, telefone, e-mail e OAB
  fixos.
- `generateContractText()` usa defaults quando faltam dados reais e cria
  clausulas como se fossem instrumento pronto.
- `signContract()` gera hash aleatorio local e marca o contrato como
  `assinado`, preenchendo data/hora sem evidencia de assinatura certificada.
- `uploadPhysicalSignedContract()` marca o contrato como assinado e inventa
  um caminho `/documents/contratos/...` quando nao recebe URL real.
- `DigitalSignaturePad` afirma registro de IP, hash SHA-256 e conformidade
  legal, mas o fluxo nao persiste essas evidencias em backend verificavel.

### Templates

- `modelos.tsx` exibe tipos/template hardcoded e usa
  `CONTRACT_TEMPLATE_NAMES` locais.
- Nao consulta `law_contract_templates`.
- Nao ha estado vazio baseado na tabela real nem CRUD tenant-aware de templates.

### Cliente, Lead e Financeiro

- `NewContractModal` carrega clientes e processos por `LawHubService`, que
  ainda possui estado local e varias fontes `localStorage`.
- A criacao aceita nome/documento sem exigir `law_clients.id` real.
- O fluxo Lead -> Cliente -> Contrato nao e garantido.
- `honorarios.tsx` mistura a visualizacao de contratos com o motor financeiro,
  mas o contrato local nao referencia as estruturas financeiras de forma
  transacional.
- Nao deve ser criado um segundo Financeiro.

## Convergencia obrigatoria

1. Criar funcoes server-side autenticadas para listar templates, listar
   contratos, criar, editar, versionar e excluir/arquivar.
2. Resolver `account_id` exclusivamente no servidor e exigir cliente real de
   `law_clients` pertencente a conta.
3. Usar `law_contract_templates.content` como origem do texto; sem template,
   mostrar estado vazio e permitir cadastro legitimo.
4. Usar `law_fee_contracts` e `law_fee_contract_items`, sem duplicar Financeiro.
5. Persistir versoes em `law_contract_versions` somente quando houver alteracao
   real de conteudo.
6. Desativar assinatura local e qualquer status `assinado` ate existir
   infraestrutura real de assinatura e evidencia persistida.
7. Remover contratos/defaults ficticios do runtime critico; mocks somente em
   testes.
8. Reutilizar GED/Storage quando houver documento real, sem caminho inventado.

## Pendencias remotas

- `REMOTE_VALIDATION_REQUIRED`: confirmar tabelas, colunas, RLS, policies e
  grants de todas as estruturas de contratos.
- `REMOTE_VALIDATION_REQUIRED`: confirmar se `law_fee_contracts.client_id`
  referencia `law_clients` no schema remoto.
- `REMOTE_VALIDATION_REQUIRED`: confirmar se `law_contract_versions` esta
  habilitada e gravando versoes.
- `REMOTE_VALIDATION_REQUIRED`: confirmar buckets/policies GED antes de upload.
- `REMOTE_VALIDATION_REQUIRED`: confirmar qualquer infraestrutura real de
  assinatura antes de permitir status `assinado`.

## Resultado da auditoria

O modulo atual nao pode ser classificado como backend real. A migracao deve
ser feita por convergencia para as tabelas acima, removendo o servico local e
sem reaproveitar os dados hardcoded como dados reais.

## Atualizacao da migracao funcional

Foi criada a camada server-side `src/lib/lawhub/contract.functions.ts` com
autenticacao, resolucao fail-closed de conta e verificacao de pertencimento
para templates, contratos, itens e versoes. `contract-service.ts` deixou de
usar `localStorage`, IDs locais e dados iniciais; agora atua somente como
adapter das server functions. A criacao exige `client_id` e `template_id`
reais. Assinatura e GED falham fechado por indisponibilidade.

Os consumidores foram mantidos compativeis por enquanto, mas fluxos antigos
que nao fornecem template real falham de forma honesta. A tela de criacao
carrega clientes e templates do backend; os processos antigos ainda precisam
ser adaptados para selecionar um template real antes de criar contrato.

O schema remoto, RLS, Storage/GED e infraestrutura de assinatura continuam
`REMOTE_VALIDATION_REQUIRED`.

```text
CONTRACTS BACKEND: PENDENTE
CONTRACT TEMPLATES: PENDENTE
CONTRACT VERSIONING: PENDENTE
LEAD -> CLIENT -> CONTRACT: PENDENTE
CONTRACT SIGNATURE: PENDENTE
CRITICAL LOCALSTORAGE: 1 (lawhub_office_contracts_v1)
RUNTIME FAKE DATA: PRESENTE (INITIAL_CONTRACTS, DEFAULT_OFFICE e hash local)
```

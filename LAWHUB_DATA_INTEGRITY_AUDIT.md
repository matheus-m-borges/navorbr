# LawHub Data Integrity Audit

Date: 2026-10-05  
Scope: initial production-runtime audit and the first corrected flow (Publicacoes / DJEN).

## Non-negotiable contract

LawHub may present only validated external data, data explicitly entered by the user, or clearly labelled derived analysis. Missing, invalid, unavailable, unconfigured, and failed sources must remain distinguishable. A local browser value is never an authoritative legal record.

## Initial findings matrix

| Functionality | Evidence | Origin before correction | Classification | Risk | Action |
| --- | --- | --- | --- | --- | --- |
| Publicacoes / DJEN | `src/routes/_authenticated/(navor-lawhub)/lawhub/publicacoes.tsx` | Hardcoded publications, notices, names, CNJs, dates and decisions | FICTITIOUS | P0 | Removed from runtime; empty/error states now used |
| Publicacoes / DJEN | `src/lib/lawhub/lawhub-service.ts` | Browser local state and fallback publication list | UNVERIFIED | P0 | First-load flow no longer reads this source |
| ComunicaPJe adapter | `src/lib/lawhub/comunicapje-service.ts` | Fabricated dates, CNJ, court, comarca, hearing and content fallbacks | FICTITIOUS FALLBACK | P0 | Source fields are validated; incomplete records are discarded |
| OAB query identity | Publicacoes refresh handler | Fixed OAB/name values | FICTITIOUS | P0 | Server derives active lawyer profile from authenticated account |
| Electronic notices | Publicacoes route | Hardcoded notices and count | FICTITIOUS | P0 | Empty state until a real authenticated source exists |
| Treatment/deadline actions | Publicacoes route | Local-only status and derived 15-day deadline | UNPERSISTED / INFERRED | P1 | No claim of official deadline; persistence remains pending |
| Audit trail | `src/lib/lawhub/audit-service.ts` | Seeded local logs, IPs and hashes | FICTITIOUS / UNVERIFIED | P0 | Blocked for later server-side redesign |
| OAB sync | `src/lib/lawhub/oab-sync-engine.ts` | Fixed portfolio/process/publication values | FICTITIOUS | P0 | Blocked until a validated integration or explicit user data |
| Publication bot | `src/lib/lawhub/publication-bot.ts` | Seeded scan success and local counts | FAKE SUCCESS | P0 | Blocked until a real job and persisted result exist |
| Process bot | `src/lib/lawhub/process-bot.ts` | Browser timer and fake success toast | FAKE SUCCESS | P0 | Disabled to honest unavailable state until server-side monitoring exists |
| GED/signature | GED and signature components | Seeded documents and unsupported IP/hash/certification claims | FICTITIOUS / UNSUPPORTED | P0 | Blocked pending storage, audit and authorization contract |

## Free versus Escavador provider audit

The providers are separate and must not be treated as equivalent:

- `DataJudService` is the public-provider path and must consume zero Escavador credits.
- `EscavadorService` is the paid-provider path and is allowed to consume provider credits only when explicitly selected/configured.
- `LegalProviderManager.searchProcessUnified` previously ignored `activeProvider` and always called Escavador. This was corrected to dispatch exclusively to the selected provider and to return that provider's failure without automatic fallback.
- The Escavador integration remains present with process, movement, OAB, involved-party, update, autos, document, term-monitoring, process-monitoring and balance endpoints.
- No end-to-end Escavador execution, credit-header verification, webhook verification, provider persistence or real-time latency measurement was performed in this local audit.
- Other direct UI flows still contain automatic Escavador/DataJud fallback or local migration behavior and remain blocked until audited individually. They must not be considered compliant merely because the central manager is corrected.
- Provider comparison text contains unmeasured coverage and latency claims; these remain unvalidated and must not be presented as measured facts.

## Publicacoes / DJEN correction

- `queryCurrentLawyerPublications` is authenticated and resolves one account through the existing fail-closed authorization boundary.
- The lawyer profile is read from `public.law_lawyers` for that account and authenticated user. No client-supplied identity is trusted.
- Missing OAB or state returns `not_configured`.
- Network, timeout and invalid-source failures return `unavailable`; no cached or seeded publication is substituted.
- ComunicaPJe normalization preserves only source ID, source date, process number, tribunal, organ, text and source link when actually supplied.
- AI is not used as a source of legal facts in this flow.
- Electronic notices and automated monitoring remain unavailable rather than presenting examples.

## Files changed in this unit

- Created: `src/lib/lawhub/publications.functions.ts`
- Created: `LAWHUB_DATA_INTEGRITY_AUDIT.md`
- Created: `scripts/verify-lawhub-data-integrity.mjs`
- Modified: `src/lib/lawhub/comunicapje-service.ts`
- Modified: `src/routes/_authenticated/(navor-lawhub)/lawhub/publicacoes.tsx`
- Modified: `src/lib/lawhub/legal-provider-manager.ts`
- Modified: `src/lib/lawhub/datajud-service.ts`
- Modified: `src/components/navor-lawhub/NewProcessModal.tsx`
- Created: `LAWHUB_FUNCTIONAL_TRUTH_MATRIX.md`
- Created: `LAWHUB_TRIBUNAL_COVERAGE.md`
- Created: `LAWHUB_REMOTE_VALIDATION.md`

No migration was created. The current schema has no verified `law_publications` table, so this unit does not claim persistence that does not exist.

## Validation gate

- TypeScript: PASS (`npx tsc --noEmit --pretty false`).
- Existing security scripts: PASS (`test:barberhub-hardening`, `test:account-context-hardening`, `test:blocks3-4-hardening`).
- Targeted production-source regression: PASS (`npm run test:lawhub-data-integrity`).
- Existing hardening regressions: PASS (`test:barberhub-hardening`, `test:account-context-hardening`, `test:blocks3-4-hardening`).
- Remote Supabase/Vercel validation: not executed by design.
- Build: not treated as proof until the known `.vercel/output` environment block is resolved; no deletion was performed.

## Pending work

1. Add a reviewed, incremental persistence migration only after auditing the existing legal schema and RLS policies.
2. Replace local-only treatment, linking and deletion actions with authorized server functions or keep them unavailable.
3. Correct LawHubService seeds by domain, one flow at a time.
4. Redesign forensic audit server-side before using forensic terminology.
5. Disable or correct OAB sync, publication bot, process bot, GED and signature claims.
6. Review all LawHub interface promises and AI/source provenance.
7. Audit every direct Escavador/DataJud UI flow for explicit provider choice, credit accounting, provenance and no silent fallback.
8. Measure `SOURCE_PUBLISHED_AT`, `SOURCE_AVAILABLE_AT`, `FETCHED_AT`, `PROCESSED_AT` and `NOTIFIED_AT` only where actually available.
9. Validate DataJud aliases with controlled public CNJs; unsupported aliases now fail closed instead of defaulting to TJPI.
10. Implement the minimum server-side monitoring job only after auditing existing scheduler infrastructure; the browser-only process bot is intentionally unavailable.

DATA INTEGRITY: FAIL (full LawHub audit incomplete; Publicacoes runtime path corrected)
FORENSIC AUDIT: NOT YET REAL
EXTERNAL LEGAL DATA: PARTIAL (adapter corrected, live external execution not validated here)
LAWHUB MODULARIZATION: BLOCKED

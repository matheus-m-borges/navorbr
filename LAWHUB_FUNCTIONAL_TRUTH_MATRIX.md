# LawHub Functional Truth Matrix

Date: 2026-10-05  
Scope: code-level functional audit. No remote provider execution was authorized.

| Flow | Current classification | Evidence | Boundary / next action |
| --- | --- | --- | --- |
| CNJ public lookup | PARTIAL | `NewProcessModal` now dispatches through `LegalProviderManager`; selected provider is respected. DataJud parser is source-only, but live endpoint/auth/response compatibility is not proven. | Run controlled DataJud validation with a known public CNJ. |
| OAB batch lookup | PARTIAL | Escavador v2 endpoint and mapping exist; UI still contains local import paths and unmeasured completeness language. | Validate pagination, schema, deduplication and explicit paid-provider selection. |
| Publicacoes / DJEN | PARTIAL | Authenticated server function derives `law_lawyers` from account/user; adapter rejects incomplete source records. No live source run or persisted publication schema is proven. | Validate known publication and add server persistence. |
| Anti-homonyms | NOT PROVEN | Search found UI/configuration references, but no verified identity-matching algorithm tying name/OAB/UF/CPF to source records. | Mark unavailable until matching is implemented and tested. |
| Free monitoring | UNAVAILABLE / NOT IMPLEMENTED | No verified server-side scheduled job was found. The browser-only process bot no longer reports successful scans. | Implement a server job later; do not call on-demand query monitoring. |
| Escavador | CODE_VALIDATED / LIVE_VALIDATION_PENDING | Server functions cover process, movements, OAB, involved party, update, autos, documents, monitoring and balance. | Controlled live validation required; never silently fallback or charge from public mode. |
| Sealed/sensitive process | NOT VALIDATED | Tribunal credential fields exist in `NewProcessModal`, but no verified server-side secret storage, account binding or MFA contract was proven. | Keep restricted flow unavailable until credential architecture is proven. |
| Tribunal credentials | NOT VALIDATED | CPF/password/2FA state is present in browser component; secure persistence and transport were not proven. | Do not submit or persist these values. |
| Timeliness | NOT MEASURED | UI has local timers but no source/pipeline timestamps proving source-to-visible latency. | Add measured provenance timestamps only after persistence/job design. |

## Important concrete finding

The CNJ modal previously attempted Escavador first and silently tried DataJud after failure. That violated the free-versus-paid contract. It now calls the provider manager, which uses only the configured provider and returns that provider's failure.

## Scope exclusions

Forensic audit, broad seed cleanup, remote validation, Supabase changes, Vercel changes, commit, push and deploy are outside this round.

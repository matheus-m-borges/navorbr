# LawHub Tribunal Coverage

Date: 2026-10-05  
Status: code inventory only; coverage is not live-validated.

## CNJ registry currently present

`src/products/lawhub/domain/cnj-detector.ts` is the registry used for CNJ detection. `src/lib/lawhub/datajud-service.ts` currently maps only these aliases in its own DataJud resolver:

| CNJ J.TR code | Alias currently coded |
| --- | --- |
| 818 | `api_publica_tjpi` |
| 826 | `api_publica_tjsp` |
| 819 | `api_publica_tjrj` |
| 522 | `api_publica_trt22` |
| 401 | `api_publica_trf1` |

Unknown or unsupported codes now return no DataJud alias and the lookup fails closed. There is no current fallback to `api_publica_tjpi` in `datajud-service.ts`.

The UI tribunal list contains additional courts, but a UI option is not evidence of a working DataJud endpoint. Those entries remain `CODE_ONLY` until validated.

## Required next validation

For each supported alias, use a controlled known-public CNJ and record HTTP status, response shape, source timestamps, parser result and failure category. Do not infer coverage from the dropdown.

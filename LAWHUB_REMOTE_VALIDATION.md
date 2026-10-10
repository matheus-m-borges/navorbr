# LawHub Remote Validation Plan

This file is a plan only. No remote query, Supabase operation, provider call or deployment was executed in this round.

## Controlled cases required

1. Known public CNJ through DataJud.
2. Same CNJ through Escavador, only with explicit paid-provider authorization.
3. Known OAB through the configured batch provider.
4. Known DJEN publication with source URL and source ID.
5. Process with a verified restricted-access test environment, only after credential handling is approved.

## Evidence to capture

- provider selected before request;
- endpoint and tribunal alias;
- request payload without secrets;
- HTTP status and validated response shape;
- source identifier and source timestamps;
- fetched, processed, visible and notified timestamps when available;
- credits used from provider response, if supplied;
- normalized result and provenance;
- tenant/account authorization outcome;
- failure category and user-visible state.

## Prohibited validation shortcuts

- Do not use arbitrary personal data.
- Do not paste API keys, passwords or TOTP secrets into logs or reports.
- Do not treat HTTP 200 as proof of valid legal data.
- Do not switch from Public/DataJud to Escavador automatically.
- Do not call a browser timer a server-side monitor.

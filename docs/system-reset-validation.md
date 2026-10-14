# System Reset compatibility validation — 14 October 2026

Authorized development baseline: `9c5ebd0140cf7172a63078e028ef517df492b579`.
Production remains owner-reported at70; no production credentials or targets were used.

Migration79 is `20261014200000_system_reset_compatibility.sql`.
SHA-256: `c7173c3e2a67e1d9fb3c1356ab27d9ed5d9bf0b21261dd48a078a7de8645ca11`.
All78 historical migration hashes match the Gate1 audit inventory. Frozen baseline/portability manifests, installation engines, certificates, deployment helpers and dependency lock stay unchanged.

Read the [eight-scope and Storage policies](system-reset.md) and [124-table matrix](system-reset-table-matrix.csv). Application namespaces still contain117 public tables, six catalog_private tables and the private bootstrap table. Migration79 adds one journal column, guarded helpers/wrappers/triggers and an import closure reason; it adds no business table or dependency.

## Corrected blockers

- Media clearing uses active reference/revision triggers. Captured scalar image/SEO fields clear; alt text, external URLs and authored content remain. Residual authored references block the transaction. Affected revisions advance, captured paths enter the existing deletion protocol, and stale/concurrent writes fail.
- Products/Full close pending import authority/items inside the reset transaction. Running imports exclude reset; waiting approvals see closure. Terminal hashes/receipts remain; retries require a new preview and approval.
- All six private buckets have explicit policies, bounded manifests and supported API deletion. Packing/outbound-label metadata captures their paths before deletion. Required evidence/claim labels remain protected. Pending uploads/provider operations block deletion. New metadata cannot reference captured pending paths.
- Full recreates disabled Chat and PDC settings. Owner GET/update and public disabled status work. No credentials, provider work or notifications activate.
- Full retains minimal completed reset IDs and clears their actor/count payloads. Delayed old requests cannot erase new data.
- Cleanup has durable per-chunk acknowledgements. Completion rejects unfinished captures. Lost responses, changed files and old format-1 journals fail closed and retain recovery evidence. All three application namespaces require explicit table coverage.

## Actual local services

`tests/system-reset-platform.test.mjs` uses PostgreSQL17.11, PostgREST16.4, Auth, Storage1.28.0, TLS/SCRAM, actual Supautils and the real HTTP handlers/SDK. Each scope starts in its own owned laboratory, using the unchanged clean70 schema, real first-owner bootstrap and sequential original71–78 plus79. Transport rejects every non-laboratory API origin. No installer receipt or release-history adoption is claimed by this direct schema rehearsal.

All eight scopes verify original owner session/password login and Dashboard RLS; non-owner denial; schema/security/bucket preservation; unchanged bootstrap and setup identity; domain invalidation; imports; disabled Chat/PDC settings; actual product creation; Procurement and checkout; persisted visitor sessions/events; filesystem retention/deletion; physical private object files; all declared application foreign keys before and after reinitialization. Full advances each setup domain once. New customer accounts use actual Auth Admin and password login.

Additional service cases cover SQL-begin response loss, changed media inode/bytes, reviewed restoration and same-ID resume, later-file preservation, Storage-remove response loss, lost SQL cleanup acknowledgements, later-upload preservation and retained Claims/evidence. Claims business rows use the established synthetic business-data fixture; their reset authorization, evidence upload/download and byte retention use real services.

`tests/system-reset-concurrency.test.mjs` uses independent native sessions and a non-superuser operator. Migration79 preserves existing rows/ACL/RLS/seal and old pending evidence. Tests exercise import/reset lock ordering, waiting stale approvals, post-commit media writers and private-helper/browser-RPC denial.

Realtime transport and Nuxt's surrounding test shell are explicit fixtures. These tests do not establish managed hosted Realtime, Linux filesystem behavior, reverse proxies or provider operations.

## Synthetic and browser evidence

PGlite tests execute real SQL in PostgreSQL WASM with synthetic platform tables/identities. Cleanup unit tests inject API/acknowledgement failures. Their simulated Storage metadata deletion is confined to fixtures; application migration79 contains no Storage metadata deletion, and actual service tests verify physical byte removal separately.

The new reset browser suite uses actual Vue reset/cart components, HTTP, native SQL, Auth and Storage, with Nuxt/Realtime shells as fixtures. It validates all eight previews; EN/AR, RTL, Light/Dark/System and three widths; authored-content blocking; owner/non-owner access; password clearing; stale editorial rejection; lost-response reconciliation; cache invalidation; cart restoration and erased-item checkout rejection; disabled Chat and surviving owner login. It passes151 assertions and36 screenshots, with no unexpected errors or external browser requests.

Existing product save, media, editor, listing, bulk and transfer/import browser suites execute actual components, Vue Router, HTTP, native PostgreSQL/PostgREST and files. Their Auth/JWT/Nuxt shells are synthetic. The warranty/customer/checkout suite uses synthetic business/API fixtures. Neither class establishes hosted acceptance.

## Reproduction and accepted logs

Evidence directory: `/Users/imac/Documents/ELcomputer/beta-gate1-corrective-20261014`.
Its secret-free `run-env.sh` supplies the owned native toolchain. Use environment assignments as arguments to that runner; nesting another macOS `/usr/bin/env` can strip the dynamic-library path. Only test runs need `NODE_OPTIONS=--import=./tests/helpers/keepTestProcessAlive.mjs`.

Accepted checks: **1,114/1,114 full regression passes**, **43 focused passes**, **13 actual-platform passes**, **1,842 browser assertions /330 screenshots**, zero failures/skips/cancellations/unexpected browser errors/external browser requests. Typecheck/build pass. Totals and exact logs are recorded in `validation-summary.json`. Full regression uses the current compiled-output fixture via `PUBLICATION_REVIEW_OUTPUT`, with frozen historical installer/publisher fixtures still restricted to1–71. These are regression tests, not79 installation recertification; historical certificates are never rewritten.

Typecheck and production build use Node22.23.1, an empty dotenv and an empty inherited environment. All592 compiled input hashes match the sealed output fixture. Existing missing-Supabase-key, duplicate ERP import and source-map warnings remain. No deployment command runs.

Earlier diagnostic runs are not accepted results: an old compiled fixture caused source-drift rejection; a nested environment command lost the native library path; simultaneous laboratories exhausted macOS shared-memory slots. Two unattached56-byte PostgreSQL shims from disposed audit laboratories were retired only after validating the header magic, dead creator and zero attachments. No live database, data page, credential or persistent database file was modified. Accepted regression runs serialize the native workload and retain all failures as diagnostic evidence.

## Remaining boundaries

- **High release prerequisite:** guided installation remains certified through71. A separate reviewed certification must cover72–79; no source membership or certificate is relaxed here.
- **Medium operational prerequisite:** inspect old pending format-1 resets before any later release. They require operator review, never automatic reinterpretation. Pair migration79 with this application version.
- **Medium hosted acceptance:** run all eight scopes in a disposable hosted BETA project. Verify managed privileges/RLS/Storage bytes, real Realtime, latency/concurrency, lock pressure, interrupted workers/restarts, filesystem durability and actual browser sessions. Local macOS success is not hosted acceptance.
- **Low operational limit:** caps, authored-reference blockers, changed files and protected Claims are deliberate stops. Browser carts/drafts in other tabs/devices remain; database validation rejects erased products. Operators must not replace captured file names during cleanup.

No production reset/deployment, provider activation, installer recertification, BETA Gate2, domain/VPS/WordPress work or unrelated feature work is part of this corrective task. Stop for review after validation and the authorized commit/push.

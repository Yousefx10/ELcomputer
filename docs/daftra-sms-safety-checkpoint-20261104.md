# E251 — Daftra and SMS safety checkpoint — owner paused

The owner requested a safety checkpoint and a stop on 4 November 2026.
**PAUSED BY OWNER. Do not resume implementation, qualification or release preparation
until the owner asks. This checkpoint is not deployment or provider authorization.**

Production remains Storefront114 `6fd67997c8feaeca`, source `ff037ddd`, schema114.
The latest read-only observation retained 14 checkout sessions/attempts, 11 orders,
zero new funds/callbacks/proofs and four zero integrity counters. It captured 160
protected table projections. Meta115 remains uninstalled. No production migration,
deployment, runtime/credential change, worker invocation, provider request, invoice
creation/import, SMS, charge, refund or Git push occurred in this workstream.

## Saved implementation

All source changes are local commits in the owned worktree:
`/Users/imac/Documents/ELcomputer/daftra-sms-20261104/source`.
The worktree is clean on `local/daftra-sms-combined-20261104` at
`b782b13785b08d72dc718aa914456bb73bab4b96`.

| Candidate | Local source | What is implemented | Gates |
| --- | --- | --- | --- |
| A — private Daftra invoices | `a47b39b99aed38f81e93785c262f6d796590b659` | Verified client links; opaque customer-owned invoice list/detail; private supported PDF proxy; read-only adapter gates; Dashboard mapping/revocation; bounded polling worker templates | Runtime reads/writes false; DB reads/outbound false; no worker installed |
| B — selective accounting | `d726438b44e6be7e18ba136548d9e64d21cf4769` | Separate accounting provider/domain controls; local duplicate-write guards; verified event capture; stable references; one-use draft-create fence; uncertain-outcome reconciliation | Built-in/disabled; outbound false; final issuance/payment posting/credit notes remain unqualified |
| C — transactional SMS | `bb58b1461ce41f7609cca4f1968349d680a2d1a6` | Separate channel; seven verified event bindings; eleven disabled bilingual templates; optimistic template versions; source deduplication; final source/config/template checks; raw campaign UI/API closed | Runtime/DB/provider disabled; no sending or scheduler |
| D — marketing SMS | `38302a6e0b90f6489315357f45b130a9712da334` | Separate permissions; opt-in imports/provenance; persistent suppression; locale/tags audiences; drafts/schedules; actual link-inclusive segment/cost preview; frozen audience; exact approval; pause/cancel; audit; private fragment unsubscribe capability | Runtime/DB false; price unknown; unsubscribe secret absent; no provider sending |

`64cbe3e` corrects only the SQL test adapter's JSON-versus-PostgreSQL-array
serialization. `b782b13` combines A/B and C/D additively. No foreign source branch
was changed or pushed. Independent source snapshots are preserved in `release-a`,
`release-b`, `release-c` and `release-d` under the task directory.

Important source entry points:

- A: `server/utils/daftraInvoices.js`, `server/api/account/invoices/`,
  `app/pages/account/invoices/`, `DaftraInvoiceControls.vue`, migration
  `20261104230000_daftra_customer_invoices.sql`.
- B: `server/utils/daftraAccounting.js`, `DaftraAccountingControls.vue`, migration
  `20261104231000_daftra_accounting_ownership.sql`.
- C: `server/utils/sms/transactional.js`, `SmsTransactionalControls.vue`, migration
  `20261104232000_sms_transactional_channels.sql`.
- D: `server/utils/sms/marketing.js`, `SmsMarketingControls.vue`,
  `app/pages/sms/unsubscribe.vue`, migration `20261104233000_sms_marketing_channel.sql`.
- Candidate contracts: `docs/daftra-invoice-access.md`,
  `docs/daftra-accounting-ownership.md`, `docs/sms-transactional-channel.md` and
  `docs/sms-marketing-channel.md` in the owned source.

These migration timestamps are source identifiers. No physical schema numbers are
reserved. Pending Meta and a future A installation compete for the next actual
ledger slot; choose ordering and rebase/rebind before any approval.

## Qualification and unresolved results

| Evidence | Result | Saved evidence |
| --- | --- | --- |
| A invoice SQL/unit and actual authenticated HTTP/PDF | 15 pass | `release-a-final.log`, `invoice-http-final.log` |
| B ownership/idempotency/uncertainty | 9 pass | `accounting-final.log` |
| Independent A, B, C, D Nuxt typecheck and build | All pass | Each `release-*/build-results.json` |
| Combined focused invoice/accounting/SMS/actual HTTP | 39 pass | `combined-focused-first.log` |
| Transactional/marketing on disposable PostgreSQL17.11 | 14 pass | `sms-native-second.log` |
| Current PDC/date/polling/contract/label/amount fixtures | 51 pass | `pdc-current-focused.log` |
| Broader reused commerce regression run | 135 pass, 20 fail | `commerce-regression-first.log`; NOT a clean final qualification |
| Actual Vue EN/AR desktop/mobile/staff/session run | Incomplete, failed invoice Detail viewport assertion | `browser-third.log`, `browser/`; NOT browser accepted |

Older regression failures include the historical COD fixture's unsupported city
and PDC fixture expectations predating current dated lookups/webhook contracts.
They have not been fully isolated against the deployed baseline. Keep the failures;
do not call them resolved, silently weaken tests or reopen historical development.
The newer payment-interface/EGP10, Email, Order SMS and Vodafone foundation tests
are present in that run, but its aggregate result is still FAIL.

The browser harness first required fixture corrections (missing build CSS and a
nested-main locator). Its latest meaningful failure is `Detail stays within
viewport`. Diagnose the actual component and fixture at mobile size before changing
code. Later views, staff/session cases and final browser acceptance are incomplete.
No owner browser or provider credentials were used.

A/B early build receipts used short `a47b39b` or literal `HEAD`. The originals are
preserved. Separate `verified-source-binding.json` receipts verify every archived
source byte against the full A/B commit (1,701 and 1,709 files); no rebuild was
needed to correct that evidence label. C/D receipts already bind full commits.
The combined source has not yet received its own final typecheck/build.

## Partial Release A packet — NOT READY TO APPROVE

`release-a/release/application-review.tar.gz` completed locally before the pause.
Its SHA256 is `cc621fb17582131f8d451e93cf45d2e59c709751fb26e1753d261f9a35ee9fc6`.
Full archive readback and secret scanning pass. It retains the deployed immutable
Storefront114 assets and their compiled serving entries; 5,022 browser assets are
listed. The original Storefront114 build and deployment were untouched.

**Compiled archive HTTP/hash smoke has not run.** `artifact-review.json` explicitly
says pending compiled smoke. Do not treat this archive as release-ready.

`release-a-installation/` contains an isolated draft copy of existing guarded
operator/helpers, A SQL, a current host snapshot and a read-only database binding.
Those operator adaptations are unfinished and unqualified. There is no new A
`plan.json`, seal, approval, apply marker or execution receipt. Never execute it in
this state. Latest live bindings are read-only; the current observation passed.

A fresh encrypted backup/full readback, restored-target A migration rehearsal,
exact schema delta, operator/one-use guard tests, retained compiled asset/API checks,
final fresh target reconciliation, new seal and exact one-use approval are still
required. Earlier Meta and Storefront backups/consumed seals remain preserved and
are not new A authorization. No production apply was attempted.

## Missing provider and acceptance prerequisites

Daftra: actual tenant/API principal and least-privilege scope, account-specific
limits, verified customer/client/invoice mappings, genuine invoice/PDF acceptance,
accepted tax/COD timing/payment-method/treasury policy and final financial mutation
contracts. Only draft creation is implemented for controlled outbound execution;
final issuance, payment postings and credit notes remain manual/blocked.

Vodafone Egypt E'len: actual merchant endpoint/account/password, approved sender,
trusted outbound IP/certificate/activation, commercial maximum pricing and limits,
Unicode terms, authenticated delivery-receipt/inquiry contract, protected runtime
worker/unsubscribe bindings, accepted templates and explicit paid-send scope.
The confirmed V5 literal uppercase hexadecimal string HMAC key contract is retained.
SUBMITTED still means provider acceptance, never verified handset delivery.

Credentials belong only in the authenticated Dashboard controls after the matching
inactive installation: ERP connection/invoice mappings and SMS Settings/Marketing.
Do not paste secrets into chat. Database Daftra credentials were absent in the
opening read-only check; boolean-only environment fallback checks are unfinished.
No claim of complete environment unconfiguration is made.

The mandatory detailed **ELcomputer ↔ Daftra Integration Contract and Data-Flow
Matrix**, full local ERP control matrix and final four release reviews are still
unfinished. The candidate-specific contract documents are saved for review.

## Preservation and resumption

All 61 worktrees remain registered. The 59 foreign worktrees apart from main and
the owned task worktree retain their original heads, indexes, diffs and statuses;
main retains its HEAD/index and prior documentation work. The checkpoint records
this in `checkpoint-preservation.private.json`. Existing Meta/image/Apple source
and packets are untouched. All financial attempts and provider uncertainty remain.
CARD/COD/EGP10, Brevo/Auth, PDC and monitoring remain governed by existing production
contracts. No automatic rollback, speculative correction or financial retry occurred.

Local tests/builds/browsers have ended. No integration worker, deployment or provider
operation is left running. `owner-pause.json` records the explicit pause.

**ONE next action: owner reviews this checkpoint.** Resume only after the owner
asks. On resumption, read this file and the private task `CHECKPOINT.md`, audit the
saved processes/source/receipts and fresh live lineage, then address the outstanding
mobile/focused qualification before completing release preparation. Reuse passing
checks and preserve all earlier failed/superseded evidence.

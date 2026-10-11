# Order amount constraint reconciliation — migration 69

October 11 Storage amendment: the separately approved unapplied migration64 compatibility correction is the sole exception to this report's earlier unchanged1–68 requirement. Migration69 and its supported baselines remain unchanged. Real non-owner Supautils execution of64–69 preserves validated order checks and historical records; updated hash/history evidence is in [storage-policy-delegation.md](storage-policy-delegation.md). Original reconciliation results below remain historical.

Implemented locally on 2026-10-11. This task did not access production. Production checkpoint 63 and the completed corrections below come from the preceding authorized execution evidence, not a new live inspection.

## Recorded production corrections

The nine-table authorization correction was applied separately from migration history on October 10. Its approved SQL remains archived in [20261010-nine-table-correction.sql](security/20261010-nine-table-correction.sql), SHA-256 `f8e6f35fef987f0ca7a84575d156895aadc47988394b0e0c9990923afdec3e94`. Pending migration 68 recognizes the canonical and corrected policy baselines, preserves correct existing policy objects and rejects unknown policies. This behavior is unchanged.

The two customer order checks were separately added and validated on October 11 at `2026-10-11T08:17:58.703528Z`, while all 63 migration identities remained unchanged. Unmodified execution SQL is archived in [20261011-order-constraints-correction.sql](security/20261011-order-constraints-correction.sql), SHA-256 `94305f9983dbc993b1e28c304a20837a575b4accdd43815499cac5966e349181`. The archive's historical “NOT authorized” comment is retained for byte integrity; it is provenance, not a deployment script or new authorization. Its checkpoint-63/approval guards must never be bypassed on a live database.

The previous execution report records all nine orders, 13 items and 148 table fingerprints unchanged after the correction, nine-table fingerprint `c7cfef8e0314b85709e381ed0f8d5dda0aa461cf4e6a1ae31cdd473df37f2917` retained, refreshed encrypted native restore-tested backup, dormant controls and unchanged application process. This task neither revalidates that current production state nor uses its credentials/backups.

## Schema and invariant audit

The repository's canonical [schema.sql](../supabase/backups/schema.sql) already defines these validated CHECK constraints. The approved production correction produces the same PostgreSQL 17 catalog definitions:

| Column | Required shape | Constraint | Catalog definition |
| --- | --- | --- | --- |
| subtotal_amount | numeric(12,2), NOT NULL, DEFAULT 0 | customer_orders_subtotal_amount_check | CHECK ((subtotal_amount >= (0)::numeric)) |
| discount_amount | numeric(12,2), NOT NULL, DEFAULT 0 | customer_orders_discount_amount_check | CHECK ((discount_amount >= (0)::numeric)) |

The existing total_amount column has the same money shape and a validated `customer_orders_total_amount_check`. Migration 69 verifies and preserves that existing invariant too. It does not alter total calculations or introduce an arithmetic equality rule. Existing fees, rounding, coupons, preorder deposits/paid totals and status checks remain owned by the existing order functions/triggers.

Audited normal and preorder canonical order creation, payment fees, ERP ownership, Paymob reconciliation, Order SMS/warranty wrappers and checkout/quote/coupon server APIs. Normal checkout derives prices/discounts from current trusted database records; payment fees extend totals through the existing trigger; preorders retain their separate amount/fulfillment rules. Payment callbacks continue to determine settlement. Migrations 64–68 introduce Claims/reverse/Email/communications/catalog boundaries and do not modify these three money columns or financial CHECK definitions. No application implementation changed.

## Reconciliation behavior

Migration: [20261011140000_order_amount_constraints_reconciliation.sql](../supabase/migrations/20261011140000_order_amount_constraints_reconciliation.sql), the **69th** migration.

SHA-256: `d2b60fbd08f8d457c9d507737b9f0b6665b34b89b6860214bfc5f5329ce7cf89`.

- Both correct validated checks present: leave their OIDs, definitions and validation state intact. Canonical fresh installations and manually corrected production follow this path. Re-executing the SQL also preserves them, although normal deployment still relies on the migration runner's history.
- Both checks absent: only the supported permanent, non-inherited ordinary customer_orders table with RLS enabled, reviewed numeric columns/defaults/nullability and existing validated total invariant is accepted. Add the two exact checks as NOT VALID and validate both before the same transaction commits. Invalid historical rows cause rollback; no record is repaired or changed.
- Exactly one present, unvalidated existing checks, unexpected expressions/kinds/column bindings/inheritance attributes, altered numeric type/precision/default/nullability, missing columns/total invariant, disabled order RLS or unknown overlapping amount checks: stop for review. An existing NOT VALID check is not silently validated. Unknown constraints are never dropped or replaced.

The transaction uses an empty search path, five-second lock timeout, 60-second statement timeout and ACCESS EXCLUSIVE lock on customer_orders so schema/record changes cannot race the guarded reconciliation. A busy table can cause a safe timeout. Even the preserve-existing branch briefly obtains that lock. It sends only a PostgREST schema-cache notification. No data DML, grant/RLS/role/provider changes, migration-history insert/repair or customer_profiles change occurs.

Constraint validation and table locks follow [PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/17/sql-altertable.html); the guard reads constraint validation, column bindings and inheritance metadata described in [pg_constraint](https://www.postgresql.org/docs/17/catalog-pg-constraint.html). Definitions are deliberately restricted to the reviewed PostgreSQL 17 form; an unrecognized future database representation needs review, not an automatic rewrite. Existing nonnegative checks retain their exact semantics; this task adds no new finiteness or discount/subtotal relationship invariant.

## Local compatibility and security testing

New regression source: [order-amount-reconciliation.test.mjs](../tests/order-amount-reconciliation.test.mjs). Existing disposable-native helpers gain an optional after-success migration callback. It records **actual executed file identities in memory**, including all initial 63 SQL files and 64→69; it creates no fake Supabase history records. All four baselines execute exactly the same ordered six pending files:

| Baseline | Expected result |
| --- | --- |
| A: fresh canonical repository schema | Preserve both original validated checks |
| B: populated checkpoint 63 with both out-of-band corrections | Preserve the separately applied check and corrected policy OIDs |
| C: populated canonical checkpoint 63 without out-of-band corrections | Preserve canonical checks; migration 68 safely corrects authorization and confidentiality |
| D: supported populated checkpoint 63 with the entire check pair absent | Add/validate exactly the two checks, without changing records |

The populated cases include historical normal and Arabic preorder orders/items, customers, staff, products/variants/images/specifications and inventory references. Tests compare every pre-existing public table's complete old-column values across 64→69. Migration 69 alone preserves public catalog metadata, columns, constraints outside the pair, roles/memberships/default grants, table/view ACLs/RLS, policies, functions and triggers. Reapplication preserves all objects and records.

After the chain, actual native roles prove public pricing/published browsing, draft privacy, denied confidential-column access for both browser roles, denied customer writes and staff-only RPCs, and permitted staff internal reads/product editing. Corrected production policy objects remain unchanged; all 45 secure nine-table policies are present. Rollback-only synthetic normal checkout rejects forged submitted negative totals, produces the expected database price/fee, and rejects negative subtotal/discount updates. EN/AR historical order contracts remain compatible.

Claims/reverse/Email/channel ledgers and historical provider/payment/ERP jobs remain empty. PDC/reverse/auto labels, Vodafone/SMS templates/events, Brevo, return/warranty policies and Claims communications remain OFF. Existing suppressed-only Order SMS intents stay suppressed; no historical sendable work is seeded. Other full-suite activation/callback tests use synthetic database settings/mock transports solely in owned fixtures, never merchant/provider activation or traffic.

Drift fixtures cover partial pairs, weaker/wrong-column/wrong-kind/NO INHERIT checks, correct-but-unvalidated checks, NULL/incorrect precision/type/default/missing columns, missing total validation, inheritance/RLS differences, overlapping unknown checks, invalid historical amounts and lock contention. Each failure retains the altered fixture objects/records exactly; fixture restoration is confined to the disposable environment. No production URL or existing database cluster is accepted.

All final tests used Node **22.23.1**, native PostgreSQL **17.11** and real local PostgREST **16.4**. Results:

| Check | Result |
| --- | --- |
| Complete regression suite | **729 passed**, zero failures/cancellations/skips |
| New reconciliation coverage | **37 passed**: identity/archive integrity plus four native ordered baselines, object/data/security/dormancy/checkout/reapplication checks and 19 atomic drift/lock cases |
| A fresh canonical | PASS: all 69 executed identities; original validated check objects preserved |
| B populated corrected checkpoint 63 | PASS: exact 64→69 chain; both check OIDs and all existing corrected policy OIDs preserved |
| C populated canonical checkpoint 63 | PASS: exact 64→69 chain; records retained, authorization/confidentiality safely reconciled by 68 |
| D supported absent pair | PASS: exact 64→69 chain; two new validated checks, unchanged historical records |
| Existing native concurrency/database regressions | PASS: Paymob, Email, Claims, reverse logistics, communications and seven final-audit lock-barrier races enabled |
| Catalog REST regression | PASS: real local REST confidentiality, staff CRUD/procurement, embeddings and revocation; 10 standalone results also passed |
| Checkout/payment/catalog/product management/warranty/Claims/shipping/SMS/Email | PASS in full unit, fixture, native and local REST suite; no real provider transaction |
| Typecheck / production build / diff check | PASS; existing ERP duplicate-import, sourcemap/chunk/preorder warnings retained |
| Earlier migrations 1–68 | All files compared byte-for-byte with the starting Git revision: unchanged |

An initial full run encountered an existing local PostgREST startup failure: its dynamic libpq path was unavailable on this Mac. Supplying the already prepared compatible local library resolved it, without changing a server service or application code. The fixture also incorrectly waited for another exit event after a child had already died by signal. Its close/readiness logic now handles signal exits and bounds readiness requests. The reproduced missing-library failure now rejects/cleans up in about 3.5 seconds; standalone REST and the complete final suite passed afterward. No migration was edited to accommodate the environment.

Reproduce the complete run with the prepared test executables:

```sh
env -u DEBUG \
  PATH=/private/tmp/elcomputer-preflight-20261010/node22/node-v22.23.1-darwin-x64/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin \
  DYLD_LIBRARY_PATH=/Users/imac/Documents/ELcomputer/production-backup-tools/postgresql-17.11/lib \
  EMAIL_REVIEW_PG_BIN=/private/tmp/elcomputer-email-audit-pg/install/bin \
  EMAIL_REVIEW_PG_DRIVER=/private/tmp/elcomputer-email-audit-pg/driver/node_modules/pg/lib/index.js \
  PAYMOB_REVIEW_PG_BIN=/private/tmp/elcomputer-email-audit-pg/install/bin \
  PAYMOB_REVIEW_PG_DRIVER=/private/tmp/elcomputer-email-audit-pg/driver/node_modules/pg/lib/index.js \
  CATALOG_REVIEW_POSTGREST_BIN=/private/tmp/catalog-review-tools/postgrest \
  NODE_OPTIONS=--import=./tests/helpers/keepTestProcessAlive.mjs \
  node --test --test-concurrency=2 tests/*.test.mjs
```

Run from the repository root. Native executable/driver paths only are accepted; no production URL, password file or existing cluster is used. The existing keepalive preload supports Node22's unreferenced fixture timeout timers and does not change production transport. Without executable configuration, optional native/API tests explicitly skip; that reduced run is not the result above. Typecheck/build used the same Node22 PATH with `npm run typecheck` and `npm run build`.

Evidence logs: `/private/tmp/order-reconciliation-full.log`, `order-reconciliation-focused.log`, `order-reconciliation-rest.log`, `order-reconciliation-typecheck.log`, `order-reconciliation-build.log` and `order-reconciliation-rest-launch-guard.json`. The focused log is the earlier 33-result run before four additional native drift cases; all final 37 are in the complete suite. Every created database cluster is disposable and removed. Browser/hosted authentication is not proven by native fixture SQL or signed synthetic REST JWTs; no new authenticated browser/provider acceptance is claimed.

## Future deployment and recovery boundaries

Keep all migration files 1–68 unchanged. Proposed normal sequence is now **63 → 64 → 65 → 66 → 67 → 68 → 69**. Production still has the last reported 63 identities with the two independently recorded corrections; never insert fabricated 68/69 identities to account for them. Applying any pending migration or deploying main requires separate authorization for the complete reviewed set. Migration 69 does not weaken or replace migration 68's policy/confidentiality reconciliation.

A later deployment computer must recheck current identities, all pending hashes, corrected permissions, exact amount/nullability/check states, unrelated drift, disabled controls and queues, concurrency exclusion, encrypted restore-tested database recovery and application-output backup/rollback readiness. Allow the brief customer_orders lock and the separately documented coordinated Dashboard reader/schema transition for migration 68. Stop on any guard failure; never bypass it or silently edit applied migration source.

Preserve additive integrity/security checks during an application rollback. Do not drop these checks or restore public cost grants as an automatic rollback. A failing guard or post-release compatibility issue requires a separately reviewed forward fix. Actual whole-database restoration/cutover needs separate authorization, an explicit data-loss boundary and recovery of Supabase-managed configuration/Storage bytes outside logical dumps.

Remaining release prerequisites include fresh complete production preflight, the previous Nginx inspection/application-output rollback gaps and hosted signed-in/Auth/Storage/GraphQL/cache acceptance. Customer-profile email/index differences are untouched and remain a separate assessment. Production confidentiality remains unverified/unreleased until migration 68 and compatible code are separately approved/applied. No claim of overall deployment readiness or provider activation acceptance is made here.

**STOP after local commit/push and review report.** No production access/change/migration/deployment, credential reset, unrelated schema correction or real provider/message occurred.

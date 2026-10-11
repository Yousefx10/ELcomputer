# Catalog data confidentiality — local implementation and security report

October 11 Storage amendment: the separately approved unapplied migration64 correction supersedes this report's earlier requirement to leave64 unchanged. Its restrictive policy remains exact; only the owner-only RLS alteration is replaced by a transactional enabled-RLS/ordinary-table verification. Migration68 and all other migrations remain unchanged. Updated fingerprints, real Supautils/non-owner chain and confidentiality/security validation: [storage-policy-delegation.md](storage-policy-delegation.md). Original catalog implementation results below remain historical.

Completed locally on 2026-10-11 from clean, synchronized `main` at `e7515e6`. This report covers one feature: prevent anonymous visitors and ordinary authenticated customers from reading internal catalog costs and supplier/warehouse references. No production connection, migration, deployment, credential reset, provider activation or real message occurred.

## Evidence and exact confidential fields

Read `AGENTS.md`, `PROJECT_STATE.md`, `CODEX_HANDOFF.md`, the 2026-10-10 production security investigation and completed correction report. Those historical production reports recorded public exposure of product/variant costs and warehouse/supplier references through raw tables and both storefront views. They recorded one published product and one active public variant with nonzero costs, 46 published products with warehouse references, and no published supplier reference at that checkpoint. These counts were **not refreshed** in this local task.

The nine-table correction was applied outside migration history on 2026-10-10. Its executed SQL SHA-256 is `f8e6f35fef987f0ca7a84575d156895aadc47988394b0e0c9990923afdec3e94`; the corrected authorization fingerprint was `c7cfef8e0314b85709e381ed0f8d5dda0aa461cf4e6a1ae31cdd473df37f2917`. The historical checkpoint is exactly 63 migrations. The user subsequently confirmed live Dashboard access manually. This does not establish hosted acceptance of the new confidentiality implementation.

An unchanged copy of the approved SQL is retained at [security/20261010-nine-table-correction.sql](security/20261010-nine-table-correction.sql) for provenance and disposable regression fixtures. Its original review comments and guards remain intact. It is not an instruction to re-execute that script.

| Relation | Staff-only column | Why |
| --- | --- | --- |
| products | cost_price | Acquisition/inventory cost, distinct from the public selling price |
| products | default_supplier_id | Internal supplier relationship |
| products | primary_warehouse_id | Internal receiving/fulfillment warehouse relationship |
| product_variants | cost_price | Variant acquisition/inventory cost |

Audited current columns of products, variants, images, specifications, product features, brands and categories. No additional structured confidential field was identified in these catalog relations. Prices/old prices, public SKU/variant identity, color, availability/stock, category/brand references, SEO, warranty and preorder purchase terms remain public. Preorder capacity/remaining availability already form part of the existing public purchase contract. Warehouse inventory average costs, procurement unit costs, serialized-unit identities and CRM supplier details remain behind their existing staff RLS/RPC/server boundaries; those protections are not replaced here. Customer purchase items contain selling amounts rather than catalog acquisition costs.

Published text, specifications, SEO and brand-page JSON are merchant-authored public content. This feature does not detect secrets deliberately or accidentally placed in those free-form fields. Future confidential columns in brands/categories or other publicly readable tables need an explicit privilege design before being populated.

## Query and workflow audit

| Access path | Audit and final behavior |
| --- | --- |
| Home, search, SearchBar, product detail, cart, Order again | Existing storefront views and explicit public projections continue to work; both views omit all four confidential columns |
| Public AI/Markdown, brand storefront, sitemap/SEO | Existing explicit field selections and safe public response construction remain unchanged; no internal catalog value is returned |
| Public reviews and analytics APIs | Service reads select public/identifier fields and retain existing publication/authentication/response controls; no internal projection added |
| Product Management list/stats | List reads the sanitized invoker view, including permission-controlled staff drafts; count requests now select id instead of wildcard base-table columns |
| Product editor | Product and variant reads use identity-gated staff RPCs; supplier/warehouse references and internal costs remain available; current server POST/PATCH and direct permission-controlled delete paths remain unchanged |
| Procurement | The internal warehouse lookup uses the guarded product RPC; existing search/order/limit and product-variant embedding are retained |
| Sales, Returns, Warehouses | Their product queries already select permitted public columns; existing inventory/financial relations remain staff-protected; no source change required |
| Dashboard category/brand/image/specification CRUD | Existing action-specific nine-table RLS and server RBAC remain intact |
| Checkout, order packing, admin inventory/ERP APIs | Existing trusted server/service reads and canonical inventory/order functions retain full internal access; payment/shipping behavior is unchanged |

Reviewed raw and view catalog queries throughout `app/` and `server/`, nested catalog relationships, relevant grants/policies, invoker views and catalog-related definer functions. Public availability/stock functions return their existing public projections; internal stock calculations can still read warehouse references inside their existing privileged boundary. Existing function bodies are unchanged by migration 68.

## Implementation

New migration: [20261011120000_catalog_confidentiality.sql](../supabase/migrations/20261011120000_catalog_confidentiality.sql), the **68th repository migration**.

SHA-256: `e7d9fb35a05f9c8cb2b82c343efdb79e515c607842e0d7f9c5369e4365bb3cae`.

1. Revoke table-level SELECT and residual column SELECT grants on products/variants from PUBLIC, anon and authenticated. Grant only an explicit whitelist: 37 product columns and 12 variant columns. Removing a column grant alone would leave any table-wide grant effective. RLS controls rows, not individual columns. [Supabase column security](https://supabase.com/docs/guides/database/postgres/column-level-security).
2. Replace both existing storefront views using fixed public projections and the existing `erp_storefront_stock` expression. Retain `security_invoker=true` and SELECT grants. PostgreSQL cannot remove existing view columns with CREATE OR REPLACE, so DROP/CREATE happens inside the transaction, **without CASCADE**. An unexpected dependent object stops execution. [PostgreSQL views](https://www.postgresql.org/docs/17/sql-createview.html).
3. Add two read-only STABLE SECURITY DEFINER RPCs with empty search paths: `catalog_staff_products()` and `catalog_staff_product_variants()`. Execution is denied to PUBLIC/anon and granted only to authenticated/service_role. Every invocation checks the current JWT identity using the existing active-staff helper. No caller-supplied actor, permission bypass or dynamic SQL is accepted.
4. Keep existing staff row scope: active commerce staff can read internal fields on published products; drafts additionally require products.view. The variant RPC preserves the existing product_variants_admin_read active-staff scope, including inactive variants. Owners/product viewers retain draft access; inactive staff and customers are denied. Service-role workflows retain complete access. No new staff permission or role is introduced.
5. Change only three application files: product editor reads, procurement product reads, and product count projections. Customers and staff continue sharing authenticated; staff never receive a broad confidential-column grant on that role.

Foreign-key identities remain available through the public views and table-returning RPCs. Actual local PostgREST tests verify both storefront variant embeddings and the procurement RPC's variant embedding, filtering and ordering. These use PostgREST's existing table-returning-function relationship support. [PostgREST embeddings](https://docs.postgrest.org/en/stable/references/api/resource_embedding.html).

Future products/variants columns are not automatically granted or added to public views. The migration verifies that neither browser role has effective SELECT on any confidential column, including inherited privileges; a remaining grant raises an exception rather than changing role memberships.

## Reconciliation and migration strategy

Do not edit or mark migrations 1–63/64–67 differently. The historical production correction remains a real, separately recorded authorization change.

Migration 68 recognizes two **per-table policy definitions**: the exact repository canonical baseline and the exact reviewed corrected baseline. These are MD5 identifiers of PostgreSQL's ordered policy JSON, not approval signatures. All nine tables are validated before any policy changes. An unknown definition fails the transaction. Canonical fixtures converge to the same 45 corrected policies; already-corrected production policies are kept in place, including their OIDs/expressions. The other eight tables retain their corrected browser privileges, while products/variants receive the intended SELECT restrictions. Owner/service grants, helpers, triggers, business functions and variant RLS policies are preserved.

The SQL guard is intentionally a policy/column-privilege guard. It does not substitute for a future full production authorization/schema/data/preflight comparison against the saved correction fingerprint.

The proposed normal migration sequence is **63 → 64 → 65 → 66 → 67 → 68**, retaining all four reviewed After-Sales migration hashes. Tests execute that sequence over populated, manually corrected checkpoint-63 fixtures and prove existing columns/data/policy objects are retained. A fresh canonical database also converges safely. No migration-history repair or fabricated applied identity is needed.

**This feature does not authorize applying 64–67.** Current main contains that pending After-Sales work. A production release following normal history needs separate approval covering all pending migrations and the coordinated application update. Do not run a general db push under a confidentiality-only authorization, manually mark 64–67 applied, or silently execute 68 out of order. An urgent independent confidentiality release would need a separately reviewed production-baseline code package and explicit migration-history plan; none was created or deployed in this task.

## Validation

All final checks used Node **22.23.1** on this Mac.

| Check | Result |
| --- | --- |
| Full suite | **692 passed**, zero failures/cancellations/skips; native Email/Claims/Paymob and catalog PostgREST checks enabled |
| Focused catalog plus existing native final-audit checks | **64 passed**, including **51 new catalog SQL/API results** |
| Native database | Fresh owned PostgreSQL **17.11** clusters; destroyed after tests; no production URL or existing cluster accepted |
| Actual REST security | Checksum-verified official PostgREST **16.4**, disposable loopback PostgreSQL, synthetic signed JWTs; confidential explicit columns, filters, wildcard/whole-record and embedded reads denied or safely omitted |
| Staff acceptance | Owner/editor/commerce reads, draft scope, variant costs, FK embeddings, product editing, canonical physical procurement receipt/cost projection, and immediate staff revocation passed |
| Data/authorization preservation | All pre-68 public table contents and existing public function bodies retained; corrected policy objects retained; unknown extra policy rolls back; residual column grants removed; future product column stays private |
| Browser | **615 assertions / 96 screenshots**, EN/AR, 1440/390 widths, Light/Dark/System; actual Vue product creation/editing, public product/cart action, checkout, account regression, procurement and warehouses; zero browser errors/external requests |
| Typecheck / production build / diff check | Passed; existing ERP duplicate-import, sourcemap/chunk and preorder warnings remain |

The full suite uses the existing optional `keepTestProcessAlive.mjs` preload because socket-free provider fixtures rely on unreferenced AbortSignal.timeout timers in Node 22. It changes test-process lifetime, not production transport. The historical final-audit migration test is now bounded to its original 64–67 scope so the new migration does not invalidate its fixed checkpoint assertions.

Regression sources: `tests/catalog-confidentiality.test.mjs`, `tests/catalog-rest-security.test.mjs` and their two fixture helpers. The existing `scripts/warranty-browser.mjs` now models sanitized public catalog reads and the guarded staff RPCs, adds procurement/warehouse coverage and checks private cost canaries. Auth/API transport in that browser runner is mocked; real SQL/PostgREST is tested separately. No hosted Supabase Auth, GraphQL extension, current production PostgREST cache or authenticated production browser acceptance of this new feature was performed. Database ACL/RLS checks and local REST tests do not replace that future acceptance.

Local evidence logs are under `/private/tmp/catalog-*`; screenshots/report are in `/private/tmp/elcomputer-catalog-browser/`. Disposable tests contain synthetic data only and never read protected production credentials or encrypted backups. The unchanged adjacent public-artifact/SSR regression scan also passed: 133 public files, 36 SSR cases, zero private SSR requests or secret canaries.

To repeat native/API coverage, provide executable paths through `EMAIL_REVIEW_PG_BIN`, `EMAIL_REVIEW_PG_DRIVER`, `PAYMOB_REVIEW_PG_BIN`, `PAYMOB_REVIEW_PG_DRIVER`, and `CATALOG_REVIEW_POSTGREST_BIN`, then run `node --test --test-concurrency=2 tests/*.test.mjs` with `NODE_OPTIONS=--import=./tests/helpers/keepTestProcessAlive.mjs`. Without those paths native/API tests explicitly skip; that reduced run is not the result reported above. These helpers create only owned loopback databases. Browser acceptance uses `WARRANTY_REVIEW_PLAYWRIGHT`/`WARRANTY_REVIEW_ARTIFACTS` with `node scripts/warranty-browser.mjs` after building.

## Compatibility, proposed deployment and recovery

**2026-10-11 deployment-safety amendment:** the current coordinated release has six pending migrations 64–69. Migration68 requires `env -u DEBUG npm run deploy:check -- --manual-recovery` followed, only after authorized database gates, by `env -u DEBUG npm run deploy -- --manual-recovery`, using the prepared Node22 PATH. See [the safety report](deployment-recovery-safety.md). Automatic fallback to pre-68 output is forbidden; failures can cause downtime and require separate recovery authorization. The original feature-only chronology below remains historical.

Deployment remains **unauthorized**. The exposure remains in production until a separately approved coordinated release applies the privileges and updates staff readers.

For a later approved normal release:

1. Synchronize the reviewed source. Recheck actual migration identities/checkpoint, all five pending file hashes, full corrected authorization state and unexpected schema/role drift. Preserve all OFF provider/event controls and inspect historical queues. Stop on differences.
2. Obtain a fresh encrypted, verified/restorable backup with roles/grants/policies and the existing application-output rollback backup. Confirm the recovery key/access and concurrent deployment/migration exclusion.
3. Plan a brief Dashboard maintenance window. Old/cached product editors and raw-table wildcard count queries will fail closed after column revocation; avoid staff saves during the transition. Storefront projections and trusted checkout/inventory functions remain compatible.
4. If separately authorized, apply 64→65→66→67→68 through the established guarded workflow. Respect the transaction, five-second lock timeout and 60-second statement timeout; never bypass a policy, inherited-privilege or dependent-view failure. Verify PostgREST schema reload and both RPCs/relationships before staff acceptance.
5. Deploy the reviewed compatible application using the separately approved production procedure. Refresh staff clients, then verify published browsing/prices/images/variants/SEO, drafts hidden from public/customer reads, all confidential direct/filter/embed reads denied, staff internal reads and editing, checkout/warehouse health, unchanged existing records/providers/backlog and exact applied migration identities. Do not activate any provider as part of acceptance.
6. Perform real hosted Supabase/customer/staff acceptance with established authorized sessions. Keep tokens, costs, supplier/warehouse values and customer data out of logs. Any synthetic write acceptance needs separate safe fixture approval and cleanup; do not touch customer orders or initiate fulfillment.

Before commit, a guard failure leaves the transaction unchanged. After commit, **do not regrant public/authenticated table SELECT**, restore secret columns to storefront views, or run the old vulnerable rollback script. An application-only rollback to readers that select base-table wildcard columns is incompatible; retain these compatible reads or use a separately reviewed forward fix, with Dashboard maintenance until accepted. Actual backup restoration/cutover requires separate approval. A backup predating either security correction must not reopen public traffic until both protections are re-established and verified.

Unrelated production order-amount constraints, customer-profile email drift and outstanding complete deployment preflight items remain outside scope. No order-constraint script, profile correction, payment/shipping integration change or additional feature was implemented. This is ready for implementation/security review, not a declaration that production is deployed or fully cleared for release.

**STOP after local commit/push and this report.**

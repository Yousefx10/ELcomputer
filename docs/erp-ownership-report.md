# ERP ownership final report — 2026-10-03

Implementation is local. No deployment or production migration was performed.

The [preimplementation audit](erp-ownership-audit.md) records the discovered conflicts. The [integration guide](daftra-erp.md) lists official endpoint sources, directions, mappings, pagination, retry rules and limitations.

## 1. Previous architecture

A provider flag existed, but navigation, checkout queuing and worker behavior also depended on connection health. Most local ERP screens wrote directly to Supabase. Settings conflated saved credentials, a historical test result and activation.

## 2. Conflicts found

Failed tests could reopen local ERP operations. Local ERP mutations had no ownership guard. Checkout started remote processing immediately; outages could omit jobs. Searches used only the first page, unknown creates could repeat, invoice reads were swallowed, discounts used the wrong field, and stock import conflicted with serialized integrity rules.

## 3. Final ownership matrix

| Area | Classification | Built-in mode | Daftra mode |
| --- | --- | --- | --- |
| Storefront, CMS/help, SEO, images, descriptions, categories, brands, publication, selling prices | A: platform always | Local | Local |
| Website accounts, checkout, orders/messages, analytics, admin access | A | Local | Local |
| Packing, scans, videos, support/Live Chat, documents, shipping/PDC | A | Local | Local |
| Suppliers, procurement, purchasing | B/C: active ERP | Existing local ERP | Daftra; local writes blocked |
| Manual sales and invoices | B/C | Existing local ERP | Daftra; local writes blocked |
| Warehouse balances, inventory quantity/cost, movements, transfers, ERP receipts | B/C | Existing local ERP | Daftra; retained local ledger frozen |
| Treasury, receipts, supplier/salary payments, ERP employees | B/C | Existing local ERP | Daftra; local writes blocked |
| Physical QR registry and packing assignment | A/D | Existing registry and local posting | Platform custody only; no local ERP posting |
| Customer contacts, support activities, return/warranty requests | A/D: platform plus ERP consequences | Local workflow; existing local return posting | Local workflow; manual external accounting |
| Preorders and their payment workflow | A/D | Existing allocation and release | Local request/payment records; manual ERP allocation/release |

## 4. Built-in behavior

Existing modules and RPCs are preserved. Authorized procurement receipts, stock changes, sales and treasury payments remain available. Storefront views return the original quantity projection in this mode.

## 5. Daftra behavior

Daftra owns ERP operations independently of test health. Outages retain that ownership. Supported external views remain available; unsupported business consequences are explicitly manual.

## 6. Hidden and blocked modules

Purchasing/suppliers, local sales, warehouse editing/transfers, local stock overview, treasury and employee operations are hidden. Serialized lookup, QR printing/scanning, customer returns, web orders, packing, product content, support, shipping and admin users remain available. The physical registry no longer links to blocked procurement in Daftra mode.

## 7. Server and database protection

Shared mode helpers resolve one setting source. Product mutation and preorder release APIs check ownership. Database triggers block ERP table writes, including direct PostgREST operations and trusted RPC internals. Browser settings writes cannot activate a provider or manufacture a test. Private caches, intents, reservations, runs and leases are service-only. Existing RLS and permission checks remain in force.

## 8. Website orders

Checkout commits locally without a Daftra request. External mode atomically saves the order, platform reservations and a deduplicated status job. Retries reuse the cart. Existing invoice-linked orders retain known Daftra ownership; other historical orders remain built-in and are not exported.

## 9. Product and storefront ownership

Names, images, descriptions, specifications, publication, categories, brands and SEO remain local. Existing parent-product selling prices remain authoritative. Public storefront, search suggestions, reorder, dashboard availability, SEO and AI readers use the consistent quantity projection. No remote content or price overwrite occurs.

## 10. Stock and cost

Daftra refresh updates a private cache and mappings. It leaves original product/variant quantities and costs, warehouse balances and inventory history unchanged. Availability deducts reservations and caps serialized items by the physical registry. Reservations release only after verified processed invoice stock transactions and a later stock fetch.

## 11. Order synchronization

New eligible web orders map existing Daftra products, match/create clients and create draft invoices. Standard invoices can issue after validating currency, customer, total and confirmed creation. Serialized issuance requires manual warehouse/serial review. Payments, cancellation/refund accounting and preorder accounting remain manual.

## 12. Retry and worker

A durable provider lease serializes processing and recovers interrupted jobs. Backoff is bounded; manual retry applies only to failed work. Durable POST intents prevent blind duplicate creation after a timeout. Requests disable transport retries, refresh credentials per job, verify leases and use local rate pacing. The authenticated internal scheduler endpoint is prepared; no live scheduler was installed.

## 13. Switching UX

Settings show four separately labeled states: active ERP, credentials, test health and activation. Headers say **Active ERP: Built-in ERP** or **Active ERP: Daftra ERP**. Saving/testing credentials cannot activate Daftra. Activation requires an explicit choice and confirmation. Stale settings/reviews are rejected.

## 14. Switch only

Ownership changes with an atomic audit entry. Local history remains stored. No historical export job is created. New eligible transactions queue independently of remote availability.

## 15. Switch and synchronize

A review lists support, direction, candidate count, action and warning. Confirmation queues one inventory import run. Its queue exposes progress/failure and retry. Repeated imports upsert cache/mappings rather than creating remote business records.

## 16. Supported migration entities

Only current product/variant SKU mapping and Daftra → ELcomputer stock/cost cache refresh are supported during activation. This is an inbound refresh, not a historical built-in → Daftra export. The integration guide describes each supported endpoint.

## 17. Unsupported automatic migration

Historical clients, sales/invoices, purchases, warehouse balances, serialized receipts, treasury, HR, refunds and reverse imports remain excluded. Official APIs exist for several domains; safe repository mappings and accounting workflows do not. The review marks them manual and preserves local records.

## 18. Switch back

Switch back without import restores built-in ownership over retained records. It warns about external changes. No cache-to-ledger overwrite or reverse accounting import occurs. Reconciliation is required before relying on retained balances.

## 19. Schema

The unapplied migration is `supabase/migrations/20261003120000_erp_ownership.sql`. It adds credential/state revisions, immutable order ownership, manual return flags, private cache/reservation/run/lease/intent tables, guarded RPCs and RLS-preserving storefront views. It extends reset allowlists and blocks destructive ERP reset scopes in Daftra mode. It does not delete history or seed remote stock.

## 20. Validation

`node --test tests/*.test.mjs`: 234 passed, 0 failed. `npm run typecheck`, `npm run build` and `git diff --check` passed. Focused coverage includes both-mode checkout, packing and chat; PDC queuing; ERP guards; credential revisions; review requirements; transitions; populated migration preservation; RLS; stock cache; lease recovery; manual retry; unknown POST outcomes; mapping reuse; and invoice validation.

Actual Vue settings and badge components were checked in Chrome with mocked responses: credentials saved, successful test while inactive, reviewed activation, active-provider outage, switch-back, Arabic, mobile width and dark styling. No live Daftra account was mutated. PostgreSQL behavior used isolated PGlite; live Supabase/PostgREST schema-cache behavior still needs staging review.

## 21. Known risks and manual steps

- Application and migration must be released together after approval. New views/RPCs are unavailable on the old database.
- Configure the authenticated scheduler after deployment. Until then, use manual queue processing.
- Switch-only does not populate an empty remote cache. Refresh mapped stock before expecting normal availability; existing backorder policy remains unchanged.
- Verify SKU uniqueness, account permissions and the account's primary store. Default-store issuance follows documented behavior for standard items.
- Aggregate stock cannot generate QR units. New external serialized receipts require a verified registry reconciliation/import workflow, which this phase does not implement.
- Serialized invoices need manual warehouse/serial issuance. Returns, refunds, payments and external preorder allocation require manual accounting.
- Missing permission-scoped stock evidence retains reservations. Review restrictions and reconcile uncertain postings.
- Ambiguous creates and unlinked historical queue entries need manual review. Legacy matched drafts without confirmed creation are not automatically issued.
- Switching back restores retained balances; it does not reconcile physical custody or external financial changes.
- API-key headers remain supported by the authorization guide but are deprecated in endpoint schemas. OAuth remains future work.
- No production secrets were requested, printed or included in reports.

## 22. Pages to review

| Page | Review |
| --- | --- |
| `/dashboard/settings?tab=erp` | Four state labels; save/test separation; both activation choices; supported review; switch-back warning |
| Any dashboard page, both header layouts | Active ERP badge; unavailable-state handling |
| `/dashboard/erp` | External overview during outages; queue counts |
| `/dashboard/erp?tab=inventory` | Explicit inbound direction, queued refresh, last success, failures and unavailable remote stock |
| `/dashboard/erp?tab=sync` | Per-job direction, failed/manual status, permission-aware retries |
| `/dashboard/commerce?tab=procurement`, `sales`, `warehouses`; `/dashboard/treasury`; `/dashboard/hr?tab=employees` | Direct external-mode URL gives an explanation and a permitted destination |
| `/dashboard/commerce?tab=serialized`, `scan`, `returns`, `shipping` | Physical lookup/printing remains; external returns require manual accounting; PDC remains available |
| `/dashboard/products` and `/dashboard/products/edit/:id` | Current availability on list; content editing retained; built-in quantities/costs frozen and labeled |
| `/dashboard/orders`, `/dashboard/orders/confirm`, `/dashboard/live-chat`, `/dashboard/hr?tab=users` | Platform workflows remain available in both modes |
| `/`, `/search`, `/products/:slug`, `/cart`, public AI pages | Consistent cached availability without remote merchandising changes |

Local component screenshots are under `/tmp/elcomputer-erp-audit/ui/`: `connected-inactive.png`, `active-outage.png`, `arabic.png`, `arabic-mobile.png`, `arabic-dark.png`.

> **E172 /1November2026:** [Minimal metadata qualification complete locally](woocommerce-history-metadata-review.md).1,088source-keyed metadata entries qualified; existing core records/41receipts stay unchanged.204of205total differences match archived zero-decimal rounding; one and5coupon cases deferred. Notes private, missing/order-time SKUs and comment logs deferred. No production installation or approval. UI/UX review NEXT; original E171 assessment below remains evidence.

# WooCommerce history — read-only reassessment

Verified **1 November 2026, Asia/Riyadh**. **SOURCE AVAILABLE. READ-ONLY ASSESSMENT
COMPLETE. Core history is already imported; no repeat import is needed.**
Production remains **1fd7ef6909869361/schema107/source7d989cd**, app PID140566,
Caddy PID26652. No migration, deployment, restart, import, claim, provider request,
email, archive execution/write or Git push occurred. No live approval was prepared.

## Source and proof boundaries

Read current AGENTS/README/Notes, roadmap, both handoffs and migration receipts.
Inspected all42 existing worktrees and reused the deployed implementation and the
consumed25October import. Main is not deployed application lineage. The old
3c9f5764 import and dd931679 SEO approvals remain consumed; never replay them.

Authenticated both full local SQL backups as data only, verified every plaintext
byte against their AES-GCM receipts, and re-counted exact `wp_` table names.
No SQL dump was executed or loaded into a database. No PHP/WordPress code ran.
`old.elcomputer.net` was not requested, so no archive cron, callback or integration
could be initiated through storefront access. Both encrypted archives retain their
original SHA256, size and modification time.

The approved primary is `wordpress-primary-20261020`, raw encrypted SHA256
`4c62f42b156e40cc45ccdf7ba43ef682ea7ab234362ecb53963f7e9a8ec7aefd`.
The comparison SHA256 is
`2d415414ec29907d5f88d86205bd7370b33eed148cffc611687eedf75e7abcdb`.
Both are under the existing private actual-vps-reinstall-preparation-20261020
backup directory. Local decryption tools/key and read-only destination access work;
no credentials or personal records appear in this report.

The filename is not proof of an exact final transaction cutoff. Primary order
creation dates run **13January–16October2026 GMT**. Counts below cover the frozen,
previously approved primary archive. Changes beyond that snapshot are unverified;
a broader legacy delta would need a newer immutable export and cutoff evidence.
There is no missing access needed to assess this approved snapshot.

## Fresh primary counts

| Source records | Verified count / meaning |
| --- | --- |
| WordPress registered accounts |518:516 ordinary customers and2 administrators |
| Guest orders |110;84 distinct nonempty billing-email strings, not verified people |
| Woo guest lookup rows |88 of590 lookup rows; lookup IDs are not Auth identities |
| Historical orders |591 |
| Separate Woo refund records |6;597 total order/refund records |
| Order-related items |1,789:721 line items,582 shipping,403 fee,83 coupon;0 tax rows |
| Customer billing / shipping snapshots with a street |404 /105 |
| Order billing / shipping snapshots with a street |591 /590 |
| HPOS mirrored address rows |1,194 billing/shipping rows across597 records; not additional addresses to import |
| Historical fulfillment observations |702 already preserved |
| Checkout notes / order notes |12 /8,353;236 order notes marked customer-facing,8,117 other/private |
| Product / variation records |626 /73;576 nonempty SKUs across them |
| Distinct product IDs referenced by line items |176;2 no longer exist in archive product/variation rows |
| Orders with a transaction reference |10; absence does not prove unpaid or paid |
| Source refund-request cases |6 separate request records; not6 additional executed refunds |
| Source wallet transactions |32 historical rows; no current wallet credit or ledger action |
| Legacy order/webhook logs |114; preserve as archive evidence, never replay |
| Active Nuxt orders / saved addresses |8 /2; separate from history and unchanged |

Address counts require a nonblank street. They count snapshots, not unique people
or addresses. All1,032 customer address JSON objects and1,194 order/refund address
JSON objects are preserved in existing immutable history, including empties.
There are1,690 street-bearing customer/order snapshot occurrences. A conservative
source/owner/address-kind/all-fields fingerprint produces1,440 review candidates;
**no addresses were deduplicated, promoted, deleted or copied**. The separate
physical-location-only count871 is not a safe automatic address-copy count.

Source billing cities are missing on148 orders; shipping cities on146, and one
order lacks a shipping street/country. Customer snapshots have still more missing
components. Keep missing versus empty, names/phones and original text. Do not guess
Nuxt governorate/city IDs or overwrite newer saved addresses.

The authoritative store setting is classic posts (`custom_orders_table_enabled=no`),
with HPOS synchronization enabled. All597 HPOS mirror rows match classic source
status, currency and total value. They are corroboration, not a second import.
The comparison has518 users/513 customer roles,589 orders,6 refunds and1,783 items.
Only516 user IDs overlap; each snapshot has two unique IDs and one shared email
changed. Do not union the snapshots. Earlier inventory included plugin-shaped rows in user/post counts; only the
exact-table counts above are used.

## Status, money and missing metadata

All597 order/refund records use EGP. Order statuses:323 completed,254 cancelled,
6 processing,5 refunded and3 failed. All6 refund records are completed source facts.
These labels never create a current Paid state, receipt, collection or refund.

Payment-method labels are preserved as recorded:443 COD; the remaining148 span
Kashier variants, bank transfer, EasyKash, InstaPay and historical Paymob methods.
Only10 orders have a transaction reference. Gateway configuration is not payment
proof: four Paymob gateway rows are configuration; Pixel intentions, card tokens
and Woo payment-token tables have zero rows. No old credentials/tokens migrate.

All591 original order totals/currencies/dates and all6 refund snapshots already
match their approved payload in production. Discounts are nonzero on21 orders,
shipping on509; all explicit order and shipping tax totals are zero. Original
fee/coupon/shipping rows remain in the1,789 imported item records.

A simple line+fee+shipping+tax sum differs from the recorded grand total on205
orders. Coupon-row sums differ from the source discount aggregate on5 orders;
208 unique orders have one or both exceptions. These are source-fidelity review
cases, **not imported-total mismatches**. Original totals and item facts remain
unchanged; do not retotal, infer collection, fabricate tax or mark reconciled.
Detailed record exceptions are encrypted outside Git.

The current history record whitelist omits explicit order-level discount/shipping/
tax aggregates, checkout notes, order comments and historical SKU values. It does
retain original product IDs, item names, amounts, payment references, addresses,
refund parents/reasons and dated/raw fulfillment observations. Item names are all
present, so renamed/deleted/unpublished products need no guessed current catalog FK.
A future metadata supplement must preserve explicit zeros and source values even
when components differ. No schema change is necessary for the existing core;
no new migration number or supplementary storage design is approved here.

One completion-date metadata conflict is retained in `date_variants`, with no
guessed timestamp. All other core money/quantity checks pass. Refund per-item
allocation metadata is absent; do not invent item refunds or stock restoration.
The six separate refund-request cases have no order-ID column, so their order
association is unproven. The32 wallet records and114 webhook logs also remain
unmapped ancillary source facts; never convert them into active operations.
One archived follow-up-email/order linkage is excluded from active email queues.

## Current schema107 reconciliation and privacy

Current five private history tables contain one visible source,516 customers,
597 order/refund records,1,789 items and41 durable command receipts. Every customer,
order/refund/item JSON record and reviewed ownership flag matches the sealed import.
Fresh raw-source normalization reproduces the core payload exactly; deterministic
batch IDs match and all41 database receipts equal the original execution receipts.
**Planned core inserts0; updates0; Auth accounts/password imports0.**

The private source UUID is `b89ee96a-9964-5f7f-adb5-dece550d929f`. Composite keys
`(source_id,legacy_id)` retain original IDs and prevent collisions with current
ORD numbers/UUIDs. A changed/re-encrypted export is not permission to create a new
source namespace for the same old records. Changed immutable records or conflicting
receipts must be held for review, not overwritten or silently retried.

Private RLS and ACL checks pass: anon/authenticated/service_role have no direct
private-table privileges; only service_role can execute the four mediated RPCs.
All five tables have RLS, and there are **zero noninternal history triggers**.
The hosted function bodies match the versions exercised by local fixtures.
Import writes only the five history tables; claim writes only its customer link;
hide writes only source visibility; read performs no writes. No network function
is called. Current Email/SMS/ERP/payment/stock/shipping triggers target live tables,
which history import never touches.

Current Auth/profile counts are9/9, with6 verified accounts,0 anonymous accounts
and1 admin member. Existing UUIDs/credentials/profiles remain intact. No WP password
is copied: all518 source hashes use the WordPress-specific prefixed bcrypt family.

Persisted source approval is513 conditionally claimable customers and3 held
(two primary-only identities and one changed registered email). Approval is not
mailbox verification and no account was automatically linked. **Actual claims0.**
A current unverified account corresponds to a source-approved identity with two
orders; runtime access remains withheld. The current re-evaluation therefore has
512 conditionally eligible /4 held-at-runtime cases without changing stored flags.
The one verified eligible current match has no historical orders. Positive hosted
order-detail acceptance is consequently still pending an appropriately authorized,
verified order-bearing customer. No account, verification message or claim was
created for testing.

Ownership requires the explicit confirmed-customer action. The server derives
UUID from Auth, rejects caller-selected IDs, and SQL rechecks current verified
email, active profile, unique claim email and the approved source. Read also binds
the linked Auth UUID and current registered email; account changes cannot transfer
history. Normalize only case/whitespace for matching, never provider email aliases.
No billing/contact string or customer note proves mailbox ownership.

All110 guest orders and21 excluded/missing-owner orders remain unlinked/private.
Fifty guest orders have billing emails matching registered source customers; they
still cannot be attached that way. Guests use per-order provenance, not a fabricated
customer/account. Held/ambiguous cases need separate ownership evidence.

My Account → Previous orders has EN/AR, explicit connection, owned list/detail,
archived addresses/refunds and stored fulfillment facts. Client account changes
clear private state and discard late responses. Customer routes are private/no-store;
anonymous hosted history returns401. Current Dashboard order management reads
`customer_orders`; a dedicated staff historical viewer is not implemented. Keep
future staff history views read-only and permission-scoped in the later UI phase.

## Exact mapping and hold rules

| Source | Existing destination / proposal | Rule |
| --- | --- | --- |
| `wp_users.ID,user_email` + customer `wp_usermeta` | `customer_history_private.customers`:legacy_id/email/record.profile/billing_address/shipping_address |516 existing; source-approved claim gate, no Auth/profile writes |
| Primary snapshot identity/hash | `customer_history_private.sources`:id/source_key/snapshot_sha256 |Reuse existing namespace; no new source to bypass duplicate detection |
| `wp_posts` shop_order + `wp_postmeta` | `customer_history_private.orders.record` |591 existing; exact total/currency/status/date; retain original customer ID |
| shop_order_refund + parent/refund metadata | Same private orders table,kind=refund |6 existing; original parent/amount/reason, never execute refund |
| Classic `_billing_*`,`_shipping_*` | Embedded immutable customer/order addresses |No automatic promotion into `customer_delivery_addresses` |
| Mirrored `wp_wc_orders`,addresses,operational data | Comparison evidence only |Never double-count orders/addresses or override authoritative classic data |
| Woo order items + itemmeta | `customer_history_private.items.record` |1,789 existing; source item/order/product/variation IDs and original title/quantity/money |
| Method/title/transaction/paid/completed metadata | Private order facts/date_variants |Never create live Paymob transactions or infer cash collection |
| Existing source shipment metadata | Private order AWB/reference/702 observations |Display facts only; no PDC job, polling registration or callback replay |
| Deterministic history batches | `customer_history_private.batches` |41 existing immutable receipts; same command returns same receipt, conflict stops |
| Discount/shipping/tax aggregate fields; SKU | **Unmapped private metadata proposal** |Keep original core immutable; no migration or update currently proposed |
|12 checkout notes /8,353 order notes | **Unmapped private metadata proposal** |Default private; review customer projection separately, never expose8,117 internal notes |
|6 refund-request cases | **Held ancillary source cases** |No proven order mapping/executed-refund meaning; no current after-sales action |
|32 wallet transactions | **Held historical ledger facts** |No current wallet credit, Treasury entry or settlement inference |
|114 legacy webhook logs;follow-up queues;gateway config | Archive evidence/excluded operational state |Never replay notifications, callbacks, jobs, marketing or credentials |

## Dry run, testing and rollback design

Reused22 existing tests against synthetic local fixtures: planning, explicit
source approval, guest/staff/email separation, immutable records/receipt replay,
rollback on changed current data, direct-grant denials, source hide, actual H3
handlers, account changes and EN/AR component behavior. Three parser safety tests
also pass: exact table prefix/hash removal, injection refusal and PHP-object refusal.
There were zero non-loopback network attempts in fixture tests. SQL tests use
synthetic in-memory PGlite only, with no real backup/customer data or credentials.
No production/archive DB mutation or real Auth action was performed.

All raw bytes/authentication and core-record comparisons passed. Original145
public/private/catalog/Auth/Storage projections were compared:143 unchanged,
only ordinary analytics events/sessions grew. All five history tables separately
match the pre-SEO snapshot exactly; original41 durable receipts match. Nine current
accounts/profiles,eight current orders andtwo saved addresses remain unchanged.
All17 protected deployment files, source commit and app/Caddy PIDs remain unchanged.
At12:20Riyadh MON completed normally with five existing warnings/zero critical/gaps2;
Email/tracking timers active and callers successful, CARD/COD/purchasing available.

No native107 restore, hosted customer claim or real authenticated detail view was
run. Keep these limits explicit; local checks are not owner acceptance. Any future
extension needs synthetic ownership/revocation/concurrency/duplicate/recovery and
queue-boundary qualification before an application/schema/production approval.

For a future approved history-only change, retain original source IDs, namespace,
immutable core and bounded content hashes. Produce private added/unchanged/conflict/
held reports first; never treat a replay as another purchase. Existing idempotent
transactions lock the source, reject changed batches/records and return durable
receipts. Do not run them during assessment or reuse the consumed import operator.
Uncommitted transactions roll back; committed history withdrawal requires a
separate reviewed source-hide action that retains records/receipts. Never restore
an old whole database over current accounts/orders or erase import evidence.

**Smallest next qualification:** a local, private metadata-supplement dry run for
original financial aggregates, SKU and note fields, with208 source exceptions
preserved and internal notes inaccessible. Decide a minimal compatible storage/
projection design only after this mapping. Existing core needs no reimport.
Keep production writes/imports OFF and do not prepare a live approval yet.
Hosted verified-owner acceptance remains a separate DTR-06 requirement; do not send
a verification email or make a claim to manufacture an eligible test account.

Owner priority `OD-20261101-MIGRATION-NOW-01`: migration now, then customer/Admin
UI, Paymob enhancements after the provider reply, detailed PDC settlement/ERP LAST.
No unrelated SEO/UI/provider development occurred. All42 worktrees and35 deferred
IDs/prior evidence are retained. Private aggregate/encrypted evidence:
`/Users/imac/Documents/ELcomputer/woocommerce-history-assessment-20261101`.

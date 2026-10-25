# Required WordPress customer migration

**Production history import PASS — 2026-10-25,23:07:33.882 Riyadh.**
[Current receipt](customer-history-import-receipt.md): exact3c9f5764 approval consumed,
41 batches/516 customers/591 orders/6 refunds/1789 items/702 events.513 conditionally
eligible,3 held; actual claims0. Three scoped history routes loaded/one Caddy signal,
no app restart/schema deployment. Original140 projections and three current users/
profiles preserved; signup/purchasing/provider initiation closed. Hosted ordinary
ownership acceptance remains pending. Next: small EN/AR notice release before signup.
Earlier READY/pending/source-only statuses below are retained historical evidence.

**Final import milestone — 2026-10-25:** [source-bound packet](customer-history-final-import.md)
is READY for separate exact owner approval3c9f5764.516 customers/591 orders/6 refunds/
1789 items/702 events;513 conditionally eligible identities (1 current verified,
512 later signup),3 held.131 unlinked orders stay private. Fresh native94 recovery/
final41 batches,140 original projections and seven operator checks PASS. The same
approval covers three required history API routes/one Caddy signal. No production
import/routing change/Auth creation has run. Earlier preview references below are
retained history; final payloada34838d6 supersedes the zero-claim import candidate.
Source/deployment decisions are complete; do not repeat them.

## Retained earlier implementation and deployment evidence

Current2026-10-25: recovery/controlled confirmation are ACCEPTED. Use the
[next guarded approval packet](customer-migration-approval.md). The refreshed
dry-run preserves three confirmed current customers and the original516 historical
customers,591 orders, six refunds and1,789 items. This plan authorizes no import.
The exact source/cutoff/exception seal is owner-approved. Claims remain zero;
the [inactive91→94 deployment](inactive-history-release.md#production-result-and-consumed-approval)
completed21:31:49.255 Riyadh as releasebc05eef266eeb7de/schema94. Replacement
seal4c332350 is consumed; never rerun it. All history tables remain empty and the
prepared41-batch import check passed read-only. Final reviewed eligibility/payload,
fresh current-target recovery and separate import approval are next. The catalog
deployment pause can end; do not repeat source or deployment approval.

[Current owner requirements and release order](customer-access-release-plan.md)
require original registered email via verified signup/recovery and an ordinary
My Orders → Connect previous orders experience. That claim UI/API is already in
the sealed inactive release. The EN/AR notice/generic login guidance follows in
the next small release before public signup; no incompatible hash is imported.

Current implementation and actual dry-run:
[customer migration release](customer-migration-release.md), 2026-10-25.
Customer/history migration is now on the public-launch path, after email
acceptance and before public signup. Its local source lives on
`local/customer-history-launch-20261025`; production import is not authorized.
All518 inspected password hashes use WordPress's prefixed bcrypt/pre-hash format.
The implemented transition uses supported verified signup/account recovery;
it does not import these hashes or overwrite existing Nuxt identities.

This follows the disabled Paymob/PDC release and controlled configuration.
Prepare offline first. No customer import is authorized by release approval.
Never rerun the completed product import or change the existing Auth project.

## Inputs and identity matching

Use the preserved original WordPress/WooCommerce snapshots. The handoff records
518 user identities per snapshot; reverify privately before selecting a source.
Fingerprint each snapshot and identify its site, prefixes and cutoff. Reconcile
snapshots by stable source/user/order IDs; never combine two full snapshots blindly.
Inventory algorithm/version counts without retaining password hashes in reports.
Inventory both legacy and current order-storage layouts before extracting orders.

Export existing Supabase Auth UUIDs and verified login emails read-only into an
encrypted private workspace. Profile, contact and order emails are not identity
proof. Preserve all current UUIDs, roles, profiles and orders. Do not auto-confirm
legacy email claims or give imported users staff privileges.

Use a durable private source/legacy-user-to-Auth-UUID mapping. Reuse an existing
identity only after an unambiguous verified-email match and ownership review.
Resolve shared, missing, conflicting, changed and unverified emails explicitly.
Treat staff and customer records separately. Never infer aliases, collapse email
providers' address variants or create a second identity to resolve a conflict.
Reserve the reviewed mapping before creating a genuinely missing identity.
Concurrent retries must return its existing result, including lost responses.

## Login compatibility

Inspect the actual legacy hash families and authentication extensions offline.
Choose a verified compatibility mechanism or an owner-approved password-reset
flow using the existing Auth boundary. Verify any proposed mechanism against
current official Auth documentation and synthetic accounts first. Do not paste
legacy hashes into unsupported Auth fields, store plaintext passwords, overwrite
current Auth credentials or log passwords/hashes. An already existing Supabase
identity keeps its working credentials. No login bridge may bypass verification,
rate limits, account status, authorization or recovery controls.

## Profile and historical data

Extract real names, phones, private billing/shipping addresses and useful profile
fields with provenance. Preserve missing versus empty values. Review conflicts
with newer customer edits instead of overwriting them. Keep original source IDs
and distinguish registered customers from guest purchases; an order's contact
email never creates or proves an Auth identity.

Historical orders require a separate immutable historical representation and a
customer-scoped read projection. Preserve original item snapshots, quantities,
currency, totals, payment/status records, refunds, dates and source order IDs.
References to products may reuse the completed catalog mapping; never remigrate
products or invent missing items, fees, stock or payment facts.

Importing history must not call checkout or insert through active commerce
transactions. Do not allocate/deduct inventory, charge providers, book shipments,
send notifications, post treasury cash or start fulfillment. Do not disable
application triggers/RLS globally. A historical paid status records source facts;
it is neither a new payment nor a current cash-reconciliation event.

## Review gates

1. Produce a private bounded dry-run: source counts, mappings, duplicates,
   conflicts, rejected rows and exact planned changes. No production writes.
2. Test only disposable Auth/database fixtures. Cover shared emails, existing
   UUID preservation, guest/staff separation, concurrent/repeated imports,
   interrupted receipts, address conflicts and customer-to-customer isolation.
3. Prove that every historical import leaves live inventory, orders, ledgers,
   provider requests, shipping jobs and notification queues unchanged.
4. Reconcile source/target counts and original money values; retain encrypted
   backup, per-record provenance and durable partial-result receipts.
5. Present exact source fingerprints, conflict decisions, target binding and
   rollback limits for separate owner approval before production import.

Keep unrestricted signup disabled until identity matching is accepted.
Before any first controlled purchase, separately confirm saleable physical stock,
actual coverage/charges/parcel settings, confirmed customer login and reachable
callbacks. The disabled release alone cannot satisfy these business gates.

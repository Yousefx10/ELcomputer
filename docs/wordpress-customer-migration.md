# Required WordPress customer migration

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

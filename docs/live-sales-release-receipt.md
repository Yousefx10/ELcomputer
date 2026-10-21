# Paymob/PDC disabled production release — 2026-10-21

**DEPLOY PASS. Owner browser acceptance PASS. Do not rerun.**

The owner subsequently reported all listed browser checks passed on 21 October:
Dashboard, Products/images, Orders, Shipping, Quick Setup and browse-only holds.
The original execution receipts retain their historical pending-browser state.
Next is [private existing-account configuration](provider-configuration.md);
the owner confirms provider credentials have not yet been entered.

The owner approved the corrected release at `108d9df` and said Dashboard editing
would be paused. The exact reviewed operator ran once using only
`paymob-pdc-auth-drift-resolution-20261021/prepared/plan-reviewed.json`.
All guards passed. Reviewed tools, source files, artifact and plan stayed unchanged.
The original blocked attempt and its retired approval remain preserved.

| Binding | Verified result |
| --- | --- |
| Deployed release | `d2d7a8029b473e4a` |
| Application source | `21f54e49f7da3a1f39e3802ec8e366f499fcb286` |
| Approved correction commit | `108d9df7f49913e421e2ee5d846b2e02de0eb888` |
| Approval seal | `e81236a4ab2faf0961be6f852a58424de4e8f2e3a3334006dd32266155531c5e` |
| Archive SHA256 | `d2d7a8029b473e4ae82d562abc0c8534e14e9f12a44c4daaff9f4a57f4ffd382` |
| Archive bytes / verified output entries | 6,630,641 / 1,367 |
| Inventory digest | `c32591d17593dede7d6e4c74c3b56ba4b21485a91656831501b6501e7974e25c` |
| Retained immutable client assets | 331, individually verified after deployment |
| Schema | 87; exact history identities and stored sources verified |
| Execution window | 2026-10-21 02:45:55–02:52:54 Riyadh |
| Operator completed UTC | 2026-10-20 23:52:54.735 |
| Independent read-only verification UTC | 2026-10-20 23:53:04.925 |
| Active current | `/srv/storefront/releases/d2d7a8029b473e4a` |
| Nuxt | PID 25021, active/running, zero automatic restarts |
| Caddy | PID 23477 unchanged; no configuration or service operation |

## Ordered gates and preservation

Local hashes, clean Git state, pinned target/runtime, protected inputs, prepared
backup envelopes, migration sources and all protected security/business bindings
matched before execution intent. The corrected Auth policy still protects all
33 non-activity columns, membership, schema and Auth relationships. No Auth write,
timestamp manipulation, password reset, permission exception or identity was added.

A fresh encrypted database dump authenticated and passed both `pg_restore --list`
and full SQL readback into `/dev/null`. Eight encrypted runtime recovery files
passed independent full-byte comparison. No plaintext backup file was created.
No backup key or local credentials were transferred to the VPS.

The exact candidate then passed native Linux startup on private loopback port 3100,
authorization rejection, unit validation and the service-user/systemd sandbox
create/fsync/read/delete probe. The candidate stopped before SQL. These checks
created no order, payment, label or provider request.

Only 86, then 87, applied in one bounded transaction. All 134 original table
projections, including both analytics tables, matched before commit. Auth activity
metadata also remained unchanged during this transaction. All earlier 85 migration
identities/sources remain exact. Service-only RPC, RLS, ledger and dispatch ACL
checks passed; the private dispatch ledger is empty.

| Migration | SHA256 |
| --- | --- |
| 86 `20261021010000_live_card_checkout.sql` | `04d26ea7cef634cc753c71663061e9a14a400efb8eb2741f7e9c158e87245790` |
| 87 `20261021020000_safe_pdc_dispatch.sql` | `1166201e9f0d9af4c8d2a4b8e04601c4e7318fbb82ce7609aa9f8e19f4927cd3` |

After commit, the current symlink selected the sealed candidate. One controlled
Nuxt restart activated it. Caddy stayed unchanged, including its SHA256
`504191ccdc985084cf9aa0bba4fc36b7cf2bcae7405af95abce469d56bd81558`.

Post-release comparison preserves 561 products, the existing one Auth user/identity,
four Storage objects and every original protected business row. All 2,613 public
media files / 410,096,992 bytes match their original hashes. Orders, payment
attempts, packing videos, normal/reverse shipping jobs and dispatches remain empty.
No existing image, historical data, Auth UUID or private packing file was removed.

## Private runtime and disabled controls

The only environment additions are `NUXT_SHIPPING_DOCUMENTS_DIR` and
`NUXT_PAYMOB_LIVE_REQUESTS_ENABLED="false"`. Their complete appended bytes match
the approval. All original environment bytes, unit, existing drop-ins, decoder,
old output and recovery metadata remain preserved.

`/srv/storefront/shared/private/shipping-documents` is empty, 0700 and owned by
`storefront`. The only new drop-in grants that exact path in `ReadWritePaths`.
Packing videos retain their existing private path and decoder. No public alias
or Storage upload was added. The new output inventory and all 331 retained assets
pass independent byte checks.

All five payment methods remain false. PDC, automatic labels and reverse pickups
remain false. `NUXT_PAYMOB_ENABLED`, `NUXT_PAYMOB_LIVE_REQUESTS_ENABLED`,
`NUXT_SHIPPING_LIVE_REQUESTS_ENABLED` and `PDC_LIVE_REQUESTS_ENABLED` remain false.
Hosted signup remains disabled and email confirmation required. No provider
credential was entered, exposed or changed; no live transaction or provider call ran.

Fourteen prescribed public GET checks pass: storefront and Dashboard login 200;
protected Products/customer APIs 401; EN/AR account entry 302; checkout/signup/login
and provider callback holds 403; private document path 404. Callback 403 is an
intentional hold, not provider reachability acceptance. Existing authenticated
Dashboard behavior and real merchant transactions still require acceptance.

## Encrypted recovery and receipts

| Fresh execution backup | Encrypted bytes | SHA256 |
| --- | --- | --- |
| Database | 8,742,635 | `d2772803b744e09ba7b5763fa5981d45f333d298b0d2118ee0323fddb0cf3735` |
| Eight runtime/recovery files | 94,347 | `2b3bea1e77fa782a103fa2d5ac99234b6bc45a38fae60a403860872dc9fa4d52` |

Private local evidence:
`/Users/imac/Documents/ELcomputer/paymob-pdc-auth-drift-resolution-20261021/prepared/`.
`release-receipt.json` binds 25 evidence files by SHA256, including the exact plan,
archive/inventory, exclusive intent, execution log/exit, encrypted backups,
candidate/provision receipts, SQL preservation/commit receipts, activation,
fourteen HTTP checks and independent read-only verification.
Its SHA256 is
`e2e91739dcbd2822f98af2089f789752d7fb33e8bfc54b6b8fda99f2131ee2f5`.
`completed.json` records PASS; no `STOP.json` exists.

Remote evidence remains under `/var/lib/live-sales-releases/d2d7a8029b473e4a/`.
The old release `82214df492a57126` and original 0600 runtime snapshot remain retained.
No pruning, automatic retry, rollback, database restoration or Git push ran.
Do not rerun either release command or the completed 82→85 operator.
On any later failure, preserve evidence for reviewed forward correction; the
[recovery limits](live-sales-release.md#recovery-and-acceptance) still apply.

## Completed owner browser acceptance

The owner reports PASS for these checks. No repeat is requested.

Use the existing owner account at `https://elcomputer.net`. Inspect without saving,
enabling providers, entering credentials or creating commerce transactions.

1. Sign in to Dashboard. Open Products and an original product. Confirm 561 products,
   saved details and existing images load.
2. Open Orders, Commerce → Shipping and `/dashboard/setup` provider links. Confirm
   existing screens load without access/schema errors. Payment/PDC/automation
   controls must remain disabled; inspect masked/configuration states only.
3. In a private window, confirm storefront images load and checkout/signup remain
   blocked. Do not submit an order or payment.

The browser acceptance milestone is complete. Current work prioritizes
configuring the owner's existing Paymob/PDC accounts through
Quick Setup's existing destinations. PDC uses its protected settings editor;
Paymob secrets use the existing protected runtime, not a new Quick Setup secret form.
This deployment approval does not enable those accounts or authorize live calls.

The required next workstream remains WordPress identities, old-login compatibility,
names, phones, billing/shipping addresses and historical orders. Preserve existing
Auth UUIDs, prevent duplicate identities and exclude all live commerce side effects
from historical imports. Follow the [migration plan](wordpress-customer-migration.md).
Before controlled payment/shipment acceptance, verify actual saleable stock,
delivery coverage/charges, parcel settings, customer access and callback reachability.
Public checkout requires its later explicit approval.

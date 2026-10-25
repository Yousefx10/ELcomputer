# Historical customer import — production receipt

2026-10-25, Asia/Riyadh. **HISTORICAL IMPORT PASS — APPROVAL CONSUMED.**
Completed at **23:07:33.882 Riyadh**. Independent read-only verification passed
at23:08:12.790. No further import or deployment is required for these records.

## Exact authorization and scope

The owner approved:

```text
APPROVE HISTORY IMPORT 3c9f5764901005600c8a3c22900975bdeed9199f277bb8299d2d8b0a771b70ad
```

The [sealed final packet](customer-history-final-import.md) executed once through
operator `de5c4142057c86f29a812af06cec9b9b566297ad`. Source approval70e929ee and
inactive deployment4c332350 remain separate completed decisions. Production is
still application `bc05eef266eeb7de` / schema94: **zero migrations, deployments or
application restarts** during import. No Git push.

Private authoritative workspace: `../customer-history-final-import-20261025/`.
`IMPORT-APPROVAL.receipt.json`, `execution-intent.json`,41 local batch receipts,
41 database command receipts, `execution/import-verified.json`,
`execution/ingress.json`, `execution/completed.json`, `POST-IMPORT-VERIFICATION.json`
and aggregate `IMPORT-RECEIPT.json` retain evidence. `IMPORT-STATUS.json` is
**CONSUMED_COMPLETE**. Never rerun apply or pre-import checks expecting empty history.
The original false template and sealed preparation evidence remain unchanged.

## Imported data and ownership

| Records | Imported | Conditionally eligible customer history | Held customer history | Unlinked |
| --- | ---: | ---: | ---: | ---: |
| Customer snapshots | 516 | 513 | 3 | — |
| Orders | 591 | 459 | 1 | 131 |
| Separate refunds | 6 | 6 | 0 | 0 |
| Items | 1,789 | 1,373 | 3 | 413 |
| Fulfillment observations | 702 | 696 | 2 | 4 |

All41 batches committed and reconciled. Every immutable customer/order/refund/item
record equals the approved payload, including totals/currency, dates, parent/item
relationships, archived billing/delivery addresses and fulfillment observations.
Source, payload, eligibility flags and evidence digests match the final packet.

The513 eligible identities are **not automatically linked**. Actual claims at
completion and independent verification: **zero**. One current verified ordinary
identity matches;512 require ordinary verified signup later.395 eligible customers
have orders;118 do not. The existing verified match has **no historical orders**.
It can verify archived-profile ownership and the empty-history view only.

Three customer identities remain held: two primary-only and one changed registered
email. Their one order stays private.110 guest orders and21 excluded/missing-owner
orders stay unlinked. Two privileged legacy users are excluded; two comparison-only
identities were not unioned into the source. Duplicate registered emails remain0/0;
one completion-date conflict retains both observations. No billing-email claim.

Claims still require an explicit action by a confirmed, active, permanent ordinary
customer using a unique matching original registered email. Server-derived UUID,
private RLS and service-only RPC rules remain. The import created no Auth account,
imported no password, and changed no current profile, order, inventory or ledger.
Historical payments/refunds/shipping remain read-only facts, with no provider action.

## Recovery and preservation

The final read-only preflight passed before intent. A fresh exported-snapshot
database/runtime backup then passed authenticated decryption and complete readback:

- Captured23:03:23.629 Riyadh; verified23:05:18.044.
- Database plaintext11,043,268 bytes;10 runtime recovery files.
- Encrypted database SHA256:
  `3e9ba3b3d706530538665b643cddff98b7af4db2853f6a3bd16485431bbe2911`.
- Existing qualified native94 restore/final41-batch evidence remained fresh.

Each production batch compared all140 original Auth/profile/commerce/Storage
projections before and after its transaction. All41 preservation checks passed.
Independent post-import comparison also found **zero changed original projections**
relative to the execution backup. Three current users, all confirmed permanent,
and three customer profiles remain intact. Credentials and existing records were
preserved; no catalog pause or current-data rollback occurred.

## Three required routes — loaded once

The exact reviewed one-line Caddy matcher extension loaded after full import
verification. It admits only GET history list, GET detail for the approved source
UUID and positive order ID, and POST explicit claim. No broad account/API wildcard.
One SIGUSR1 was journal-confirmed; Caddy PID unchanged, application restarts0.

The current Caddy file matches proposed SHA256
`90d9181a396ef69c46f2df1f69ca3991ac6eb2bb601fc6cb3aeb08cb7418511f`.
All other runtime recovery files equal the approved baseline. Signed Paymob
callback routing/authority is preserved. No public signup/purchasing/provider gate
was opened. VPS receipts are private under
`/var/lib/customer-history-import/3c9f576490100560/`.

Independent live checks passed11 cases:

- EN/AR login200; Cart and Checkout403.
- Anonymous list/detail/claim401; invalid-Bearer list401.
- GET claim, POST list and another-source detail remain403.
- Supabase settings separately confirm signup disabled and confirmation required.
  This settings check is additional to the11 route cases.

These checks prove routing and authentication barriers. They do **not** prove a
real customer's authenticated ownership claim or browser order-detail acceptance.
No live customer token/password was requested or used; no email was sent.

## Next guarded milestone

Prepare the small [EN/AR returning-customer notice release](customer-access-release-plan.md#returning-customer-notice--next-small-release)
before public signup. Preserve the current form, themes, responsive layout and
accepted confirmation/recovery; show generic help without an account lookup.
Its deployment and public signup activation remain separate approvals.

The existing eligible customer may explicitly use My Account → My Orders →
Connect previous orders to verify its archived profile/empty view. Hosted
order-detail acceptance needs an eligible order-bearing customer, either through
one separately approved owner-controlled signup or after approved public signup.
No account creation or confirmation email is authorized by the consumed import.

Then complete PDC/delivery/EGP50, manual merchant refund/reconciliation,
unpaid-expiry and final normal paid-order acceptance before purchasing approval.
PDC booking remains administrator-controlled after confirmation.

Any withdrawal uses separately reviewed source hide/routing reversal. Preserve
immutable records and receipts; do not delete/reimport, retry the consumed operator
or restore an old database over newer customers/orders. The backup proves recovery
availability; it does not authorize destructive restoration.

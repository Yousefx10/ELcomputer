# E64 — approval consumed with STOP; SQL95 installed, application not switched

Read [the STOP receipt](schema95-deployment-stop-receipt.md) and
[the separate asset recovery review](schema95-asset-recovery-review.md).
Do not execute this historical a510 packet again. Signup OPEN; purchasing OFF.
The qualification/approval description below is retained as historical evidence.

# Schema95 inactive Beta deployment review — E63

Qualified on 2026-10-26, 23:04 Riyadh. **READY for exact deployment approval.**
No deployment, migration, restart, production setting change, payment or PDC call
has occurred. Signup remains OPEN. Public purchasing remains OFF.

## Exact packet

Private packet: `../schema95-beta-release-20261026/review-2/plan.json`.
Operator: `scripts/schema95-beta-release/operator.mjs` in the main checkout.
The operator loads application inputs from the separate, frozen schema95 checkout;
main's schema91 application is never a deployment source.

| Bound input | SHA256 / identity |
|---|---|
| Deployment seal | `a510a04dd2d55b0b39c22c1b88437008ecaefbc1cc94ca3872305209840febab` |
| Frozen source | `b37be43ac6a24a663a12a5a56aaaa7e801827963` |
| Original application archive | `81becf54218a8e144137f2bdce7df1eed6bcc07745924c0167fcd7435aae37ff` |
| Only migration: `20261026170000_unrecorded_normal_sales.sql` | `fd9c028435f74caae6b3731ce7791573077838d00f9c3893ac3e10f484e2a508` |
| Separate retained-client asset bundle | `5ed2d468dc1abf211d8f84298f4a1d1cdbe166479a103121cc8d4f8965d12f41` |
| Expected current release / schema | `5a38201292763325` / 94 |
| Candidate release / schema | `81becf54218a8e14` / 95 |

The original archive, migration, manifest and Manual configuration draft are
unchanged. Schema96 and its location data are excluded. The first local preparation
stopped at a missing-asset guard, before backup or target writes. That evidence is
retained. A separately sealed companion now supplies 1,598 missing immutable client
files from the verified previous release. No existing candidate file is overwritten.
All 1,639 retained current client assets are bound and checked. No rebuild occurred.

Recovery evidence expires **2026-10-27 05:04:49 Riyadh** (02:04:49 UTC).
Fresh runtime, data, Auth, source and preservation guards also run before execution.
Expiry or drift requires a fresh review packet; never bypass a guard or reuse a
consumed intent. Existing consumed Auth/signup/deployment operators stay consumed.

## Approval scope

```text
APPROVE SCHEMA95 BETA DEPLOY a510a04dd2d55b0b39c22c1b88437008ecaefbc1cc94ca3872305209840febab
```

This permits only the pinned application's staging, the exact atomic 94→95
migration and its ledger entry, a temporary loopback candidate service, one current
release switch and at most one main application restart. It includes encrypted
pre-execution backups, asset preservation and read-only postflight checks.

It does **not** permit public purchasing, a live charge, a shipment, a PDC request,
Auth/CAPTCHA changes, runtime/Caddy edits, shipping-company or sales-setting changes,
Git push/merge/reset/cherry-pick, schema96, historical claims or automatic recovery.
The Manual50 draft remains staged for the separate controlled-purchase approval.
`inventory_tracking_required` defaults to true; configuring normal unrecorded-stock
sales is explicit at that next stage. Existing data and stock policies are retained.

## Qualification and preservation

- Fresh pinned read-only checks: correct installed release/schema94, signup enabled,
  email confirmation required, accepted Turnstile runtime unchanged, EN/AR login200,
  Cart/Checkout403 and anonymous history401. No Auth submissions or emails.
- Reused original 15 native transaction/stock/ownership/packing checks, typecheck
  and build. No completed customer, CAPTCHA or real-payment acceptance repeated.
- New tooling: 18 scope/seal guards, 12 extraction/asset guards and 6 native migration
  operator cases PASS, zero skipped. Exact SQL footprint also qualified locally:
  one default-true column, one expanded constraint, seven existing functions;
  original owners, ACL/RLS, unrelated schema, triggers and indexes preserved.
- Native failures verify rollback on unexpected schema and receipt-write failure;
  tampered SQL and a second application are denied. This is local qualification,
  not hosted migration acceptance.
- Fresh database backup: authenticated encrypted decryption, complete `pg_restore`
  TOC and full archive readback PASS. Runtime recovery: ten files, complete byte
  readback PASS. No plaintext production dump written; no full hosted restore claimed.
- All 145 protected table projections, imported history, Auth security, old migration
  statements and expected schema footprint are bound. SQL compares original rows
  inside the migration transaction before committing. Only the new default column
  and ledger/schema metadata are added; no business rows are rewritten.
- Signed Paymob callbacks and payment/normal-purchase source files are unchanged
  against the installed application. Runtime/Caddy hashes and callback ingress
  remain preserved. Outbound payment/shipping gates remain OFF.
- All 135 frozen changes in 14 original worktrees remain byte-identical. Separate96
  remains clean at `48437549bb66f635fac544ed3bcf5e5419ba8d14`. Both branches, detached
  context and existing commits are retained. Main receives tooling/continuity only.
- The 32-row deferred register is unchanged. Pending/skipped cases remain pending.
  PDC live operations and the original uncertain-booking incident remain paused.

## Execution and recovery

1. Use Node22.23.1 and the exact `check <private-packet-directory>` command. Stop on
   expiry, target/source/schema/ownership/media/asset drift or a consumed intent.
2. After the exact approval above, use `apply <private-packet-directory> <seal>`.
   The exclusive local intent and exclusive remote stage prevent a second attempt.
   Create and fully verify fresh encrypted pre-execution backups; recheck baseline.
3. Stage the unchanged archive and sealed asset companion; verify their union before
   any release switch. Apply only migration95 in one bounded transaction, with
   advisory/table locks and original-row/Auth/history/schema verification before
   commit. A precommit failure rolls back SQL; never retry an uncertain commit.
4. Start the isolated candidate against schema95 with the existing disabled commerce
   runtime. Check public content, anonymous denials, held payment capabilities and
   retained assets; stop the temporary service. It submits no customer or provider
   transaction. Then switch once and restart the main app once.
5. Verify new inventory/schema/ledger, unchanged runtime/Caddy/media/private files,
   Auth/security/history preservation, signup open, confirmation required and public
   purchasing closed. Record the completed receipt, or STOP with evidence. No retry,
   second restart, automatic rollback or automatic public activation.

Before the switch, failure leaves the previous app current. A committed additive95
migration may remain; do not rerun or drop it. After the switch, recovery needs its
own freshly reviewed exact approval. Keep purchase/provider holds in place, verify
the retained previous inventory/archive, require tracking=true and zero untracked
orders, then switch the current symlink back and restart once. Retain additive95;
do not down-migrate or replay old installers. Recheck signup/Turnstile/callbacks and
owned reads. Once any untracked order exists, retain compatible95 handling and fix
forward; do not roll back that order's fulfillment contract.

Database restoration is a last resort requiring separate approval and reconciliation
of registrations, callbacks and any other writes after backup. Never overwrite new
customer activity by blindly restoring a dump. Encrypted runtime recovery includes
the runtime, services, Caddy, private-file probe/extractor and previous inventories;
ordinary application rollback does not replace these unchanged files.

## Smallest remaining path to public purchases

After deployment passes, prepare **one** owner-operated genuine new-customer normal
storefront purchase. Its separate approval must bind the eligible product/model,
listed price, real address, Manual50 delivery terms, trusted total and one charge
budget. Configure the reviewed separate Manual company, CARD-only Beta policy,
unrecorded-stock option and delivery copy under that approval; keep public purchases
closed outside the scoped grant. Exclude QA/test products, drafts, nonpositive prices,
inactive models and preorder/coming-soon products. No PDC or tracking promise.

Verify quote+EGP50, authenticated order/payment ownership, one durable command/order,
one payment intention, actual signed paid confirmation and correct untracked
fulfillment state. Use read-only reconciliation for totals, foreign denial and
duplicate protections; no second card charge or callback replay against production.
Do not repeat accepted signup, session or packing acceptance. The QA address marker
is rejected by95; a real delivery address is required for the transaction.

Only after that transaction passes, request separate public-purchasing activation.
Bind manual exception monitoring, held-method exclusions, the runtime/edge kill
switch and the [existing manual cancellation/reimbursement process](public-beta-minimum-launch.md).
Keep late signed callbacks and protected owned receipts available when new purchases
are disabled. A transfer is recorded as manual reimbursement, never claimed as an
automatic Paymob reversal; retain evidence and prevent double compensation. Refund
automation, the other deferred tests, location96, storage audit and PDC stay separate.

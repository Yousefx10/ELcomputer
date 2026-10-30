> **E155:** future transactional Email ACTIVE on105; recovery8824 CONSUMED_COMPLETE, zero additional restart. First empty worker,12 scheduled batches and next09:10 MON/CARD/COD/privacy PASS. Queues0; no historical/test/provider email. [Current receipt and disable](customer-email-activation-review.md). Actual first genuine delivery remains pending; old approvals cannot be replayed.

> **E151,30October2026:** schema105 recipient fix [DEPLOYED INACTIVE / hosted postflight PASS](customer-email-schema105-deployment-receipt.md).40b consumed; never replay. App unchanged/no restart; all Email/capture/workers OFF. The separate future-events-only activation packet is being prepared.

# CX-EMAIL-01 — inactive recipient-ownership fix, E150

30 October2026. **RECIPIENT FIX READY / NOT DEPLOYED.** Automatic Email remains OFF.

## Minimum release

Production remains **1e931d20d19bde5a/source444c8fd/schema104**. The next migration,
verified against live history and all worktrees, is **105**:
`20261030040000_order_email_recipient_ownership.sql`.

The SQL adds one restricted private predicate and replaces two private function
bodies: `capture_order_email` and `order_email_reason`. The latter is already called
before queue materialization and at final dispatch. Existing public RPC signatures,
triggers, tables, RLS/ACLs, payment logic and bilingual templates stay unchanged.

Require the exact order owner's active, nonanonymous account, a confirmed Auth
mailbox, and a match to the saved recipient. An arbitrary checkout email proves
nothing. Missing/mismatched/revoked ownership withholds the message, without
rerouting it or changing any order/payment state. Invalid destinations need no
sendable event. Restoring ownership never replays a suppressed old notification.

Local source **083fc20a91542efd1b10872a18b6cebeb36d734d**, based on deployed444c8fd.
Only the migration and relevant test/fixture files changed. Every historical104
migration is byte-identical. This is **SQL only: no app deployment or restart**.
The successful local build is qualification, not a new installed application.

## Qualification

- **113 focused email tests PASS**, including the original31 and32 additional owner
  tests. EN/AR CARD pending, verified live CARD payment, and COD awaiting collection
  remain truthful. Unpaid/test/unverified/cancelled states never get payment success.
- Identity/verification changes at capture and after queue/claim suppress dispatch.
  Disabled/anonymous accounts, wrong owners, missing mailboxes and concurrent
  dispatch waiting behind the provider lock are covered. Callback replay, stable
  event keys, independent workers, durable linkage, uncertainty and retries remain
  covered. Browser roles cannot read ledgers or execute the restricted helper.
- **16 release guards PASS**: exact approval/hash/target/migration/expiry, key/sender/
  schema drift, no activation, preserved data, committed-checkpoint replay refusal,
  single migration attempt and no retry after uncertain COMMIT.
- Native **PostgreSQL17.11 migration/rollback PASS**:149 fixture data/security
  projections unchanged;395 unrelated functions unchanged; no new tables, triggers,
  backfill or Email configuration changes. Rollback restores the complete104
  catalog and rows. Production transaction guards bind all150 actual projections.
- **Node22.23.1 typecheck/build PASS**. Existing duplicate ERP-import warnings remain;
  no unrelated ERP correction. Full encrypted production database/runtime backup
  readbacks PASS. No plaintext backup or production secret enters build inputs.
- **Sealed preflight06:07:06Riyadh PASS**: installed files/process/runtime/Caddy/MON,
  104 catalog/checkpoint, disabled Email revision2/key/sender, CARD/COD availability,
  current warning identities, emergency budgets and worktree preservation.

An early guard-test fixture used two timestamps at a boundary; its failed log is
retained. Using one timestamp fixes that fixture; final16/16 is the accepted run.
The earlier E149 ownership failures remain preserved as the defect evidence.

## Inactive boundary and current health

All five Email provider controls stay false. Capture remains false/revision0;
worker secret/scheduler remain absent. Queues stay empty. No historical backfill,
provider request, email, private-test repeat, customer/order/payment/shipment write,
Paymob/PDC operation or Supabase Auth SMTP access is included.

CARD and COD remain live. MON is active: five existing terminal-unverified warnings,
zero critical, two recorded journal gaps unchanged. Both original emergency budgets
remain1. Original approved schema104 emergency controls are independent of this SQL
checkpoint; their files, reasons and one-use fences remain unchanged. No new budget.

The cancelled C1403FCFC6 COD order remains excluded, with no email/shipment. The
Brevo HTTP201/private mailbox delivery test remains accepted and consumed. All35
old worktrees and deferred IDs/evidence are preserved; the new source is isolated.

## Exact separate deployment approval

```text
APPROVE CX-EMAIL-01 SCHEMA105 INACTIVE RECIPIENT OWNERSHIP FIX 40b02e0559b1e3ca3bdc3a4a166ec279c75c5d8ca0258d90ee63ce6e4226a9d4
```

**Expires 2026-10-30 10:06:00 Riyadh. Start before 2026-10-30 09:56:00 Riyadh.**
This approval would authorize only one inactive104→105 migration. It does not
approve automatic Email activation, another send, worker installation or a restart.

Private packet: `../customer-email-recipient-fix-20261030/plan.json`, `seal.json`,
`operator.mjs`, `OPERATOR.md`, source, tests/rollback, encrypted backups and sealed
preflight receipts. No approval has been recorded and apply has not run.

Any failed guard, lock/policy/SQLSTATE, partial or uncertain outcome consumes the
attempt. Stop; inspect read-only. No retry, automatic post-commit rollback, down
migration, restore or history repair. A lost COMMIT response may already be105.

## After the separately approved deployment

1. Verify hosted105 predicate/ACL privacy, unchanged app/runtime, all Email gates
   OFF, no queues/backfill/cancelled-order mail, CARD/COD and next automatic MON.
2. Prepare a new, separately approved future-events-only activation packet. Reuse
   existing provider/mailbox acceptance; do not repeat the successful isolated test.
   Worker secret/scheduler and transactional/capture enable belong to that scope.
3. Retain bounded dedup/retries/uncertainty and the documented canonical Email disable
   procedure. Never infer delivery from acceptance or collected cash from shipping.

**ONE next action:** approve the exact inactive recipient-fix deployment above.
After Email, Pixel/Pay Again waits for Paymob; genuine eligible PDC shipping/tracking,
SEO/Search Console/redirects and remaining deferred work follow. Financial ERP stays LAST.

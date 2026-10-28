# Current status: CONSUMED / DEPLOYED — 28 October 2026

This exact approval executed once. [Deployment receipt](customer-payment-first-fix-receipt.md).
Do not replay it. The original review below is retained as history.

---

# CX-PAY-01 first production fix approval review

Status: **READY for separate exact approval; NOT APPROVED / NOT DEPLOYED.**

Read [the audit and implementation review](customer-payment-safety-review.md).

Production baseline: **b4b502a03207713a / schema98 / application PID58599**.
Read-only preflight **28 October03:34:15Riyadh PASS**. MON-01 enabled, active/waiting,
report complete/fresh, two provider-unverified exceptions. Shared purchasing
emergency-close budget1 remains unused. No production writes or app restarts.

Local source: `local/customer-payment-recovery-20261028`, commit
`bb21a160450c38c04477ae0081211d5fb5f17d58`, based on deployed MON lineage568c8dd.
Reviewed archive release **acfc97b72fe85237**, SHA256
`acfc97b72fe85237328cc2d1c2692865c63a07da00563f3a60bc85429e932b54`.
Node22.23.1 build/typecheck PASS;64 focused application checks (including real
Chrome EN/AR and disposable native PostgreSQL concurrency),5 release-guard checks
PASS. Exact archive extracted and all2374 assets served/hash-verified locally;
2267 old hashed assets and old versioned build manifests retained. Nuxt's mutable
current-build pointer correctly identifies the new build.

## Approved scope if the owner sends the statement below

- Truthful verified-payment projection and checkout/result/account/summary labels.
- Neutral address confirmation; order placement distinguished from payment.
- Existing attempts held for provider reconciliation; no unchecked reopen/new
  intention, historic retry or payment-method change. Fresh first payment stays
  behind current ownership, purchasing and immutable-amount guards.
- Dormant truthful notification input preparation. No automatic email or queue.
- Switch this application archive and restart the application **ONCE**. Bounded
  GET readiness tolerates startup502; failed readiness stops without another
  restart, automatic rollback or activation replay. Existing MON-01 stays enabled.
- Independent single-use local/host execution receipts. No consumed MON installer,
  recovery or timer approval is replayed or given manufactured missing receipts.
- Rebind existing emergency close to this release using the ORIGINAL single-use
  kill marker/budget1. No second purchasing-closure allowance is created.
- Postflight: immutable app/schema, public CARD/cart/signup/callback availability,
  protected API privacy, new browser assets plus retained samples, unchanged MON
  files/permissions and a fresh automatic report after cutover. Owner/customer UI
  acceptance remains distinct from local and technical deployment evidence.

**Excluded:** SQL/migrations, Caddy/runtime/unit/timer/worker/credential changes,
provider operations, emails/Auth SMTP, COD activation, PDC, SEO, unrelated work,
Git push/merge and all historical payment actions. Full Pay Again and automatic
notifications remain blocked on provider inquiry/lease and email activation work.
This is the first safe correction, not acceptance of the whole P0 requirement.
The customer's exact recalled green CONFIRMED message remains unproven; confirmed
ambiguous cues and incorrect payment-status derivation are documented separately.

## Exact separate owner approval

```text
APPROVE CX-PAY-01 FIRST FIX ac46dec13101b94ab12f71dfda2c07966733bc5db6066a50d632b5b8de575e0d
```

Seal: `ac46dec13101b94ab12f71dfda2c07966733bc5db6066a50d632b5b8de575e0d`.
Expires **28 October2026,07:33:32.216 Riyadh** (`2026-10-28T04:33:32.216Z`).
Approval must arrive before expiry and pass fresh baseline checks. No approval
has been issued or recorded on the owner's behalf.

Private sealed packet: `../customer-payment-recovery-20261028/plan.json`.
Read-only preflight: `node release-operator.mjs check` in that private packet.
After exact approval only: record it once, execute guarded `apply` once; wait for
one scheduled MON run before `verify`. If a guard fails, retain the stop evidence
and inspect. Do not re-run apply, fabricate switched receipts, or restart again.

**ONE next action:** the owner reviews this scope and sends the exact statement.

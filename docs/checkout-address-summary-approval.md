> E126: OWNER REJECTED SINGLE-ADDRESS SCOPE. The approval below is withdrawn and its operator refuses the recorded rejection. Multiple addresses and a separately reviewed migration are now required. Preserve this historical packet; do not execute it.

# CX-ADDR-01 — Schema101 application release review — E125

28 October 2026. **SINGLE-ADDRESS RELEASE QUALIFIED / FULL REQUIREMENT BLOCKED.**
**NOT DEPLOYED / NO OWNER APPROVAL / NO EXECUTION INTENT.**

## Scope decision

Current schema101 stores one saved address in each owned `customer_profiles` row.
There is no address-book table, list or selector in the existing checkout/profile.
Codex1's implementation collapses that single complete address. It does not implement
multiple saved-address selection. Full CX-ADDR-01 remains blocked on this requirement;
CX-ADDR-02 records it explicitly. An owner question is pending: ship the application-only
summary and defer the address book, or include the address book with a separately reviewed
migration. No deferral has been silently accepted and no migration number is reserved.

The exact approval below explicitly chooses the smaller release AND defers the address
book. If multiple addresses are required now, do not approve this packet. Preserve it and
finish that requirement before issuing a replacement review/approval.

## Reused source and compatibility

- Production verified read-only: **615506cd7c047ca8 / schema101**, sourcee47e9a7;
  PID68874. Fresh sealed preflight **20:37:09.967 Riyadh** passed. MON enabled/active/
  waiting,20:35:06 automatic report WARNING3, critical payment/ownership counts0;
  overdue-unverified2 unchanged. CARD/signup/Manual EGP50 remain available;
  COD/staff-COD/PDC outbound remain OFF. No provider outcome is inferred.
- Original29 worktrees, their HEADs/statuses and2918 pending-file hashes matched
  before continuity updates. Original4a3cd25, deployede47e9a7, location4843754,
  all branches/stashes and pending application work are retained. No push/reset/
  merge/rebase/cleanup. Additive30th worktree only:
  `../checkout-address-release-20261028/source`,
  branch `local/checkout-address-schema101-20261028`.
- Candidate source **fb824d4e8ade2e3471a54160413f81d80155fb09**, directly based one47e9a7.
  The checkout page is byte-identical to Codex1's reviewed4a3cd25 page.
  Only that page and its existing focused browser test differ from production source;
  the test now reads candidate CSS instead of an absolute older-worktree path.
- Every deployed server, migration101, payment/shipping/authorization/MON implementation,
  translation and reusable application setting is unchanged. No new configuration input.
  Complete single addresses collapse, Edit expands/focuses, incomplete/new addresses
  stay expanded, drafts/delivery choice remain, loading/account isolation is retained.
  Existing authenticated ownership/server validation remain authoritative.

## Focused qualification

- **16 actual address browser checks PASS / 0 skipped** against the schema101
  candidate/CSS: EN/AR, desktop1440/mobile390, light/dark, RTL, summary/edit/focus,
  retained draft/delivery selection, payment-step transition, incomplete/new and
  account-switch isolation. Network restricted to local fixtures; no order/payment
  intention request. This is local evidence, not hosted customer acceptance.
- Node22.23.1 typecheck/build and diff checks PASS. **5 release-guard tests PASS**;
  invalid exact approval rejected, with no approval or execution files created.
  No broad payment/provider/Auth/stock suite was repeated. No deferred test closed.
- Exact **3778 entry** archive unpack/inventory/secret-scan PASS.
  **2804 browser assets** all pass local real-serving-path
  HTTP200/SHA256. All **2697 retained immutable assets** preserve
  bytes, with the new mutable latest-build pointer. The established7 retained
  leading-dash URL entries were added to the generated serving registry only;
  original registry entries and every other output byte remain unchanged.
  Initial local packaging/check artifacts are retained, not deployed.
- Schema101 migration-history fingerprint and unchanged CARD/Manual50/PDC settings
  pass in explicit read-only transactions. Payment mismatches, duplicate success,
  unreconciled signed success and ownership mismatches0. No investigation restarted.

## Exact candidate

- Release: **0951137d1d85bfe4**; schema remains **101**, migrations **0**.
- Archive SHA256: `0951137d1d85bfe48a5c10c8601baaaaceae9a009f51968dbbd278f8d72d5b14`; bytes **23229999**.
- Plan seal: `6922b6d2488a505847e18e3523d452cbf5eccea79c70c9535f602d040ffb2c0e`.
- Private packet: `../checkout-address-release-20261028/plan.json`, `seal.json`,
  `release-operator.mjs`, `release-remote.py`, `OPERATOR.md` and qualified archive.
- Expiry: **29 October 2026, 00:36:37 Riyadh** (`2026-10-28T21:36:37.927Z`).

## Exact optional single-address deployment approval

```text
APPROVE CX-ADDR-01 SINGLE-ADDRESS RELEASE AND DEFER ADDRESS BOOK 6922b6d2488a505847e18e3523d452cbf5eccea79c70c9535f602d040ffb2c0e
```

This is a request for a NEW separate approval, as the owner's takeover instructions
require. It is not authorization and does not reuse any consumed approval.
No owner approval, deployment intent or remote stage exists.

If approved before expiry, mandatory fresh sealed target/source/archive/runtime/PID/
configuration/schema/CARD/MON guards run before one candidate loopback check and
**at most one ordinary application restart**. Runtime/Caddy/units/credentials,
MON lifecycle, provider settings, database and business data remain unchanged.
No order/payment/charge/refund/PDC booking/pickup/email or COD activation occurs.
Every public candidate/retained asset must then pass HTTP/hash postflight once,
followed by a fresh automatic MON report after cutover. Hosted owner acceptance
of summary behavior stays separate. Retain/rebind the ORIGINAL emergency-close
budget1 and callbacks; no new budget, automatic rollback, retry or repeated restart.
Any drift, expiry, partial result or transport uncertainty stops execution.

The remaining work before this narrow release is the owner's explicit address-book
scope decision and exact approval, then the mandatory execution guards. Broader
customer acceptance, DTR-33/STOR-01, all original deferred tests, the original paid/
unverified transactions and uncertain shipment references remain open and preserved.
Task2 LOC-01 still requires reconciliation of preserved historical96 numbering with
then-current repository/production history; no old migration is deployable unchanged.

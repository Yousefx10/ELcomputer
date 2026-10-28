> E130,29October2026: DEPLOYED57a5b31dd4d82156/schema103; approval661e429c **CONSUMED_COMPLETE**, never replay. One migration/one app restart;2911 public assets and next automatic01:15 MON PASS. [Actual deployment receipt](loc01-delivery-locations-deployment-receipt.md). Owner visual acceptance remains pending. Readiness/expiry below are historical.

# LOC-01 — offline governorate/city dropdowns — E129

29 October 2026. **LOC-01 READY / LOCAL PASS / SEALED PREFLIGHT PASS / NOT DEPLOYED.**
Owner address-book visual acceptance remains pending. No approval or apply attempt exists.

## Reused implementation and behavior

New32nd worktree `../loc01-20261029/source`, branch `local/loc01-20261029`, source
`34022ae87d92313a5e56f87a81ce099cdfaf0092`, based directly on deployed2236497/schema102.
Original31 HEAD/status inventories and331 pending-file hashes passed preservation
checks. No old worktree edits beyond these main continuity documents; no merge,
rebase, reset, cleanup or Git push. Original location4843754/a9a5c6f is unchanged.

Reuse the26October reviewed workbook, neutral names/aliases, original searchable
selector, translations, offline preparation script and validation/recovery design.
Latest owner `Address Mapping.xlsx` still matches SHA256
`0201a05d3fb724e06c208b10379caecc5087fe9db4e98ec3d1bd64d97b25a04e`.
27 governorates/382 reviewed cities,381 selectable. Others366 remains inactive;
ID21 keeps the corroborated name; ambiguous Arabic137/146 retain English fallback.
Cache-only/unparented cities remain excluded. Names do not promise carrier coverage.

Checkout shipping, owned multiple-address editing, `/account/profile`, and the
existing customer controlled-address editor reuse one dependent bilingual component.
Search accepts EN/AR names/aliases; changing governorate clears city and the existing
checkout quote/delivery guards resolve stale selection. Mobile/desktop, RTL and themes
retain the current layout. Typed search text is never submitted as a selected city.

The app bundles only reviewed public names, with no location API/edge route,
PDC dependency, reference-management redesign or deployment identity in reusable logic.
Existing address fields, ownership,20-entry limit, revisions, exact lost-ack retries,
account-scoped drafts, checkout intents and immutable order snapshots stay intact.
Known legacy names resolve without rewriting storage. Unmatched values remain visible.
An active customer may check out using their exact already-owned profile/book pair.
Unchanged legacy pair/contact edits remain supported; changing its pair requires a
supported selection. New book entries require supported pairs. No customer backfill.

## Migration and local qualification

Only new **103**, `20261029010000_customer_delivery_locations.sql`;
SHA256 `afd1776328eac0844e1ea8a639df60418b4f8c5338bbb7923d0611558639a8b0`.
Fresh read-only history confirms102 entries ending20261028210000; historical location96
was never applied and is not included or replayed. Migration103 adds two private
reference tables,409 reference rows, six private functions and two validation triggers.
Each existing checkout quote/command gains exactly one validation call; receipts and
intent fingerprints are unchanged. Reference tables use RLS with browser/server direct
access revoked. Existing profile/book RLS, RBAC and revision RPCs are retained.

- **32 native SQL/API tests PASS,0 skipped**: complete reference parity/aliases,
  parent/invalid pairs, legacy preservation, new/old owned addresses, anonymous/foreign/
  disabled rejection, direct grants/RLS, revisions, concurrency and safe errors.
  Synthetic CARD/intent/webhook regressions preserve amount/ownership/duplicate guards.
  Exact schema102 receipts recover after103 and removal of a legacy saved pair.
  Synthetic provider transport is local; no real provider or authenticated hosted
  acceptance is claimed.
- **35 actual-component browser tests PASS,0 skipped**: checkout/profile/shared
  selectors, new/single/multiple/legacy addresses, dependent search/reset, EN/AR/RTL,
 320/390/1280/1440 widths, light/dark, drafts, saves, uncertain replies, conflicts,
  removals, account switches, CARD-only and Manual50. External browser writes blocked.
  Eight profile screenshots and original-selector artifacts retained privately;
  mobile Arabic dark profile inspected visually.
- Native102→103 migration/rollback PASS, **145 protected projections unchanged**;
  Auth/history/storage/inventory/orders/profiles/book preserved. All prior schema
  objects retained except the two exactly qualified validation additions. No backfill.
- **7 operator guards PASS** (5 remote/2 database), Node22.23.1 typecheck/build and
  `git diff --check` PASS. Earlier local tool/harness stops are retained; final logs
  govern. No unrelated acceptance or deferred provider tests were repeated.
- Exact archive **57a5b31dd4d82156e8e0ed229580a5b657282e546390fbc62f81fc018b7e86e0**, bytes23989893,
 3891 inventory entries; readback/secret scan PASS. All2803 immutable parent assets
  retained; all **2911 browser assets HTTP200/SHA256 PASS** against packaged Nitro.
  Four compiled address routes deny anonymous requests401/private no-store.
  The existing seven retained-URL registry entries were restored locally, with all
  prior entries and other output bytes preserved. No production Caddy change.
- Fresh encrypted102 database full pg_restore readback and11 runtime/config file
  readbacks PASS. Recovery data stays private/encrypted; no DB restore performed.

## Current production and exact approval

**01:04:32 Riyadh,29October2026 sealed READ-ONLY PREFLIGHT PASS**:
currenta7fa8e8e3b7870d4/schema102/source2236497/appPID70394; exact installed archive,
certificate, schema/history/security, Caddy/runtime/units/config files and unused
original emergency budget1 match. CARD-only, Manual EGP50 and signup/email confirmation
remain live. COD/PDC booking remain OFF; MON active/enabled/waiting, last automatic
01:00:06 report WARNING3/critical0/complete. Payment/ownership/signed-success/duplicate
mismatches0; overdue-unverified2 retained. No provider outcome inferred.

Candidate **57a5b31dd4d82156**, source34022ae. Private sealed packet:
`../loc01-20261029/plan.json`, `seal.json`, `release-operator.mjs`,
`release-remote.py`, `database-release.mjs`, `OPERATOR.md`, archive and qualified logs.
Seal **661e429c7ba968065ec537ddb7af66be669da6017d68d661f7665759de3182ce**. Expiry **29October2026,05:03:49.596 Riyadh**
(`2026-10-29T02:03:49.596Z`). Per the owner's takeover instruction, deployment
requires this ONE separate exact approval:

```text
APPROVE LOC-01 SCHEMA103 LOCATION DROPDOWNS DEPLOYMENT 661e429c7ba968065ec537ddb7af66be669da6017d68d661f7665759de3182ce
```

Scope: exactly one103 migration (including409 reference inserts), one sealed app
cutover and **one ordinary app restart**. ZERO Caddy writes/signals/restarts,
runtime/MON/unit/credential/settings/stock/provider/payment/email changes or Git push.
No order, charge, inquiry, refund, booking, pickup or cash/Treasury transaction.
No old approval is reused. This packet is **not approved, staged or executed**.

Before execution, repeat the exact read-only sealed guards; consume one local attempt;
apply/verify/commit103 once; verify loopback; switch/restart once; verify installed
bytes, private routes, every public asset once and the next AUTOMATIC non-critical
MON report. Preserve/rebind the original unused emergency-close budget1 and callbacks.
Stop on drift/expiry/failed checkpoint/transport uncertainty; no retry, second restart,
automatic rollback or migration replay. Any partial/uncertain execution needs a new
exact recovery seal. Parentc86 consumed-stop and recovery17c complete stay historical.

Risks: brief app interruption and up-to5second schema lock wait. An old open free-text
editor must supply a supported or already-owned legacy pair after103. Reference
corrections require a reviewed versioned update. Hosted customer/owner acceptance is
NOT EXERCISED; the earlier address-book visual acceptance remains pending.

## Preserved next priorities

OD-20261029-LOC-01 supersedes historical queue ordering: after LOC-01, **CX-NAV-01
navbar welcome/name → CX-COD-01 only after written PDC cash amount units → CX-PAY-01
Inquiry/Pay Again/payment-method changes → SHIP-10/11 shipping/tracking completion →
CX-EMAIL-01 transactional emails → SEO/legacy redirects → remaining deferred work**.
The COD provider-unit blocker is not waived; if still blocked, progress independently
on the next authorized work without activating COD. DTR-33/STOR-01/original deferrals,
uncertain payment outcomes and PDC REF/AWB/no-retry boundaries remain intact.

**ONE NEXT ACTION:** owner sends the exact approval above before expiry.

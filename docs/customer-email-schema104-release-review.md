> **E145,29October2026:** 1e931d20d19bde5a/schema104 DEPLOYED INACTIVE. Approval e2663f CONSUMED_COMPLETE; never replay. One migration/restart, all3,129 assets and next automatic18:00:07 MON PASS. Configured Email revision2/key/sender preserved; all sending/capture/worker controls OFF, no email/provider request. [Receipt](customer-email-schema104-deployment-receipt.md). ONE private controlled test requires separate preparation/approval.

# CX-EMAIL-01 — inactive schema104 release review, E144

29 October2026. **SCHEMA104 READY / SEALED READ-ONLY PREFLIGHT PASS / NOT DEPLOYED.**
No approval or execution attempt is recorded. No production mutation, Brevo request,
email, worker activation or Supabase Auth SMTP access occurred.

## Exact release scope

Production remains **9aa61b64c2c5cf9f / schema103**. Candidate
**1e931d20d19bde5a**, source **444c8fd6e3955520071af07f1bf67e7cd467d60c**,
is directly based on deployed **8d75404b9acec7b137de471e7298fe80254c48fb**.
The preserved original Email worktree is unchanged. A separate35th worktree holds
this release copy. All34 opening worktrees and14,076 pending-file hashes are retained,
except intentional main continuity documentation. No merge, reset or Git push.

Reuse the exact five previously qualified code/migration files:

- Internal Email processing adds bounded order-event preparation.
- Existing Email service adds scoped order-event enqueue context.
- `orderEmailNotifications.js` renders truthful EN/AR order/payment content.
- `20261029120000_customer_order_email_notifications.sql` is the only migration.
- The existing31 focused checks remain unchanged.

All103 historical migrations are byte-identical to the deployed lineage. The104
migration hash remains **1e3af8f00edd377678656f63fe581cf807ddc7e4e0d15a28b861c837252386f2**.
It adds two RLS/service-only tables, default-disabled order-email configuration,
immutable per-order/event identity, scoped preparation RPCs and dispatch/retention
extensions. Only four existing function definitions are extended; the existing
Email/reset bodies are preserved as delegated functions. Checkout/payment/packing/
PDC/inventory business functions remain unchanged. No historical order scan/backfill.

Included events: order received for CARD/COD, plus coherently verified live CARD
payment. COD copy says cash is not collected. Payment copy requires authoritative
matching amount/currency, succeeded live attempt and unique successful transaction;
redirects, test signals, booking or delivery cannot prove payment. Recipient and
locale snapshots, one event identity, atomic enqueue/linkage, final-dispatch guards,
privacy and uncertain-send no-retry safeguards remain intact. Provider acceptance
and delivery remain separate observations.

Remaining fulfillment/cancellation, COD collection/remittance and reminder events
are unfinished CX-EMAIL-01 scope. No local or release result accepts those tests.

## All email delivery remains inactive

Live application Email revision**2** is preserved by complete-row fingerprint and
transactional table preservation, including its encrypted key and selected verified
sender. No key/ciphertext is selected for reports or decrypted by this packet.

| Control/state | Required after deployment |
| --- | --- |
| Provider, account approval, activation confirmation | All false |
| Marketing and authenticated webhook | Both false |
| Order-email capture | False, revision0, enabled_since/updated_by null |
| Email worker secret and scheduling | Absent/off; nothing added |
| Templates, messages, attempts, provider events, order-email events | Zero |
| Historical customer email backfill | Zero |
| Auth SMTP, Brevo configuration and sender/key | Unchanged |

The new capture trigger returns while disabled. Restarting the app cannot activate
capture, enqueue an old order or authenticate a worker. No settings save, provider
probe, verification email, test-send or account/DNS change is included.
Sender verification is owner-confirmed and stored; Brevo authentication/delivery
have not been independently exercised.

## Qualification and recovery evidence

- **31 focused email checks PASS /0 skipped**, rerun on the frozen implementation.
  Includes EN/AR/escaping, COD cash truth, verified/test payment distinction,
  no backfill, replay/lost acknowledgement, independent native concurrency,
  recipient/token/permission revocation, final-dispatch suppression and uncertainty.
- **11 release guards PASS /0 skipped:**8 remote scope/emergency checks and3 database
  approval/history/configuration/start-deadline checks. No writable connection opens
  without exact approval and a valid execution window.
- **PostgreSQL17.11 migration/transactional rollback PASS:** configured revision2
  fixture key/sender and COD-active settings retained;142 existing table data/security
  projections and383 unrelated function contracts preserved. Rollback restores the
  original schema/data/security. Default capture false; historical events0.
- Live103 schema/ownership/RLS/ACL/function footprint matched the reviewed delta.
  Future deployment transaction compares all**148** current protected projections
  before/after, preserving the configured Email row, Auth/history and business data.
- **Node22.23.1 typecheck and build PASS.** Six original bilingual previews remain
  available; owner visual/delivery acceptance is still separate.
- Exact archive SHA256 **1e931d20d19bde5aeda1f38a2fbf950e76755e294630077ad359cf9db779ac1b**,25,491,199 bytes,
  4,111 inventory entries. Secret scan and guarded extraction/readback PASS.
  **3,129 browser assets HTTP200/SHA256 PASS**, including all3,019 immutable parent
  assets; only the mutable current-build pointer changes. Seven retained negative-name
  asset URLs were registered locally before final packaging. No Caddy workaround.
- Fresh encrypted schema103 database/full pg_restore readback and11 runtime/config
  files/full-byte readback PASS. No production restore is authorized. Original recovery
  key stays private; no decrypted backup is written to a durable plaintext file.

Three pre-existing reset-coverage unknown tables remain fail-closed: delivery cities,
governorates and customer delivery addresses.104 introduces no additional unknowns.
The existing deferred register and its evidence are preserved; no broader reset fix.

**29 October 2026, 17:12:24 Riyadh: sealed READ-ONLY PREFLIGHT PASS.**
Same app PID76747/Caddy PID26652, exact inventory/certificate/fixed files/runtime,
CARD+COD, Manual EGP50 plus COD EGP50, CARD fee0, Email revision2/all-off. MON's
**29 October 2026, 17:10:05 Riyadh** automatic report completed with the same five warnings,
zero critical, unchanged fingerprints and two historical journal gaps. Payment,
unreconciled-success, duplicate and ownership mismatch counters remain zero.
Original purchasing kill budget1 and COD-only disable budget1 remain unspent.
Genuine COD orders0; new orders since activation0. Original uncertain PDC dispatch
remains quarantined; no retry, shipment, pickup, collection or financial action.

## ONE exact deployment approval

```text
APPROVE CX-EMAIL-01 SCHEMA104 INACTIVE EMAIL DEPLOYMENT e2663fb7457f5cafebfa42a27d9f58b5c565a069cc6833247e4806c209bf32ce
```

**Expires 29 October 2026, 21:10:52 Riyadh** (`2026-10-29T18:10:52.725Z`).
**Execution must start before 29 October 2026, 21:00:52 Riyadh** to retain a10-minute execution window.
Expiry/drift requires a fresh review and seal; do not approve a preliminary packet.

Permits **one additive103→104 migration, one exact app archive cutover and one ordinary
app restart**. The restart may briefly interrupt requests. It permits zero existing
business-data edits, historical migration changes, runtime/Caddy/unit/MON changes,
credential changes, provider/API/payment/shipping requests, email or Git push.
The new disabled configuration row and migration checkpoint are intended metadata.

Execution repeats all sealed-input, target/history/schema, Email/commerce, payment,
monitoring and unused-budget checks before writes. It consumes one attempt, verifies
migration preservation before commit, qualifies loopback, switches/restarts once,
then verifies104/all-off/private GET routes/CARD/COD/every browser asset. Wait for the
NEXT normal five-minute MON report; never manually scan/reset it. Cache the asset
receipt while waiting. Do not mark complete before that normal report passes.

Stop on SQLSTATE42501/55000/42710, lock/policy/checkpoint mismatch, drift, expiry,
failed/partial result or transport uncertainty. No replay, second restart, automatic
rollback, database restore or history repair.104 may already be committed if app
cutover fails. Native rollback proves rollback before commit; a committed migration
needs separately approved recovery, preserving all genuine orders.

## Existing emergency controls

Both controls are rebound to this exact release without minting a budget. They are
available only after recorded exact approval and an established emergency reason;
qualification does not execute them.

- COD-only disable uses the original activation's unused single-use record. It
  removes COD from the purchase policy and closes the manual-COD runtime gate,
  retaining CARD and all saved orders; one emergency restart, no DB rollback.
- Whole purchasing close uses the original unused purchasing budget1, preserves
  callbacks, and also works after the COD-only disable. No new kill budget.

Private operator/evidence: `../customer-email-schema104-release-20261029/OPERATOR.md`,
`plan.json`, `seal.json`, `sealed-preflight.log`, migration/guard/archive/asset/backup
receipts. Historical operators and the preliminary local seal are never replayed.

## After deployment

Prepare a separate **ONE-message** controlled test to the already approved private
mailbox. Keep future order capture off. Bind sender, reviewed content, private recipient,
one immutable intent, one dispatch budget and expiry under its own approval.
Only successful provider acceptance, verified actual mailbox delivery and owner
approval can precede future transactional capture/worker activation. No send or
activation seal is issued by this inactive deployment review.

**ONE next action:** owner supplies the exact deployment approval above before its
start deadline. CARD/COD/MON, shared worktrees, Pixel preparation, visual TODOs, SEO/
redirects and all35 deferred entries remain preserved. PDC financial/ERP work stays LAST.

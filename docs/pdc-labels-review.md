> **E161,31October2026 — DEPLOYED / CONSUMED_COMPLETE.** Production a98e465ae7611e73/schema106/source4238e9258d896f2ad708b30143cfb8aabcf2bc6d. Approval05fca90d consumed; one app restart,0 migration/SQL/provider/manual Email requests. All3,365 assets and next12:20 automatic MON PASS. CARD/COD/Email/emergency controls/current server settings preserved. Genuine PDF/physical printer/barcode acceptance remains pending. All approval and local-only sections below are historical; never replay apply.

# PDC labels — app-only schema106 release review

31October2026, E160 / SHIP-06. **LABELS READY locally; NOT deployed.**
Production remains ce4142a02ffd7afb/schema106. Previous106 approvals are consumed.
Source4238e9258d896f2ad708b30143cfb8aabcf2bc6d descends directly from deployed
0631cbe972bf9e86ae9572c632e115da685f4e50. Main is documentation, not release lineage.

## Existing functionality reused

PDC ExportPDF, current provider settings, saved order/job/AWB/reference, database
label lease and unique job, private VPS document adapter and publish-once storage.
Existing Dashboard Orders authority, measured staff CARD/COD eligibility, completed
packing and uncertain-dispatch quarantine remain. Label actions never book shipments.

## Exact changes

- Staff View renders a private PDF canvas; Download returns the original bytes;
  Print opens the browser print dialog with only label pages and their paper size.
  Compact existing styles support EN/AR/RTL, mobile/desktop and Light/Dark/System.
  Keyboard focus/Escape, abandoned request cancellation and stale-order guards apply.
- A bounded PDF parser verifies actual structure and both saved AWB/REF on every
  page before publication and retrieval. It rejects wrong/substring/metadata-only
  identities, malformed/truncated/oversized, scripted/attached/form/annotated files,
  password-required or unextractable/image-only identity. Limit5MiB/4pages/6seconds;
  finite page geometry, two parsers and bounded worker heaps. No external fetch or
  runtime credentials enter the parser. No private extracted text is logged.
- The private endpoint binds order/job/provider/path/hash/size/AWB/REF, then rechecks
  current staff authority and database evidence. Customers, viewers and disabled
  staff are denied. Private/no-store, attachment, sandbox, nosniff and same-origin
  response policy remain; no arbitrary private path or public customer label URL.
- Existing storage validates a publish-once orphan before accepting evidence.
  Concurrent retries preserve one job/file. Explicit pending-label recovery uses
  only the saved AWB and ExportPDF. It rejects booking tasks or changed identity
  before any provider access. Missing/tampered already-ready files are withheld;
  reviewed private-evidence recovery is separate. No SaveShipmentEx recreation.
- Exact PDF.js6.4.299 and DOMMatrix3.1.2 dependencies, parser modules, browser worker
  and versioned fonts are packaged. Compiled Node22 output works without native
  canvas. Existing1041 lock package records are unchanged. Existing private
  shippingDocumentsDir configuration applies; no new deployment-specific input.

The owner intentionally selected customer COD feeEGP10 in Dashboard. Current
server-authoritative settings govern prices. No fee is hardcoded/restored or
investigated as a defect; historical order snapshots remain. Labels do not change
payment/collection status or prove shipment delivery, cash collection or settlement.

## Qualification

| Check | Result |
| --- | --- |
| Label PDF/access/client integrity/storage/AWB-only tests |20 PASS |
| Actual schema106 native DB/FS/authorized endpoint tests |19 PASS,0 skips |
| Existing PDC protocol/tracking suites |74 PASS,0 skips |
| Automated source total |113 PASS |
| Label browser |144 assertions/12 scenarios PASS |
| Existing staff CARD/COD booking browser |82 assertions/8 scenarios PASS |
| Browser total |226 assertions PASS |
| App-only release guards |16 runtime +5 database =21 PASS |
| Typecheck / production build, pinned Node22.23.1 |PASS |
| Final compiled Nitro PDF parser/reauthorization/wrong identity/no native canvas |PASS |
| Exact archive full guarded unpack/inventory readback |4,361 entries PASS |
| Every public browser asset HTTP/SHA |3,365 PASS, including3,236 retained assets |
|106 historical migrations / previous lock packages |Unchanged |
| Encrypted106 database and14 protected runtime/Email/unit files |Full authenticated readback PASS |

Browser fixtures cover1440/390 widths, EN/AR/RTL, all themes, PDF rendering,
original download hash, actual Chrome printed-PDF geometry, print-only content,
accessibility/focus, stale/error/wrong-order cases and contrast. Local fixtures
create no production customer/order/shipment and make no provider/external request.
Previous pre-COD native fixture and older tracking-browser deferred checks remain
preserved; they are not counted as newly passed. All35 deferred IDs/evidence remain.

## Acceptance still pending

No genuine provider-issued PDF exists for this task. DTR-21 remains open for the
first separately approved real AWB: current provider template/font/text extraction,
AWB/reference, actual download, physical printer/paper/scale and barcode scan.
Fixtures are not merchant/provider/physical-printer acceptance. Unsupported identity
or format is withheld, never guessed valid. No synthetic shipment or contact with
PDC is needed. The historical uncertain shipment and cancelled COD remain excluded.

## Smallest release and operational boundary

**Application only, schema106 unchanged. Zero migrations/SQL/business/settings/
runtime/Caddy/unit/credential changes, provider requests, manual Email requests,
backfill or new emergency budgets.** One app restart requires the new exact owner
approval. Briefly pause the existing Email timer; allow its running caller to finish,
then restore the same timer once in finally. Genuine future capture remains active.
No manual worker invocation, provider probe, repeat private test or Auth SMTP change.

Automatic PDC booking/polling/webhook cutover remain OFF. CARD/COD/Email/MON and
original purchasing/COD/Email emergency fences are retained. Existing warnings/gaps
are not cleared. Stop on drift/uncertainty; no automatic rollback, retry or second
restart. Recovery needs a separately sealed observed-state packet. Existing
emergency controls consume only original budgets and remain available after cutover.

Private packet: `../pdc-labels-release-20261031/`, including OPERATOR.md, exact
plan/archive/inventory, qualification, backups and original emergency-fence bindings.
Before deployment: read-only current target/lineage/schema/security/runtime/MON/
Email/commerce/private-route/worktree checks. After: exact installed identity,
CARD/COD/payment integrity/private endpoints, every asset hash, normal scheduled
Email caller state and next automatic MON report; no forced scan or manual send.

## Following work

After labels, implement bounded GetShipmentsStatus polling and verified Dashboard/
My Account timelines, then offline authentication/dedup/replay checks against the
existing documented webhook. Polling does not wait for live webhook registration.
SEO/legacy redirects start after independent PDC readiness even with no real order.
Historical WooCommerce migration and UI follow. Pickup development is excluded.
Paymob Pixel/Pay Again wait for the reply. Detailed fees/net settlements/ERP LAST.

Exact seal, expiry and fresh preflight are appended below. No deployment authorized
or performed during this development task. Genuine shipment/provider action needs
its own separate exact approval.

## New exact deployment approval

```text
APPROVE PDC LABELS SCHEMA106 APP-ONLY DEPLOYMENT 05fca90db0a6b61cede98f4e7ec5bafbf19a17309bb02280b0c8b8f57112d915
```

Expires **31October2026 16:07:19 Riyadh** (2026-10-31T13:07:19.638Z).
Execution must start before **31October2026 15:52:19 Riyadh**.
Candidate archive a98e465ae7611e73; schema106 remains unchanged. One app restart;
no migration, shipment booking, PDC request or Email request. Exact approval is
required because the owner prohibited unapproved production deployment. No approval
has been recorded and no deployment attempt has started.

## Final read-only preflight receipt

**31October2026 12:09:07.092Riyadh /09:09:07.092UTC: PASS**, bound to the seal above.
Production ce4142/schema106/source063 unchanged; service PID106963/Caddy26652,
14 protected runtime/Email/unit/Caddy files and encrypted key/sender preserved.
CARD/COD capabilities and unauthenticated private-route denials pass. Critical
payment mismatch/unreconciled success/duplicate/ownership counts are all0.
Customer Email capture/provider/caller timer remain active; no manual worker call.
MON12:05:03 retains five original unverified warnings/zero critical and gaps2;
MON Email OFF. Original emergency budgets remain unspent. No forced scan or clearing.
All38 original worktrees and17,074 pending non-document files pass preservation;
one new clean feature worktree was added, with0 staged changes or pushes. All35
DTR IDs and original evidence remain; DTR-21/34 append the label acceptance boundary.

No owner approval, apply attempt, root staging, restart, migration, shipment,
provider call or Email request has occurred. **ONE next action: approve the new
app-only deployment statement above.** If expired or drifted, refresh/seal the packet
before asking for another approval; never reuse a consumed previous statement.

## E161 — deployed receipt,31October2026

Exact owner approval05fca90d was recorded at12:15Riyadh and executed once.
Current release **a98e465ae7611e73**, source4238e9258d896f2ad708b30143cfb8aabcf2bc6d,
schema106 unchanged. Root cutover succeeded at **12:17:05.283Riyadh** with one app
restart; PID118185 replaces106963. Caddy PID26652 and all14 protected file hashes/
permissions remain unchanged. Zero migration, SQL/business/settings/runtime/unit/
credential/Caddy/Auth SMTP/provider/manual-worker/Email changes or requests.

The existing Email timer pause lasted **1.229677seconds**. Its running caller was
allowed to finish; timer resumed once in finally. Normal scheduled caller completed
successfully at12:18:08Riyadh after the switch, with no manual invocation. Encrypted
key/sender/provider row revision3 and capture revision1/activation boundary unchanged.
No isolated delivery test repeated, no historical backfill or synthetic paid order.

Hosted postflight verified exact installed archive/schema/security/runtime, CARD/COD
capabilities/payment integrity and unauthorized private-route denial. All **3,365**
public assets passed HTTP/SHA at12:21:14Riyadh, including3,236 retained immutable
assets. All **11** original order/payment/packing/shipping/financial projections
match the preflight fingerprints: eight orders, nine items, eight checkout commands,
seven payment attempts, two transactions, one packing session, one quarantined
shipping job and zero collection/reconciliation/Treasury rows. No order was booked,
reopened, marked paid or changed. There is no new eligible genuine shipment.

The first verifier captured the pre-switch MON report before its asset scan and
reported AWAITING_NEXT_AUTOMATIC_MON_CHECK. This was resolved by a separate read-only
report inspection: normal **12:20:06.233Riyadh MON** completed after cutover with the
same five TERMINAL_PAYMENT_UNVERIFIED warnings, zero critical and gaps2; MON Email
OFF. No forced scan, warning clearing, retries or additional restart occurred.

Automatic PDC booking/labels/polling/webhook cutover remain OFF. The existing narrow
staff gate and current server-authoritative business configuration remain unchanged.
Owner-selected customer COD fee10 is respected without hardcoding or reverting any
amount. Shipment delivery and verified cash collection remain separate.

**Acceptance still pending:** first real provider-issued PDF/template/font/AWB/REF,
physical printer/paper/scale and barcode scan. Local fixtures and hosted deployment
do not close DTR-21. The original uncertain booking and cancelled COD stay excluded.
No artificial order or provider request was made. Original35 deferred IDs/evidence
and all original worktrees/pending bytes remain preserved; no Git push.

Private evidence: owner-approval.json, apply-attempt.json, staged.json,
cutover-complete.json, verification-*.json, postflight-assets.json,
automatic-mon-postflight-*.json, host-postflight-*.json, data-postflight-*.json,
final worktree preservation and deployment-receipt-final.json in the label packet.
Root stage `/var/lib/storefront-pdc-labels/05fca90db0a6b61c/` retains single-use intents,
one restart and one Email pause/resume. Approval is **CONSUMED_COMPLETE**; no replay.

### Existing emergency controls after this deployment

Use the installed label packet `../pdc-labels-release-20261031/OPERATOR.md` and its
pinned Node22 operator for established purchasing/COD/Email emergencies. These bind
the new installed certificate and consume only the original unspent fences; no new
budget was created. Original disable scopes/reasons remain. No emergency was used.
Do not invoke old-release installed checks against the new archive. A label failure
safely withholds its bytes; it does not authorize shipment recreation or automatic
purchasing shutdown. Missing/tampered ready files need reviewed evidence recovery.
Any deployment uncertainty requires a fresh observed-state seal, never replay/rollback.

**ONE next action:** SHIP-08 bounded GetShipmentsStatus polling and verified Dashboard/
My Account timelines. Then documented offline webhook authentication/dedup/replay;
polling works independently of unverified live webhook registration. SEO follows
independent PDC readiness without waiting for a real order; history/UI follow.
Pickup development excluded, Paymob Pixel/Pay Again await the reply, fees/ERP LAST.

> **SUPERSEDED BY E226:** The in-window approval was rejected for analytics-only drift before any approval/apply marker. [Corrected guard, current same-app/SQL packet and new exact approval](paymob-checkout-lifecycle-schema113-guard-review-20261104.md). Older hashes and READY states below are historical; both predecessors remain unused.

> **SUPERSEDED BY E224:** The earlier packet remains unused after its execution-start cutoff. [Fresh same-code packet, current evidence and new exact approval](paymob-checkout-lifecycle-schema113-refresh-20261104.md). Earlier approvals and deadlines below are historical.

> **E223, 4 November 2026:** The owner supplied the exactfe9450b0statement after its execution-start cutoff. The unchanged operator rejected the late start before production connections. This packet remains unused and preserved. A fresh packet with the same source, SQL and archive is being prepared separately. The approval and deadlines below are historical; never execute or transfer them.

# Paymob checkout lifecycle113 — 4 November 2026

**LOCAL PASS. SEALED PREFLIGHT PASS. READY / PRODUCTION UNAPPROVED.**
Task `PAY-ABANDON-20261104-01`. The preceding
[schema112 technical closeout](product-family-schema112-closeout-20261104.md)
is complete. Its consumed operator and all older packets remain spent.

Production remains release `7828142b76d63b48`, source
`45803149530063050631fcdf6c6a16d74359aa24`, physical schema112.
Fresh preflight at **01:53:08 UTC / 04:53:08 Riyadh** passed with zero production
writes or provider calls. All five current private attempts remain unresolved;
verified funds/callbacks are zero, existing orders10 and transfer proofs0.
Financial integrity issue counts are zero. The earlier four-attempt report was
an older snapshot; no genuine attempt was used as a test or retired by assumption.

## Confirmed cause and correction

Opening the embedded form creates an intention and immediately marks it pending.
The old SQL guard and unique owner index then block every later checkout for that
customer. The API also withholds fields on an acknowledged replay, and the browser
retains a single global pending command. This was a database/session restriction.

Reuse the existing private sessions, attempts, funds/callback ledgers, paid-order
finalizer, cart-line completion, notifications, pinned SDK, account scope and
hosted CARD fallback. Separate new initialized interfaces from possible submission.
Reopen or verified-decline retry uses the **same intention**. Server tokens permit
one submission from the latest tab. Acknowledged sessions clear the global browser
command; unknown payment evidence remains private and protected for affected items.
Unrelated products can use another journey. Apple cancellation closes the UI;
it does not reset a potentially submitted payment or prove financial failure.

No normal order is created before verified funds. Replacement identities preserve
late-success reconciliation and prevent a second order for the replaced cart
action, including COD. Additional genuine funds remain in private review. Replay
does not create duplicate orders or notifications. A new pending transaction
cannot inherit an earlier decline label. No age-only cleanup or invented provider
cancellation API is added. The private inquiry adapter is fixture-qualified;
no inquiry runs from a customer status read or from this release.

Schema113 is required because the global unique index enforces the existing lock.
The actual112ledger was inspected before choosing the new migration. Exactly one
SQL file, `20261104020000_checkout_payment_interfaces.sql`, adds eight metadata
columns/two constraints/nine functions, changes seven functions and replaces one
index. Existing attempts default to unknown/null only; original financial fields
remain exact. The old claim signature fails closed for stale bundles. All existing
authenticated late callbacks remain compatible. No product-family code is changed.

## Reviewable source and qualification

- [Source contract](../../paymob-checkout-lifecycle-20261104/source/docs/paymob-checkout-lifecycle.md)
  documents server authority, SDK hooks, inquiry boundaries and all behavior.
- Source commit `0b2eeb3255b07163364368b15bb6310a55322f43`, clean isolated branch
  `local/paymob-checkout-lifecycle-20261104`; no push or merge.
- [Exact source diff](../../paymob-checkout-lifecycle-20261104/source-review.diff).
- [Immutable packet review](../../paymob-checkout-lifecycle-20261104/release/REVIEW.md),
  [operator](../../paymob-checkout-lifecycle-20261104/release/operator.mjs) and
  [approval seal](../../paymob-checkout-lifecycle-20261104/release/seal.json).
- Candidate release `46bb252b303280e8`; archive SHA256
  `46bb252b303280e85b7e09316549cf5d772a99fd9ce73c0922083c60b36c1e55`.
- SQL SHA256
  `111bec875f0c6a0120801549089fb3ce1ff851efcaad1aba1af4339ccd1f4f66`.

| Evidence | Result |
| --- | --- |
| Focused backend/native/HTTP/RLS/concurrency/financial fixtures | 83 PASS, zero skips |
| Checkout UI EN/AR, RTL, themes, desktop/mobile | 34 Chromium + 34 WebKit PASS |
| Pixel lifecycle, actual pinned package rendering, validation/authorization/timeout/disposal | 26 PASS across both engines |
| Typecheck and production build | PASS; 763 application inputs match built bytes |
| Actual hosted SQL preimages | All seven changed functions and removed index exact |
| Native original projections and DDL rollback | 154 projections PASS; five historical-attempt fixtures preserved |
| Compiled scoped Pixel/Apple/hosted fallback runtime | Nine HTTP cases PASS |
| New and retained compiled assets | 4,651 HTTP SHA256 checks PASS; full archive readback and secret scan PASS |
| Protected backup | Fresh112database +17host files encrypted; full authenticated readback PASS |
| Operator scope/expiry/permission guards | 40 JavaScript +32 Python +4 actual post-seal authorization checks PASS |
| Existing work | All56prior trees, new57th tree,55paused artifacts and12,936consumed packet input hashes preserved |

All provider and financial responses in local tests are isolated fixtures. Real
CARD/issuer3DS/Apple authorization, live inquiry and notification delivery are
deferred under DTR-36/38/42/44. Existing owner CARD rendering and eligible-iPad
Apple visibility are display/device evidence. DTR-43 family technical PASS and
owner visual OPEN remain distinct; Modern DTR-41 stays accepted.

Initial native fixture failures, the corrected late-pending projection, and the
first invalid local seal are preserved. That first unapproved seal included a
changing console stream; the actual read-only check rejected input drift before
production connections. Its plan, seal, producer and STOP are retained in
`release/unapproved-preparation-1`. No approval or apply attempt was consumed.
The corrected seal excludes live console streams and passed all1,905input hashes
and the full production read-only preflight. It is the only current candidate.

## Narrow execution and recovery boundary

One archive staging/upload, one exact113migration/history row, one app cutover /
restart, and one bounded pause/resume each existing MON/Email/PDC timer. No
runtime/flag/Caddy/unit/key change, provider request, genuine financial operation,
business-row rewrite, manual worker, method activation, product mapping, new
emergency budget or Git push. Backups are preservation evidence; no restore over
later genuine activity or automated rollback is permitted.

CARD/COD/core, EGP10 COD fee, selected-account Pixel/Apple, hosted CARD, transactional
Email and bounded PDC remain active. General/private/runtime InstaPay, Google Pay,
balance and automatic PDC booking remain OFF. Natural MON at01:50:05UTC retains
the original **8 warnings / 3 journal gaps / 0 critical**. No warning was cleared.

The operator rechecks current evidence before recording approval, consumes one
attempt before mutation, and stops on drift or uncertain commit/cutover. Never
replay a committed migration or consumed attempt. Only already-fenced timers can
resume once. Any recovery requires a fresh exact packet; favor forward repair
because the old application cannot initiate through the new claim contract.

Postflight must establish the actual app/source/schema113, all4,651asset hashes,
private boundaries, EN/AR critical storefront/family selectors, preserved old
financial/catalog values, unknown historical metadata, runtime controls and next
natural MON. Preserve and classify later genuine activity rather than forcing old
fingerprints to match. Deployment and owner/financial acceptance stay separate.

## Exactly one next action

Authorize this SQL113 and app release. Runtime settings stay unchanged.
Send the exact statement:

```text
APPROVE PAYMOB CHECKOUT LIFECYCLE SCHEMA113 DEPLOYMENT fe9450b019da9c6361d8627b506ba1551e8f9220d96141e734caad7d26087c4b
```

Execution must start before **2026-11-04T05:35:56.307Z** /
**08:35:56.307 Riyadh, 4 November**. Approval expires at
**2026-11-04T05:50:56.307Z** / **08:50:56.307 Riyadh**.
This grants no live inquiry, charge, refund, void, bank operation or activation.

Fresh production authorization is required by
[AGENTS.md](../AGENTS.md) and the owner's Phase D instruction. Safe local work
and read-only preflight are complete; no production mutation is authorized yet.

# Inactive COD deployment receipt — E119

28 October 2026. **DEPLOYED INACTIVE / TECHNICAL POSTFLIGHT PASS.**
COD is OFF. Hosted COD purchase, cash collection and public activation are separate.

## Consumed approval and deployed boundary

Owner exact approval `e3176505e22006ea79a65540889c730921952d31fc009f9797f181c8ceffefd9` was recorded once at17:24:21Riyadh.
The guarded operator passed its fresh schema98/target/seal/payment/MON preflight and
recorded one execution intent at17:25:26. Approval is **CONSUMED COMPLETE**.
Never rerun approve/apply, the two migrations, or a consumed predecessor.

- Production: **9c74cf4d2c22a267 / schema100**.
- Source: **3911124efe9cc00d73879d9446d3f702d9d209f1** (`local/cod-untracked-readiness-20261028`).
- Exact archive SHA256: `9c74cf4d2c22a267911fa6992f54550b6d5edcef9dbecb85f78cbbd748a36b16`.
- Migration transaction committed17:25:48.719Riyadh; exactly99 and100 were applied:
  `20261028170000_manual_cod_eligibility.sql` and
  `20261028180000_untracked_cod_sales.sql`. All98 old history entries remain.
- App cutover passed17:26:11.200Riyadh; **one ordinary app restart**. Final installed
  certificate/inventory/running-directory checks match the approved archive/source.
- All145 original projections, Auth/security, imported-history structure/access/counts
  and expected schema/ACL/RLS footprint passed the in-transaction preservation checks.
  No old order/payment value, settings row, inventory quantity or provider evidence
  was changed by the deployment. Public customer activity remains independently live.
- Same runtime/Caddy/unit/config/credential hashes and Caddy process retained.
  MON timer/worker lifecycle unchanged; original emergency purchasing-close budget1
  remains unused and bound to this release, with callbacks available.

Private single-use evidence: `../cod-readiness-20261028/owner-approval.json`,
`execution-intent.json`, `migration-receipt.json`, `switched.json`, the final
`verification-*.json`, `http-database-postflight.json` and `completion-receipt.json`.
The [sealed scope](cod-inactive-deployment-review.md) is historical execution evidence,
not reusable authority.

## COD remains disabled

Postflight confirms **zero shipping options with cash collection enabled** and
runtime Beta methods exactly **CARD**. The existing cash setting remains TRUE/fee0;
it does not override either gate. Manual delivery remains active at EGP50.
`inventory_tracking_required=false` remains unchanged for the owner's opening model.

The deployed code now supports normal COD without recorded stock once separately
activated. It retains normal purchase labels, trusted pricing/delivery/model/ownership,
actual packing quantity/video checks, unpaid Placed/Awaiting COD collection states,
immutable cash receipts and separate Treasury reconciliation. No physical quantity,
serial or stock movement was invented. The original65eed27 worktree remains intact.

No COD activation, real test order, charge, refund, provider inquiry, PDC operation,
customer email, runtime/Caddy/unit edit or Git push occurred. There was no retry,
rollback or extra app restart. Actual employee collection, covered cash destinations,
fees and controlled owner acceptance still need the separate activation process.

## Mandatory postflight

- All**2592** browser assets requested through the actual public serving path:
  HTTP200 and exact SHA256. All2479 retained asset hashes remain; installed3566-entry
  inventory/certificate checks pass. The seven local Nitro registry additions were
  included in this exact qualified artifact; no production packaging edit occurred.
- Public EN/AR entry checks PASS: home/cart/login and real signup entry200, anonymous
  checkout302, anonymous delivery/monitor401, unsigned payment callback403.
  An auxiliary observer initially used unsupported `/signup`; source and the prior
  accepted receipt establish `/login?mode=signup`. Only that unsealed read-only
  observer was corrected; its failed evidence remains, with no application change.
  The sealed deployment and final verification passed without bypass or rerun.
- Schema100 latest version28180000, cash capability0, CARD live/available,
  Manual EGP50 preserved. Critical payment mismatch, unreconciled signed success,
  duplicate successful charge and order-ownership counts all**0**. Overdue
  provider-unverified attempts remain**2**. No provider outcome was inferred.
- **17:30:04.092Riyadh automatic MON report succeeded after cutover**. Timer remains
  enabled/active/waiting; complete report, WARNING3 unchanged, email OFF. No monitor
  start, reset, timer alteration or history/dedup reset was used for this proof.
- All27 opening worktree HEADs and pending-file inventories passed preservation
  before authorized continuity updates. Existing location source, frozen work,
  original deferred register/DTR-33/STOR-01 and both accounts' changes are retained.

The earlier95 native and46 browser/policy qualification results remain local evidence.
This deployment verifies hosted static assets, route/privacy gates, schema and payment
records; it does not claim a new owner browser purchase, email delivery or real cash
collection. Homepage Add to Cart's final owner acceptance remains pending.

## Next work

Prepare customer transactional order/payment emails next, then collapsed saved
address, offline governorate/city selectors at checkout AND profile, and navbar
username. Paymob/PDC investigations remain paused until that customer-facing queue.

COD test-order access/public activation each requires its own exact scoped approval.
Employees are the stated collectors; bind actual cash coverage, current EGP50/zero
COD fee and receipt/Treasury responsibilities in that later review. Do not infer
activation from this completed inactive deployment.

> E121: Approval972c77 received but HELD_SCOPE_CHANGED, not accepted or executed. Owner now requires PDC collection/full remittance and booking from Nuxt Dashboard. Production COD stays OFF. The existing owner receipt blocks apply. Never overwrite/replay this packet. Current review: [PDC Dashboard COD](cod-pdc-dashboard-review.md).

# Manual COD activation review — E120

28 October 2026. **COD ACTIVATION READY / OFF / NOT APPROVED.**
Production remains **9c74cf4d2c22a267 / schema100**.

## Owner decision and customer charges

**OD-20261028-COD-01** replaces the earlier zero-COD-fee proposal and work order.
Employees arrange Manual delivery, collect cash and confirm actual receipt.
Use the existing eligible destinations. PDC booking and collection stay paused.

| Checkout charge | CARD | COD |
| --- | ---: | ---: |
| Merchandise | Current validated prices | Current validated prices |
| Shipping: existing Manual delivery | EGP50 | EGP50 |
| Payment fee: COD collection charge | EGP0 | EGP50 |
| Final amount | Merchandise + EGP50 | **Merchandise + EGP100** |

For EGP100 merchandise, CARD totals EGP150 and COD totals **EGP200**.
The existing checkout displays Shipping, Payment fee and the full order total
before confirmation. The COD charge uses the existing **Payment fee** row;
it is not folded into shipping. Arabic uses the existing translated labels.
Coupons remain excluded by the Beta policy. Stored order totals are immutable.

The bound Manual service keeps its existing 28 destination labels:
Alexandria, Assuit, Aswan, Bani Suif, Behira, Cairo, Dakahlia, Damietta,
El Kalioubia, Fayoum, Gharbia, Giza, Ismailia, Kafr Alsheikh, Luxor, Matrouh,
Menya, Monufia, New Valley, North Coast, North Sinai, Port Said, Qena, Red Sea,
Sharqia, Sohag, South Sinai and Suez. No destination, tariff or provider ID changes.

## Fresh read-only qualification

**18:05 Riyadh, 28 October 2026:** sealed target/application inventory, source
certificate, loaded release, runtime/fixed files, Caddy and database checks PASS.
Current cash setting is TRUE/fee0; Manual collection is FALSE; Beta permits CARD.
The previous inactive deployment and its approval are consumed; neither is reused.

MON-01 is enabled/active/waiting. Its automatic **18:00:06 Riyadh** report is
complete, WARNING3: two overdue and one terminal provider-unverified exceptions.
Critical amount/attempt mismatch, signed-success reconciliation, duplicate-success
and customer-ownership counts are all zero. No provider outcome was inferred.
The original one-use emergency purchasing-close budget remains unused.

CARD initiation and EN/AR public entry/privacy checks PASS. Signup remains open;
anonymous checkout redirects to login, private shipping/MON reads require Auth,
and unsigned callback access is rejected. Existing signed callbacks remain usable.
PDC automatic labels and both outbound runtime controls remain OFF.

Local qualification, using the deployed code and disposable synthetic data:

- **66 native SQL/API checks PASS, zero skipped:** EGP50 COD fee, CARD unchanged,
  stale-fee reviews, order ownership, eligibility, concurrent confirmation/recovery,
  no Paymob attempt or PDC job for COD, no manufactured inventory, packing,
  cancellation, cash/Treasury authority and immutable financial receipts.
- **18 actual browser checks PASS:** EN/AR, desktop1440/mobile390, light/dark/RTL;
  separate EGP50 shipping/EGP50 payment fee/EGP200 final total for EGP100 merchandise,
  one confirmation, unpaid saved confirmation and unchanged CARD-only gating.
- **5 runtime guard tests and22 monitoring regressions PASS:** exact approval,
  expiry, consumed intent, original shared emergency budget and monitor behavior.
- The exact configuration transaction passes native commit, injected rollback,
  baseline-drift rejection and repeated-activation rejection. It preserves17
  existing financial/inventory/Auth table projections in its MVCC snapshot.
  Existing security/function/trigger footprints and unrelated settings are guarded.

Auth verification and SQL transport in native tests are fixtures. These results
do not establish hosted COD purchase, actual employee cash receipt or Treasury
acceptance. Those remain **NOT EXERCISED**. No fake hosted order is permitted.
No unresolved technical activation blocker was found under the owner's stated
employee collection responsibility and existing delivery coverage.

## Smallest activation scope

No application redeployment, source change or migration is needed.
The existing deployed Dashboard settings and runtime policy support this model.
**Exactly one ordinary app restart is required** to load the runtime policy.

After separate exact approval, the single-use operator will:

1. Recheck expiry, exact inputs/target/schema100, fixed files, installed release,
   CARD/privacy health, MON and the original unused emergency budget.
2. Record one local/remote execution intent and a private runtime recovery copy.
3. Commit one guarded configuration transaction: existing cash fee0→50 and the
   bound Manual collection flag FALSE→TRUE. Existing `payment_methods` and
   `shipping` configuration generations each advance once through their triggers.
   All other settings, delivery coverage/price, old orders/payments, inventory,
   ledgers, Auth, grants and RLS remain unchanged.
4. Add only `payment_methods:["card","cash"]` to the existing private Beta policy,
   retaining its Manual binding, product exclusions and all other restrictions.
   Runtime is the final opening gate. Restart the same application once.
5. Check loaded environment, same release/schema, fee50+50, CARD and privacy gates,
   callback protection and the next successful automatic MON report after opening.
   No timer/worker reset or manual report generation is allowed as that evidence.

No automatic rollback or retry is permitted. A committed settings transaction
followed by a transport, expiry or runtime stop is a partial checkpoint requiring
separate recovery review. Never repeat apply, reset an intent or edit a seal.
New legitimate customer activity is allowed; no existing CARD order is converted
or repriced. There is no new Pay Again or payment-method-switching authority.

The existing original purchasing kill closes both methods through the public
runtime gate. This packet binds that same budget to the COD policy; it creates
no new budget and does not consume it during preparation. Signed callbacks and
owned order reads remain available. The closure path accepts only the established
payment-integrity, privacy or unavailable-monitoring incident reasons.

## Staff collection and cancellation

Placement displays **Placed / Awaiting COD collection**. Database payment status
stays pending, amount paid zero and paid timestamp empty. Dispatch and delivery
do not prove cash receipt. COD never initiates Paymob intentions or transactions.

Staff use Dashboard → Order details → **COD cash**. After delivered/completed,
authorized Orders staff record only cash actually received, its amount, unique
receipt reference and collection date. Partial cash leaves the balance outstanding.
Full actual collection may mark payment paid. Treasury reconciliation is separate,
requires additional Treasury view/edit permission and settles each full receipt
once with its own remittance reference/date. Receipt recovery retains exact
commands; confirmed financial history cannot be silently edited or deleted.

Unfulfilled/unpaid COD cancellation keeps existing guards. Untracked sales create
no inventory return; tracked allocations return original units once. Collected,
shipped, packed or ambiguous cases require review. There is no automatic refund,
inventory fabrication or unsafe reopening. Existing CARD protections remain.

## Exact separate activation approval

```text
APPROVE MANUAL COD ACTIVATION 972c77a4c3f3fbe30fc8059f7c4fe06495a372458cc5c797cc5beef51d9f0d52
```

Expires **22:04:06.072 Riyadh, 28 October 2026**
(`2026-10-28T19:04:06.072Z`). Approval must be accepted and fresh guards must pass
before execution. No approval or execution receipt exists now.

Private packet: `../cod-activation-20261028/plan.json`, `seal.json`,
`operator.mjs`, `database.mjs`, `runtime.py`, qualification logs and read-only check.
The exact executable steps are in that packet's `OPERATOR.md`.

The owner requested separate sealed activation approval. That explicit boundary
is why COD remains OFF despite the approved business decision.

## Preserved work and next priority

All27 worktrees and both accounts' work remain. Main6cfaadc matches read-only
remote main. Source1615993 contains the deployed3911124 application code with only
later Markdown changes. Original COD65eed27, location4843754, DTR-33, STOR-01,
all deferred tests, successful payments and uncertain provider evidence remain.
No production write/restart/deployment/provider operation or Git push occurred.

After COD activation, work one feature at a time in this exact order:

1. Collapsed saved shipping-address summary.
2. Searchable governorate/city at checkout AND `/account/profile`, reusing the
   preserved offline mapping/location branch and qualifying it against schema100.
3. Authenticated username in the navbar.
4. Paymob Merchant Inquiry, safe Pay Again and payment-method changes.
5. PDC shipment creation, tracking and shipping operations.
6. Customer transactional emails.
7. Google SEO, legacy redirects and Search Console audit.
8. Remaining admin improvements, historical migration, storage audit and tests.

Paymob and PDC are the first integration priorities after the customer fixes.
Their investigations are not restarted by this packet.

# Customer and Dashboard UX review — E173

Verified 1 November 2026. **READ-ONLY REVIEW COMPLETE; IMPLEMENTATION NOT STARTED.**
Owner direction `OD-20261101-UIUX-01`: UI/UX is the current phase. Preserve the
locally qualified metadata supplement and wait for owner priorities before edits
to application behavior. No release, deployment seal or migration is proposed.

## Current production and evidence boundary

Pinned SSH and read-only database checks confirm
`1fd7ef6909869361 / schema107 / source7d989cd1d886f850ebc15d9d289f3d9f78d78869`.
Latest closing host check13:14:18UTC (16:14:18 Riyadh). App PID140566 and Caddy
PID26652 remain unchanged. All17 protected runtime,
systemd, Caddy and monitor file hashes match the completed SEO receipt. CARD/COD
remain enabled; Email, bounded tracking and MON timers remain active. MON has
the same five warnings, zero critical alerts and monitoring Email OFF. The
customer COD fee is verified at EGP10 and remains server-authoritative; no setting
was changed.

Reviewed the deployed-source worktree, not main application code. No connected
authenticated document/browser session was available. Protected screens below
were exercised with actual deployed-source Vue components and isolated synthetic
Auth/data. These reproduce client defects; they do not prove hosted staff RBAC,
real customer account acceptance or real shipment/PDF acceptance.

Public Chrome navigation allowed site GET/HEAD and scoped anonymous catalog reads.
Analytics mutations and third-party scripts were intercepted before transmission.
No login, order, address, payment, claim, booking, refresh, label-provider request
or email was submitted to production. Only a fresh browser's anonymous local cart
was changed. The WordPress archive was not opened or executed.

## Five confirmed problems, in recommended order

| ID | Classification and reproduction | Practical impact |
| --- | --- | --- |
| UX-REV-01 | **Functional, staff, high:** open order A, switch to B while A's detail GET is delayed, resolve B then A. The heading/details become A while the selected ID remains B. `OrderDetailsDialog.vue:699` accepts late responses without checking the selected order or request generation. Reproduced locally with no mutations. | Staff can review the wrong customer/items while action URLs still use B. No wrong live action or data corruption was performed or established. |
| UX-REV-02 | **Functional, staff, high:** enter a preorder amount/reference and check external receipt verification, close, then open another preorder. All three inputs remain populated, including the checked assertion. `resetDialogState` and the order watcher do not clear them. | Evidence entered for one order can appear ready to submit for another. Reproduced with synthetic data; payment submission was deliberately not executed. |
| UX-REV-03 | **Presentation, customer sales journey, medium:** a populated anonymous cart survives SPA navigation; hard reload initially displays zero items and “Your cart is empty” while browser storage still contains its item. In the longer live check it restores automatically between the1-second and7-second observations. `cart.vue:9` renders emptiness before restoration is established. | Misleading empty-state flash during hydration. This is **not confirmed cart loss**. Use an honest restoring state before showing the real empty state; preserve cart ownership and acknowledgement rules. |
| UX-REV-04 | **Accessibility, staff, medium:** order details has no dialog role/aria-modal, Escape leaves it open, and Shift+Tab from its first control reaches a background fixture button. Actual component reproduced locally. | Keyboard and assistive-technology users lose modal context. Keep the current layout and reuse existing accessible modal patterns. |
| UX-REV-05 | **Presentation, customer history, medium:** the imported `created_at` is returned but omitted from both list/detail display. Both languages show the raw status `wc-completed`. Four local desktop/mobile EN/AR cases reproduce this. | Customers cannot readily date or interpret previous purchases. Display existing dates and safe localized status labels; retain original source values as historical evidence. No source data correction is required. |

The smallest recommended first implementation is **order-dialog state isolation**
(UX-REV-01/02, existing ORDER-01): reject stale detail/action completions and clear
order-specific drafts/assertions when closing or changing orders. Keep the same
screen and backend authorization/payment/booking contracts. This recommendation
does not authorize implementation or deployment. Root cause and exact tests for
the independent cart hydration presentation issue remain a later scoped task.

## Existing workflows worth retaining

- **Products:** atomic revision-checked details saves, immutable retry receipts,
  explicit conflict reload, Draft-first creation, deliberate publication, independent
  gallery/specification saves, dirty navigation guards and scoped raster uploads.
  Listing already has compact desktop/mobile rows, server search/filtering and
  preserved return state. Bulk already confirms bounded current-page selections
  and reports per-product outcomes. No new product-save/publish/bulk/upload defect
  was reproduced in this review.
- **Orders:** retain approve/pack gates, measured parcel weight, verified AWB
  binding, private label View/Download/Print and stored tracking timelines. There
  was no real AWB/provider call/physical label test. Existing genuine acceptance
  remains deferred. Payment and collection must remain independent of shipping.
  The live order list searches identity/date but lacks payment/packing/shipping
  queue filters; this is an optional operational enhancement, not a failed writer.
- **Storefront:** retain the current homepage, category/search filters, product
  galleries, options, cart controls and locale routing. Public EN/AR desktop/mobile
  snapshots showed no page-level horizontal overflow or JavaScript exceptions.
  The direct product Add to Cart and SPA cart path worked in the fresh anonymous
  browser. Anonymous checkout/account routes correctly led to localized login.
  No completed customer purchase or authenticated live checkout was attempted.
- **My Account:** retain existing owned orders, historical purchase component,
  saved checkout addresses, conflict handling and private stored shipment history.
  Saved delivery addresses are managed at checkout; Profile edits the separate
  profile address. A dedicated account address-book entry is optional navigation
  work, not a reason to duplicate or replace the deployed address implementation.

## Historical staff viewer and metadata decision

A dedicated **private, read-only historical viewer would be useful for staff
support**, because the Dashboard order list reads current `customer_orders` while
591 historical orders and6 refunds reside in the separate private history model.
It is an optional feature, not a prerequisite for resolving the defects above.
An approved feature would need explicit staff authorization and separate
historical list/detail projections; never impersonate customer ownership, mix
historical entries into fulfillment queues or expose internal notes.

**The metadata supplement is not required** for that basic viewer, historical
dates/status labels, cart or order-dialog fixes. Existing core records already
hold identities, dates, original totals/statuses, items, refunds and addresses.
Keep the `9b4107cabbb96fcf1f8124d03f9318aa4650cf22` supplement local and unchanged.
No automatic email linking, history claim, password migration or address promotion.
All131 unlinked orders remain private and actual ownership claims remain0.
Optional notes/SKU/component detail must not expand this UI phase without need.

## Qualification and remaining limits

- Existing actual-component suites rerun against deployed source: product editor
  **177**, listing **168**, bulk **310**, media **204** browser assertions PASS
  (**859 total**,135 screenshots), no unexpected browser errors/external calls.
  Save/conflict/recovery, publication, uploads, EN/AR/RTL, themes and responsive
  behavior are covered with local native PostgreSQL/PostgREST and synthetic Auth.
- Existing checkout/address browser suites: **37 tests PASS**, zero failed/skipped.
  These cover actual components with local fixtures, not live account/address writes.
- New review harness: stale order responses, retained payment assertion, modal
  keyboard behavior and four historical EN/AR desktop/mobile cases reproduced;
  zero JavaScript errors or external requests. These are recorded findings, not
  tests claiming the defects are fixed.
- Public layout matrix:28 navigations at1440/390px and EN/AR, no overflow/errors.
  Initial guard omitted a public variants view, so its availability screenshots
  are not purchase-readiness evidence. A corrected12-navigation pass plus two
  focused anonymous cart probes supplied the actual cart behavior above. One
  intermediate network-idle timeout is retained, not counted as an app defect.
- Initial local PostgREST launches lacked its libpq search path; reruns using the
  existing pinned toolchain passed. Failed logs are preserved separately.
- No implementation means no new typecheck/build/release or migration is needed.
  Prior genuine customer/RBAC/history/PDF/provider acceptance remains open; no
  deferred test is marked owner-accepted from these fixtures.

Private artifacts: `../ui-ux-review-20261101/` (mode0700), including hosted
read-only snapshots, reports, screenshots and preservation manifests. No secrets
or real customer data belong in this report. All43 worktrees and35 deferred IDs
remain preserved; the metadata candidate receives no edits.

**ONE next action:** owner selects the first implementation priority; recommend
the minimal order-dialog state-isolation fix for UX-REV-01/02. No implementation
starts until that decision. Paymob still awaits its provider reply; PDC commercial
settlement/ERP remains last.

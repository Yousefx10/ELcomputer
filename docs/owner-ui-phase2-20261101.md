> **E178:** [VISUAL deployed and hosted postflight passed](owner-ui-phase2-release-review.md):5fa9ef1bf4b05359/schema107. e613 consumed complete;940c consumed stop. Original complete phase-two source retained; checkout/catalog/payment/metadata remain separate. Owner mobile EN/AR visual review is next.

> **E177:** visual deployment940c stopped before staging; production unchanged. [Fresh guard recovery](owner-ui-phase2-release-review.md) is ready and requires its own approval. Never replay the consumed parent.

> **Resume completion E176:** [Visual-only release and separate group packets](owner-ui-phase2-release-review.md) now supersede this report's final combined A+D grouping and next action. Implementation and original evidence remain preserved. No production action.

# Owner UI/UX phase two — E175

1 November 2026. **INDEPENDENT LOCAL IMPLEMENTATION COMPLETE. NOT DEPLOYED.**
Owner decision `OD-20261101-UIUX-PHASE2-01`, task `UIUX-03`.
This authorizes the coordinated local work below. Production migrations,
configuration changes, restarts, deployment and provider actions require separate
approval. No phase-two deployment seal or expiry has been issued.

## Source and preserved work

The isolated `local/owner-ui-phase2-20261101` branch starts from the complete,
qualified phase-one candidate `71d86c365101ea7dd185c0f0884334a4a7fc9c90`.
Current source: `34e159002bbe348c12da73202a04023e9587ec0f`. Main is the continuity repository, not application
release lineage. The original phase-one branch, archive and stopped release
packet remain intact. No reset, blind merge, cleanup or push occurred.

All previous mobile hero/navigation, account containment, favicon, EN/AR homepage
SEO and UX-REV-01–05 corrections remain. The historical metadata candidate
`9b4107c` remains undeployed. No historical viewer, import, ownership claim,
SEO expansion, pickup or ERP feature was added.

## Feature results

| Task | Local result | Release boundary |
| --- | --- | --- |
| UIUX-03-A — Footer | Both configured styles retained. Shared payment cells normalize logo size/spacing and center the grid. Only configured, enabled methods with applicable capability evidence appear; unconnected PayPal and unknown methods are withheld. Unknown methods no longer default to CARD. Configured social URLs/labels retained, with recognizable X/WhatsApp vectors and existing platform icons. Compact columns/contact links; disabled newsletter shows information without a pretend input/Subscribe form. | App-only. No sender/subscription/payment activation. |
| UIUX-03-A — Product cards | Shared cards improve mobile image proportions, padding, title wrapping, prices, equal-height layout and 44px actions. Tiny discounts cannot show Save 0%. Unavailable items show one stock state instead of a second disabled Out of stock action. Wide/portrait images use object-fit contain. | Existing published-product, option, stock, purchasing and cart contracts retained. No catalog data changed. |
| UIUX-03-B — Infinite scroll | Owner-controlled Dashboard General/shopping setting, ON by default for the proposed feature; explicit OFF preserved. Shared search/shop/category/brand continuation. Twelve rows per server page; relevance ranking moved from whole-catalog browser fetching to a bounded, public, invoker-scoped SQL reader. Stable identity tie-breakers, one request in flight, 15s read timeout, cancellation/epochs, deduplication, manual retry after failure and stopping rules. | Separate catalog migration108. No production setting written. |
| UIUX-03-B — Navigation/privacy | Public-only per-Nuxt-app memory retains up to four listing windows, 20 pages/240 products each, for ten minutes. Back restores loaded rows and position. New filters retire stale reads/results. Next/previous URLs stay crawlable and use applied filters; automatic loading has a manual/link fallback. | No customer/address/session data in this cache or browser persistence. Checkout revalidates stock/prices. |
| UIUX-03-C — Selected accessories | Reuses the existing private, ordered compatible-product IDs and revision/receipt-protected presentation editor. Staff add/remove/reorder up to eight recommendations. Both PDP styles show compact optional rows and Show more. Existing ProductCard/cart handles stock, options, publication, explicit add and line merging. Source self/duplicate/missing-reference guards retained; transitive cycles and competing opposite edits now reject under a bounded graph lock. | No new relationship table or product/payment data rewrite. Separate function-only migration109. Current live compatible assignments: zero. |
| UIUX-03-A — Dark category art | Removed dark-theme multiply blending; original images sit on a light image medallion within the dark page. No image replacement, dimming filter or opacity mask. | App-only. |
| UIUX-03-P0 — Payment support | Reuses verified status projection and existing owned Support tickets. Pending/failed/uncertain cases can request cancellation through a prefilled, explicitly submitted ticket. It does not cancel an order or confirm payment. Closed orders stay closed in the staff controls. Staff guidance keeps unverified orders out of fulfillment. | Provider reconciliation/resume/Pay Again remains unavailable without finality evidence. No ticket was submitted. |
| UIUX-03-P0 — Cancellation safety | Staff API refuses cancellation of a normal unpaid CARD order with an existing payment attempt. The separate SQL correction also holds direct/worker cancellation for every uncertain existing attempt, including locally expired/failed states. No-attempt orders retain the existing cancellation contract. | Separate payment-only migration110; no backfill, order mutation, refund, worker activation or provider query. |

The selected-accessory section uses existing authored product recommendations,
not inferred compatibility or newly invented items/prices. No separate reference
image was included with the text attachment; owner visual acceptance remains open.

## Checkout A–F

| Request | Local status |
| --- | --- |
| A — Saved addresses | Accessible inline expandable choices with actual summaries; existing select/edit/add/save/conflict workflows reused. Native buttons, selected state, Escape and focus return. Auth invalidation clears private values. |
| B — Remove default placeholder | Removed the Current checkout address option. A legitimate unsaved profile/draft remains a clearly labelled actual address, with an explicit Add new address action. Selection never saves automatically; per-address drafts and revisions remain protected. |
| C — Delivery cards | Native radio cards replace the provider select. Compact wrapping supports multiple options; only genuinely configured methods appear. Name and price come from the existing server option/quote. No logo or delivery estimate is invented when the contract supplies none. |
| D — Coupon placement | Existing control moved directly below subtotal in the summary. Validation, disabled behavior and API authorization remain unchanged; no coupon API was enabled. |
| E — Redundant CARD box | Removed the repeated Secure card payment / Confirm then open instruction. Existing method labels, privacy/test-mode disclosure and validation remain. |
| F — One-action hosted handoff | Implemented and qualified behind `NUXT_PUBLIC_PAYMOB_HOSTED_REDIRECT_ENABLED`, default OFF. Only an explicit final confirmation plus a newly created CARD order can request one intention and navigate in the same tab. Replayed/recovered checkout commands never auto-initiate payment. Viewing/refreshing a page never starts payment. Navigation failure retains a same-session fallback; uncertainty offers the saved order without retry. No session secrets are persisted in browser storage. The explicit first-payment page supports the same gated hosted path. Pixel is not mounted by that path. |

F is prepared, not live. The owner must separately approve its release/configuration,
with merchant hosted-path/3DS/return acceptance qualified. It cannot resume or
replace the cancelled order's original attempt. Existing callback/HMAC, unique
claim and verified-payment projection code remain unchanged.

## Read-only production/payment evidence

Fresh pinned host observations at16:18 and17:01UTC confirm
`1fd7ef6909869361 / schema107 / source7d989cd`, unchanged app/Caddy PIDs
140566/26652 and all17 protected hashes. CARD/COD, customer Email, bounded tracking
and MON are active. Server-authoritative COD fee remains EGP10 and inventory
tracking remains intentionally configurable. No setting was changed.

The order identified privately in `payment-readonly.private.json` was initially
`pending_payment / pending`, with one saved live intention and no transaction
receipt. A later read shows local order and attempt cancellation at16:47UTC;
order payment remains pending, amount paid zero and no payment transaction exists.
Its local client secret was retired; original intention/provider references remain.
The existing Dashboard audit records an owner-role status update at that time.
This work performed no cancellation, reopening, payment marking or provider inquiry.

Local cancellation is not provider failure, void or finality evidence. The current
order must not be resumed, packed, shipped or used as a payment test. Its exact
reference and detailed evidence stay outside Git. The existing provider response
is still needed for authoritative finality and any future recovery contract.

The original SQL cancellation rule used local attempt age and a saved provider
order reference. Once its deadline was over an hour old it could permit local
cancellation and stock release without provider finality. Migration110 replaces
that age inference with a hold for every existing attempt. It changes no existing
order or ledger row. The bounded expiry worker returns these orders for review.
No production expiry worker was invoked.

The earlier UI release stopped because its sealed guard expected five MON warning
identities and older ledger fingerprints. A genuine new order introduced a sixth
warning. After owner cancellation the normal report shows six
`TERMINAL_PAYMENT_UNVERIFIED` warnings and zero critical alerts. No warning was
cleared, hidden, suppressed or rebound. Independent UI work continued; the next
release needs a fresh packet that explicitly discloses the current unresolved
alerts and observed data. Do not replay or amend the previous stopped packet.

Application journal review since order creation found no payment/callback-specific
messages; that absence does not prove that no payment exists at Paymob. No new
live Paymob inquiry, provider request, Brevo send, callback replay, PDC call,
booking or Google action was performed. Supabase Auth SMTP was untouched.

## Qualification and evidence limits

- 33 focused presentation/catalog/handoff/cart/SEO/payment-status tests PASS.
- 13 focused payment/HMAC/privacy/idempotency/uncertainty checks PASS.
- 15 native PostgreSQL tests PASS: migration/rollback, actual publication/privacy,
  owner/viewer Settings permissions, bounded deterministic relevance pages,
  ordered recommendation receipts/RLS, genuine two-session cycle contention,
  five uncertain attempt states, expiry quarantine and Orders HTTP authorization.
- Five existing native presentation/API/video/privacy checks PASS. The native
  Settings fixture uses the authenticated admin-profile SELECT grant observed
  read-only in production; migrations leave production ACL/RLS unchanged.
- Chromium and WebKit each pass500 component assertions across64 cases:
  all eight widths, EN/AR, RTL/LTR, light/dark and both footer styles. Include
  wide/portrait image containment, logo capability filtering, no subscription
  form, explicit accessory adds/merge/reorder, request deduplication, stale filter
  rejection, failure recovery, Back restoration and OFF-setting pagination links.
- Both engines each pass36 new checkout tests, covering32 responsive cases plus
  fresh handoff, disabled/recovered behavior and uncertain fallback. Provider
  navigation is fulfilled locally before transmission; no charge/provider call.
- All37 existing saved-address/summary browser tests PASS with the new controls.
  A parallel stress run had two initial action-stability timeouts; the complete
  isolated final rerun passes. No assertion was weakened or timeout increased.
- Staff phase-one race/payment-reset/focus/history regressions:145 assertions PASS.
- Compiled public homepage regression:459 assertions per engine,32 cases each;
  previous hero/navigation, localized metadata, canonical/hreflang, favicon bytes/
  caching and cart restoration retained. Before and after screenshots preserved.
- Typecheck and secret-free production build PASS with Node22.23.1. The existing
  duplicate ERP auto-import warning remains unchanged.
- Thirty local HTTP/rollback checks PASS through prior→candidate→prior application
  switches. Shop/search/brand pages, page2, bounded-search response contract,
  canonical/pagination links and34 actual served asset hashes per application
  observation verified. No production symlink or database rollback was attempted.

Private evidence is under `../owner-ui-phase2-20261101/`, including the component,
checkout, public-shell, native and source-preservation reports. Fixture pictures
and identities are explicitly synthetic. Screenshots are local visual evidence,
not owner physical-iPhone or authenticated hosted acceptance.

Three older static frozen-source assertions (Classic PDP, Classic footer/CSS and
checkout delegation strings) also fail on the untouched prior71d86c3 candidate.
The old native product reset-coverage case likewise fails on that unchanged
baseline. Those tests and failure logs are preserved; no reset policy or unrelated
application contract was changed to make them green. Current focused/actual
component and SQL qualification does not erase these deferred checks.

## Smallest independent releases

1. **A + D, app-only/schema107:** phase-one fixes plus footer/cards/category art
   and checkout A–E. Exclude catalog/schema-dependent features, financial guard
   changes and hosted handoff. Build a reviewed subset from the local patches;
   do not publish the full phase-two tree as a schema107 app-only archive.
2. **B, catalog:** one new boolean preference and bounded read RPC, then its
   Dashboard/search/brand UI. New feature defaults ON only in this separately
   approved release; preserve any explicit OFF. No payment/fulfillment changes.
3. **C, accessories:** reuse existing model plus the isolated cycle-guard function;
   no new table, price/stock edit or automatic cart operation.
4. **P0 safety:** separate unpaid-CARD API/support guidance and function-only
   cancellation hold. Existing cancelled records remain unchanged.
5. **F, hosted handoff:** separate release/activation with its flag OFF until
   approved and merchant acceptance qualified. Pixel/unsafe Pay Again remain held.

The local source uses provisional108/109/110 in that order. Reconfirm actual
production history and number each selected packet before any deployment; do not
force unrelated migrations into a release. Each packet needs fresh source/artifact
hashes, protected state/backups, disclosed MON state, targeted postflight and exact
one-use owner approval. No such approval/seal/expiry is issued here.

An app-only cutover would require one separately approved app restart and the
existing bounded Email/tracking timer pause/resume policy. No new runtime/Caddy
change is needed for A+D. F's flag is separately configured and remains OFF.
Rollback should restore the approved prior app while retaining current business
data, settings and stricter additive safeguards. Supplied SQL withdrawal scripts
are local qualification, never permission for automatic database rollback.

All original44 worktrees and their pending evidence, the clean isolated45th,
all35 deferred IDs and the metadata candidate remain preserved. First genuine PDC
acceptance, hosted ownership/RBAC, physical-device review, Paymob provider reply
and detailed settlement/ERP retain their separate boundaries.

**ONE next action:** owner reviews the mobile previews for the first app-only
visual/checkout presentation release. A fresh sealed deployment packet follows
that review; no production action is authorized by this report.

Provider reference: [Paymob Intention and client-secret handoff](https://developers.paymob.com/paymob-docs/intention-apis/create-intention),
[Paymob's hosted checkout integration planner](https://wizard.paymob.com/).

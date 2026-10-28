# CX-CART-01 — Direct product-card Add to Cart

28 October 2026. Application-only candidate from deployed `bb21a16`/schema98.
**LOCAL VALIDATION; NOT DEPLOYED OR OWNER-ACCEPTED.**
Exact sealed artifact, expiry and approval are recorded separately in
[the approval packet](homepage-direct-cart-approval.md) once preflight passes.

## Root cause and corrected behavior

The shared ProductCard treated every serialized product and any active variant as
requiring Options. Serialized inventory often has a single Default reference,
which is a fulfillment identity rather than a customer choice. Homepage queries
also omit variant metadata. No product/stock data needs to be changed.

The card now reads the existing public `storefront_product_variants` view, filtered
by its exact product ID and active status. It requests at most2 rows: one proves a
single configuration;2 prove that choices exist. No arbitrary first/default ID is
chosen, and no private inventory/supplier/warehouse fields are fetched. Simultaneous
cards share only the in-flight public request within their Nuxt app; settled results
are not cached across route visits. Reads have a10-second timeout.

- Exactly one active serialized reference: direct Add to Cart if eligible. Pass
  its real variant ID/name/code/SKU/color and public stock to the existing cart.
  Its name need not be Default. Known ordinary bulk products with no choices also
  add directly without a fabricated variant.
- Multiple active references: retain Options, including when one is out of stock.
  The product is genuinely configurable; unavailable alternatives are not silently
  replaced. Explicit legacy choice markers also retain Options.
- No active serialized reference, unpublished/coming-soon product or unavailable
  stock: no cart action. Preorders keep their existing product-page review flow.
  Restricted purchase grants keep their existing product-page selection flow.
- Missing/malformed/foreign/error metadata: never guess a configuration. Show
  localized lookup feedback and Options navigation. Pending metadata/capability
  checks disable the action with Checking availability. Unknown option availability
  does not claim In Stock or Available to Order.
- Click guards and the existing Added acknowledgement prevent immediate duplicate
  cart actions. Navigation is guarded while pending; cart failures are visible.
  A late response for an old product cannot select a variant for a new card.

The cart's existing backorder expression is extracted unchanged into the shared
`allowsCartBackorder` helper. Legitimate sell-without-recorded-stock normal sales
retain real stock0 and their allowed quantity. The ordinary bulk backorder switch
cannot bypass recorded serialized stock. No stock or site setting is altered.

## Production evidence and local qualification

Read-only catalog sample:100 published products, all serialized;86 have one active
reference,14 have multiple. Current settings permit normal unrecorded-stock sales.
This is a bounded sample, not a claim about the entire catalog.

Read-only live homepage, desktop1440/mobile390, EN/AR/RTL:40 cards show Options or
View pre-order; no page errors. No cart/order/payment action occurred on production.
The built local homepage uses the real public catalog with an anonymous local cart
and a read-only production capability snapshot:37 cards now show Add to Cart,3
retain preorder flow, in all4 locale/viewport cases. Local additions pass; all
business-write/provider requests are blocked. This is LOCAL browser evidence.

- 24 focused policy/cart/access/session checks PASS,0 skipped.
- 25 actual Vue HomeProductSection/ProductCard/variant-reader/cart/access browser
 checks PASS,0 skipped. EN/AR, RTL/LTR, desktop/mobile, light/dark; single reference,
 genuine choices, delayed/failed reads, unavailable/closed/excluded products,
 bulk backorders, preorder, double click, duplicate-card read deduplication,
 stale response and A→B→A ownership. Screenshots retained privately.
- 13 server/SQL checks PASS. Existing native PostgreSQL competing-carts case is
 unavailable in this environment and remains SKIPPED/NOT EXERCISED. PGlite proves
 existing stock holds, expiry/late settlement, unpublished rejection and ownership;
 no real provider or hosted business write. No deferred acceptance is closed.
- Typecheck and production build PASS. Five application-release guard tests PASS,
 including consumed execution, scope/budget/expiry, transient readiness and failure.

Only card UI, a public metadata composable/utility, the unchanged stock expression,
EN/AR feedback and focused tests change. Server handlers, SQL/migrations/RLS,
checkout/payment projections, purchase authorization, session isolation code,
credentials, shipping, COD and MON source/units remain unchanged. Checkout still
revalidates publication, active variant, stock policy, exact prices/amounts and
customer ownership. A client cart is never authority to create an order or payment.

## Scoped release and risks

Use the existing reviewed application-only cutover protocol with a fresh feature
kind, stage, seal and single-use receipts. Never replay consumed MON/CX/Inquiry
operators. Archive readback, secret scan and all retained hashed Nuxt assets must
qualify; the mutable latest-build pointer belongs to the new build. Read-only
preflight checks schema98, Manual50, critical payment counts, fixed app/runtime/
Caddy/unit identity, active/fresh MON, public CARD and anonymous monitoring denial.

After separate exact approval only: one candidate loopback health check, one
application cutover/restart, bounded GET readiness and postflight asset/route/MON
checks. No automatic rollback or repeated restart. MON timer/service/reports are
not restarted or modified. The existing emergency purchasing close is rebound to
the candidate and shares the ORIGINAL single-use budget1; no new kill budget.

Material risks: extra small public reads can delay labels; timeout/errors offer
Options safely. Catalog/stock can change after display, so trusted checkout
validation remains authoritative. One brief application restart occurs only after
approval. Native concurrent-stock and broader hosted/owner acceptance remain open.

No SQL/stock/Caddy/unit/runtime/credential change, COD activation, Pay Again,
Merchant Inquiry, provider transaction, customer email or SEO work is included.
Paid orders and fulfillment backlog remain unchanged. EGP2649/3149 stay provider-
UNVERIFIED; consumed inquiry evidence and provider-contract draft are preserved.
PDC PAUSED; original32/DTR-33/STOR-01/full deferred register and separate location
work are preserved. After this fix: safe COD preparation separately, including
awaiting collection (never premature Paid), confirmation, Dashboard handling and
Manual delivery eligibility. Pay Again's block does not gate these shopping fixes.

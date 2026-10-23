# Tariff manager deployment — PASS, 2026-10-23

Production is now release `08b45ffac0e524c8`, schema91.
The exact approved repaired package deployed once. Its approval is consumed.
Do not rerun the plan or reuse this approval.

| Item | Verified result |
| --- | --- |
| Owner-approved deployment seal | `a4217c90bf0ec1cc331a8842ab0f6042facce02fbf9e46bd5ada412a86fd1a4a` |
| Archive SHA256 | `08b45ffac0e524c8b1d2d308893842238ba396c2ec7a25ef140b6de7420f0d26` |
| Application source | `ba05770187a0a29fca225da957ed0ad8f7594d70`, with the separately approved packaging metadata repair |
| Schema change | One migration91; two private RLS tariff tables, four functions and exact reset-retention registration |
| SQL SHA256 | `97cee839a01873a98e2cdcbdf9bbcfca6a742cf18d0a9c283bffae70635c45fe` |
| Execution recovery | Fresh encrypted database/runtime backups, authenticated decryption and full readback PASS |
| Exact staging |2181-entry archive/inventory verification and retained assets PASS |
| Private candidates | Schema90 and91 PASS; retained HTTP bytes and disabled global card capability verified |
| Activation | Exact release switched; Nuxt restarted; Caddy process unchanged |
| Preservation | All138 original protected table projections, Auth security and unrelated schema/ACL/RLS preserved |
| Files/configuration | Runtime/Caddy/systemd/probe/extractor inputs,2627 media files and private-file state preserved |
| Public verification |14 recorded health/safety routes PASS; tariff API rejects anonymous access with401 |
| Independent live checks | Three previously serving retained scripts, two new scripts and latest-build pointer return200 with exact hashes; controlled checkout/capabilities remain403 |
| Financial/provider effects | Zero Paymob/PDC requests, charges, bookings or shipping jobs |
| Business import | None; both new private tariff tables contain zero rows |
| Rebuild/test repeat | None; completed feature tests/build and approved repaired archive reused |

The exact guarded apply used `../tariff-production-preparation-20261023/prepared-3/plan.json`.
Its execution intent, fresh `execution/` backups, candidate receipts, committed
migration receipt, activation state, final read-only database state and
`completed.json` are retained. Independent preservation/schema/receipt/live-asset
verification passed in `independent-deployment-verification.json`.

The [packaging repair receipt](shipping-tariff-packaging-repair.md) preserves the
original archive and its withdrawn plan. The old broken package was never deployed.
The new package passed1224 local static HTTP byte checks before approval. No build
or feature suite was repeated during production execution.

## Draft and activation boundary

The manager is deployed. No business tariff import was authorized or performed.
The [owner-supplied six-zone package](operations/shipping-tariffs/README.md) remains
editable, inactive and unverified for a later exact company-bound draft import.
Effective dates remain null; Product40 applicability, fractional rounding and
ambiguous suburb mappings remain unverified. Insurance remains off.

Checkout has no reader/activation path for B1 tariff versions. Shipping/customer
prices, provider settings, credentials and all purchasing/provider gates are
unchanged. Public checkout, signup, ordinary payment APIs, controlled purchase
access, Paymob/PDC public callbacks and automatic booking/reverse remain held.
No private purchase grant was installed. Import, price edits and activation still
need their separate reviewed authorization.

This deployment proves guarded application/schema publication and preservation.
It does not establish hosted owner save/import acceptance, a real payment,
courier coverage, a shipment or a refund/return. No business save was used to
manufacture acceptance.

## First real transaction: immediate next packet

The existing [restricted purchase capability](controlled-purchase-readiness.md)
remains available for a separately approved controlled test. The new private
`FIRST-REAL-TRANSACTION.after-tariff-deploy.template.json` marks only tariff
deployment complete; all access, setup and financial authorizations remain false.
The current private `NEXT-EXACT-AUTHORIZATION.json` points to these missing inputs;
it is not an executable purchase or provider approval.

Confirm the truthful carrier-declared value and destination city/governorate first.
TESTproduct2026 remains deliberately EGP1, with one physical unit owner-reported.
The existing booking computes declared value from net merchandise, so it would
send EGP1 without a discount. A different carrier-required value needs a suitable
genuine product/value path. Do not change its price or underdeclare automatically.
Actual unit/serial/provenance, valid recipient phone, full address, measured parcel
and pickup details belong in the private packet.

One active confirmed internal customer is a candidate through ordinary Auth/RLS.
Checkout delivery remains off, governorates empty and both PDC caches empty.
Pickup city10 needs cache verification and the destination needs one exact mapping.
Prepare one GetCities-only read and explicit cache/mapping/settings patches;
Dashboard Test/Sync would repeat GetProducts and is not that request. No new
provider request ran during this release.

Stored customer shipping fee10 and card fee0 are facts, not approval of a payable
total or carrier charges. Review exact customer total, Paymob merchant fees/minimum
or expressly accepted one-attempt uncertainty, PDC service/coverage/quote, VAT,
weight rounding and failed/return costs. A one-off confirmed shipment quote can
support the first test while imported six-zone rates remain drafts.

After those facts, separately approve the exact one-account/product/company/
address/amount/window grant and narrow Caddy opening/receipt-only closure, one
durable order, and one Paymob intention/card submission. HMAC-verified LIVE receipt
and a durable paid order precede physical scanning/packing. Then separately
approve one PDC booking, exact REF/AWB, private VPS PDF and one tracking poll.
Keep signed callback ingress and owned receipt access for late outcomes after
outbound closure. Never blindly retry uncertain payment or booking results.

Paymob refund/void functionality remains absent and those callback types are
rejected. PDC reverse code remains disabled with no reverse type configured;
real type3 acceptance, return charges and physical return receipt are separate.
Neither follows from outbound success. The [full transaction and acceptance
requirements](tariff-deployment-and-first-transaction.md) remain in force.

Modular gateways, carrier accounts, subsidies and loyalty remain independent
roadmap releases after initial provider acceptance. No Git push occurred.

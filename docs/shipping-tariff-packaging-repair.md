# Approved tariff packaging repair — 2026-10-23

The owner approved local repair/resealing under proposal
`ee0da9bb58b65c7a6b0ea505adc82bcde05cc674cb36c7e79d5feae565b249fa`.
That work is complete. Production deployment is not authorized.

| Item | Verified result |
| --- | --- |
| New review seal | `e8f57fa538f666d029c11ea80bf0448bb68e161ae1cacb860fb7cb91100a4336` |
| New archive SHA256 | `08b45ffac0e524c8b1d2d308893842238ba396c2ec7a25ef140b6de7420f0d26` |
| Proposed release | `08b45ffac0e524c8` |
| Application source | `ba05770187a0a29fca225da957ed0ad8f7594d70`, unchanged |
| Packaging delta | Only `server/chunks/nitro/nitro.mjs`; approved static metadata additions only |
| Registry repair |1082 missing entries added; existing entries/latest pointer preserved |
| Exact archive |2181 entries, complete extraction/inventory readback PASS |
| Local HTTP |1224 client URLs return200 with exact file hashes; four anonymous API checks return401 |
| Retained immutable assets |1121, all original bytes preserved |
| Build and feature qualification | Original build, typecheck and96 feature/regression checks reused; zero rebuilds |
| Repair safety | Five packaging guards PASS; existing native migration guard reused after identical-body/helper verification |
| Production state | Remains inactive release1088e036c4f81048/schema90; no apply or provider requests |
| Fresh production plan | prepared-3, schema90→91; seal `a4217c90bf0ec1cc331a8842ab0f6042facce02fbf9e46bd5ada412a86fd1a4a` |

The new package is `../modular-commerce-planning-20261023/review-4/`.
The old review-3 package and withdrawn prepared-2 deployment plan remain intact.
Its `STOP.json` prevents reuse. No old archive, source output or import was replaced.

The [local repair tool](../scripts/shipping-tariff-release/repair.mjs) checks the
exact proposal approval before copying. It verifies original and accepted archive
inventories, adds only the approved metadata, rejects collisions/unsafe paths and
requires every other file to remain byte-identical. The executable prefix/suffix
outside the static registry are unchanged. The new format-v2 manifest binds the
proposal, approval receipt, original manifest, exact delta and qualification.
The [deployment validator](../scripts/shipping-tariff-release/operator.mjs) verifies
this provenance and rejects the old broken package before SSH.

All1224 static checks ran against the extracted exact new archive on loopback.
No hosted customer, provider, real-payment, packing or shipment acceptance is claimed.
The four anonymous checks verify tariff and controlled-purchase GET/POST boundaries.
New packet qualification reuses existing source/UI/SQL tests rather than replaying
the feature suites. New repair cases cover approval/scope tampering, metadata and
path collisions, unrelated/duplicate/missing files, executable preservation and
full repaired-artifact provenance. New and retained static bytes were verified.

Migration91 and the separate owner-draft import retain their original hashes.
Imported PDC tariffs stay editable, inactive and unverified. Effective dates remain
null; Product40 applicability, fractional rounding and suburb mappings remain
unverified; insurance stays off. There is no automatic checkout pricing change.

Fresh read-only preflight,138 protected projections, Auth/runtime/media/Caddy
preservation and encrypted database/runtime backup readback PASS. The fresh plan is
`../tariff-production-preparation-20261023/prepared-3/plan.json`; its authorization
packet is `../tariff-production-preparation-20261023/NEXT-EXACT-AUTHORIZATION.json`.
Final read-only check PASS against this exact plan and unchanged tools/artifact.
Production remains unchanged.

The next owner approval text is:

```text
Approve tariff deployment only.
Seal: a4217c90bf0ec1cc331a8842ab0f6042facce02fbf9e46bd5ada412a86fd1a4a
```

That approval would permit one guarded attempt: the exact application package,
migration91, private candidate checks and Nuxt switch/restart. Fresh execution
backups and final preservation checks remain required. Business import,
Caddy/runtime/credential changes, purchasing grants, payments and provider booking
remain outside that approval. The local repair approval does not authorize apply.
Any drift or uncertain phase stops; do not retry or automatically roll back.

The [first-transaction plan](tariff-deployment-and-first-transaction.md) remains in
force: one eligible account/item, verified route and explicit costs, narrow access
and signed callback ingress, separately approved payment, durable paid order,
physical packing, then separately approved PDC booking/PDF/poll. Uncertain outcomes
are never blindly retried. Refund/reverse acceptance and the modular gateway,
carrier-account, subsidy and loyalty roadmap remain separate.

No production SQL, business import, gate activation, price/credential change,
provider request, charge, booking or Git push occurred.

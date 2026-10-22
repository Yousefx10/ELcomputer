# Inactive controlled-purchase application release — 2026-10-23

**DEPLOY PASS. CAPABILITY REMAINS INACTIVE.**
Production is `1088e036c4f81048`, schema90. [Deployment receipt](controlled-purchase-deployment-receipt.md).
The owner approved the exact seal below; this plan ran once and is consumed.
Both real provider transactions remain blocked. Never rerun the approved apply.

| Bound item | Reviewed result |
| --- | --- |
| Application | `32f152f3e75380db1f7ca9c054098231dbbd3226` |
| Deployed release | `1088e036c4f81048` |
| Archive SHA256 | `1088e036c4f81048bf78bdb218230d16f38d647477a43a7560990b3f6154ca41` |
| Approval seal | `d9ed612b03fbc146d4b6f5449448a4e1331ff155c267e8e70666e0bb2c98bf76` |
| Schema / writes | Schema90 unchanged; no migration or SQL write |
| Archive readback | 2074 entries;1021 retained previous client assets |
| Preparation backup | Authenticated encrypted database/runtime backups and full readback PASS |
| Preservation at seal | All138 protected table projections, schema/Auth, runtime/Caddy/service, media, assets and disabled gates PASS |
| Final independent preflight | READ_ONLY_CHECK_PASS; clean source, bound evidence/backups and live target/preservation/held routes verified; zero writes |
| Execution | Completed once; approval/intent consumed; no automatic retry or rollback |

## Deployed scope

One private EN/AR account page and exact controlled checkout GET/POST handler.
The server defaults to an inactive `NUXT_CONTROLLED_PURCHASE` value. Existing
bearer Auth and active/confirmed customer checks remain required. Future approval
binds one account, durable cart, product/model, quantity1, carrier, exact EGP total,
address hash and a maximum one-hour window. No deployment-specific identity is
hardcoded in reusable application code.

Global purchasing, ordinary Paymob initiation, signup and PDC runtime remain off.
This release changed no runtime file, Caddy rule, credential, catalog record,
stock, delivery setting, cache, payment or shipment. It preserves Premium PDP,
Auth, footers and schema90. Public purchase controls will still display the hold.
No provider request or card charge occurs merely by deploying this capability.

Paymob helpers add only a server-selected order authorization hook and a fixed
controlled return path. Auth/scope are checked before and after the durable
payment claim. The existing callback validates signed persisted payment context
independently of new-initiation closure. The callback stays publicly held until
its exact POST ingress is separately approved.

## Completed qualification

- 15 controlled checks: nine native PostgreSQL17/90-migration tests and six
  Vue/headless Chrome UI checks. Concurrent/replayed commands create one order
  and one synthetic intention; callback replay creates one receipt and no PDC job.
- 27 existing Paymob regression checks. No real provider was contacted.
- Typecheck and clean release build PASS. Existing duplicate ERP import warning
  remains; no new functional blocker was found.
- Exact extracted archive:20 compiled HTTP checks with synthetic Auth/PostgREST
  and external networking denied. Normal Nuxt-decoded object and source JSON
  string grants work. Other users, invalid review signatures and wrong orders
  fail; global capabilities and ordinary initiation stay disabled.
- Four release guard tests include nine remote filesystem/phase fault cases,
  frozen prior operators, tar link-header compatibility and build-reuse integrity.
- Local Caddy policy test passes on two configurable hostnames, with exact methods,
  private caching and HMAC query forwarding. This candidate is not deployed.

The UI clears card fields after SDK completion/cancel and reads server status.
SDK/browser return never marks an order paid. Network requests do not retry.
Uncertain order acknowledgement exposes only saved-order recovery. An uncertain
payment cannot start another attempt. Time closure prevents new app initiation;
outstanding provider/3DS activity can still settle, so retain signed receipts.

## Guarded deployment and remaining activation

The private format8 plan is
`../controlled-checkout-readiness-20261023/prepared-4/plan.json`.
The operator is `scripts/controlled-purchase-release/operator.mjs`. Its `check`
mode verifies all bound evidence, authenticated backups, clean source, target,
current production, protected data/Auth and disabled gates without production
writes. Fresh execution backups and final preservation remain mandatory after
exact approval. The application-only apply stages a private schema90 candidate,
requires anonymous controlled API401 and global card-unavailable checks, then
activates once. No consumed operator is changed or reused. A failed apply stops;
there is no automatic retry or rollback.

Consumed approval for this inactive application deployment only; **do not rerun**:

```text
APPROVE INACTIVE CONTROLLED PURCHASE DEPLOY
d9ed612b03fbc146d4b6f5449448a4e1331ff155c267e8e70666e0bb2c98bf76
```

**Application approval is consumed. Do not apply this plan again.**
This authorizes neither the private grant nor the Caddy candidate, city/cache or
Dashboard writes, a payment intention/card submission, refund, booking, PDF or poll.
Those require the completed private purpose/account/order/address/amount/cost/window
packet. No activation packet is currently sealed because real business details
remain unselected. Existing merchant credentials need no replacement or Dashboard
secret editor.

## Preserved stops and evidence

Private evidence is in `../controlled-checkout-readiness-20261023/` (0700/0600).
It contains the final source/artifact qualifications, native/UI/Paymob/typecheck/
Caddy/guard logs, backup receipts, compiled archive fixture, seal log and plan.
No credentials, card details or recipient addresses are copied into this document.

Earlier local preparation directories are retained and must not be deployed:
`prepared` stopped on tar symlink header mode; `prepared-2` stopped when Dashboard
setup/audit projections advanced; `prepared-3` was superseded after compiled Nuxt
JSON decoding exposed the string-only parser. Confirmed local corrections were
qualified before `prepared-4` received this seal and completed its approved deployment.
No failed production deployment,
provider retry or production write occurred. Do not delete or reuse those stops.

See [current blockers and approvals](controlled-purchase-readiness.md) and
[first physical shipment requirements](pdc-first-live-shipment-checklist.md).
The EGP1/50-unit product is deliberate test data. It does not prove a real sale,
physical inventory, actual parcel value or carrier coverage. Do not fabricate
supplier transactions or underdeclare a real parcel using its nominal test price.

# Account/profile access applied — 2026-10-23

Owner approval:
`5d3181a2382ee4812b6fc0cf21d1759abfd2bb41d12b6dd77f92949a40c4aac9`.

Only GET/HEAD EN/AR `/login` and `/account/profile` were added to Caddy.
Existing Auth and own-profile RLS remain authoritative. The owner selected
`i***@elcomputer.net`; no account was impersonated or given extra permissions.

| Check | Result |
| --- | --- |
| Exact proposal/evidence/source hashes | PASS before execution |
| Fresh pinned runtime/configuration/process preflight | PASS |
| Exclusive intent and original Caddy backup/metadata | Preserved locally and on target |
| Exact target candidate validation | PASS before atomic installation |
| Baseline Caddy SHA256 | `504191ccdc985084cf9aa0bba4fc36b7cf2bcae7405af95abce469d56bd81558` |
| Installed Caddy SHA256 | `7374a3e2c8e889f97eec41134626d6fe5e65c17d71402e2c3fa1afbb9fef6663` |
| Caddy restarts | One; `admin off` preserved |
| Nuxt/application/schema/runtime changes | None; release08b45ffac0e524c8/schema91 retained |
| Public login | EN/AR200 |
| Anonymous profile | EN/AR302 to normal authentication |
| Checkout/payment/signup/worker holds | Retained; recorded GET probes403 and exact method policy preserved |
| Dashboard login and public content |200 |
| Provider requests, orders, attempts, transactions, dispatches/jobs | Zero |
| Real owner profile save | Pending owner action; not inferred from anonymous checks |

Private execution evidence:
`../normal-owner-checkout-20261023/approved-5d3181a2/`.
The procedure was executed once. Its one-use intent blocks repetition.

The broad post-operation row comparison stopped because Auth activity and live
analytics changed concurrently. That STOP remains preserved. No restart,
installation retry or automatic rollback followed.

Read-only review found the other138 protected table fingerprints unchanged,
financial counts unchanged at zero, and Auth security identical to the deployed
baseline. The existing Auth fingerprint excludes only `last_sign_in_at` and
`updated_at`; current security columns are all included. An additional analytics
session appeared during the comparison. This is concurrent-state evidence,
not proof of global write history or a claim about who created the session.
The Caddy operator used read-only database connections and sent no provider request.

`verification-resolution.json` and `completed.json` record
`PASS_AFTER_READONLY_REVIEW`. The original STOP and all snapshots remain retained.
The owner can now sign in and update their address in My Account → Profile.
Checkout, Paymob ingress/initiation and PDC operations remain closed.

The [normal-flow corrections](normal-checkout-restriction.md) are a separate
local application change. This approval permits preparing their inactive artifact,
not deploying it, enabling a purchase grant or making a real transaction.

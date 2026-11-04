# Apple Pay checkout hotfix — deployed; hosted technical checks passed

4 November 2026. Task `PAY-APPLE-FORM-20261104-01`.

**DEPLOYED / ROUTING UNBLOCKED / HOSTED TECHNICAL PASS.** Physical iPhone
Apple authorization-sheet and genuine provider-payment acceptance remain **OPEN**.
No successful authorization, charge, refund or paid order is claimed.

| Verified identity | Value |
| --- | --- |
| Active application | `54315e37fdc74aa7` |
| Source | `388c04df15d998fcde1774b8eaddc8169a39bdd9` |
| Physical schema | `113`, unchanged |
| Latest installed migration | `20261104020000_checkout_payment_interfaces.sql`, unchanged |
| Application PID | `271738`, unchanged during activation |
| Caddy PID | `26652`, unchanged |
| Exact signal approval | `3d0a441c0f4392c5bc6f34875b43620e5e9834ec7f2fe2a80d00510b066b0d0c` |
| One production signal acknowledged | `2026-11-04T13:10:25.236392+00:00` / 16:10:25 Riyadh |
| Original operator completion | `2026-11-04T13:16:39.944Z` / 16:16:39 Riyadh |
| Final operator status | `CONSUMED_COMPLETE` |

This packet is spent. No new approval or expiry applies to its completed action.
Never replay apply, signal, configuration writes or any previous consumed operator.

The owner reported an immediate unavailable form on iOS 26 while CARD fields
rendered. The old app checked top-level eligibility, then initialized Apple Pay
inside a child context. Rejection there could become the generic message.
An eligible-parent/restricted-child fixture reproduced that failure. The original
physical Safari exception was discarded, so its precise device/provider cause
remains unverified.

The app correction uses the unmodified pinned Pixel 1.2.8 SDK in an authenticated
top-level Apple page. It reuses the existing intention, authoritative quote and
server submission gate. Exits replace the document to dispose of the SDK;
failures provide localized recovery controls and fixed, sanitized phase codes.
No domain or certificate correction is claimed.

Postflight proved a separate production blocker: Caddy omitted the Apple UUID
page GET/HEAD routes and the existing owned interface API POST route. Public
pages returned **403**, while Nuxt loopback returned **302**. The `bf0a21c6`
packet passed native validation and installed the approved route expression and
monitor hash binding. Its reload stopped because the systemd unit has no
`ExecReload` and the admin API is disabled. That **STOP** remains preserved;
it was never replayed or relabeled complete.

The fresh `3d0a441c` packet confirmed the exact file-based startup, no `--resume`,
caught `SIGUSR1`, disabled admin, binary/PID/configuration identity and full approved
adapted JSON. The actual installed binary passed an isolated loopback fixture:
private HOME/XDG, admin/HTTPS/persistence disabled, fixed before/after responses,
one fixture signal and unchanged fixture PID `275892`. Only that owned child was
terminated. Exactly one production signal then activated the approved bytes.

During this activation there were **no further configuration edits, app/Caddy
restarts, timer pauses, unit/runtime/flag/key changes, SQL/schema/history writes,
provider/financial actions, manual worker invocations or Git pushes**. Caddy admin
remains disabled. The approved UUID/method routes retain customer authorization
and private/no-store behavior.

Current Caddy SHA256:
`7133f681f5cd7e734b50dca467521c0ad30cfc487963ebcb4ca90c936b45fd73`.
Monitor configuration SHA256:
`5604d55ca72f8625ac6acdd83125883b1f9f8af473bf7d12ac191f3257b3538a`.

The earlier approved app hotfix changed these runtime source files:

- `app/components/payment/ApplePay.vue`
- `app/pages/checkout/apple/[id].vue`
- `app/pages/checkout/index.vue`
- `app/components/payment/CheckoutStatus.vue`
- `i18n/locales/en.json`
- `i18n/locales/ar.json`

Tests and documentation accompanied those changes. Routing and activation changed
no app code. Backend, SQL, vendor SDK, CARD iframe, callback HMAC, reconciliation,
quote, cart and COD implementations remain unchanged.

Qualification and postflight evidence:

- **183 focused app/SDK/backend/browser tests**, typecheck/build and 765 build-input
  hashes passed. Tests of the real SDK used isolated responses and a synthetic
  Apple session; they do not prove physical-device or merchant acceptance.
- **210 routing/guard checks** and 21 execution assertions passed. Caddy adaptation
  changed only the reviewed route expression on HTTP/HTTPS. Full native validation
  passed.
- **92 signal-controller checks** and 21 one-use assertions passed, followed by
  the actual installed-binary signal fixture before the one production signal.
- Fresh encrypted database/17-file backups passed authenticated readback.
  No production restore was performed.
- All **4,772 deployed/retained asset HTTP hashes** passed. Independent checks
  after activation confirmed SDK resources, actual SRI, CSP and referrer controls.
- Public EN/AR Apple pages now return **302** to login with private/no-store
  controls. The single authorized empty-body anonymous interface POST returned
  **401**. CARD/COD capabilities return **200**. The public hosted CARD default,
  inactive InstaPay and existing customer scope remain preserved.
- **Nine independent public/auth/SDK checks** passed. Read-only schema 113 history,
  security, settings, retained attempt IDs and financial-integrity checks passed.
- The independent host audit passed all **17 approved file hashes**, both unchanged
  PIDs, app certificate/cwd, loaded runtime and the existing Apple integration
  `6038812` scoped to one customer. Existing encoded Nitro value types matched.
- MON/Email/PDC timers remain active/enabled; their natural callers succeeded.
  No worker was invoked. The natural monitor run at
  `2026-11-04T13:15:05.954889+00:00` completed with the original **8 warnings,
  3 gaps and 0 critical findings**. No warning or gap was cleared.
- All **2,360 sealed input hashes**, **58 worktrees**, **55 paused artifacts** and
  **19,350 prior sealed input entries** remain preserved. No homepage,
  infinite-scroll, Meta, image-cache or other unqualified changes were bundled.

Current read-only activity is **11 sessions/attempts, 0 funds/callbacks, 10 orders
and 0 proofs**. All four financial-integrity counters are zero. All 11 baseline
IDs remain, including five legacy unknown/null interfaces and the submitted
unresolved attempt. These records were neither restored over nor rewritten.
A browser completion cannot mark an order paid. Authenticated fixture callbacks
still establish exactly one paid order after verified funds; genuine provider
success remains unexercised. Unsubmitted cancellation preserves the cart and safe
reopening. Submitted or uncertain outcomes remain protected against unsafe retry;
native cancellation cannot establish their financial outcome.

DTR-45 hosted routing/technical qualification is **PASS**. Physical iOS 26 sheet
and authorized provider-payment acceptance remain **OPEN**. DTR-44 hosted technical
qualification and older DTR-36/38/42/43 owner/provider gates remain distinct.
Modern DTR-41 acceptance remains preserved.

Evidence packet:
`/Users/imac/Documents/ELcomputer/paymob-apple-signal-activation-20261104/release`.
Execution and independent audits:
`/Users/imac/Documents/ELcomputer/paymob-apple-signal-activation-20261104/execution-3d0a441c-20261104`.
The old `23d5` app and `bf0a` routing STOP/history records remain unchanged.
No further production action is required for this completed activation.

**ONE next action:** reload Safari checkout on the eligible iPhone and select
Apple Pay to check whether its authorization sheet opens. Stop before confirming
payment. If an existing attempt shows an uncertain status, report that message.

---

Historical interim receipt, superseded by the completed postflight above:

# Signal activation acknowledged — 4November2026

**ACTIVATED. Hosted postflight active. Device/provider acceptance OPEN.**

PAY-APPLE-FORM-20261104-01: CADDY_SIGNAL_ACTIVATION_APPLIED 2026-11-04T13:10:25.236392+00:00.
Installed-binary isolated SIGUSR1fixture PASS, then exactly1productionSIGUSR1to
Caddy26652. App54315e37/source388c04d/schema113/PID271738and CaddyPIDunchanged.
0config edits/app or Caddy restarts/timer pauses/SQL/provider/financial/manual
worker actions. EN/ARApple UUID pages now302to login/private-no-store; exactowned
interface anonymous empty-body POST401; CARD/CODcapabilities200. The prior403
routing block is cleared. No authenticated Apple sheet/provider acceptance claimed.
Full read-only sealed/public/SDK/schema/financial and next-natural-MON postflight
is active. Never replay signal/apply; previous23d5/bf0aSTOPevidence stays preserved.
All existing attempts/warnings/paused artifacts and deferred gates remain intact.
ONE next action: finish postflight and record the exact hosted/device evidence tier.


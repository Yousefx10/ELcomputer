# Apple Pay Caddy route correction — 4 November 2026

Task `PAY-APPLE-FORM-20261104-01`. **APP INSTALLED / APPLE ROUTING BLOCKED.**
The routing correction is **LOCALLY QUALIFIED / SEALED READY / UNAPPROVED**.

Application `54315e37fdc74aa7`, source `388c04df15d998fcde1774b8eaddc8169a39bdd9`,
is installed on physical schema113. The owner-approved23d5b181app cutover succeeded
once at11:14:36UTC, with PID271738. Caddy PID26652 stayed unchanged. All three timers
resumed; pauses were10.38–10.45seconds. No SQL/runtime/Caddy/provider/financial action
was performed by that app release. The original approval is spent; do not replay it.

Postflight found a missed deployment dependency. Public EN/AR Apple pages return
**403 Unavailable**, while the same Nuxt route returns **302 to login** on loopback.
The Caddy payment_checkout_access allowlist permits checkout/session UUID pages
but omits checkout/apple UUID pages. Its source also omits the existing owned
payment-checkout interface POST used for opening and authorizing embedded forms.
Generic dormant/commerce rules deny the missing paths before Nuxt handles them.
The prior qualification did not check this live routing dependency.

This is separate from the original iOS26exception, which the old wrapper discarded.
The parent/child eligibility mismatch was reproduced with a restricted-child
fixture; no exact physical Safari exception or successful native sheet was proven.
No merchant certificate/domain defect is claimed, and those investigations remain
closed unless later provider evidence requires them.

The proposed correction changes one Caddy expression line. It adds only:

- GET/HEAD `/checkout/apple/<valid UUID>` and its Arabic equivalent.
- POST `/api/account/payment-checkouts/<valid UUID>/interface`.

Both reuse the existing private no-store handler. UUID bounds, customer ownership,
server authorization, submission tokens and every other path/method stay intact.
The actual deployed Caddy v2.11.7adapter accepts the complete candidate. Only the
same expression changes on the HTTP and HTTPS servers; all other adapted JSON
is identical. No plaintext Caddy configuration or credential was exported.

The second protected-file edit changes only the monitor's caddy_sha256 binding.
The two files are `/etc/caddy/Caddyfile` and
`/etc/commerce-monitor/config.json`. Expected Caddy SHA256:
`7133f681f5cd7e734b50dca467521c0ad30cfc487963ebcb4ca90c936b45fd73`. Expected monitor configuration SHA256:
`5604d55ca72f8625ac6acdd83125883b1f9f8af473bf7d12ac191f3257b3538a`. All other keys and protected files stay unchanged.
Original warning records must remain exact; additional noncritical findings are
retained in evidence. Critical findings, or missing/changed original warnings, stop.
No warning, journal gap or payment uncertainty is cleared to manufacture success.

The initial app verifier stopped at MONITOR_WARNING_DRIFT during the11:15snapshot.
The next natural report returned to the original eight warnings without intervention.
Current sealed preflight at **2026-11-04T12:00:54.735Z** observes natural MON
**2026-11-04T12:00:03.859993+00:00**, complete, eight warnings, three gaps,
zero critical findings. The old verification STOP remains preserved and was not
replayed or relabeled CONSUMED_COMPLETE.

Independent evidence verifies the installed app/certificate/PIDs/runtime/17files,
resumed timers, unchanged SDK/SRI and **all4,772live asset hashes**. The original
183focused app tests and build/typecheck remain applicable because app code is
unchanged. Current read-only evidence shows11sessions/attempts,0funds/callbacks,
10orders,0proofs,integrity0. The added customer attempt remains preserved alongside
all earlier IDs and the five legacy unknown/null interfaces. One submitted
unresolved fence stays protected. Full original frozen financial projections are
not claimed after ordinary customer activity; the new operator performs read-only
schema/security/integrity/ID checks and never restores or rewrites payment data.

Routing qualification passes **210checks**:36JavaScript operation guards and174
Python route/UUID/method/config-preservation/timer/expiry/warning checks. Another
**21assertions** exercise missing/wrong approval, one-use success and uncertain reload
fences with isolated dependencies. Fresh encrypted database and17protected-file
backups pass authenticated complete pg_restore/tar byte readback. Native full Caddy
validation is an execution guard before protected changes, and is not claimed
already performed during read-only preparation.

Authorized scope, if approved, is one native validation, one write per the two
protected files, one graceful Caddy reload, one bounded MON timer pause/resume,
and one empty-body unauthenticated interface POST to a nonexistent fixture UUID
that must return401. The backend authenticates before parsing payment actions;
this probe cannot open a real session. It includes no customer credentials.
There are **zero app restarts, app/source/archive changes, SQL/migration/history/
financial/provider/runtime/flag/key/unit edits, Email/PDC pauses or manual worker
requests**, and no new emergency budgets. CARD/COD, callback HMAC, same-intention
retry rules, cart retention and duplicate prevention remain installed unchanged.

The original58worktrees,55paused Meta/SMS/InstaPay artifacts and17,085spent packet
inputs remain preserved. No homepage, infinite-scroll, Meta or image-cache work
is bundled. DTR-45 remains blocked on routing and owner-device acceptance; all
DTR-36/38/42/43/44 gates and Modern DTR-41acceptance remain separate and preserved.

The packet is `/Users/imac/Documents/ELcomputer/paymob-apple-route-correction-20261104/release`. Seal `bf0a21c6416653b1ba9cc5b84f3151777a2771262ef74ac0cad76fad27566678` binds2265inputs.
Its sealed read-only preflight passes; owner approval and apply markers are absent.
Native validation must succeed before either protected file changes. Application
and Caddy process identities, app inventory and runtime stay exact. Postflight
requires the two approved config hashes, private Apple authentication redirects,
interface401denial receipt, CARD/COD, exact113schema/security and retained attempt
IDs/integrity, followed by the next natural complete MON. Genuine iPhone sheet and
separately authorized provider-payment acceptance remain OPEN; no charge/refund
or provider success is claimed.

Execution consumes the packet before mutation. An uncertain reload never repeats;
there is no automatic rollback or database restore over customer activity. Only
this execution's fenced MON pause can resume once. Recovery requires fresh current
state and a separately approved exact packet. Expiry or drift cannot transfer approval.

A new approval is required because the spent23d5b181packet explicitly permitted
**zero Caddy changes**. Start before **15:42:41UTC /18:42:41Riyadh,4November2026**;
expiry **15:57:41UTC /18:57:41Riyadh**.

ONE next action: approve this exact routing correction:

```text
APPROVE PAYMOB APPLE PAY CADDY ROUTE CORRECTION SCHEMA113 bf0a21c6416653b1ba9cc5b84f3151777a2771262ef74ac0cad76fad27566678
```

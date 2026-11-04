# Apple routing signal activation — 4 November 2026

Task `PAY-APPLE-FORM-20261104-01`. **READY / UNAPPROVED.**
Sealed read-only preflight PASS at 2026-11-04T13:00:12.297Z. No production signal has been sent.

The previous bf0a21c6operator completed native Caddy validation and wrote exactly
the two approved configuration files. It then stopped at systemctlreloadbecause
the unit has no ExecReloadand reportsCanReload=no. Its admin API is disabled.
No Caddy reload or restart occurred. The monitor timer was restored in3.64seconds.
That operator remainsCONSUMED_STOP; its input files and receipts are preserved.
The service capability check should have been included in its preflight.

Current app `54315e37fdc74aa7`, source `388c04df15d998fcde1774b8eaddc8169a39bdd9`,
physical schema113, appPID271738and CaddyPID26652remain unchanged. Approved Caddy
SHA7133f681and monitorSHA5604d55cbytes are installed, but public Apple pages still
return403because the running process has not loaded them. CARD/COD code and all
payment-first, callback/HMAC, quote, cart and duplicate-prevention contracts remain.

A restart is avoidable. [Caddy's official signal contract](https://caddyserver.com/docs/command-line#signals)
supports SIGUSR1for a process started with caddy run from a config file without
resume/API configuration changes. Read-only current-process checks confirm its
exact file, no resume, disabled admin, caught SIGUSR1and exact approved adapted
JSON. The old and new configs differ only in the approved route expression and
monitor hash binding; no admin configuration was changed. The failed systemdjob
never called the Caddy admin API or performed a reload.

This new packet binds the installed binary, currentPID26652and approved files.
It first validates the current configuration, then must test that installed binary
in one isolated Caddy process. That fixture uses an ephemeral loopback-only port,
private HOME/XDG storage, disabled admin/automaticHTTPS/persistence and fixed
before/after bodies. One fixtureSIGUSR1must change the response without changing
its child PID. Only that owned child is terminated afterwards. Any unsupported
signal, startup/fixture failure or capability drift stops before a production signal.
**The actual installed-binary fixture is deferred to approved execution.**

Only after that pass may oneSIGUSR1target the exact production Caddy process.
GET readiness can poll, but no production signal can repeat. One empty-body
unauthenticated interface POST to a nonexistent fixture UUID must return401;
existing server authorization runs before any action or payment-state access.
No credentials, client secrets, genuine provider requests, charges or refunds are
part of the test. Physical owner iOS26sheet and real payment acceptance stayOPEN.

The remaining action includes **zero further production configuration edits,
application/archive/source changes, app or Caddy restarts, timer pauses, SQL/schema/
financial/provider/key/unit/runtime/flag changes, manual workers or new emergency
budgets**. The admin API stays disabled. Native activation uses the two files
already approved and installed; it does not repeat their writes or the old apply.

Local qualification passes **92checks**:38JavaScript guards and54Python scope,
PID/signal restrictions, fixture isolation/failure/cleanup and ordering tests.
Another **21assertions** verify wrong/missing approval, one-use execution and
uncertain-outcome consumption with isolated dependencies. Fresh encrypted DB and
17-file backups pass authenticated complete readback. The unchanged application
retains its183focused tests and4,772verified live assets. All58worktrees,55paused
artifacts and19,350previous sealed input entries remain preserved. No Meta,
homepage, infinite-scroll, image-cache or unrelated project work is bundled.

Current baseline is11sessions/attempts,0funds/callbacks,10orders,0proofs and
integrity0. All existing IDs, the five legacy unknown/null interfaces and one
submitted unresolved fence stay protected. No outcome, expiry or cancellation is
invented; no cart is cleared or ordinary order created by these operations.
Read-only schema/security/integrity and ID checks allow normal customer activity
without restoring or rewriting it. The app's same-intention and uncertainty
protections remain authoritative.

Packet: `/Users/imac/Documents/ELcomputer/paymob-apple-signal-activation-20261104/release`. Seal `3d0a441c0f4392c5bc6f34875b43620e5e9834ec7f2fe2a80d00510b066b0d0c`, binding2360inputs.
Approval and apply markers are absent. App/CaddyPIDs,17approved file hashes,
loaded runtime and installed inventory must stay exact. Postflight requires
private EN/ARApple302/no-store responses, the interface401denial receipt,
CARD/CODhealth, physical113/security/ID/integrity preservation and the next natural
complete MON. Original warning evidence remains exact and additional noncritical
findings remain visible; critical findings stop. No warning is cleared for a pass.

This fresh approval is necessary because bf0a21c6is consumed and its recovery
contract requires a new exact approval. Acknowledged writes are never replayed;
uncertain signals never repeat. There is no automatic rollback or database restore.
DTR-45routing/device/financial acceptance remainsOPEN. All other deferred gates,
previous hosted technical success and Modern DTR-41acceptance stay separate.

Start before **16:42:25UTC /19:42:25Riyadh,4November2026**;
expiry **16:57:25UTC /19:57:25Riyadh**. Expiry or drift cannot transfer approval.

ONE next action: approve this exact signal-only activation:

```text
APPROVE PAYMOB APPLE PAY CADDY SIGNAL ACTIVATION SCHEMA113 3d0a441c0f4392c5bc6f34875b43620e5e9834ec7f2fe2a80d00510b066b0d0c
```

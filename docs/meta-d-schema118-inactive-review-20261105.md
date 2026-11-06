# Meta and Release D: current schema118 review — 5 November 2026

Both packets are **LOCAL PASS / READY UNAPPROVED**. Neither is installed.
Production remains SMS `ee5dd61e2b6fd8f6` / `573e208` / physical schema118.
Provider, transactional SMS, marketing SMS and Meta remain OFF. This review and
the old consumed SMS approvals authorize no new production change or transmission.

| Candidate | Reused original | New isolated source | Proposed migration |
| --- | --- | --- | --- |
| Meta | `77013c4` | `c8ba3711abe81b3ffe62a5c9d43fe446cb3ba0d9` | `20261105132000_meta_commerce_tracking.sql` |
| Release D | `0f4e66f` | `54364a5fac9e78f498c9743e9bfdb81e188699cc` | `20261105150000_public_image_cache.sql` |

Both sources descend from installed SMS573e208 and preserve all118 installed
migration files byte for byte. Feature code is reused; additive locale/config/RBAC
merges preserve SMS. D's uninstalled migration received a forward identifier;
its SQL bytes are unchanged. No installed migration was renamed or rewritten.

Each packet independently proposes **118→119**, one migration/history row in one
transaction and one application release. They are alternatives against the same
actual predecessor. Installing one invalidates the other's baseline; the second
must preserve the newly installed source/schema and receive a fresh qualification
and seal. Do not install them sequentially from these two unchanged packets.

Meta installs empty, disabled settings with no token, events, worker or scheduler.
D installs reviewed visual corrections and public-image caching, whose setting
defaults enabled. D's image-cache behavior is an explicit application effect;
communication/provider gates remain OFF. Release C/preorder and Daftra are excluded.

| Evidence | Result |
| --- | --- |
| Current restored-production schema118 | Exact schema/functions/RLS/ACL footprint before either DDL;33 redundant owner grants reproduced locally |
| Independent commit and rollback | Both PASS;172 original projections and14 attempts preserved |
| Meta bounded checks |43 PASS on new source; four worker checks PASS |
| Meta native balance | PASS; initial local statement timeout preserved; no timeout/code relaxation |
| Release D checks |54 PASS on new source, including actual component/browser checks |
| Typecheck/build | Both PASS with isolated dependency copies and recorded source inputs |
| Retained compiled Meta HTTP |21 route checks and5,389 asset hashes PASS |
| Retained compiled D HTTP |17 route checks and5,392 asset hashes PASS |
| Installed public assets | All5,283 immutable files preserved in both; latest-build pointer intentionally replaced |
| Release guards |54 scope/lifecycle + nine activity-policy JS checks and five Python checks PASS |
| Fresh sealed Meta preflight | PASS13:11:02 UTC,5 November2026 |
| Fresh sealed D preflight | PASS13:14:55 UTC,5 November2026 |

The first D read-only preflight stopped at `EXISTING_WORKER_STOP`. Independent
systemd observation showed the existing workers naturally successful afterward;
the unchanged read-only preflight then passed. No worker call, restart, timer
change, stage, approval or deployment attempt was consumed.

Installed SMS57 and Dashboard17 passing checks are retained for their unchanged
installed source identities. Shared routes and current database preservation were
also checked in the new compiled/rehearsal evidence. The historical PDC fixture's
`order_number` failure and old footer-fixture expectations remain recorded;
unrelated code was not changed and no broad clean-suite claim is made. Local
browser tests do not establish signed-in hosted, device or provider acceptance.

Fresh read-only evidence retains14 attempts/sessions,11 orders, zero funds,
callbacks/proofs and all four integrity counters0. CARD/COD/EGP10, existing Apple/
Pixel boundaries, Brevo, PDC, MON and all financial uncertainty remain protected.
Natural MON retains eight warnings, three historical gaps and zero critical.
An authenticated encrypted schema118 dump and17-file runtime backup passed full
readback. They do not authorize restoration after customer activity.

The original68 worktrees and24,004 untracked hashes are preserved; two new isolated
worktrees are additive. Main remains20ee821; original candidate sources, old
packets and both consumed SMS receipts are intact. There was no Git push.

## Exact review packets

Packet directory:
`/Users/imac/Documents/ELcomputer/ELcomputer/logs/historical-integrations-20261105/operations/packets/`.

| Candidate | Application SHA256 | New seal |
| --- | --- | --- |
| Meta | `4503cbf1cda3c5d0763216ed42be2c4124ea97d4948f76697d070ac1e0ef45f6` | `eb935c7be29f332fa0e69ebf6e818578752e7cc25a1f65e8f0decffe715d15db` |
| D | `3959ee5b544ff4c7b0e572bd5228a8786fe6e78cce77043d9984180cb2a1c9bf` | `088a8197449baeef99266536b61d9f2fbe1aef0e8776bfcda807663ef6ef3c23` |

Independent rehash passed1,794 Meta and1,771 D sealed inputs. Start by
**5 November2026,19:40:47 Riyadh /16:40:47 UTC**; expire19:55:47 Riyadh.
Any source, schema, protected-state or expiry drift blocks execution. Approval
recording and execution each repeat the sealed read-only guards.

Exact future installation statements, for review only:

```text
APPROVE META ONLY INACTIVE SCHEMA118 INSTALLATION eb935c7be29f332fa0e69ebf6e818578752e7cc25a1f65e8f0decffe715d15db
APPROVE VISUAL ONLY INACTIVE SCHEMA118 INSTALLATION 088a8197449baeef99266536b61d9f2fbe1aef0e8776bfcda807663ef6ef3c23
```

Each scope permits at most one archive upload, one local candidate launch, one
transaction, one app restart and one pause/resume of each existing timer within
180seconds. Runtime, credentials, Caddy, unit definitions, workers, providers,
business/financial writes and transmission changes remain zero. Consumed or
uncertain mutations must never be retried or rolled back automatically. These
statements are not approvals and neither was recorded or executed.

## Existing credentials and hosted prerequisites

[Historical recovery](historical-vodafone-meta-recovery-20261105.md) found Vodafone
credentials and four Meta token candidates. The existing server encryption key
meets Nuxt's requirement; no recovered value has been bound to production.
Current Vodafone account/Notification/sender/IP permission and tariff/cap remain
unverified. Historical Pixels differ from target1680814460341996, so target-token
permission remains unverified. Existing owner records and Events Manager should
be checked before requesting provider contact or replacements.

[Prepared scopes](vodafone-meta-bounded-test-preparation-20261105.md) limit SMS to
one approved Notification and Meta to one consented customer/five minutes/three
nonfinancial events. Private recipient/body/cap, target permission/Test Event code
and exact installation/configuration/test approvals are still required. No SMS,
Meta, marketing, provider or financial request ran during this preparation.

ONE next action: privately confirm Vodafone sender/IP/tariff and target Meta
dataset access through the existing owner accounts, using the recovered values.

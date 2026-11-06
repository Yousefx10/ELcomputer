> **SMS is now DEPLOYED INACTIVE / schema118 / CONSUMED_COMPLETE.** Do not approve or replay the historical packet below. See the [completed receipt](sms-inactive-schema118-deployment-receipt-20261105.md). Old Meta/D schema116 bindings are stale.

> **SMS approval162c0f90 is now CONSUMED_STOP before commit. Do not replay it.** Production remains B/schema116. See the [independent stop receipt](sms-inactive-installation-stop-receipt-20261105.md). The READY status below is historical for that SMS packet; Meta/D remain separately unapproved.

# SMS, Meta and D release review — 5 November 2026

**READY / UNAPPROVED — three independent packets against deployed B/schema116.**

The refreshed login restored protected execution. The blocked snapshot, restored
PostgreSQL rehearsals, compiled HTTP/assets, worker tests and new operator guards
are complete. Existing candidates and their passing evidence were reused. No app
source was changed, no deployment ran, and no SMS/Meta/provider transmission or
financial action occurred. Approval and execution markers are absent in all packets.

## Fresh production and preservation

Production remains `bef28c4029ccc9b6` / source
`e3ba3b72ead34fcc71f7c6fd8ce8cd57151b74c3` / physical116. The new snapshot passed
at **13:43:10 Riyadh**. Subsequent sealed read-only preflights passed:

| Packet | Verification time, Riyadh | Proposed physical schema |
| --- | --- | --- |
| SMS only | 13:59:11 | 116 → 118 |
| Meta only | 14:00:15 | 116 → 117 |
| D only | 14:01:46 | 116 → 117 |

Every preflight verifies 162 protected original projections, all 14 sessions/
attempts, 11 orders, zero funds/callbacks/proofs and four zero integrity counters.
Original attempt/interface evidence and financial uncertainty are preserved.
CARD/COD and fixed EGP10 remain active; Brevo/Email, PDC, MON, Auth, runtime,
credentials, Caddy, unit files and original emergency fences remain unchanged.
Natural MON retains eight existing warnings, three gaps and zero critical issues.
No manual worker invocation, provider inquiry or financial reconciliation ran.

Final preservation at **13:57:16 Riyadh** passes all 68 worktrees: 67 foreign
worktrees have exact opening HEAD/status/index/working diffs; all 24,004 original
untracked hashes and original interrupted artifacts match. Main's opening document
bytes are retained beneath additive continuity updates. All three candidate sources
remain clean. Daftra's `b782b13` owner pause, its failures/mobile issue, and Release
B's CONSUMED_COMPLETE boundary remain intact. No Git commit or push occurred.

Evidence: `logs/sms-meta-recovery-20261105/preservation-final-after-qualification.json`
and `operations/packets/ready-summary.json` beneath the same directory.

## Qualification completed

| Check | Result |
| --- | --- |
| Existing SMS focused evidence | Reused 57 passing checks; known PDC fixture failure retained |
| Existing SMS actual Dashboard fixtures | Reused 17 passing checks |
| Existing bounded Meta checks | Reused 43 passing checks |
| Existing D visual/cache/browser checks | Reused all 54 passing checks |
| Three typechecks/builds | Reused exact verified inputs and archives |
| Restored PostgreSQL17.11 | All three independent rollback and real atomic-commit rehearsals PASS |
| SMS compiled artifact | 17 route checks; all 5,266 `_nuxt` asset body hashes PASS |
| Meta compiled artifact | 17 route checks; all 5,264 `_nuxt` asset body hashes PASS |
| D compiled artifact | 13 route checks; all 5,267 `_nuxt` asset body hashes PASS |
| Meta worker | Four loopback/authentication/redirect/output tests PASS |
| New release guards | 58 JavaScript tests and five Python tests PASS |
| One-use lifecycle | Nine success/failure scenarios PASS; no mutation retry or automatic rollback |

All 116 installed migration files remain byte-identical in every candidate. Each
restored baseline reproduces the complete production schema before DDL, including
33 reviewed explicit owner ACL representations and exact search_path. All 162
original projections/all 14 attempts survive each independent transaction. SMS
allows exactly eleven new disabled seed templates and eleven automation revision
increments, with original templates and all other original values preserved.

Two copied verifier corrections were necessary: bigint revision strings now add
numerically; settings fingerprints use the exact original column projection when
D adds its cache column. The latter still checks every original settings value.
Full schema/RLS/ACL and all original-data comparisons remain in place.

The first smoke copies either used a root symlink or dereferenced package links;
the unchanged path/inventory guards rejected them. Canonical private copies now
retain every internal link and match the original inventories. The SMS checker
now follows the existing worker contract: disabled404 and private no-store. That
worker does not promise a Referrer-Policy header; the observed absence is recorded.
No handler or privacy control was changed to satisfy a test.

Initial concurrent sealed snapshots stopped at existing statement timeouts. These
read-only failures are preserved in each packet. Sequential checks passed under
the same limits. No approval, SQL transaction, stage upload or restart was consumed.

The historical PDC history fixture still fails identically on B and SMS with
`Cannot read properties of undefined (reading 'order_number')`, plus its parent.
Unrelated PDC code was not modified. Two ancillary historical footer fixtures also
retain their prior schema88/old-Classic expectations. No broad clean-suite claim
or hosted/customer/provider acceptance is implied by focused qualification.

## Exact packets

Packet root:
`/Users/imac/Documents/ELcomputer/ELcomputer/logs/sms-meta-recovery-20261105/operations/packets/`.

| Candidate | Original clean source | Application archive SHA256 |
| --- | --- | --- |
| SMS | `573e208940a12aadc32134bcef8536468f8d0332` | `ee5dd61e2b6fd8f603ad2560f898707d5b5f231a9ea3bf9f5b83ef6d67a77b0c` |
| Meta | `77013c4a8f4f4b02fa4278a7da5c3466741371ed` | `18bf9213760f4f8e42a2375eddcacb9bab8811475f431317e67f3a6a6e144f4a` |
| D | `0f4e66fa68c31afc0ca3a09e85d7a790cc1da28c` | `4626cbed2b777cb3cace050186b38b754d61447245036f9873dad9a71a28e424` |

Original worktrees remain under
`/Users/imac/Documents/ELcomputer/sms-meta-priority-20261105/`, respectively
`sms-source`, `meta-source`, `visual-source`. No original operator was replayed.
New reviewed operator: `operations/release-cli.mjs`; frozen inputs are in each plan.

| Packet | New one-use seal | Bound inputs |
| --- | --- | --- |
| `sms/plan.json` | `162c0f907bf5b3d39651063fd98244065240d6ee58fe08a9a7569666fa4269da` | 1,760 |
| `meta/plan.json` | `1cfc77e27780f635c7ca85c375cd2e05799d09c2d8f0c9ac514f88eafddcb2eb` | 1,773 |
| `visual/plan.json` | `9cbaf1ac4d22dd573b93940e54e64de80e30bd1385354c62f6fa488f13c0cd85` | 1,751 |

All start deadlines are **16:52:50.938 Riyadh, 5 November 2026**. Absolute expiry:
**17:07:50.938 Riyadh**. The existing encrypted backup/full runtime readback and
fresh restored rehearsal are reused within the original four-hour backup limit.
A late approval, changed live baseline or changed input requires a fresh packet.

Each scope allows only its exact archive and selected additive SQL in one atomic
transaction/history update, one archive upload, one bounded candidate readiness
process, one app cutover/restart, and one pause/resume of each existing MON/Email/
PDC timer within 180 seconds. It permits zero Caddy changes/signals, runtime/flag/
credential/unit changes, new workers, manual workers, provider calls, financial
actions, Git pushes or new emergency budgets. Postflight requires expected schema,
original-data preservation, all public asset hashes and natural MON evidence.
An uncertain commit/cutover stops without replay or automatic database restore.

SMS selects only `20261105130000_sms_transactional_channels.sql` and
`20261105131000_sms_marketing_channel.sql`; both channel controls, all bindings
and new templates stay OFF. Daftra is excluded. Meta selects only
`20261105132000_meta_commerce_tracking.sql`, empty/disabled settings and outbox;
no token or worker installation. B's physical115/116 are not overwritten.
D selects only `20261105030000_public_image_cache.sql`, with no C/preorder.

For D, “inactive” refers to SMS/Meta/provider controls. **Its reviewed visual fixes
and public-image cache take effect on installation; cache defaults ON at86400s.**
Dashboard can control that public cache. This is not an inactive cache feature
flag, and private media/payment routes remain excluded.

These are **alternative independent packets on B116**, not a combined sequential
approval. Installing any one invalidates both others' baseline bindings. Preserve
the installed feature, then adapt/requalify the next source and physical ledger;
never overwrite SMS with the current Meta-only B archive or apply an older slot.

## External prerequisites for later transmission

Inactive installation needs no merchant credentials. Real Vodafone sending still
requires merchant HTTPS host/port/TLS, AccountId/password/literal hash secret,
approved/default sender, trusted egress IP and activation confirmations, explicit
tax-inclusive tariff/segment terms and a charge cap. Marketing additionally needs
private unsubscribe signing configuration and proven recipient consent. The V5
PDF supplies no merchant delivery-status/inquiry/callback contract; none is invented.
SUBMITTED is not handset delivery. Both original PDFs remain recovered and exact.

The private selected recipient is unchanged. The existing one-message review draft
allows only one exact Notification batch/recipient, one POST and zero POST retries;
no campaign, automatic producer polling or scheduler. Missing sender/cost/body
approval and an exact-batch dispatcher qualification prevent a send approval seal.
No real SMS is authorized by any inactive installation packet.

Meta Dataset1680814460341996 still needs its Dataset-authorized CAPI token entered
privately in Dashboard → Marketing, Events Manager Test Events code, one approved
non-staff customer, and matching private server/worker authentication. Local worker
unit rendering and four loopback tests pass, but installation is excluded here.
The separate proposed Test Events scope is five minutes/three events, explicit
consent, settings-revision binding, staff/GPC/DNT exclusions, and no Purchase or
CODOrderPlaced. No general marketing activation or historical Purchase replay.

Hosted Dashboard/customer/device acceptance, provider delivery/cost and genuine
Meta Test Events/deduplication remain owner-controlled and unexercised. No password,
token, worker secret or private recipient belongs in chat or release documentation.

## Smallest next production approval

SMS first installs its isolated Dashboard/configuration foundation with sending OFF.
No provider/credential action is bundled. Review the complete scope above, then use:

```text
APPROVE SMS ONLY INACTIVE SCHEMA116 INSTALLATION 162c0f907bf5b3d39651063fd98244065240d6ee58fe08a9a7569666fa4269da
```

Meta and D remain separately unapproved alternatives. Their exact phrases are in
their private `ready.json` files; this SMS approval cannot authorize either one.

**ONE next action:** approve the SMS-only inactive packet within its valid window.

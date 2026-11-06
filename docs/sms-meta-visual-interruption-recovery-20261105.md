> **Qualification completed after login refresh.** The blocked status below is historical. See the [current sealed release review](sms-meta-visual-inactive-release-review-20261105.md).

# SMS, Meta and visual interruption recovery — 5 November 2026

**RECOVERY PASS. Existing local candidates recovered. Deployment qualification BLOCKED.**

This resumes the authentication interruption, not the older owner-paused Daftra
work. SMS-only work is resumed; Daftra remains paused at `b782b13`. No application
source, original candidate, prior operator, production configuration or provider
was changed. No Git push, SMS, Meta event or financial action occurred.

## Exact recovery and preservation

Recovery checkpoint: `logs/sms-meta-recovery-20261105/RECOVERY_CHECKPOINT.json`,
created at 10:26:28 UTC / 13:26:28 Riyadh. Its adjacent private inventory records
all **68 worktrees**, HEAD/branch/status, working and staged diff hashes, private
copies of nonempty patches, and **24,004 original untracked file hashes**.
The original interrupted operations and diagnostics were copied before correction.
The previous task's directory remains untouched.

All three new candidate worktrees were **clean**, with no staged or uncommitted
application changes. Main had six modified tracked documents and eight untracked
documents. Their opening bytes were copied privately. Twenty-seven other dirty
worktrees were recorded and preserved; attribution of those older changes to the
interrupted task is not inferred. No reset, cleanup, overwrite, cherry-pick, rebase,
commit, worktree deletion or process termination was performed.

| Candidate | Original worktree under `/Users/imac/Documents/ELcomputer/sms-meta-priority-20261105/` | Branch | Source |
| --- | --- | --- | --- |
| SMS | `sms-source` | `local/sms-priority-20261105` | `573e208940a12aadc32134bcef8536468f8d0332` |
| Meta | `meta-source` | `local/meta-priority-20261105` | `77013c4a8f4f4b02fa4278a7da5c3466741371ed` |
| Visual D | `visual-source` | `local/visual-d-priority-20261105` | `0f4e66fa68c31afc0ca3a09e85d7a790cc1da28c` |

At 10:34:31 UTC / 13:34:31 Riyadh, fresh offline verification matched every saved
build input: SMS 1,715, Meta 1,730, D 1,709. All **116 installed migration files**
match B in each source. All three complete archive readback inventories and archive
SHA256 values match. Existing typecheck/build results can therefore be reused;
no application rebuild or repeated implementation was needed.

| Candidate | Archive SHA256 | Verified archive entries |
| --- | --- | --- |
| SMS | `ee5dd61e2b6fd8f603ad2560f898707d5b5f231a9ea3bf9f5b83ef6d67a77b0c` | 6,327 |
| Meta | `18bf9213760f4f8e42a2375eddcacb9bab8811475f431317e67f3a6a6e144f4a` | 6,330 |
| D | `4626cbed2b777cb3cace050186b38b754d61447245036f9873dad9a71a28e424` | 6,325 |

Receipt: `logs/sms-meta-recovery-20261105/evidence-verification.json`.

## Production evidence boundary

Last recovered host snapshot: **10:05:03 UTC / 13:05:03 Riyadh**. Last recovered DB
snapshot: **10:05:28 UTC / 13:05:28 Riyadh**, not a new live check in this recovery.
They show `bef28c4029ccc9b6` / `e3ba3b7` / physical116, 162 protected projections,
14 sessions/attempts, 11 orders, zero funds/callbacks/proofs and four zero integrity
counters. Release B is CONSUMED_COMPLETE; its operator must never be replayed.
SMS remains OFF, Meta uninstalled/OFF, D uninstalled, C/preorder uninstalled and
Daftra paused. Owner/provider acceptance remains separate.

The new read-only snapshot could not connect inside the sandbox. Its required
escalation was **not executed** because automatic approval review could not refresh
the account token after the account switch. The error explicitly says this is an
authentication/review failure, not a determination that the action is unsafe.
The isolated PostgreSQL rehearsal also encountered sandbox shared-memory denial.
Its unsandboxed retry was not submitted after the review failure. Compiled HTTP
checks require local sockets and remain pending behind the same authentication
prerequisite. No alternate tool, account, network path or sandbox bypass was used.

## Tests and interrupted rehearsal

| Evidence recovered | Result | Limit |
| --- | --- | --- |
| SMS focused run | 57 passed, 1 top-level failure | Not an all-green suite |
| SMS Dashboard actual Vue fixtures | 17 passed, EN/AR, 1440/390 widths | Local fixtures; no hosted/provider acceptance |
| Meta bounded final run | 43 passed | Real Meta transmission excluded |
| D actual visual/cache/browser run | 54 passed | Reused unchanged source; no hosted acceptance |
| Three candidate typechecks/builds | PASS | Exact input/archive rehash now PASS |
| New SMS preservation guard regressions | 3 passed | Pure offline assertion tests |

The SMS/PDC history subtest and parent fail on both the candidate and deployed-B
baseline with `Cannot read properties of undefined (reading 'order_number')`.
Preserve this pre-existing fixture classification; no unrelated PDC correction ran.

The earlier ancillary D run had 13 passes and two failures: a historical schema88
operator fixture rejects later migrations, and an old Classic-footer snapshot
expects source predating current B. Those tests and `Footer.vue` are byte-identical
between B and D. Keep the failures; do not call the broad suite clean or rewrite
historical fixtures to manufacture a pass. D's relevant 54-case run passes.

The exact interrupted restored-production rehearsal stopped in its local guard:
PostgreSQL bigint revision strings were added with JavaScript `+`, producing
`'011'` rather than `'11'` and appending `'0'` to unchanged revisions. Only the
**copied** helper was corrected to use BigInt arithmetic and serialize a string.
Three new tests accept exactly eleven automation increments, preserve integers
above Number's safe range, and reject extra increments, unrelated revisions,
changed original templates, changed financial projections and changed seed bytes.
The real restored rehearsal has **not** passed yet. Its exact-baseline schema,
RLS/ACL, financial and seed-preservation checks remain intact.

The copied compiled checker now expects the SMS worker's actual disabled 404
contract. This changes a local expected result, not the handler or its permissions.
The original checker/logs remain preserved. Compiled qualification is still pending.

## Provider inputs and private configuration

The exact Vodafone V5 PDF exists at
`/Users/imac/Downloads/2026-01-26-API Interface document-1.pdf`, 19 pages, SHA256
`f8e6715833aa3d87a4b9caca3230c66e1e218eab41f7a54f624a2e61b647e4a9`.
The original Meta PDF is `/Users/imac/Desktop/meta.pdf`, two pages, SHA256
`d5764ab77416095bc485123e46a722f461ee7ea295e2458346f9f1be2a1d8b5d`.
Both match the recovered complete extracts. No missing PDF contract was invented.

Vodafone's two printed vectors match literal uppercase-key HMAC behavior and the
existing INC000081856720 clarification. The PDF's contradictory hex-decode sentence
does not justify changing that behavior. Notification and Campaign stay separate.
Provider SUBMITTED remains submission acceptance, not handset delivery.

Last recovered integration-presence observation was 09:23:34 UTC / 12:23:34 Riyadh.
Missing/unconfigured then: merchant HTTPS host and port, AccountId, service password,
Secure Hash Secret, approved/default sender, outbound trusted IP and provider
activation/IP/hash confirmations; SMS worker authentication and both runtime
channels. For commercial sending, tax-inclusive segment price, charge ceiling,
Unicode terms and accepted tariff reference remain missing. Delivery-status
endpoint/callback/authentication/reporting contract is not supplied by V5. Do not
guess it. Marketing additionally needs a protected unsubscribe signing key,
proven consent contacts and separate campaign approval. Existing encryption
infrastructure was present; do not replace or export its key.

The prior private recipient record is preserved and bound by hash in
`logs/sms-meta-recovery-20261105/one-message-test-review.private.json`. No recipient
value was printed, copied into public documentation or changed. The proposed
message is `SMS delivery test.`; owner text/cost acceptance remains absent.

Meta Dataset/Pixel **1680814460341996** is known deployment configuration. Still
required: the Dataset-authorized CAPI access token entered only through
Dashboard → Marketing → Conversions API token; the actual Events Manager Test
Events code; one approved non-staff test customer; and private worker-secret
binding. Never send these secrets in chat. The supplied PDF is browser Pixel
guidance, not a CAPI token or full CAPI contract. Online documentation refresh also
failed with the account's revoked-token error; no fresh provider-version claim.

The recovered Meta source already bounds customer, expiry, event cap, consent and
settings revision, excludes staff/GPC/DNT, and forbids Purchase/CODOrderPlaced in
Test Events. Proposed acceptance scope is five minutes and three events; no old
purchase replay or general marketing authorization is included.

Deployment-specific worker service/timer files are rendered locally in
`logs/sms-meta-recovery-20261105/worker-binding-review/`. They bind app user
`storefront`, loopback `http://127.0.0.1:3000`, a dedicated root-owned 0600 worker
environment file, and the same future private `NUXT_META_WORKER_SECRET` in server
runtime. No secret was generated, no runtime/unit was changed, and no timer was
installed or started. Host/path/Python verification and the four existing Python
loopback worker tests still require the protected qualification step.

## Installation readiness and smallest scopes

**SMS: local candidate recovered; NOT deployment-qualified.** Its two selected
migrations are `20261105130000_sms_transactional_channels.sql` and
`20261105131000_sms_marketing_channel.sql`, proposing physical116→118 only if
installed independently on unchanged B. It seeds eleven disabled templates and
allows only their exact automation-revision increments; financial data stays exact.
Daftra invoice functionality is not installed, and its optional binding stays off.

**Meta: local candidate recovered; NOT deployment-qualified.** Its selected file is
`20261105132000_meta_commerce_tracking.sql`, proposing physical116→117 independently.
The old historical schema115 label in its inherited documentation is obsolete.
B owns physical115/116; those files are unchanged. Balance SQL is parked outside
active migrations; no preorder/balance activation is bundled.

**D: locally qualified relevant 54 checks; NOT deployment-qualified.** Its selected
file is `20261105030000_public_image_cache.sql`, proposing physical116→117
independently. Hero/theme retention, complete mobile/tablet composition, licensed
WhatsApp/YouTube vectors, dark review styling and Dashboard public-image caching
are recovered without C/preorder. Private media and financial routes stay outside
the public cache. Hosted layout/cache acceptance remains open.

Three concrete inactive-installation **review drafts**, with source/archive/SQL
hashes and preservation limits, are in
`logs/sms-meta-recovery-20261105/inactive-installation-review-drafts.json`.
Each proposes only its own app and additive SQL, one app restart, bounded existing
timer pause/resume, and zero Caddy/runtime/credential/unit/provider/financial changes.
They have **no executable seal, expiry or approval command**: fresh live binding,
restored atomic commit/rollback proof, compiled HTTP/assets, new operator guards,
fresh recovery backup and final review are unfinished. No qualified production
approval packet can honestly be issued yet.

These are independent B-bound candidates, not a sequential combined release.
Installing one invalidates the other two baseline bindings. Rebind later releases
to the installed source/schema and preserve its features; never replace an SMS
installation with a Meta-only B archive, or reuse a physical schema label.

The one-message review draft permits one exact private recipient, Notification
only, one provider POST and zero POST retries, with campaigns/producers/scheduler
excluded. It is not send authorization. Exact sender/cost/body approval, provisioning
and a dispatcher qualified against only that manual batch are still prerequisites.
An ambiguous POST must retain uncertainty without automatic resend.

**ONE next action:** restore the Codex account's approval-review authentication,
then resume the pending read-only snapshot and isolated qualifications. Fresh
production installation, private credential entry and bounded provider tests each
retain their separate later authorization gates.

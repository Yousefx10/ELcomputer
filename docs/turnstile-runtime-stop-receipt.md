> **2026-10-26 update:** the separately approved7b correction subsequently
> completed PASS at03:48:38.214862 Riyadh. [Execution receipt](turnstile-runtime-deployment-receipt.md).
> Both a8 STOP and7b PASS approvals are consumed. The preparation/approval-pending
> section below is historical; never rerun either operator or old-baseline check.

# Turnstile configuration attempt stopped before mutation — 2026-10-26

**The approved configuration did not deploy. Production is unchanged.**
The original approval is consumed and must never be rerun.
A local correction and a replacement read-only preparation are recorded below.
Public signup, CAPTCHA enforcement, purchasing and PDC remain closed/paused.

## Exact approved attempt

- Approval: `APPROVE TURNSTILE FRONTEND CONFIG a8aec16a72d59972812a459c00b3e7b1029c6ebe8257e60e3ef642b03ce66c67`.
- Reviewed operator: `9d6508cdbf00fcd9159e5266ddf02f45c8aad0ce`.
- Private packet: `../turnstile-runtime-preparation-20261026/`.
- Invocation: once, `apply .. <approved seal>`; exit1.
- Initial mandatory target/schema/Auth/ownership checks passed.
- Exclusive execution intent: **2026-10-26 03:32:23.528 Riyadh**.
- Fresh encrypted database dump:12839012 bytes, authenticated and full readback.
- Runtime recovery failed before a valid tar archive was produced.
- No candidate, remote staging, runtime write or application restart occurred.

`execution/STOP.json` records an AssertionError from the backup wrapper.
The146-byte encrypted runtime file authenticates locally but contains only
its source's generic STOP JSON, with `error_type: KeyError`.
It is failed evidence, not a valid runtime recovery archive.
Zero-byte diagnostics did not establish the missing field by themselves.

The shared recovery helper's `baseline()` requires `plan.archive_bytes`.
Preparation supplied zero explicitly; the sealed apply plan omitted the field.
That mismatch was missed in qualification. The helper stopped before tar output.
No credentials, Cloudflare challenge or Supabase CAPTCHA setting caused this stop.
No production rollback was necessary or performed.

## Independent read-only result

`STOP-READONLY-VERIFICATION.json` passed at
**2026-10-26 03:36:32.931 Riyadh** using pinned SSH and a read-only DB transaction:

| Boundary | Verified result |
| --- | --- |
| Application | Same release5a38201292763325 and exact process/start identity;0 restarts. |
| Runtime | Original file hash/mode/ownership and running environment unchanged. Public provider/Site Key still empty. |
| Staging | This approval's frontend staging directory does not exist. |
| Other target files | Caddy, media, private files, installed output and retained assets unchanged. |
| Database/Auth/history | Schema94 and protected projections, Auth security, ownership/history match the sealed baseline. Only existing telemetry/Auth activity normalization is retained. |
| Public settings | Signup disabled; confirmation required. Purchasing/provider holds retained. |
| Actions |0 production mutations, Auth submissions, account/password/claim/email/provider changes or Git push. |

Private owner approval, intent, execution log, STOP, encrypted files and read-only
receipt are preserved. `APPROVAL-STATUS.json` is now
`CONSUMED_STOPPED_BEFORE_TARGET_MUTATION`. Never rerun apply or its old-baseline check.
The original sealed tools, plan and evidence inputs remain unchanged.
The configured-page browser smoke was not run because configuration never happened.

## Isolated correction

Source: `../turnstile-runtime-recovery-fix-20261026/source`, branch
`local/turnstile-runtime-recovery-fix-20261026`.
Local commit: `31ecdd2e4256b603b2455c37e3aefc00df031063`.

The adapter now passes `archive_bytes: 0` to the read-only shared backup helper.
The sealed activation plan remains unchanged. Scope validation still rejects
application deployment, enforcement, signup, purchasing or provider changes.
A regression invokes the actual shared Python capacity guard: the old shape
fails with `KeyError: archive_bytes`; the adapted shape passes. Expanded scope fails.

Fresh focused results: **23 JavaScript +7 Python PASS**, no failures/skips.
All759 deployed application inputs match3001cd6, including session isolation.
Schema source remains94. No app build, package installation or UI change.
Earlier qualified artifact/widget/session evidence is reused without new Auth tests.

## Replacement packet READY — approval pending

Private packet: `../turnstile-runtime-recovery-fix-20261026/plan.json`.
New seal: `7b9038186919a03ca16138845e90642dffdc53a49cd0eaa303654fdc9a413f15`.
Sealing and independent read-only target/schema/Auth/preservation checks PASS.
Fresh encrypted recovery/full readback:12839997 DB bytes/10 runtime files,
verified **2026-10-26 03:40:02.140 Riyadh**;
expires **2026-10-26 09:40:02.140 Riyadh**.
No new execution intent exists; replacement apply has not been called.

Exact replacement approval:

```text
APPROVE TURNSTILE FRONTEND CONFIG 7b9038186919a03ca16138845e90642dffdc53a49cd0eaa303654fdc9a413f15
```

This authorizes only the same two public runtime values/private candidate and
one app restart. It does not enable CAPTCHA enforcement, signup or purchasing.
The first approved operator stopped and is single-use; the changed operator and
new seal require a new exact approval. No replacement execution is inferred.

The original12 worktrees and their source bytes remain preserved.
This additive correction makes13 worktrees/10 local branches.
Main remains the91-migration continuity checkout at ea113e9.
No merge/rebase/reset/delete/push; detachedc3775e8 and both accounts' work retained.

Supabase Secret Key pairing/enforcement and hosted Auth acceptance remain pending.
The Secret Key stays owner-held and goes only into Supabase's CAPTCHA protection
settings during a later separately approved step after configured-page checks.
Public signup activation is still separate. No executable activation phrase issued.
PDC stays paused; BETA-07 official destination mappings remains the next purchasing
milestone after signup. Do not expand this recovery fix into paid/post-Beta work.

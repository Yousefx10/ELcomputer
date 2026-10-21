# Paymob credential-loading restart preparation — 2026-10-21

**Preparation PASS. Execution awaits separate owner approval. Nothing restarted.**

The owner reports all 24 configuration/safety checks PASS. Only
`SAVED_VALUES_LOADED` was BLOCKED. This establishes the restart need from the
owner's result; the agent has made no new production observation.

## Exact service and scope

Restart **`storefront.service`**, the existing Nuxt application. Its reviewed unit
loads `/etc/storefront/runtime.env` and starts Node22 from the current release.
Keep release `d2d7a8029b473e4a`, schema87 and the existing current symlink.
Do not restart/reload Caddy, Supabase or the VPS. No deployment, migration,
credential edit, provider call, payment, shipment or gate activation is involved.
Requests in progress can briefly fail during the application restart.
No Auth/session reset, inventory, media or data operation is performed.

The existing app unit uses `Restart=on-failure`. A temporary **runtime-only**
`Restart=no` drop-in suppresses systemd retries throughout the controlled attempt
and final health/gate checks. Only after those pass is the original policy restored.
This follows the [systemd restart policy](https://www.freedesktop.org/software/systemd/man/255/systemd.service.html#Restart=).

The runtime guard needs two `systemctl daemon-reload` calls: one when added and
one when removed after successful verification. These re-read unit definitions;
they do not restart Caddy or other services. The original service fragments,
existing drop-ins and runtime.env remain unchanged. Environment-file edits alone
would not require a daemon-reload; the temporary no-retry guard does.

## Prepared helper and staging boundary

The helper is **local only**, not installed on production:

`/Users/imac/Documents/ELcomputer/paymob-controlled-restart-20261021/run.py`

After explicit approval, stage only that inert helper using the existing pinned
SSH target/key/known-host binding. Require `/root/paymob-restart` to be absent;
stop if it exists. Create root0700 directory and root0600 regular `run.py` with
exclusive/no-follow creation. Independently read back full bytes, SHA256,
ownership and permissions before execution. Do not stage credentials, recovered
secret archives or runtime.env. Staging is diagnostic preparation, not a Nuxt
release deployment. No root-console script block or encoded payload is needed.

Prepared staging target for the forthcoming approval:
`/root/paymob-restart/run.py`.
Helper SHA256:
`e7349870a6e35d5c9dbdd477ceb8f7120232342958eab1b0434064bc3365d831`.

The approval scope must include this staging, the temporary app-only guard,
the two manager definition reloads, exactly one application restart and an app-only
containment stop if verification fails after that restart. No execution approval
has been given for this task. The CLI approval flag is not permission by itself.

## Short Hostinger root-console commands

**Do not run these until owner approval and verified helper staging.**
Run one line at a time. Stop immediately on any BLOCKED, unexpected output,
interruption, timeout or missing success line. Do not repeat a failed command.

First, recheck safety:

```sh
python3 -I -S -B /root/paymob-restart/run.py pre
```

Expected: `PRE_RESTART PASS`.
All 24 earlier checks must pass again; the six saved values must still differ
from the running process. If already loaded, stop: a loading restart is unnecessary.
This phase is read-only and creates no restart authorization or attempt marker.

Then, after explicit owner approval, run the single guarded attempt:

```sh
python3 -I -S -B /root/paymob-restart/run.py once --approved
```

Expected, in order:

```text
ONE_APP_RESTART PASS
SAVED_VALUES_LOADED PASS
DISABLED_GATES PASS
APP_HEALTH PASS
CADDY_UNCHANGED PASS
RELEASE_UNCHANGED PASS
RUNTIME_NO_RETRY_GUARD PASS
CONTROLLED_RESTART PASS
```

The command reruns fresh preflight, records a root-only consumed attempt, installs
and verifies the runtime guard, and invokes `systemctl restart storefront.service`
**once**. After one five-second settling interval, it verifies the loaded inputs,
all safety checks, health and stable target state. It never polls or retries.
The runtime no-retry guard remains in place for the final command.

Finally, verify again and finish the temporary guard:

```sh
python3 -I -S -B /root/paymob-restart/run.py post
```

Expected:

```text
ORIGINAL_RESTART_POLICY PASS
POST_RESTART PASS
```

This rechecks health, loaded values and all gates **before** removing the runtime
guard. It then restores and verifies the original unit loading/policy without
another restart. A root0600 `SUCCESS.json` receipt completes the attempt. Repeating
the restart or finalization is blocked; use `status` for subsequent status only.
The ordinary crash-recovery policy resumes only after guarded verification passes.

## Checks and confidentiality

The existing 24-check validator is reused, including root0600 runtime custody,
no duplicate variables, all six approved LIVE inputs, preserved unrelated settings,
systemd loading and saved/running outbound gates. Post checks additionally require
the running six inputs to match disk. The temporary drop-in is accepted only at
its exact path/hash while armed; arbitrary extra drop-ins still block.

Also require the exact machine/release/node invocation, unchanged runtime bytes,
stable Caddy PID/start/unit/config hashes, no automatic restarts, and one changed
app PID/start across the attempt. Existing Supabase payment/signup settings and
public EN/AR signup/checkout403 holds are checked through read-only metadata GETs.
Health uses public `/`200 and loopback `/api/admin-products/list`401. No Paymob/PDC
URL, callback, order command or provider diagnostic is requested.

All output is fixed PASS/BLOCKED labels. No environment contents, credential values,
lengths, encodings, HTTP bodies, raw logs or exception details are printed. Credentials
are compared in process memory only; no plaintext credential file/cache is created.
Local metadata receipts contain process/boot identifiers and one-way file hashes.

## Failure and safe recovery

- A failed preflight makes no service change. Stop and return the failed label.
- A failure after guard installation but before restart leaves the old app running
  and any runtime guard intact. Do not remove it or resume automatically.
- A failure after the restart triggers **one app-only containment stop**. It prints
  `APP_STOPPED PASS` or `APP_STOPPED BLOCKED`, then the failed phase as BLOCKED.
  No restart retry, rollback, old-release activation, database restoration or
  automatic configuration repair is attempted.
- A lost console or missing result is an uncertain attempt. Do not repeat it.
  If containment has not been confirmed, use this single short safety command:

  ```sh
  systemctl stop storefront.service
  ```

  Expected: no output; successful exit. This can make the storefront temporarily
  unavailable while Caddy and all stored data remain intact.

Read only sanitized service state:

```sh
python3 -I -S -B /root/paymob-restart/run.py status
```

Expected: `ActiveState`, `SubState`, `MainPID`, `NRestarts`, then `SAFE_STATUS PASS`.
After containment, expect inactive/dead, PID0; failed state is evidence to preserve.
Return those lines and the failed phase only. Never paste runtime.env, raw journal
output or secrets. Keep the guard/receipts for a narrow review. Any subsequent start,
restart or corrective file edit needs a separately reviewed owner instruction.

## Evidence and next stages

Forty-nine local synthetic safety cases passed: 27 inherited validator cases,
19 restart/containment cases and three exact runtime-guard verification cases.
No real Linux service execution or production connection occurred in preparation.
Private artifacts are directory0700/files0600, outside Git. Reviewed receipt:
`paymob-controlled-restart-20261021/PREPARATION-RECEIPT-final.json`.
Receipt SHA256:
`0a148bba87242601ea563822d8e2c03d353a6950dc4141b48f4ba15c1f6f74bf`.

Next action: owner approves this exact helper staging and controlled app restart.
Paymob loading is not payment acceptance. Charging, PDC booking/automation, customer
checkout and signup remain disabled. PDC GetProducts HTTP500 investigation remains
pending under a new bounded approval; the earlier one-run permission is consumed.
Mandatory WordPress customer identities/old-login compatibility, private profiles,
addresses and historical orders remain next on the migration roadmap. Preserve
Auth UUIDs, avoid duplicates and prevent imported orders creating financial or
commerce transactions before unrestricted signup and first public purchase.

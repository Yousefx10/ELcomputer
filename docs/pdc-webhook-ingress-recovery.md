# PDC ingress recovery PASS — 24 October 2026

**INBOUND_INGRESS_PASS. The signal approval is consumed; never rerun it.**

The separately approved recovery sent one SIGUSR1 at15:00:56.337 Riyadh. Caddy's
journal confirmed the reload. One unauthenticated HTTPS POST returned401.
The installed candidate is now loaded. The pending-reload condition is resolved.
Caddy PID26652 and Nuxt PID32102 remain active, without restarts.
Release58e3083f4aa6a1f8, runtime bytes and all outbound/purchasing gates are unchanged.
No authenticated callback, provider request, provider-registration change or
business-data write occurred. The Caddy admin API remains disabled.

Protected receipt: `../pdc-webhook-readiness-20261024/SIGNAL-EXECUTION-RECEIPT.json`.
The root intent, journal, denial-probe intent and completion were copied read-only
with all four hashes verified. Both approvals are consumed. Keep the original
failed attempt and protected baseline. No automatic retry or rollback occurred.

Provider cutover and authenticated verification remain separately blocked by the
mapping/timezone review and genuine assigned REF/AWB prerequisites. This ingress
approval did not authorize a PDC destination update or a new shipment.

The stopped attempt and replacement approval below are historical evidence.
Their commands must not be repeated.

# PDC ingress attempt stopped — signal recovery prepared

**Ingress activation is unconfirmed. No retry or recovery was executed.**

The owner approved ingress seal
`cd3b7ccf8f657e72acafe8d6016af52bf1c6ab0640e9d6d17b353c11217c1c05`.
The operator validated and installed the exact reviewed Caddyfile, then stopped:

```text
Failed to reload caddy.service: Job type reload is not applicable for unit caddy.service.
```

Preparation missed the service's reload capability. `caddy.service` has no
`ExecReload`; `CanReload=no`. The Caddy admin API is disabled. The old operator
and approval are consumed and must never be rerun.

## Verified current state

- The approved candidate is installed on disk at `/etc/caddy/Caddyfile`.
  SHA256: `a23719140d8d6e8e2e159287d6b7bb5cefcc044299e1f8b27522c94b1a93e256`.
- Caddy validation passed. The systemd reload request failed before reloading.
  No signal, restart or approved unauthenticated POST probe followed.
- Caddy remains active at PID26652. Nuxt remains active at PID32102 on
  `58e3083f4aa6a1f8`. Runtime bytes and all purchasing/provider gates are unchanged.
- The observed public GET still returns403. GET alone cannot establish the
  active POST policy; no successful ingress activation is claimed.
- No PDC call, authenticated callback, payment, order write, credential change,
  provider registration, automatic retry or rollback occurred.

The installed file is pending reload. A later Caddy start/reload can load it;
account for this pending change before unrelated Caddy maintenance.
The original full baseline remains protected at:
`/var/lib/pdc-webhook-ingress/cd3b7ccf8f657e72/Caddyfile.before`.
Its SHA256 is
`7f6d50ba620ca809bc19f8e336176d6cf75e32d8e501e2dbdd64b85d87af671b`.

## Prepared correction

The existing process uses:

```text
/usr/local/bin/caddy run --config /etc/caddy/Caddyfile --adapter caddyfile
```

Caddy documents [SIGUSR1 file-based reloads](https://caddyserver.com/docs/command-line#signals)
for this launch mode when resume/API-based configuration has not taken over.
The existing admin-disabled, file-based setup meets the inspected launch conditions.
No admin endpoint or service-unit change is proposed.

A local Caddy2.11.7 TLS fixture with `admin off` passed12 recovery checks:
one SIGUSR1 changed the exact PDC POST from403 to401, preserved the process PID,
accepted only the synthetic correct secret, and retained Paymob/internal/checkout
and sibling-route behavior. Three new operator-denial tests pass. The original
43 callback/database,36 TLS routing and3 ingress guard checks are reused.
The production read-only recovery preflight also passes, including journal access.
No production signal or callback was sent by these checks.

The replacement operator binds the consumed plan, existing installed candidate,
original validation/failure records, process command/PIDs, application artifact,
runtime bytes and closed gates. It does not rewrite the Caddyfile. It may send
one SIGUSR1, wait for Caddy's explicit success log, confirm unchanged process
health, then make the one still-unused unauthenticated POST expecting401.
Any uncertainty stops execution. No second signal, restart, automatic retry or rollback.

## Exact replacement approval

The first sealed attempt is consumed. This new approval authorizes a different
reload mechanism and the previously unused probe:

```text
APPROVE PDC WEBHOOK SIGNAL RELOAD fcd86364c92338c4fc85205664e3d97254b5bd44bde5d53d6e4ffb15073b8024
```

Reserved command — **not executed**:

```sh
python3 -I -B scripts/pdc-webhook-readiness/signal-operator.py apply /Users/imac/Documents/ELcomputer/pdc-webhook-readiness-20261024 --approved fcd86364c92338c4fc85205664e3d97254b5bd44bde5d53d6e4ffb15073b8024
```

The plan is `../pdc-webhook-readiness-20261024/signal-plan.json`.
Original attempt evidence and read-only inspection are retained in that directory.
Do not rerun the original `operator.py apply` command.

PDC destination changes and authenticated provider verification remain unauthorized.
The existing mapping/timezone and genuine assigned REF/AWB cutover prerequisites
remain in the [readiness report](pdc-webhook-readiness.md). Public-commerce work
continues independently; its safeguards and all previous incident history remain.

# Paymob/PDC release attempt — BLOCKED, 2026-10-21

**DEPLOY BLOCKED during preflight. Nothing was deployed. Do not retry.**
The later [read-only Auth diagnosis](live-sales-auth-preflight-resolution.md)
proves only `updated_at` changed and prepares a new seal. This receipt remains
the historical account of the stopped attempt; its command stays retired.

The owner approved release `d2d7a8029b473e4a`, preparation commit `c8457fe`,
and exact seal
`8cc87fe1dab33c4f7308cdf8f533322108386ee8d581b39222174387dfae5b5a`.
The owner said Dashboard editing would be paused. The clean checkout matched
that commit; the approved operator was invoked exactly once with only
`prepared-final/plan-reviewed.json`. No operator, artifact, plan or guard changed.

The attempt ran from 02:13:33 to 02:14:15 Riyadh,21 October2026
(23:13:33–23:14:15 UTC,20 October). It exited1 before creating execution intent.

## Exact failed gate

`preflight → inspectPrepared → protected database approvalState comparison`.

The `auth.users` fingerprint differs from the sealed database baseline. Both
observations contain exactly one Auth user; the table's columns are unchanged.
The changed column, actor and reason are **not established**. A recent login or
token operation must not be assumed as the cause. No Auth row was read into the
report, overwritten, reset or exempted from comparison.

The two explicitly permitted storefront analytics tables also changed.
They do not explain the failure: excluding only those two tables still leaves
the `auth.users` mismatch. All other131 table fingerprints match the baseline.
The operator made no database writes; the comparison used a read-only transaction.

This failed before the operator's execution-intent/phase-receipt block. Therefore
there is no operator `STOP.json`; the raw failure is in `approved-execution.log`,
with exit metadata in `approved-execution-exit.json`. The separate sanitized
`blocked-release-receipt.json` records the failed gate and preservation evidence.
It is not a deployment completion receipt.

## Current verified state

| Surface | Observed after the stop |
| --- | --- |
| Current Nuxt release | `82214df492a57126`, unchanged |
| Nuxt process | PID22422, active/running, zero restarts |
| Caddy process | PID23477, active/running, zero restarts |
| Caddy SHA256 | `504191ccdc985084cf9aa0bba4fc36b7cf2bcae7405af95abce469d56bd81558` |
| Database |85 exact identities and stored migration sources;86–87 unapplied |
| Products / existing media |561 products;2,613 files/410,096,992 bytes; hashes match |
| Existing identities / Storage | One Auth identity and four Storage objects; fingerprints match |
| Commerce | Zero orders, packing videos, payment attempts and normal/reverse shipping jobs |
| Controls | All five payment methods and PDC/auto-label/reverse off |
| Hosted Auth settings | Signup disabled; email confirmation required |
| Public boundary |14 read-only HTTP checks PASS; checkout/signup/callbacks held |

All approved application inputs, tools, protected-input hashes, migration bytes,
archive, inventory and preparation-evidence hashes match. Runtime, original output,
environment, units/drop-ins, decoder, public media and private packing match the
approved runtime. The original preparation backup envelopes still authenticate
and match their approved hashes. Those are earlier preparation backups; a fresh
execution backup was **not started**.

No execution intent, execution-backup directory or completed deployment receipt
exists. No remote staging, document directory, environment edit, unit edit,
candidate/sandbox run, migration SQL, service restart or Caddy operation was reached.
There was no retry, rollback, database restoration, credential entry, provider
request, business-data mutation, public activation or Git push.

## Evidence and next action

Private evidence remains in:
`/Users/imac/Documents/ELcomputer/paymob-pdc-release-preparation-20261021/prepared-final/`.

Retain the immutable plan/archive and `owner-approved-local-preflight.json`,
`approved-execution.log`, `approved-execution-exit.json`,
`blocked-local-gates.json`, `blocked-runtime.json`, `blocked-database.json`,
`blocked-readonly-boundary.json` and `blocked-release-receipt.json`.
The last receipt binds the diagnostic files by SHA256. No secret or customer
value belongs in Git or a browser screenshot.

No new-release browser acceptance is due because no application switch occurred.
The owner may resume Dashboard editing on the unchanged release. The previously
accepted six account pages remain closed as a completed milestone.

**One next owner action:** authorize a focused review of the Auth-row change and
preparation of a new reviewed binding. Any later execution needs separate exact
approval; do not rerun this attempt, replace the sealed baseline silently, ignore
Auth drift or relax the safeguard. No fresh plan or broader investigation was
started after this failure.

The next business milestone remains private configuration of existing Paymob/PDC
accounts, followed by controlled payment/shipment acceptance after a successful
disabled deployment and owner browser smoke. The existing Quick Setup/editors and
protected Paymob runtime remain the configuration path; no credentials were entered.
Physical saleable stock, actual delivery coverage/charges and parcel settings,
confirmed customer access and callback reachability must precede a purchase.

The [WordPress customer migration](wordpress-customer-migration.md) remains required:
login compatibility, UUID-preserving identities, names/phones, billing/shipping
addresses and historical orders. No import ran; prevent duplicate Auth identities
and historical stock/payment/shipping/notification side effects.

# Auth preflight resolution — 2026-10-21

**Resolution task: corrected release readiness PASS; no deployment by that task.**

The owner subsequently approved the new seal below. Its single execution returned
[DEPLOY PASS](live-sales-release-receipt.md), with schema87 and providers disabled.
The approval is consumed. The command below is retained history; do not rerun it.

This is a local release-tool correction and read-only resealing task.
No deployment, production Auth/data write, timestamp edit, password reset,
provider call, migration, service operation, public activation or push ran.
The blocked attempt and its original plan/artifact/receipts remain preserved.

## Proven cause and limits

The blocked release compared the complete `auth.users` row against an earlier
fingerprint. **Only `updated_at` advanced. All other34 fields are identical.**
There is still one user with the same identity. In particular, password/security
fields, roles, application/user metadata, email/phone/confirmation state, recovery/
change tokens, account flags and `last_sign_in_at` did not change.

The approved encrypted dump authenticated before its selected Auth data was
decoded in memory. A typed, read-only PostgreSQL JSON projection reproduced the
approved fingerprint exactly. The current record reproduced the blocked attempt's
fingerprint exactly. Comparing those canonical records identifies the field above;
it does not rely on counts or an assumption that the owner recently signed in.
Timestamp serialization differences in the in-memory parser were normalized
before drawing that conclusion. No plaintext dump or Auth record was saved.

The audit log supplied no matching action for the changed timestamp. The specific
actor/operation remains **not established**. The proven classification is
timestamp-only metadata drift, with no observed identity/security-state change.
Do not label it a confirmed sign-in or token refresh.

## Narrow correction

`scripts/live-sales-release/auth.mjs` separates only `updated_at` and
`last_sign_in_at` from the approval's identity/security fingerprint. The
[upstream Auth model](https://github.com/supabase/auth/blob/master/internal/models/user.go)
defines these timestamps separately from identity, role, password, token and
confirmation state. This source describes field semantics; it does not identify
the actor responsible for this incident.

All33 remaining current columns, including the UUID, are hashed together. New
columns are included by default; column addition/removal/type/generation drift,
row membership and counts remain bound. Activity fields must retain their
timestamp types. Missing or altered policy evidence fails closed.
No whole-row Auth exemption, owner special case, new identity or permission bypass
was added. `auth.identities`, application roles/permissions/profiles, every other
protected table and all existing RBAC/RLS contracts remain exact.

The full Auth fingerprint remains in snapshots for evidence. Approval checks,
pre-commit comparison and post-release verification use the separately sealed
security projection. Inside SQL, identity/security state is checked before and
after locking, during original-row preservation and again before commit. Changes
to activity metadata are recorded as a boolean; their values are never printed.
Managed Auth/Storage remain read-only and receive no new locking/write grants.
All other original-row comparisons and release exclusion locks remain intact.

The separate `rebind OLD_PLAN AUTH_EVIDENCE NEW_DIRECTORY` mode verifies original
tool provenance from its reviewed Git commit, the authenticated diagnostic proof,
unchanged application/migration/artifact/protected inputs, current target/runtime
and every other protected business fingerprint. It copies the exact old artifact,
independently extracts/checks its inventory and331 retained immutable assets,
creates fresh encrypted database/runtime backups and rechecks production before
sealing. It never stages or activates anything on the VPS.

This mode is preparation only. The old approval and failed command cannot be
reused. A new single deployment still needs approval of its new seal and a fresh
execution backup, private Linux candidate/sandbox gate before SQL, ordered86→87
transaction, one controlled Nuxt restart and post-release verification.

## Validation

52 focused checks pass, zero failures/skips. This includes39 Auth-policy checks
and the existing13 operator/native checks. Fixtures cover both activity fields,
password hashes, roles/audience, UUIDs, contact/confirmation state, every token
family represented, metadata, account flags, new fields, membership/schema drift,
Auth relationships and unrelated business changes. All protected changes still
block even when activity timestamps also advance.

The native non-superuser85→87, late rollback, exact migration sources/history,
conservative controls, ACLs and repeat refusal checks remain effective. No existing
migration, application input, dependency, Caddy rule or release artifact changed.
The application source remains21f54e4; its earlier271-test/typecheck/build evidence
is retained, not counted as newly run. Hosted Linux candidate/sandbox and real
merchant payment/shipping acceptance remain unexercised by this task.

Private diagnosis and resealing evidence:
`/Users/imac/Documents/ELcomputer/paymob-pdc-auth-drift-resolution-20261021/`.
The Auth evidence reports field names, booleans, schema and combined hashes only;
it contains no password, token, email, phone, UUID or raw metadata value.

## Newly reviewed release

| Binding | Value |
| --- | --- |
| Application release / source | `d2d7a8029b473e4a` / `21f54e4` |
| Unchanged archive SHA256 | `d2d7a8029b473e4ae82d562abc0c8534e14e9f12a44c4daaff9f4a57f4ffd382` |
| Archive bytes / output entries / retained assets |6,630,641 /1,367 /331 |
| New approval seal | `e81236a4ab2faf0961be6f852a58424de4e8f2e3a3334006dd32266155531c5e` |
| Exact new plan | `paymob-pdc-auth-drift-resolution-20261021/prepared/plan-reviewed.json` |
| Final read-only check | `READY_FOR_OWNER_APPROVAL`; production writes0 |

The final plan binds the corrected tools,33-column Auth security projection,
diagnostic proof, test evidence, fresh backups and unchanged application/runtime.
Use only this reviewed plan. `prepared/plan.json` is an earlier local preparation
seal; the original8cc87fe1 approval and blocked attempt remain historical.

Fresh encrypted database backup:8,738,319 bytes; SHA256
`5b453aace8bb51389d5822eac07b4433776448891e25865990bd59cbc6be8cf1`.
Authenticated decryption, `pg_restore --list` and full SQL-to-`/dev/null` readback
pass. Eight encrypted runtime/recovery files pass independent full-byte readback.
The future apply must take another fresh backup before its first production change.

Read-only checks preserve current Nuxt82214df492a57126/PID22422/schema85,
Caddy PID23477/SHA504191ccdc985084, original env/units/drop-ins/decoder/output,
561 products, one Auth identity, four Storage objects and2,613 public media files/
410,096,992 bytes. All134 table schemas and protected security/business projections
match; only the established activity exceptions apply. Orders, payment attempts,
packing videos and normal/reverse shipping jobs remain empty. All five payment
methods, providers, automation/reverse and signup remain off; confirmation required.
Fourteen public boundary GET checks pass. Callback403 remains an intentional hold,
not a successful callback-reachability test.

There is no new execution intent, remote stage, document path, migration86/87,
application activation or restart. Linux candidate/sandbox remain NOT_EXERCISED;
they must pass before SQL during a separately approved execution. No application
build was repeated: exact archive/input/inventory equality and fresh independent
extraction/retained-asset checks verify the preserved application artifact.

At resolution completion, the next action was separate owner approval with
Dashboard edits paused. That approval and single deployment are now complete.
Historical approved command — **do not rerun**:

```sh
/Users/imac/Documents/ELcomputer/procurement-postgrest-correction-20261018/tools/node-v22.23.1-darwin-x64/bin/node \
  /Users/imac/Documents/ELcomputer/ELcomputer/scripts/live-sales-release/operator.mjs apply \
  /Users/imac/Documents/ELcomputer/paymob-pdc-auth-drift-resolution-20261021/prepared/plan-reviewed.json \
  --approved e81236a4ab2faf0961be6f852a58424de4e8f2e3a3334006dd32266155531c5e
```

No checkout/signup/provider activation, credentials, live order/charge/booking,
Caddy change, WordPress import, automatic retry or automatic recovery is included.

After deployment, the roadmap remains private Paymob/PDC configuration,
[WordPress customer/account/address/order migration](wordpress-customer-migration.md),
controlled purchase acceptance and owner-approved public checkout. Preserve Auth
UUIDs and prevent historical imports from creating commerce side effects.

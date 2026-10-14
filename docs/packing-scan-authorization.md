# Packing scan authorization — BETA Gate 2 H1

H1 correction starts from `a811b05fe5daa0739b913f1bd4847f6adc26da21`.
Feature development remains frozen. H2, H3 and production are outside this task.

## Original failure

On the certified release-79 fresh installation, owner login, Draft creation,
physical Procurement, publication and customer COD checkout succeed. The normal
packing API inserts a scan as `service_role`. Its existing BEFORE INSERT trigger,
`public.validate_order_packing_scan()`, executes as the invoker and locks the
assigned `commerce_serialized_units` row using `FOR SHARE`.

The certified role has SELECT and no UPDATE on that table or any column.
PostgreSQL requires UPDATE on at least one column for this row-locking SELECT,
even though the query changes no inventory. Consequently assigned unit-code and
QR scans return HTTP 500 with a permission denial. BYPASSRLS does not confer table
privileges. [PostgreSQL privileges](https://www.postgresql.org/docs/17/ddl-priv.html)
documents this requirement.

## Additive correction

Migration **80**, `20261014220000_packing_scan_authorization.sql`, replaces only
the existing validation function and revokes its direct EXECUTE privileges.
It adds no tables, RPC, inventory grant, RLS policy or business data. The existing
trigger attachment, scan uniqueness constraints and immutable history remain.
Migrations 1–79 and every existing installer/certificate artifact stay unchanged.

The function uses SECURITY DEFINER with its existing migration-owner identity,
and a fixed `pg_catalog, public, pg_temp` search path. Every application relation
is explicitly schema-qualified. No dynamic SQL, caller-selected relation or
inventory mutation is accepted. Invocation must be BEFORE INSERT, row-level,
on the exact `public.order_packing_scans` relation.

Direct EXECUTE is revoked from PUBLIC, anon, authenticated **and service_role**.
There are no new EXECUTE grants. PostgreSQL invokes the existing trigger for an
already-authorized table insert; clients cannot invoke a generic privileged
inventory function. Browser-role scan-table and inventory permissions remain
unchanged. The server still validates the Auth token, active administrator and
named `dashboard.orders` permission before constructing the insert. Its actor
comes from Auth rather than the request body.

Inside the transaction, validation rechecks the active scanning administrator,
owner status or both `dashboard.view` and `dashboard.orders`, claimed session,
active operator work session and eligible unfinished order. Codes are bounded
and nonempty. Order items and locked units must belong to that exact order and
line; serialized stock must still be sold. Exact unit ID, QR, unit code or serial
must match. Serialized lines cannot fall back to a product SKU. Existing quantity
and per-session unit uniqueness rules reject excess and duplicate scans.

## Serialization and recovery

The actor row is share-locked until commit, preventing authorization revocation
from racing past the transaction. The existing session UPDATE lock serializes
scans against other scans, release, close and completion. The eligible order and
exact assigned unit are share-locked. Unit locks preserve allocation/return
serialization without granting UPDATE to the service role.

The work session is read after locking its packing session. It is not locked a
second time: work-session close already locks the work parent and then packing
sessions, so reversing that lock order would introduce a deadlock.

A committed serialized scan retry returns a duplicate conflict. Reading the
authorized session recovers progress after a lost acknowledgement. This keeps
the existing API contract; it does not introduce a new idempotency subsystem.
Scans do not change physical inventory, allocations, costs or financial entries.
Private video verification and supported packing completion remain mandatory.

## Validation and release boundary

`tests/order-packing-scan-native.test.mjs` uses actual disposable PostgreSQL,
actual non-superuser SQL and independent service-role connections. Its Auth and
Storage schemas are explicitly fixtures. It covers the original locking denial,
unchanged ACL/RLS, trigger-only invocation, exact allocation/code checks, revoked
authorization, concurrent duplicate/distinct scans, retry recovery, commit-held
locks and a real return racing a scan.

Full service/browser and reset evidence is recorded separately in
`/Users/imac/Documents/ELcomputer/beta-gate2-h1-20261014/REPORT.md`.
That report distinguishes actual PostgreSQL/Auth/PostgREST/Storage/compiled Nuxt
from local ingress, Realtime and generated camera fixtures.

Historical installer tests explicitly select their certified 71/79 migration
range. This preserves historical regression coverage and does **not** certify
migration 80. Runtime installer validation still rejects uncertified source or
migration drift. The corrected commit requires separately authorized release and
installation recertification before any hosted deployment. No recertification,
production SQL, production access or deployment is authorized by H1.

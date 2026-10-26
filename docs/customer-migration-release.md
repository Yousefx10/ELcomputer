## 2026-10-26 completed code deployment — 2026-10-26 02:02:04.416 Riyadh

[Exact deployment](public-signup-deployment-receipt.md) PASS:5a38201292763325 /
schema94, source3001cd6, approvale9d1d4bb consumed once. Runtime/Caddy/Auth/signup/
CAPTCHA/purchasing gates unchanged. No merge/reset/cleanup/worktree deletion/push;
all original source bytes and refs remain. Current source lineage still contains
94 migrations; main remains the91-migration continuity checkout. Earlier READY/
approval-pending notes below are historical; never rerun the consumed operator.

## 2026-10-26 next milestone — signup preparation

Historical import/three-route deployment remains complete and consumed. The
[notice/Turnstile replacement release](public-signup-release.md) is locally
qualified, with a separate exact application-only approval. Public signup remains
closed pending real widget/key/configuration and hosted normal Auth acceptance.
Existing owner-controlled historical match has no orders; profile/empty-view
acceptance remains owner pending. Actual order-bearing customers require their
authorization; no account creation, claim, email or impersonation was performed.
Owner verified abuse settings; accepted Brevo/recovery/confirmation stand and
Management API403 investigation is closed. No production activation or Git push.

# Customer migration and public Beta — first local milestone

**Production history import PASS — 2026-10-25,23:07:33.882 Riyadh.**
[Current receipt](customer-history-import-receipt.md): exact3c9f5764 approval consumed,
41 batches/516 customers/591 orders/6 refunds/1789 items/702 events.513 conditionally
eligible,3 held; actual claims0. Three scoped history routes loaded/one Caddy signal,
no app restart/schema deployment. Original140 projections and three current users/
profiles preserved; signup/purchasing/provider initiation closed. Hosted ordinary
ownership acceptance remains pending. Next: small EN/AR notice release before signup.
Earlier READY/pending/source-only statuses below are retained historical evidence.

**Final import milestone — 2026-10-25:** [source-bound packet](customer-history-final-import.md)
is READY for separate exact owner approval3c9f5764.516 customers/591 orders/6 refunds/
1789 items/702 events;513 conditionally eligible identities (1 current verified,
512 later signup),3 held.131 unlinked orders stay private. Fresh native94 recovery/
final41 batches,140 original projections and seven operator checks PASS. The same
approval covers three required history API routes/one Caddy signal. No production
import/routing change/Auth creation has run. Earlier preview references below are
retained history; final payloada34838d6 supersedes the zero-claim import candidate.
Source/deployment decisions are complete; do not repeat them.

## Retained earlier implementation and deployment evidence

Updated 2026-10-25. **INACTIVE RELEASE DEPLOYED; HISTORY IMPORT NOT RUN.**
Releasebc05eef266eeb7de/schema94 completed21:31:49.255 Riyadh, consumed seal4c332350.
All140 original transaction projections/Auth passed; three current customers,
orders/catalog/callbacks preserved. Fresh execution recovery/candidate/public smoke
passed. Signup/purchasing/providers stay closed. See the [deployment result](inactive-history-release.md#production-result-and-consumed-approval).
The temporary catalog pause can end. Historical eligibility/final payload/import
approval and ordinary owned-history acceptance remain separate.

**Current milestone:** recovery and controlled confirmation are ACCEPTED.
[Next guarded source approval and release sequence](customer-migration-approval.md)
bind the existing source and refreshed post-confirmation dry-run. The target now
has three confirmed permanent identities; all are preserved. Counts and payload
are unchanged, including702 fulfillment observations. Production is now schema94;
all private history tables remain empty.
The source/cutoff/exception seal is now owner-APPROVED. Its separate private
receipt preserves the original packet. The combined inactive91→94 release is now
qualified and sealed: [exact deployment packet](inactive-history-release.md),
releasebc05eef266eeb7de. Its archive/operator, fresh encrypted recovery and native
restored-data upgrade/rollback checks passed. The old deployment approval is
recorded but held by later catalog drift. The pause is now confirmed; the unchanged
archive deployed under consumed seal4c332350 with fresh recovery PASS. The prepared
41-batch import check passed read-only against schema94; claims remain0 and no
historical import is authorized. Do not rerun the deployment.

Priority is now: inactive deployment → historical import/ordinary ownership →
public signup/login → PDC/paid-checkout acceptance → public purchasing. The existing
79 roadmap IDs remain. [Current access requirements and pending-work inventory](customer-access-release-plan.md)
specify original-email signup/recovery and the EN/AR notice. The ordinary My Orders
claim experience is already in the sealed application; the notice is the next
small release before public signup and does not reopen inactive qualification.
Management API403 is an inspection limit, not an SMTP defect or a reason to defer
the approved recovery test. Do not repeat the configuration questionnaire.

## Implemented source

Local branch: `local/customer-history-launch-20261025`.
Qualified implementation: `1924ca06b2bf97426aba108f6da36cb7b7bd1287`.
Isolated worktree: `../customer-migration-launch-20261025/source`.
Base6440669 contains the deployed session/PDC work. Commit `2cd5418` preserves
the original40-file qualified Beta candidate byte-for-byte. The new migration
extends that copy; the original dirty Beta worktree and main application remain
untouched. Use the feature branch for source review; main contains this index.

Implemented files on that branch:

- `scripts/customer-migration/wordpress_dump.py`: exact-prefix data-only dump
  reader, source fingerprint verification, authenticated encrypted inputs/outputs,
  selected metadata and password-type inventory. No SQL/PHP/archive code execution.
- `scripts/customer-migration/plan.mjs` and `prepare.mjs`: bounded offline dry-run,
  identity candidates, immutable order/item snapshots and private exceptions.
- `supabase/migrations/20261025120000_customer_history.sql`: isolated private
  history tables, service-only atomic/idempotent batches, approved claims and
  customer-owned reads. It does not create Auth users or update current profiles.
- `scripts/customer-migration/batches.mjs` and `apply.mjs`: deterministic bounded
  commands, exact source/target/payload approval, fresh reviewed recovery evidence,
  persisted receipts and explicit resumption. No automatic retry or rollback.
- `server/api/account/history/`: authenticated, confirmed-email list/detail and
  explicit claim actions. Server ownership/RBAC/RLS contracts remain in place.
- `app/components/account/HistoricalOrders.vue`: compact EN/AR previous-order,
  archived-profile/address and fulfillment-history views under My Orders. Existing
  account/checkout session isolation remains; no new current-order/payment action.

History94 follows the Beta92–93 files. The combined
local source contains94 migrations, now installed in production without history data.
The application source is unchanged. Its [separate inactive deployment packet](inactive-history-release.md)
now seals the exact archive, retained assets, compatible SQL/app operator and fresh
recovery bindings. Old schema91-only operators cannot apply it. The release remains
deployed inactive, with no history import or public activation approval.

## Actual offline source and dry-run

Two authenticated preserved exports were inspected. The primary source is
`elcomputer-wordpress-current.sql.enc`; the comparison is
`elcomputerold-wordpress-current.sql.enc`. Both archives remain read-only.
The primary uses classic WordPress order tables; saved HPOS enablement is `no`.
Its mirrored HPOS rows were inventoried, not added as duplicate orders.

| Primary source / planned history | Count |
| --- | ---: |
| WordPress users |518 |
| Ordinary customer-role records eligible for review |516 |
| Administrator records excluded from customer activation |2 |
| Historical orders |591 |
| Separate historical refund records |6 |
| Order-related items, including shipping/fees/tax/coupons |1,789 |
| Retained dated/raw shipment-history observations |702 |
| Historical records referencing eligible legacy customers |466 |
| Guest historical records kept unlinked |110 |
| Records referencing excluded/missing customer IDs, kept unlinked |21 |
| Existing verified Nuxt identity candidate to preserve |1 |
| Remaining customers needing ordinary verified account activation |515 |
| Claim approvals in the dry-run |0 |
| Current Nuxt profile/credential updates |0 |

These are staged associations to legacy IDs, not accepted links to Auth users.
Every historical record remains inaccessible to a customer until the reviewed
claim policy and that customer's verified identity allow access.

The comparison also has518 users, but only516 IDs overlap. There are two IDs
unique to each source and one changed email among shared IDs. It has589 orders
and six refunds. Do not union the snapshots or assume matching counts mean
matching identities. The primary source/cutoff still needs explicit import approval.

Private evidence is outside Git under `../customer-migration-launch-20261025/`:
authenticated selected sources, `target-identities.json.enc`,
`customer-dry-run-v2.json.enc`, its private manifest/receipt, and
`local-sql-rehearsal-final.json`. The private dry-run includes identity candidates and
record-level exceptions. No customer names, emails, addresses or password hashes
are included in this report.

Exceptions retained:

- Two privileged legacy identities are excluded. No staff roles are imported.
- 21 historical records retain their original source customer ID privately but
  have no authorized customer association. Guest/contact emails never resolve them.
- One order has two historical `_completed_date` values. Both are retained in
  `date_variants`; no guessed completion timestamp or dropped order.
- Snapshot ID/email differences require review against the selected primary.
  Existing verified Nuxt UUIDs, credentials, profiles and edits take precedence.

## Authentication and ownership transition

All518 inspected password hashes use WordPress's `$wp$2y$` family with its
WordPress-specific pre-hash. They are not ordinary portable bcrypt hashes.
Removing the prefix would not preserve the password verification procedure.
No passwords/hashes are imported, reimplemented or copied into Supabase.
See [WordPress's format explanation](https://make.wordpress.org/core/2025/02/17/wordpress-6-8-will-use-bcrypt-for-password-hashing/)
and [Supabase's supported migration guidance](https://supabase.com/kb/guides/migrate-from-auth0).

- An existing Supabase customer keeps the same UUID and working credentials.
  Normal password recovery handles their own requested reset.
- A legacy customer without an Auth account activates through ordinary signup
  with a new private password and email confirmation once signup is approved.
  No administrator-assisted registration, bulk invitations or auto-confirmation.
- Owner review explicitly approves which unique registered legacy identities may
  be claimed by a currently verified matching email. Default is no claim approval.
  Duplicate, staff, changed/conflicting and unverified cases stay under review.
- The signed-in customer explicitly connects previous orders. The server requires
  confirmation, active profile, unique current identity, an approved source/email
  and the original registered customer association. Guest orders never match by
  billing/contact email. A changed account email does not silently transfer history.
- Original billing/delivery addresses and profile facts remain available as
  historical records. They do not overwrite current Nuxt fields. Customers use
  the existing Profile editor for deliberate current-address changes.

Import itself creates no Auth users or notifications. Verification remains an
ordinary Auth flow; a legacy email string alone is not verified ownership.

## Qualified checks

- 17 focused Node tests pass, zero failures/skips, including actual H3 routes,
  PostgreSQL SQL, independent native PostgreSQL connections on the full94-file
  application schema, command recovery and stale-customer UI response tests.
- Three Python reader tests pass: exact table prefix, credential/hash removal,
  escaped values and refusal to execute SQL/PHP objects.
- Nuxt typecheck and production build pass in the isolated source with empty
  dotenv. Existing dependency tooling is reused; no production environment copied.
- A private disposable in-memory SQL rehearsal accepts41 bounded batches:
 516 archived customers,597 order/refund records and1,789 item records. Snapshots
  reconcile with the prepared input. It creates zero Auth users/current profiles.
- Three compiled new API routes reject anonymous access401 with private/no-store.
  These are empty-config loopback checks, not hosted customer acceptance.
- Source snapshots, original Beta inputs and91 historical migration files remain
  preserved. No production schema/data/provider change occurred.

These checks are local. New controls have not received hosted browser/customer
acceptance. No sealed deployment, production import, public signup or paid public
activation is claimed. Full regression was not repeated; qualified original Beta
checks retain their own evidence boundaries and known baseline failures.

## Import and rollback gates

1. Approve the exact primary snapshot, cutoff, eligible claim policy and exceptions.
   Freeze the encrypted private payload, target binding and source revision.
2. Prepare a fresh matching inactive application/92–94 release, retained assets
   and verified recovery artifacts. Obtain deployment approval; keep all gates off.
3. Obtain separate customer-history import approval for that payload/target.
   The operator checks the deployed history migration and exact approval before
   applying bounded new-history transactions. Each batch has a durable receipt.
4. Reconcile counts, money/snapshots and customer isolation on the intended target.
   No live checkout, cash, stock, shipping or notification transaction is involved.
5. If interrupted, preserve the original intent/receipts. Resume the same frozen
   commands after review; never start another source or regenerate batch IDs.
6. If accepted rollback is necessary, separately authorize hiding the exact
   source with `customer_history_hide_source(source_id,snapshot_sha256)`.
   This stops future history reads without restoring backups over newer Nuxt data.
   Retain private history/receipts; no automatic deletion, Auth reset or data rollback.

The import operator's check/apply/resume modes do not deploy SQL or application.
No apply/resume mode was executed against production in this milestone.

## Email acceptance and shortest launch path

Test B recovery is owner-accepted: production email/redirect, password update
and new-password login passed. Controlled confirmation is also ACCEPTED: owner
receipt/PKCE redemption/access plus read-only confirmation and ordinary-profile
verification. No repeat sends or configuration investigation are needed.
Auth-only click-tracking suppression is recorded for follow-up; no SMTP/provider
change ran. See [email acceptance](auth-email-acceptance.md).

Then proceed through the approved history migration and identity safeguards,
normal public signup/verification/login/recovery, final owned-order acceptance,
manual merchant refund/reconciliation readiness, reviewed PDC destinations and
configurable EGP50, and CARD-only purchasing last. Keep legitimate backorders and
the existing92–93 safeguards. Administrator confirms/packs before PDC booking;
checkout never automatically creates a shipment. Preserve signed Paymob receipts.

Migration/import, signup and purchasing retain separate exact approvals.
No silent draft publication or unverified fulfillment method is part of launch.

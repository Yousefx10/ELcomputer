> E194: P0 recovery is owner accepted. The existing implementation is requalified
> on actual109in a separate [fresh activation packet](payment-first-schema109-activation.md).
> This original108draft stays retained/unexecuted and must not be applied.

> E192: the exact SQL-only109approval was applied once and is CONSUMED_COMPLETE.
> Data API reads and scheduled workers recovered;8warnings/3gaps remain intact.
> [Actual execution receipt](p0-data-api-schema109-receipt-20261102.md).
> Do not replay any consumed operator or activate the old core108draft.

> E191 update: Supabase logs received; no further log request is pending. The
> cause is the existing product revision40001/PostgREST14.18retry loop. A separate
> [SQL-only schema109correction](p0-data-api-conflict-20261102.md) is qualified and
> unapproved. No core activation was sealed or executed. Rebind this preserved
> draft after database recovery; do not apply its old108assumptions to109.

# Core108 activation preparation and Apple Pay update — E190,2November2026

**PAYMENT-FIRST ACTIVATION BLOCKED. No fresh activation approval or expiry issued.**
Owner's signed-in private Payment activity check is accepted. It loaded correctly
with no activity. The earlier three-file private-ingress/MON payload remains
installed on81f6206b393714ae/schema108/source7b33ed0. Its original operator STOP
is preserved; independent read-only installation verification remains dated E189.
It is never replayed and no remote completion marker was invented.

## Actual remaining operational blocker

A later project Data API problem prevents hosted qualification. Since the last
complete natural MON check18:15UTC, REST requests are timing out. VPS read-only
checks show Auth settings200, capabilities200 and private anonymous API401, but
service-only aggregate REST GET times out. This machine also times out reading a
single published product or two public settings fields; a final25second bounded
GET received no response. Direct PostgreSQL remains available;20/60connections
at the observed sample, no evidence of general connection exhaustion. No sessions
were cancelled, terminated or unlocked and no database/API settings were changed.

MON is now CRITICAL/incomplete. Its original7UNVERIFIED warnings are retained with
an additional missed-monitoring warning. The old2journal gaps are not cleared.
Email's recorded scheduled requests say EMAIL_WORKER_OUTCOME_UNVERIFIED; this is
not proof of a sent message. Tracking also reports failure. Existing timers remain
enabled, but their service failures prevent a healthy launch claim. No manual
worker, test Email, Brevo call, PDC call, payment or financial probe was performed.

Existing CARD/COD settings are ON. Capability200does not prove that purchases work:
checkout needs the affected Data API. No production purchase was manufactured.
Private core remains disabled/revision0 and its sessions/funds remain0. Known
legacy pending/uncertain outcomes are not failed, retried, reconciled or cleared.

The admin audit contains31successful product-update events and23completed save
receipts since18:00, ending18:18:34UTC. Some Data API sessions reference
catalog_save_product; the owner confirms stuck/retried saves. This supports further
request/queue diagnosis, not a proven code or locking root cause. Ordinary edits
should be safe. Preserve all completed updates and unsaved drafts; pause further
Save clicks. Do not reset products, force revisions or replay uncertain commands.
Owner clarified the changes were believed content/storefront updates. A real
Supabase project/API setting change remains unknown; never revert assumed changes.

## Completed core qualification, reused implementation

No new application, migration or payment implementation was built. The private
operator workspace is:
`/Users/imac/Documents/ELcomputer/payment-first-core108-activation-20261102`.
It uses the actual deployed P0source7b33/schema108, the installed FDF three-file
state, original HMAC/cancellation/private session/order contracts and emergency
fences. Local optional-method sourceffc1a30 remains untouched and undeployed.

| Qualification | Result |
| --- | --- |
| Exact deployed108 native+HTTP regression |23 PASS |
| Existing configure RPC/permission/revision/audit/late payment/COD cases |9 Node results PASS |
| Actual operator control transaction, including disable during an integrity alert |1 PASS |
| Scope/one-use/restart/runtime/worker-resumption/failure/disable guards |18 PASS |
| Actual deployed Nitro build with inactive, active and disabled flags |3 HTTP modes PASS; private Auth401/no-store/no-referrer; no secret canaries |
| Fresh encrypted database backup |Full authenticated pg_restore readback PASS |
| Fresh17protected runtime files |Encrypted full-byte readback PASS |
| Final hosted preflight |BLOCKED at EMAIL_WORKER_FAILURE; no core plan or approval produced |

Initial fixture assertions/transport failures are retained. Corrected qualification
logs are separate. No production state was changed by any of these tests.

When actual hosted health is restored, the smallest core activation remains:

1. Existing commerce_payment_checkout_configure RPC: enabledfalse→true,revision0→1,
   future enabled_since plus one authorized audit record; no order backfill.
2. OnlyNUXT_PAYMENT_FIRST_ENABLED=true andNUXT_PUBLIC_PAYMENT_FIRST_ENABLED=true.
3. One existing-app restart; no app deployment, migration, Caddy/credential/unit
   change. Pause/resume MON/Email/PDC timers once without invoking their callers.

The control transaction checks existing protected rows in the same snapshot,
excluding only the intended control and audit. Existing owner RBAC and the actual
single active owner are bound; no customer identity is forged. A failed/uncertain
commit or cutover is never retried or automatically rolled back. Timer restoration
uses existing one-use resume markers; it never repeats an activation or request.
A brief restart/new-checkout transition must be explicitly approved. Cart and
uncertain/verified funds remain durable, and old cached checkout clients must
reload rather than creating a new unpaid order.

## Disable semantics

The schema intentionally retains enabled_since after disable. Reverting the two
runtime flags after first activation would attempt to re-enter legacy unpaid-order
checkout, which the SQL guard rejects. The qualified emergency procedure instead
calls the existing configure RPC once withenabledfalse under an approved reason.
It leaves runtime/private history/callbacks available, blocks new prepaid claims,
retains genuine late success/one paid order and leaves COD operational. No restart,
refund, stock release or financial reconciliation is part of that disable.

A partial activation with no active receipt requires a separate evidence-bound
recovery; no activation/state boundary or receipt is manufactured. Original public
purchasing/COD/Email emergency fences remain separate and unchanged, with no new
purchasing kill budget. No emergency closure or disable was invoked here.

## Apple Pay — account-specific owner update

OD-20261102-APPLE-MERCHANT-01: the owner reports urgent Paymob support confirmed
Apple Pay eligibility for this exact merchant, will activate provider-side within
approximately one day, and said no extra owner activation action is required.
This supersedes the old generic certificate/domain blocker. Do not ask the owner
to generate certificates or contact Paymob again from generic documentation.

Actual production currently creates server-side Intentions with one exact CARD
integration and hands off to Paymob-hosted Unified Checkout. Pixel1.2.8 remains
locally prepared/inactive. Runtime extras had no dedicated Apple/wallet mapping;
that does not establish whether Paymob-hosted Apple becomes available on the
existing CARD integration after provider activation. No merchant metadata feed
or newly enabled configuration has independently confirmed activation yet.

Current status: **MERCHANT ELIGIBILITY CONFIRMED BY OWNER; PROVIDER ACTIVATION
PENDING INDEPENDENT EVIDENCE; NOT CLAIMED LIVE.** Verify the actual offered method
and signed-callback integration-ID binding before adding an explicit public Apple
option. One private attempt currently binds one exact requested integration ID;
never append an unverified extra ID and assume callback compatibility. Treat any
merchant-handled setup as provider responsibility. No concrete owner certificate/
domain task has been established for the current hosted integration.

## Other methods and owner priorities

- Payment-first CARD: locally qualified; blocked by current API/worker health.
  Keep existing hosted CARD configuration; no new flow activation.
- Pixel CARD: existing implementation/tests preserved; inactive; real merchant3DS/
  issuer/mobile acceptance remains pending under its separate future scope.
- InstaPay109: existing code and109-alone qualification retained; not installed.
  Verified recipient/private VPS proof controls/staff review and activation still
  required. A receipt remains Under Review until actual bank credit is verified.
- Egyptian wallets: actual live integration IDs and authenticated method contract
  remain unverified; no invented configuration or customer authentication flow.
- Balance110: qualified local ledger retained/OFF. Production installation, funding
  evidence, reconciliation operations, refunds/terms and obligations still gated.
- Google Pay: DISABLED. COD remains the unpaid confirmation exception with current
  server-authoritative prices/COD10, staff packing/weight/one booking approval.

Restore actual Data API/worker health first, then coreCARD, InstaPay/Apple readiness,
then wallets/balance. No unrelated UI/catalog expansion, historic supplement,
provider writes or financial actions. PDC settlements/ERP remain LAST.

## ONE next action and resume

Owner opens the Supabase project's Logs, selects **PostgREST** and **API Gateway**,
and shares the current error code/message since18:15UTC. Share no API keys,
request headers or customer data. Current credentials allow SQL reads but no
Supabase management session/token is available for those service logs. Follow
[Supabase's current Logs guidance](https://supabase.com/docs/guides/observability/logs).

Then qualify a narrowly scoped recovery from the actual error evidence. Do not
blindly restart the whole project/app, change RLS/API exposure, kill pooled
sessions, restore a database backup or undo staff edits. Any actual recovery
write still needs exact owner approval. After natural API/Email/PDC/MON recovery,
preserve all new warnings/gaps, inspect actual revision/history/runtime and only
then prepare a fresh current revision-bound activation approval. Never clear or
bypass the failed preflight or use a stale healthy snapshot.

> **E155:** future transactional Email ACTIVE on105; recovery8824 CONSUMED_COMPLETE, zero additional restart. First empty worker,12 scheduled batches and next09:10 MON/CARD/COD/privacy PASS. Queues0; no historical/test/provider email. [Current receipt and disable](customer-email-activation-review.md). Actual first genuine delivery remains pending; old approvals cannot be replayed.

> **E154:**105 installed; Email96da consumed-stop/OFF after one restart. Exact original MON baseline restored normally. [Zero-restart recovery](customer-email-activation-review.md) READY/unapproved,17 new tests/live preflight PASS. No first worker/provider/email; no old approval replay.

> **E153:**105 remains installed; subsequent Email activation96da stopped on MON_WARNING_DRIFT after one runtime-key restart. Sending/capture OFF; timer disabled/queues0. No readiness/provider/email; no replay. [Current stop/recovery review](customer-email-activation-review.md).

> **E152:**105 remains deployed inactive. The [separate future-events-only activation packet](customer-email-activation-review.md) is READY, unapproved and unexecuted. It requires one worker-key restart and no-send readiness/MON gates before enabling. All current sending/capture/workers stay OFF; no private probe repeat.

> **E151,30October2026:** schema105 recipient fix [DEPLOYED INACTIVE / hosted postflight PASS](customer-email-schema105-deployment-receipt.md).40b consumed; never replay. App unchanged/no restart; all Email/capture/workers OFF. The separate future-events-only activation packet is being prepared.

> **E150,30October2026:** the minimal ownership guard is [READY for separately approved inactive105 deployment](customer-email-recipient-fix-review.md).113 focused tests/16 guards/native rollback/typecheck/build/backup/sealed preflight PASS. Production104 remains unchanged/OFF; zero app deployments/restarts and no send/activation authority. Earlier E149 failures remain dated evidence.

# CX-EMAIL-01 — hosted processing qualification, E149

30 October 2026. **HOSTED EMAIL PROCESSING BLOCKED. Sending remains OFF.**

Schema104 supports the requested events, but recipient ownership fails qualification.
No activation approval, seal or expiry is issued. The successful private Brevo test
and its owner-confirmed delivery remain accepted and consumed; they were not repeated.

## Supported dormant events

| Event | Required authoritative state | Customer copy, EN/AR |
| --- | --- | --- |
| New ordinary CARD order | Saved built-in checkout, pending payment | Order received; payment not confirmed |
| Verified CARD payment | Live succeeded Paymob attempt, exactly one successful transaction, matching amount/currency, coherent paid balance/timestamps, order not cancelled/refunded | Payment confirmed; fulfillment remains separate |
| New ordinary COD order | Saved built-in checkout, pending cash collection | Order received; payment not collected; staff review pending |

This increment emits no cancellation, shipment, COD-collected, settlement, reminder
or marketing email. An AWB never proves payment. It emits a reference and total,
without an order URL, login token, address, phone, payment credentials or item details.
No order deep-link functionality is claimed. HTML is escaped; EN/LTR and AR/RTL
rendering are locally verified. Actual Arabic mailbox rendering remains untested.

## Hosted evidence and its limits

At **04:05:18 Riyadh**, the pinned SSH read-only inspection verified release
**1e931d20d19bde5a**, source **444c8fd**, all **4,111 installed inventory files**,
the running app, fixed runtime/service/Caddy/MON files and both emergency budgets.
The installed worker returned **401** for both absent and incorrect credentials,
before constructing its database client. No authorized processing call was made.
The worker secret is absent and no Email-named systemd unit is installed.

At **04:06:06 Riyadh**, a read-only database transaction matched the entire sealed
schema104 catalog: **397 functions, 230 triggers, 88 policies**, with all recorded
relations/columns/constraints/indexes intact. This verifies the hosted capture,
queue, final-dispatch and ACL definitions, rather than inferring them from source.

Configured Email revision2/encrypted key/verified sender are unchanged. All five
provider controls are false; capture is false/revision0; templates, messages,
attempts, provider events and order-email events are empty. Claims Email purposes
are disabled and their queue is empty. Marketing, webhooks and MON Email stay OFF.

MON's **04:05:05** automatic report is complete: **five terminal-unverified payment
warnings, zero critical**, timer active, two recorded journal gaps preserved. No
warning was resolved, cleared or reset. The older warning-drift stop is retained.
CARD/COD remain live. The cancelled C1403FCFC6 COD order has no email or shipment;
there are no active COD orders. No order, payment, pickup, collection or PDC action.

Positive event/worker behavior was exercised only in disposable local databases.
Live capture stayed disabled; no hosted order or payment was manufactured. The
isolated provider probe does not prove hosted automatic customer-mail delivery.

## Test results

- **81 existing tests passed on pinned Node22.23.1**, none skipped or cancelled.
  This includes the original31 order
  checks and focused transport/API/audit/concurrency/revocation coverage. Durable
  enqueue/linkage, stable event identities, replayed callbacks, lost acknowledgments,
  final authorization, bounded retries and uncertain-send quarantine remain covered.
- **17 added native PostgreSQL cases:**15 passed; **two ownership cases failed**
  against unchanged104. Node also reports the containing test as failed:18 total,
  15 pass/3 fail. This is not a green qualification.
- CARD/COD receipts and verified-payment copy pass in EN/AR. Unpaid/provider-
  unverified states do not create successful-payment events. Cancelled orders are
  suppressed before enqueue and at final dispatch. Recipient changes suppress
  dispatch; expiry and disabled-period/no-backfill checks pass.
- A minimal **proposed additive SQL guard** passes all18 tests in a disposable
  database. It is a local correction candidate, not a deployed or release-certified
  migration. No historical migration or application file was edited.

Initial new-fixture runs omitted payment settings, then attempted to modify an
immutable expiry. Their logs are preserved separately. The corrected baseline and
proposed-guard runs above are the authoritative results; fixture errors are not
reported as production defects.

Earlier Node24 runs are supplemental and retained. The first Node22 suite reported
79 passes, zero failures and two cancellations because mocked DNS left only an
unreferenced deadline. A test-only event-loop keeper produced the final81/81 run.
It changes no application transport or timeout. Negative ownership failures and
the18-pass proposed correction were also reproduced on Node22.23.1.

The **04:16** final read-only checks again preserve the installed release, all14
selected order/payment/shipping/Email table fingerprints, catalog and configuration.
Public CARD/COD capability GET is200; capture and every Email control remain OFF.
MON's **04:15:05** automatic report remains complete/five warnings/zero critical.

## Exact launch blocker and proposed correction

Checkout accepts `address.email`, which may differ from the authenticated mailbox.
Schema104 binds the event to that saved order email, but never proves that mailbox
belongs to the order's customer. The negative test queues an email to an unrelated
fixture mailbox. A second test revokes mailbox confirmation after capture and still
queues order details. Current hosted orders all match confirmed account mailboxes;
no exposure occurred, and automatic sending has always remained OFF.

The smallest correction adds a private ownership predicate and reuses existing
capture and final-eligibility functions. Require an active, nonanonymous customer
with a confirmed Auth mailbox matching the saved recipient. Check at capture,
enqueue and final dispatch. Suppress an alternate/unverified destination; never
silently redirect the message or alter checkout/payment behavior. Keep failed
ownership events out of sendable queues. No separate mailbox-verification system,
new transport, app rebuild or historical-order backfill is needed.

Local proposal: `../customer-email-hosted-qualification-20261030/`
`recipient-ownership-guard.proposed.sql`. It changes two existing private functions
and adds one restricted helper. A future additive migration slot, production
preflight, rollback/preservation qualification and separate exact deployment approval
are still required. **Do not edit migration104 or apply this proposal directly.**

## Guarded activation packet — HELD, not executable

Private draft: `activation-packet.blocked.json` in the evidence directory above.
It contains no executable approval. Do not seal it until the ownership correction
is deployed and requalified. Then prepare a fresh, expiring, single-use activation
packet bound to the actual release, schema, catalog, sender/key fingerprints,
current monitoring and unchanged emergency controls.

The eventual scope is future qualifying events only: no historical scan, resend,
old receipt backfill, private-test replay or synthetic paid order. Disabled-period
order receipts stay absent. A genuine later verified-payment transition is a future
event, not permission to scan old orders. Cancelled/refunded orders remain excluded.

Reuse the installed worker over loopback with a dedicated random secret, restricted
local scheduler, limit1 and bounded request/runtime. Keep the timer stopped until
configuration is checked. Runtime-secret installation needs one separately approved
app restart; no Caddy/public worker ingress or Auth SMTP changes. Turn on only the
three transactional provider gates plus order capture under that future approval.
Marketing/webhooks/Claims/MON Email remain OFF. Check no unrelated pending queue.
Three preparation/transport attempts and the10-minute event validity remain bounded;
ambiguous dispatches are uncertain and never automatically retried.

## One disable / rollback procedure — for the future approval

1. Atomically disable order capture with `order_email_configure` and provider sending
   with canonical `email_command('settings', ...)`, using the current revisions and
   an authorized staff actor. Preserve the encrypted key and sender. Set all five
   provider controls false. Pending/preparing events and queued messages become
   suppressed through existing functions; never delete history.
2. Stop/disable only the approved Email timer and worker. Preserve uncertain and
   accepted attempts; a request already dispatched may still arrive. Never claim
   it was recalled or automatically resend it. Do not touch CARD/COD/MON or their
   emergency switches. Gate disable needs no app restart; later secret removal
   would require its own explicitly approved restart scope.
3. Read back gates/capture, timer, queues and uncertainty; verify CARD/COD, app health,
   cancelled-order exclusion, budgets and the next normal MON report. No down
   migration, database restore, old-config replay or automatic reactivation.

This procedure is documented preparation, not present execution authority.

**ONE next action:** prepare a separately sealed inactive deployment for the minimal
recipient-ownership guard. Keep customer sending/capture/workers OFF throughout.

After Email, follow the owner's sequence: Paymob Pixel/safe Pay Again after the
provider reply; genuine eligible PDC shipping/tracking; SEO/Search Console/legacy
redirects; remaining customer/admin/deferred work; LAST commercial settlement/ERP.
All previous tests, worktrees, visual TODOs and consumed approvals remain preserved.

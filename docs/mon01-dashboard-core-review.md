> Superseded by [E97 recovery review](mon01-journal-recovery-review.md).
> Approval recorded; installer consumed at a pre-cutover stop. Never rerun it.
> The preparation statements below are historical evidence.

# MON-01 — Dashboard-first core ready for exact approval — E96

Prepared27–28October2026, Riyadh. This supersedes E95's email dependency.
**Local candidate qualified; production deployment and hosted acceptance pending.**
No production files, services, orders, payments, stock or provider settings changed.

The owner explicitly prioritizes secure Dashboard alerts and durable monitoring.
Email is optional. Auth SMTP credentials must remain untouched; no new credential
or test message is authorized by preparation or this core deployment proposal.

## Read-only findings

Application settings have no Brevo API key, approved sender or active provider.
The checked VPS application runtime has no SMTP/Brevo mail configuration. These
are bounded application/server findings; hosted Auth SMTP was **not inspected,
extracted, copied or reused**. No Auth mail, customer session or provider call ran.
There is no email configuration prerequisite for this candidate.

Production remains **a402cf24a9685e0d / schema98 / PID55343**. Public signup,
CARD and Manual EGP50 are available; PDC is PAUSED. The fresh guarded preflight
at **28October,00:09:02 Riyadh** verified the immutable application, original release manifest,
runtime/configuration, existing unit files, original unused kill budget, schema,
Manual delivery and zero critical ledger/ownership/duplicate mismatches.

Health checkpoints continued22:58,23:13,23:30 and23:45. No new orders, attempts,
transactions or changes to prior attempts/transactions were found. The23:13–23:30
interval was16m52s, beyond the15-minute cadence; historical15 unrecorded checkpoints
remain documented. Catch-up observations do not establish past real-time coverage.
No scheduler was activated by this preparation.

The sole aged pending attempt is the owner-reported incomplete EGP3149 friend test.
It remains **UNVERIFIED**, not failed or paid by inference. Merchant inquiry is not
configured. WOLF's paid order remains Processing / untracked / unpacked, no shipment.
The older paid PDC order is existing backlog, not a new public sale or permission
to book/fulfill it. No money, order, callback replay or reservation action occurred.
Available journals show no identified new checkout/callback failure. Incomplete
proxy responses remain insufficient to attribute checkout impact; no per-request
access logging is configured.

Latest full health check: **28October,00:08:57 Riyadh**; no new orders/payments,
no critical reconciliation exception. Next staffed checkpoint **00:15 Riyadh**.

## Smallest core release

Source `local/mon01-payment-monitor-20261027` at
`feea512aab9a2c8bcdd5adc0514aaacd0133b63a`, based on deployed113b313.
Candidate release **b4b502a03207713a**; it is not current.

- One standard-library worker and persistent five-minute systemd timer.
  Fixed GET-only commerce projections, signed-ledger reconciliation checks,
  pending/terminal UNVERIFIED flags, new paid orders and staff backlog.
- SQLite persists alerts/deduplication,288 bounded check receipts and512 journal
  gaps. Checks are locked, bounded and restart-safe. Unchanged exceptions do not
  create repeated alerts. No business mutation or automatic kill action exists.
- A separate atomic0640 report publishes only bounded operational fields.
  Private SQLite/credentials remain0600. The locked, non-login worker has its own
  user/group; the application receives a read-only report group through one drop-in.
  The guard checks actual loaded group membership and original unit integrity.
- One server-private runtime input, `NUXT_PAYMENT_MONITOR_REPORT_PATH`, and a
  protected GET API requiring the existing `dashboard.orders` permission.
  The API rejects symlinks, unsafe modes, malformed/oversized/unknown reports.
  It exposes no customer contacts, addresses, credential values or raw journal text.
- A compact EN/AR Dashboard banner shows last successful check, new paid orders,
  staff work and unresolved exceptions. It refreshes only while visible, retains
  last-known details on failure, marks stale reports and clears on session changes.
  Neutral initial checking state; no repeating toast or automatic dismissal.
- Email stays off. The core neither reads its recipient configuration nor queues
  an email backlog. The optional Dashboard email field remains permission-protected;
  an address alone does not enable delivery. Existing email settings are unchanged.

The existing server Supabase credential is proposed for fixed commerce GET reads
through systemd credentials **after exact approval**. Its underlying service-role
authority is unchanged; it is not a newly restricted SQL role. Root-owned code,
private credentials and the service sandbox protect it. No Auth SMTP credential,
customer token or whole application environment is delivered to the worker.

## Qualification and limits

**36 focused checks PASS:**21 worker,7 API/settings/UI,8 guarded-operator tests.
Coverage includes missing email, no email backlog, restart/deduplication, uncertain
dispatch, bounded history, source/publication failures, last-known alerts,
permissions and revocation, privacy projection, file safety, EN/AR compilation,
approval expiry/budgets, archive traversal, original unit drift, actual reader-group
requirements and exclusive sharing of the original kill marker.

Nuxt production build PASS. All **2,268 assets** returned200 with matching SHA-256
through a local Caddy handler, including all2,161 retained assets. Secret scan PASS.
Full safe archive extraction/readback PASS under restrictive umask;3,239 entries.
The normal OUTPUT-INVENTORY.json contract is explicitly preserved and validated.
Earlier unapproved packets and their stop evidence remain archived, not executed.

In-memory read-only VPS qualification at23:48:32 read all3 known ledger orders,
verified Manual/HTTP/journals, and accepted the timer expression. It wrote nothing,
read no email configuration or Auth SMTP, and sent no notification.

Installed service sandbox/timer, real publication permissions and the owner browser
banner remain post-approval acceptance. The guarded installer tests these host
conditions before recording completion; owner observation remains explicit.
GET403 from the callback route is expected method denial, not signed POST proof.
Signed-callback code/HMAC/Caddy configuration remain unchanged; no callback replay.
Provider-side unknown transactions remain unobservable without merchant evidence.

## Exact deployment scope

One new monitoring service/timer, one application release switch and **one app
restart**. Add the private report-path runtime value and read-only report group.
Preserve existing runtime values, unit fragments, Caddy, signup, CARD, Manual50,
coupons, PDC pause, callbacks and owned order access. No SQL migration/data command,
new key, SMTP profile, email activation, test notification, charge, shipment or push.

If first worker or private candidate qualification fails, the installer leaves
the serving app, its runtime and its original kill guard unchanged. Its new report
drop-in is published only when the application cutover begins.

The installer retains the immutable previous application and a root-private,
byte-verified runtime recovery copy. It does not restore the database or roll back
automatically. Local and remote exclusive intents prevent a second deployment.
`verify` resumes postflight only; interrupted/expired/ambiguous execution requires
inspection and a fresh recovery packet when the guard cannot prove continuation.

The original remaining emergency-close budget is rebound to this candidate.
Closure shares the original public activation's exclusive kill-intent marker;
there is no second budget, new public activation or automatic closure. The new
guard restores the original closed values while retaining monitoring, signed
callbacks and order access. Do not edit or rerun the consumed activation operator.
Use closure only under the existing established-emergency/coverage procedure.

Core alerts require staffed Dashboard coverage. They do not notify an absent owner
or survive a total VPS/network outage as an off-host channel. Keep15-minute staff
oversight and fulfillment coverage until further alert delivery is approved.

Private packet: `../mon01-automated-monitoring-20261027/`.
Authoritative files: `dashboard-plan.json`, `dashboard-seal.json`,
`dashboard-operator.mjs`, `guarded-dashboard-remote.py`, fresh preflight receipts.
No MON-01 owner approval or execution intent exists at preparation completion.

**Exact next approval:**

```text
APPROVE MON-01 DASHBOARD MONITORING cd1ed3593135056015cdfa14b5cf4059702866a3802a49819b202fbda8ed691f
```

Packet expires **28October2026,06:08:53 Riyadh**. Execution rechecks the live
baseline immediately; expiry/drift stops it. This is not a purchase-window grant.

## Optional email later

Email setup does not block core approval or deployment. If wanted later:

1. Use an approved verified sender and a dedicated monitoring SMTP key created by
   the owner in Brevo. Keep the existing Supabase Auth key/configuration intact.
2. Privately configure SMTP host, TLS port587/465, SMTP login, sender and that key.
   Never put the key in chat, Git or Dashboard recipient fields.
3. Set the recipient in Dashboard → Email → Settings. The reviewed proposal remains
   info@elcomputer.net; it can be changed using existing settings permissions.
4. Review a separate email activation. No test message runs without explicit approval.

[Brevo SMTP setup](https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP)
and [dedicated SMTP keys](https://help.brevo.com/hc/en-us/articles/7959631848850-Create-and-manage-your-SMTP-keys)
document the transport and distinguish SMTP keys from API keys.

Original32 deferred rows, DTR-33, STOR-01, storage audit and schema96 location work
remain unchanged/open. Existing branches/commits/uncommitted work are preserved.

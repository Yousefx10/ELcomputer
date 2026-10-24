# PDC webhook readiness — 24 October 2026

**Update: INBOUND_INGRESS_PASS. The separately approved signal recovery completed.**
Caddy confirmed one SIGUSR1 reload. The single unauthenticated HTTPS POST returned401.
Both service PIDs, application release, runtime bytes and outbound/purchasing gates
are unchanged. No authenticated callback, provider request or registration change ran.
Both approvals are consumed; never rerun either operator. The original stopped
systemd attempt remains preserved in the [completed recovery receipt](pdc-webhook-ingress-recovery.md).

**WEBHOOK BLOCKED for provider cutover. Receiver and inbound-only ingress are qualified.**

The consolidated customer-session deployment passed. Fresh read-only checks confirm
release `58e3083f4aa6a1f8`, schema91, healthy `storefront` PID32102 and Caddy PID26652.
Customer-session hosted public smoke passed previously; authenticated two-account
acceptance remains a separate public-commerce task. This PDC preparation does not
hold, modify or expand that roadmap.

## Original evidence and compatibility

The original implementation is Code Snippets entry34, `ElComputer PDC Courier — Test`.
Authenticated archival source matches SHA256
`06da3aa4ba6e9d0f79bfde93b7aa1561b444a9a56765239c83a0f2b3dcc18409`.
The verified redacted copy was inspected as data. No PHP, WordPress, old SQL,
plugin, historical worker or legacy site was executed. Original files are unchanged.
Code and historical normalized records do not substitute for a retained raw
provider webhook transcript; none is available in the selected completed evidence.

| Contract | Archived WordPress | Current Nuxt |
| --- | --- | --- |
| Route | `POST /wp-json/elcomputer-pdc/v1/webhook` | `POST /api/webhooks/pdc` |
| Authentication | Dedicated `X-Webhook-Secret`, PHP `hash_equals` | Same independent header; timing-safe digest comparison before parsing |
| Secret compatibility | Saved48-character secret | Secure comparison confirms exact match; distinct from AccessToken. No disclosure or change. |
| Payload | JSON object; canonical fields below, plus defensive aliases | Canonical JSON object; bounded8KiB, two-second body and7.5-second handler deadline |
| Matching | AWB first; REF fallback; legacy order-number inference | Exact original REF plus assigned AWB required; no inference or automatic attachment |
| Success acknowledgement | HTTP200, `{"ok":true,"duplicate":false}` | HTTP200, `{"received":true,"stale":false}`; duplicate adds `duplicate:true` |
| Unknown/mismatched shipment | Unknown404; AWB-first logic can ignore conflicting REF | Unknown404; missing/mismatched assigned AWB409; no success acknowledgement or customer attachment |
| Duplicates | AWB, status, label and provided date; a duplicate may still repair WooCommerce status | Atomic AWB+StatusID history/deduplication; duplicate status dates/reasons do not repeat actions |
| Ordering | Parsed dates, receive-time fallback and WooCommerce status writes | Strict valid event time; older/equal events remain history without replacing current state |
| Side effects | Can rewrite broad WooCommerce order statuses and run their hooks | Outbound shipment history/current state and private change signal; no order/payment/inventory transition |

PDC's supplied six-page Webhook Integration guide requires HTTPS POST, JSON,
`X-Webhook-Secret`, exact REF, AWB+StatusID idempotency and HTTP200/201 within10seconds.
It does not require the WordPress `ok` response key or a body HMAC signature.
These are shared-secret authenticated callbacks, not HMAC-signed callbacks.
No new signature algorithm, browser cookie or AccessToken authentication is added.

Canonical safe fixture:

```json
{
  "AWB": "FIXTURE-AWB",
  "REF": "ORD-OFFLINE-FIXTURE",
  "CustomerStatusName": "Out For Delivery",
  "StatusID": "4",
  "StatusDate": "2026-10-24T13:00:00+03:00",
  "ReasonName": ""
}
```

WordPress additionally accepts `awb`; `Ref`/`ref`; `statusID`/`statusId`/`status_id`;
several status-name aliases; `statusDate`/`date`; and `Reason`/`reason`.
It can process a missing REF by AWB and substitutes receive time for missing dates.
Its date helper accepts ISO and day/month/year forms. Nuxt intentionally requires
the documented field casing, REF and valid ISO date. Offset-free ISO dates use
the saved `Africa/Cairo` timezone; ambiguous/impossible DST times are rejected.
Empty status/reason labels are accepted. No actual alias-only callback evidence
justifies weakening these constraints or silently guessing dates.

## Status mappings and remaining cutover blockers

The [complete33-ID comparison](pdc-webhook-status-comparison.csv) records every
WordPress numeric fallback and all32 current Nuxt mappings. WordPress first
rewrites IDs heuristically from human labels, then may move an order into
processing, shipped, completed, on-hold or cancelled. Those order transitions are
not copied into Nuxt.

Nuxt follows the supplied account status sheet:2 in_transit,3 arrived_at_hub,
4 out_for_delivery,5 delivered,7 returning and8 returned. IDs11 and97 are neutral;
ID1 has no saved mapping and is also neutral. Other positive unknown IDs remain
private history with unknown shipment state. Valid unknown statuses are retained.
The supplied PDF illustrates different meanings for2/3/5, and the sheet contains
two meanings for97. "Same as WordPress" confirms the transport contract, not which
account-specific interpretation of those conflicting documents is authoritative.
Confirm the account mapping and offset-free timestamp convention before provider cutover.

Existing monotonicity is chronological: older/equal-time updates and stale lookup
races cannot replace newer callbacks. It is not a total rank of shipment statuses.
The outbound path can accept a newer distinct provider status after delivery;
reverse jobs separately retain their terminal guard. This preparation preserves
those existing rules and does not claim or introduce a broader state-machine policy.

Production has one PDC order job, still uncertain, and **zero jobs with an AWB**.
The standalone static AWB is not a customer fulfillment. It cannot be attached to
the paid order to manufacture a passing webhook test. No currently assigned
customer REF/AWB can support a successful durable provider-verification callback.
Preserve that uncertainty barrier and all historic references.

## Minimum ingress change

The approved Caddy candidate is loaded. It inserts one block before `@commerce`:

- HTTPS POST on exact `/api/webhooks/pdc` only; no wildcard or trailing-slash opening.
- 8KiB request bound, no-store response, no proxy retries and bounded loopback transport.
- Other methods/sibling webhooks and purchasing/internal paths retain their holds.
- Existing plaintext redirect/deny behavior and signed Paymob proxy stay unchanged.

No Nuxt deployment, database migration, PDC setting, credential, runtime gate,
pickup scheduler or automatic queue change is required. The saved PDC setting is
already enabled; automatic labels, reverse and COD are false. Outbound and public
purchasing gates remain false. The receiver does not depend on opening those gates.

The receiver invokes only transactional tracking persistence. Existing claim
callbacks use their isolated claim path. Neither path calls booking, pickup,
payment, refund, restocking or a provider HTTP client. Separately gated SMS intents
do not invoke a sender from the receiver. Customer ownership, service-only RPCs,
private history and minimal Realtime change signals remain unchanged.

## Focused qualification

- 43 callback/database tests pass: authentication, input bounds, canonical JSON,
  dates, duplicate/transactional behavior, stale/equal events, REF/AWB binding,
  unknown statuses, payment/order preservation, ownership and private broadcasts.
- 36 actual local Caddy TLS checks pass across two synthetic business domains.
  They cover valid/invalid fixture secrets, exact methods/paths, plaintext handling,
  body bounds and unchanged Paymob routing. No production credential is used locally.
- 3 operator guards pass: wrong approval, tampered plan and consumed invocation
  stop before SSH or new changes. The exact candidate parses with Caddy2.11.7.
- Production read-only preflight passes: release, receiver artifact, processes,
  runtime bytes, Caddy baseline and closed gates. No full build or broad audit.

## Exact minimum next authorization

The original **ingress-only** approval below is **consumed; do not rerun**:

```text
APPROVE PDC WEBHOOK INBOUND INGRESS cd3b7ccf8f657e72acafe8d6016af52bf1c6ab0640e9d6d17b353c11217c1c05
```

That approval permits one guarded Caddy configuration switch/reload and one
unauthenticated empty POST expecting401. It permits no valid live callback,
application restart, database write, provider request or PDC destination update.
The operator saves a protected full baseline, validates the candidate, rejects
target drift/consumed attempts and stops on uncertainty. No automatic rollback.

Historical command — attempted once and STOPPED; **never rerun**:

```sh
python3 -I -B scripts/pdc-webhook-readiness/operator.py apply /Users/imac/Documents/ELcomputer/pdc-webhook-readiness-20261024 --approved cd3b7ccf8f657e72acafe8d6016af52bf1c6ab0640e9d6d17b353c11217c1c05
```

**Provider activation approval is not issued.** Keep PDC's destination unchanged.
After mapping/timezone review and an independently authorized genuine assigned
REF/AWB exist, prepare a separate exact provider cutover and bounded authenticated
verification/duplicate/older-event packet. This preparation does not authorize a
shipment to create that prerequisite. Rollback/closure requires a reviewed
Caddy-only restoration against the then-current bytes, retaining event history.

Protected evidence and full private Caddy candidate:
`../pdc-webhook-readiness-20261024/`. No secret, personal payload or full protected
configuration is copied into Git. All unrelated session/public-commerce work stays.

# PDC webhook cutover and credential rotation — prepared only

**Public webhook readiness: BLOCKED. Local handler safeguards pass offline.**
Target: `https://elcomputer.net/api/webhooks/pdc`.
No destination change, provider contact or production ingress change has occurred.

The exact current Caddy file is bound by the completed PDP deployment and encrypted
runtime readback. Its `@commerce` matcher denies `/api/webhooks` and descendants
with403 before the default proxy. Public read-only checks confirm that hold.
The Nuxt POST handler separately requires an enabled PDC setting and independently
encrypted secret. The provider is currently disabled; outbound runtime is also off.

## Existing handler review

- POST only; JSON only; bounded8KiB body, two-second body deadline and7.5-second
  overall budget. Successful and duplicate persistence returns200/no-store.
- Missing/incorrect `X-Webhook-Secret` fails401 against configured settings;
  timing-safe comparison precedes body parsing. Unconfigured/disabled fails503.
- Exact original REF locates the job; AWB must agree. Unknown REF fails404 and
  mismatches409. Invalid payloads fail400/413/415 without a successful acknowledgement.
- AWB+StatusID deduplication, atomic ledger/current-state commit and DB locks
  prevent duplicate side effects. Older/equal-time events remain history; the
  reconciliation race cannot overwrite a newer webhook. Failed persistence returns503
  so the provider can retry. Provider retry schedule/retention remains unconfirmed.
- Outbound events affect shipment state and separately gated notification intents.
  Reverse events use the existing isolated claim route. They do not collect COD,
  settle payments, post accounting, restock or authorize a claim resolution.
- Unknown/ambiguous IDs remain neutral. Status97, illustrative PDF IDs, actual
  account mappings and timezone/DST need PDC confirmation before cutover.

## Minimal separately approved cutover

1. Obtain agreement on the account's actual status mapping, timezone, REF/AWB
   association, retries and repeated-status behavior. Review the existing CSV;
   do not guess mappings or treat the PDF illustration as current account truth.
2. Verify the independent saved webhook secret privately. Provide it only through
   the owner's secure provider channel. Keep it distinct from Access Token.
3. Review a deployment-specific Caddy diff that proxies only HTTPS POST on the
   exact `/api/webhooks/pdc` path before `@commerce`, with8KiB body bounds,
   no caching and no proxy retries. Keep GET, sibling webhooks and every other
   commerce/internal/private hold unchanged. Do not broadly allow `/api/`.
4. Separately authorize inbound tracking: `is_enabled=true` is required by the
   current handler. Keep runtime shipping outbound, auto-labels, reverse, COD,
   checkout, signup and Paymob disabled. Confirm no queued work becomes eligible.
5. With separate test authorization, verify TLS, method/secret denials and one
   known provider-coordinated REF/AWB event. Inspect durable state, replay once
   for idempotency and send an older event only if explicitly scoped. Assert
   unchanged payment/accounting/inventory and bounded200 response time.
6. Only after those gates pass, authorize PDC to register the new destination.
   Observe provider acknowledgements/retries and missing/unknown-reference alerts
   using sanitized diagnostics. Keep the previous destination/rollback record.

Rollback closes only the new exact ingress and disables inbound tracking after
reviewing in-flight retries. Retain all event history and existing business data.
No automatic retry, rebooking, database restore or old endpoint reactivation.

## Access Token rotation plan — owner/provider execution only

The previous support exchange included a production token and session cookies.
Cookies are unnecessary for V6 and must not enter this integration.

1. The owner asks PDC for a replacement scoped to the existing company. Confirm
   whether old/new tokens may overlap and arrange a bounded cutover if not.
2. Save the replacement personally in Dashboard Shipping settings over HTTPS.
   Existing AES-GCM encryption and server-only key custody remain. Keep all
   commerce/provider flags disabled. Do not paste it into Codex, Git or screenshots.
3. A token change intentionally invalidates lookup caches. Saved Product ID and
   city mappings remain; verify them and obtain separate bounded live lookup
   authorization before refreshing caches or claiming replacement acceptance.
4. Confirm the new token through that separately approved provider request while
   the old token remains valid where PDC permits. Do not automatically retry a
   failed/uncertain request or infer success from merely saving encrypted text.
5. After verified replacement acceptance, the owner asks PDC to revoke the old
   token and invalidate exposed support sessions. Record nonsecret issuance,
   acceptance/revocation times and provider confirmation; never retain token bytes.

No autonomous rotation, issuance request, secret disclosure or provider message.

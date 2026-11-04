# Separate marketing SMS channel

Local candidate only. Runtime `smsMarketingEnabled`, database marketing switch,
Vodafone provider switch and all commercial defaults remain OFF/unconfigured.
There is no contact migration from orders, Auth, Email or WooCommerce. No sender,
price, provider limit, permission or consent is inferred from an existing customer.

Dashboard → SMS → Marketing provides consent JSON import (1–500 contacts),
locale/tags segmentation, drafts, timezone-explicit scheduling, preview, immutable
audience review, exact manual approval, pause/cancel, reserved maximum cost,
submission outcomes and audit. Separate named permissions cover view, manage,
consent, configure, approve and reports; default staff grants are false.

Each imported contact requires an Egyptian normalized mobile, explicit opt_in=true,
consented_at, consent_reference, source_reference, locale and bounded tags. The
operator attests ownership/provenance; duplicate imports never silently amend
consent. Suppression survives reimport. No resubscribe or suppression deletion API
is supplied. Recipient opt-out is authenticated by a server HMAC capability and
needs no account. A GET never mutates consent.

Unsubscribe URLs use `/sms/unsubscribe#<opaque-contact-id>.<signature>`; the fragment
never enters the HTTP request URL. The actual page clears it from browser history,
keeps it in memory, and POSTs only on explicit confirmation. Responses are generic,
private/no-store/no-referrer. The route is private/noindex in shared SEO. Runtime
`smsUnsubscribeSecret` is server-only; `smsUnsubscribePreviousSecrets` preserves old
verification keys during rotation. Neither key, token, full contact, message body
nor unsubscribe capability appears in campaign previews/reports. Future analytics
integration must preserve this route exclusion.

Templates are separately managed under Dashboard → SMS → Templates. Both English
and Arabic campaign translations must contain only `{{unsubscribe_url}}`. No
commercial message is seeded. Freeze computes actual GSM7/UTF16 segments including
the exact link, validates approved sender/current template, and reserves every
recipient's maximum price before review. Pricing is explicit EGP piastres per
segment, with accepted commercial reference and Unicode/segment terms. Unknown
price blocks preparation. Set a tax-inclusive maximum accepted cost; this is a
conservative cap, not a Vodafone billing reconciliation or promised tariff.

Approval requires campaign ID, exact revision, audience count, segment count and
maximum cost. Future schedules cannot claim early. A plan is immutable after
freeze; changed content/audience requires a new draft. Pause/resume/cancel are
audited. Resume requires exact approval again. Any provider/template/pricing change
invalidates the old plan. Budget reservation is never released on uncertain sends.
Unsubscribe, current consent, config, approval, schedule, sender, template and lease
are rechecked immediately before POST. Existing raw-list campaign enqueue is
blocked at both API and SQL boundaries. Transactional SMS has a separate gate and
can operate without a marketing audience.

The existing Vodafone transport, serialized provider pacing, ExternalTrxId,
preflight-only bounded retry and ambiguous-result preservation are reused. No
automatic resend follows a lost or ambiguous POST. Each frozen recipient gets one
central batch identity. Preparation itself has max three lease claims. Provider
SUBMITTED means provider acceptance, never verified handset delivery. Merchant
receipt/authentication/inquiry contract is missing; no imaginary receiver exists.

Qualification uses actual SQL/RLS, actual H3 handlers and isolated provider fixtures.
Provider credentials and real SMS were never used. Production installation,
sender/IP approval, pricing acceptance, protected worker/unsubscribe binding and
real narrowly approved sending remain distinct future gates.

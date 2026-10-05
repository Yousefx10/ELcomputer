# Vodafone SMS foundation audit — 2026-10-05

Scope: local implementation only. No production migration, deployment, real provider call, credentials or SMS. Read `AGENTS.md`, the current `PROJECT_STATE.md` and `CODEX_HANDOFF.md`, schema/migrations, tests and all 19 PDF pages before implementation. The PDF metadata's apparent page count differs from the actual 19 pages read by the PDF parser.

- Searches across app/server/schema/migrations/tests for SMS, Vodafone, messaging, notification, campaigns, OTP, phones, senders, templates, queues, delivery, providers, secrets, HMAC and ExternalTrxId found no reusable outbound SMS service or SMS tables. The existing PDC report mentions SMS only as future work. Supabase Auth's SMS configuration is infrastructure configuration, not an ELcomputer SMS implementation.
- `customer_order_messages`, support ticket messages and Live Chat messages are in-app conversations. They are not outbound notification queues. Support unread counts and chat private Realtime signals remain unchanged. No reusable outbound email delivery service was found; no email redesign is needed.
- `credentialSecrets.js` provides authenticated AES-256-GCM encryption with a server-only master key, already used by Daftra. Reuse it for all Vodafone credentials, including Account ID. PDC has the same envelope with its separate shipping key; do not modify PDC.
- PDC and Daftra use private database jobs and authenticated internal worker endpoints. Reuse this execution pattern, SQL leases/atomic transitions, existing service-role client and bounded body reader. Their tables and business rules are provider/domain specific; sharing those tables would mix ownership and retry semantics. SMS needs its own ledger under one central service.
- `requireAdminRequest`, `adminPermissions.js`, route requirements, navigation groups, `useSupportClient` and `recordAdminActivity` provide the existing auth, RBAC, browser API and audit patterns. New SMS permissions default false for staff; owners retain existing full-access behavior. Audit logging has an existing 50-record-per-user retention policy; message/attempt history is separate and durable.
- Customer profiles, orders and CRM records store free-form text phones. Preserve historical data; normalize only new SMS input at send time to `+` plus international digits. Manual entry avoids guessing customer identity from typed contact information.
- Dashboard uses EN/AR JSON locales, locale-aware routing, shared light/dark/system preferences and logical spacing. SMS uses that shell and one navigation group with four tabs.
- Existing tests use Node's runner, isolated PGlite application migrations, and actual Vue component browser fixtures. Reuse these; never point tests at the linked production database.

## Protocol discrepancy: activation must wait for clarification

The supplied V5 section 5 explicitly requires HEX-decoding the secret. Both printed example hashes instead match HMAC with the textual secret as UTF-8 bytes. Independent Node crypto and Python hashlib calculations reproduce this conflict.

Implementation follows the explicit user requirement and written algorithm: HEX-decoded key, UTF-8 ordered fields, uppercase hexadecimal output. Focused tests prove the correct outputs and reproduce the document's contradictory outputs only as evidence. The examples cannot honestly be marked as matching the required algorithm. An explicit Dashboard confirmation of Vodafone's resolution is required before enablement; no fictional provider confirmation is seeded.

The PDF mentions legacy SSL/TLS versions. Keep Node's secure TLS defaults (TLS 1.2 minimum); obtain a supported endpoint/certificate from Vodafone rather than downgrade TLS. The API specifies submission, not handset delivery, and no usable status inquiry or guaranteed ExternalTrxId deduplication contract is supplied.

# Commerce foundation release receipt — 2026-10-20

**DEPLOY PASS. Owner browser acceptance pending. Do not rerun the release.**

The owner approved the exact plan prepared at `07bb18f` and paused Dashboard
editing. Final hashes, service bindings, media hashes, record counts, disabled
controls and encrypted-backup prerequisites matched. The unchanged operator ran
once, without release retries or automatic recovery.

| Evidence | Result |
| --- | --- |
| Application source | `862b1e3c4fd842a4a42dc8b86712bbe249e13883` |
| Release | `82214df492a57126` |
| Archive SHA-256 | `82214df492a57126182d03e48e643baaf6913f2279db39ec39fde48cab93e8fa` |
| Approved plan SHA-256 | `779a17d27a8d34e15488173e67eca0cfd7e03e661f21a769c5f303b37d4e7557` |
| Execution started | 2026-10-20 17:57:13.737 UTC |
| Operator PASS | 2026-10-20 18:02:49.506 UTC |
| Additional read-only verification | 18:03:38 UTC service/data; 18:04:31 UTC health/Auth |
| Active current | `/srv/storefront/releases/82214df492a57126` |
| Nuxt | `storefront.service`, PID 22422, active/running, zero automatic restarts |
| Caddy | PID 14793 unchanged, active/running; original configuration unchanged |
| Preserved database state | 131 original table fingerprints matched before commit |
| Preserved records | 561 products, one Auth user/identity, four Storage metadata objects |
| Customer orders / packing videos | Zero / zero; no real order, video, cash or shipment created |
| Public VPS files | All 2,613 original-at-execution files matched their hashes after activation |
| Controls | All five payment methods off; provider-live flags off; signup disabled; email confirmation required |

The three history identities and stored migration statement hashes match the
approved source exactly. All earlier 82 identities remain unchanged; 85 total.

| Version | Name | SHA-256 |
| --- | --- | --- |
| `20261020120000` | `cod_shipping_checkout` | `7f7dce470bd29b25b2aec5b5cbaaefe06c43efb6a7d6c0b8f49a451bb9eaa36b` |
| `20261020160000` | `private_vps_packing_videos` | `9057b0a8cdf7fbcefa386db51abe2b19341dbf9d1db3e9e1d70d0fb220748c21` |
| `20261020200000` | `normal_cod_collections` | `691a93c3c8ca9a8cdcf403ce1da6313a223f91570748a2bb2e5512282490ade3` |

New collection/reconciliation ledgers are empty. Actual production checks confirm
RLS, no browser ledger access, service-only commands and revoked direct video
writes. All five payment settings remain false and ERP remains built-in.

## Private runtime and health

The frozen compiler dependency installation, signed-source restricted FFprobe 8.0.3
build, version check and actual synthetic video decoding passed on Linux. The
private candidate passed authorization rejection and service-sandbox file
write/fsync/read/remove plus decoder execution before SQL. The candidate stopped
before migrations. The old main process stayed selected until SQL committed.

Private root `/srv/storefront/shared/private/packing-videos` is 0700, owned by
`storefront`. The decoder is root-owned 0755 at
`/opt/commerce-tools/ffprobe-8.0.3-6136812ea6d4/ffprobe`; binary SHA-256
`77e216208f7040420819ccbdc2b294db453390e0920e24b1072923c2cc9bf38b`.
Exactly the two approved environment keys and narrow systemd write-path drop-in
were added. Base unit, original environment keys, public uploads and Caddy remain
preserved. No Supabase Storage object upload occurred.

| Public request | Observed status |
| --- | --- |
| `GET /` | 200 |
| `GET /dashboard/login` | 200 |
| Anonymous `GET /api/admin-products/list` | 401 |
| `GET /checkout` | 403, retained browse-only restriction |
| `GET /api/checkout` | 403, retained browse-only restriction |
| `GET /login` | 403, retained customer-access restriction |

These HTTP and database checks do not establish authenticated Dashboard or real
customer purchase acceptance. No owner session was manufactured or bypassed.

## Backup and retained evidence

Before the first production change, the fresh PostgreSQL17.11 read-only dump
authenticated successfully through the existing AES-256-GCM envelope.

- Encrypted bytes: 8,527,288.
- Encrypted SHA-256: `9ec6f8582335ef08a98cbe6bf2a16c13bc350d049d61feb962895a6355fa6da9`.
- Plaintext SHA-256: `c96ced427951f4e84ffba9183cb40625a550572f6c2d6088b8dcd7a190e12ce1`.
- No plaintext dump or backup key was transferred to the VPS.

Private local evidence directory:
`/Users/imac/Documents/ELcomputer/commerce-foundation-release-20261020/prepared/`.
It retains `completed.json`, `execution-intent.json`, `backup-receipt.json`,
`database-before.dump.enc`, candidate/provision/activation receipts,
`database-before-commit.json`, `database-applied.json`,
`post-deploy-database.json`, `final-verification.json`,
`health-auth-verification.json` and `backup-prerequisites.json`.

Remote evidence: `/var/lib/commerce-releases/82214df492a57126/`.
The original 0600 runtime environment and previous release `7bfe6316a1f544d8`
with its VERIFIED/output inventory remain retained. No pruning or rollback ran.
See the [reviewed manual recovery limits](commerce-foundation-release.md#recovery-and-acceptance-limits).
Old packing code is incompatible with 84; never roll back output blindly.

An extra local preflight encryption test initially left stdin open and timed out.
The test harness was corrected and authenticated its synthetic payload before
execution. It changed neither production nor the approved operator; the actual
release ran once and returned PASS without a STOP receipt.

## Exact owner browser checks

Use the existing owner account at `https://elcomputer.net`. These are functional
smoke tests, not purchase acceptance. Do not save business changes during them.

1. Hard-refresh `/dashboard/login`; sign in with the existing owner credentials.
   Expect the Dashboard with the current account and navigation.
2. Open `/dashboard/products`. Expect 561 products and working search. Open one
   original product and the owner's existing Draft; check their saved fields and
   VPS images. Return without saving, publishing, deleting or changing inventory.
3. Open `/dashboard/commerce?tab=shipping`. Expect the existing Shipping screen
   without a schema error. Open the company form; check delivery enablement,
   governorates and customer charge controls. Close without saving or enabling.
4. Open `/dashboard/orders` and `/dashboard/treasury`. Expect loaded lists or
   legitimate empty states, not access/schema errors. Do not create orders,
   start packing, dispatch, collect cash or post treasury transactions.
5. Open `/dashboard/settings`; inspect payment controls without saving. COD,
   card, PayPal, bank transfer and InstaPay must remain disabled. In a private
   browser window, confirm storefront/product images load and `/checkout` and
   `/login` remain blocked by the existing browse-only restriction.

Report PASS/FAIL for each step. For any of the four reported access problems,
include the page URL and failing request path/method/status, without bearer
tokens, cookies or customer information. Authenticated CRUD saves, camera uploads,
packing completion, COD receipts/reconciliation and real purchases remain outside
this read-only smoke and require their controlled acceptance scenarios.

Next engineering work is the four reported 403 errors, followed by activation
readiness for the **existing Paymob/PDC Quick Setup integrations**. Reuse them;
do not redevelop them. Providers remain disabled until separately authorized.
Historical WordPress identity/order/address migration remains a required launch
workstream. Verified stock, configured coverage/fees and confirmed customer access
still precede owner-controlled purchasing acceptance; UI work comes later.

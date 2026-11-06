# Historical Vodafone and Meta recovery — 5 November 2026

SMS-VF-REC-01 and MKT-META-REC-01. Recovery is complete; provider validity remains
unverified. No credentials, account identifiers, private phone numbers or token
values appear in this report. Earlier claims of missing credentials described
Nuxt configuration only and are superseded by this recovery.

Vodafone credentials: **YES**. Account ID, password, uppercase HEX hash secret,
sender and direct endpoint were recovered from `elc_sms_*`, `vsms_settings` and
`vsms_options` in both authenticated WordPress SQL snapshots. The dedicated active
WordPress plugin used the same values. Account ID requires ordinary string
serialization; the password, secret and sender match across namespaces.

The endpoint is `https://e3len.vodafone.com.eg/web2sms/sms/submit/`. The old alternate
relay value resolves syntactically to host `vsms-relay.php` and must not be reused.
Nuxt separates the base origin, Campaign `/web2sms/sms/submit` and single-recipient
Notification `/web2sms/sms/submit/Notification`. The historical submit URL does not
prove authorization for Notification, current account/sender/IP access or TLS.

The recovered fields fit Nuxt's length, sender and uppercase-secret validators.
Historical plugin code uses literal-key HMAC-SHA256 without `hex2bin`; Nuxt's
INC000081856720 implementation is unchanged. Latest archived logs contain 1,102
`SUCCESS` result rows and 1,068 `submitted` rows. These are historical submission
records, not proof of current authorization, cost or handset delivery. Historical
failures, including 9021 and 9032, are retained without replay.

Trusted-IP requirements are described in archived plugin guidance. No saved
allowlist approval, current outbound-IP confirmation, tariff/unit cost, charge cap
or delivery-status API contract was recovered. Do not invent an authenticated
Vodafone health or status endpoint. The supplied V5 review describes submission;
INC000081856720 continues to resolve its contradictory hash-key wording.

Meta: requested dataset **1680814460341996** remains the deployment target.
Four distinct opaque token candidates were recovered: WooCommerce access,
merchant and page tokens, and PixelYourSite's `server_access_api_token`. Token
types and asset permissions remain distinct. PixelYourSite recorded server API
and advanced matching enabled, but was not in the active-plugin list. Official
Facebook/WooCommerce plugins were active. Historical configured Pixel IDs differ
from the requested dataset; that dataset literal was absent from selected SQL,
matching archive code and protected home configuration. A browser ID is never
treated as a token. No candidate is labelled expired, rejected or authorized
without current evidence. The newer SQL page token differs from the original
WPvivid snapshot; all versions remain encrypted and preserved.

Historical Meta code includes event IDs and consent hooks. This does not establish
consent settings, matching browser/server receipts or successful current Test
Events. Nuxt retains its independently qualified explicit consent, GPC/DNT gates,
staff exclusion, durable event IDs and bounded Test Events controls.

Recovery sources, read as inert data:

- Authenticated `elcomputer-wordpress-current.sql.enc` and
  `elcomputerold-wordpress-current.sql.enc` under
  `/Users/imac/Documents/ELcomputer/actual-vps-reinstall-preparation-20261020/`.
- All 22 hash-pinned WPvivid parts recorded by
  `/Users/imac/Documents/ELcomputer/wordpress-fast-track-20261015/backup-verification.json`,
  including all three SQL fragments and relevant plugin/core/theme code.
- Authenticated `newelcomputer`, `elcomputerold` and `elcomputer` encrypted home
  archives under `/Users/imac/Documents/ELcomputer/clean-reinstall-backup-readiness-20261020/`;
  61 protected configuration files inspected. No additional SMS/Meta environment
  binding or requested Pixel literal was found there.
- Fresh read-only VPS inspection: historical home/WordPress paths no longer exist.
  Existing archives supply recovery; WordPress was never started or changed.

Selected values remain in AES-GCM envelopes under the ignored, owner-only
`logs/historical-integrations-20261105/` directory. The existing backup-key
mechanism authenticates source envelopes before plaintext reaches the reader.
No plaintext secret file, clipboard action or whole-configuration migration was
used. Future binding must use `credentialSecrets.js` and existing Dashboard/RBAC
contracts, while controls remain OFF; this report authorizes no production write.

Fresh Nuxt evidence confirms app `ee5dd61e2b6fd8f6`, source `573e208`, schema118,
14 attempts/sessions, 11 orders, zero funds/callbacks/proofs and four zero integrity
counters. Vodafone fields are empty; both SMS channels/provider and Meta remain
OFF. The correctly named `NUXT_CREDENTIALS_ENCRYPTION_KEY` is present. SMS/Meta
worker secrets and workers remain absent. The first presence receipt checked a
singular environment name and is superseded by `runtime-presence-corrected.json`.
MON remains eight warnings, three historical gaps, zero critical.

No replacement credentials or provider contact is currently justified. Existing
owner account records may supply IP/sender approval and tariff; Events Manager may
confirm which recovered token already has access to the requested dataset.

## Prepared acceptance boundary

The [bounded test preparation](vodafone-meta-bounded-test-preparation-20261105.md)
defines private inputs and exact limits. No provider check or transmission ran.
Current Meta/D release qualification is recorded separately when complete.

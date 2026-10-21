# Offline Paymob recovery — 2026-10-21

**OFFLINE RECOVERY PASS. Current account match and credential validity UNVERIFIED.**

Historical credentials and Paymob configuration were recovered from two preserved
WordPress SQL snapshots and the original WPvivid package. Corresponding settings
and all six credential values agree across those three sources. No production or
provider connection occurred. Nothing was configured, activated or restarted.

## Sanitized recovery summary

| Item | FOUND / MISSING | Mode and evidence |
| --- | --- | --- |
| Merchant/account reference | Profile-reference candidate FOUND; explicit `merchant_id` not separately found in inspected settings/key claims | Base64-wrapped API-key JWT contains `profile_pk`; signature and equivalence to the current merchant ID are unverified |
| Operating mode | FOUND | Main gateway enabled, mode **LIVE**; selected keys equal explicit LIVE fields. Separate TEST keys/gateway also preserved. Legacy gateway disabled |
| Secret Key | FOUND | Distinct **LIVE** and **TEST** values; matching key-prefix shapes; agree across all three sources |
| Public Key | FOUND | Distinct **LIVE** and **TEST** values; selected LIVE pair agrees with legacy settings and all three sources |
| API key | FOUND | Historical legacy authentication material, associated with the stored LIVE main configuration; do not substitute it for Nuxt's Intention Secret Key |
| HMAC secret | FOUND | `woocommerce_paymob_settings.hmac_hidden`; referenced by callback verification. Current merchant secret/validity requires confirmation |
| EGP card Integration ID | FOUND | One LIVE and one TEST card ID. Cached type/currency/mode agree with individual options, both gateway tables and generated original source filenames |
| Historical callbacks | Source-derived URLs FOUND; actual registration MISSING from accepted evidence | Main processed/response URL reconstructed below. No provider registration was inspected |
| Additional Paymob credentials in protected application configs | Not detected | Three authenticated home archives and original package inspected; no additional configured Paymob values or known key copies identified in protected config candidates |

These are historical findings. Matching backups do not prove current ownership,
permissions, revocation status, current EGP service eligibility or successful payment.
The `profile_pk` claim is a candidate account reference, not a verified merchant ID.
The API-key name claim must not be treated as a merchant legal name.

The historical LIVE integration is shared by two registry aliases, including the
disabled legacy gateway. Their modes agree. This is not a conflicting second LIVE
integration. Both individual LIVE/TEST gateway options have `enabled=yes`; the
main stored mode is LIVE. None of those WordPress flags was copied into Nuxt.

## Original plugin and settings evidence

Original active plugin: **Paymob for WooCommerce 4.1.12**,
`paymob-for-woocommerce/init-paymob.php`.

- `wp_options.woocommerce_paymob-main_settings`: enabled/mode, active and explicit
  LIVE/TEST Secret/Public fields, API key and cached integration descriptions.
- `wp_options.woocommerce_paymob_settings`: legacy enabled flag, matching LIVE
  Secret/Public/API values, integration descriptions and `hmac_hidden`.
- `woocommerce_paymob-pixel_settings` and generated per-integration settings:
  saved Pixel/gateway behavior, exact `single_integration_id` and mode.
- `wp_paymob_gateways`: preserved gateway aliases, integration bindings and modes.
- Original manual/partner setup source constructs integration descriptions with
  type, currency, mode, MOTO and 3DS flags, and stores the returned HMAC.
- `src/paymob-for-woocommerce.php` registers
  `woocommerce_api_paymob_callback` and reads the legacy HMAC for verification.

The matching whole option records establish agreement across sources. Exact IDs,
profile candidate and qualifications are in the protected owner report. Cached
Card/EGP/non-MOTO/3DS descriptions require current Dashboard confirmation.

## Historical callbacks and migration boundary

Manual/partner setup constructs both transaction processed and response callbacks
with `add_query_arg(wc-api=paymob_callback, home_url())`:

| Saved site source | Source-derived processed and response URL |
| --- | --- |
| Main snapshot and original package | `https://elcomputer.net/?wc-api=paymob_callback` |
| Archive snapshot's different saved home | `https://old.elcomputer.net/?wc-api=paymob_callback` |

These are reconstructed from code and site settings. They do not establish which
URL Paymob actually registered. The gateway also constructs a per-order
`WC()->api_request_url('wc-paymob-card')`; its exact URL depends on WooCommerce
configuration. Do not invent a registered destination from that expression.

The current Nuxt webhook and return URLs remain in the
[provider guide](provider-configuration.md#paymob-callbacks-prepare-a-controlled-cutover).
No callback was changed, probed or activated. Defer registration changes until
separately approved receiver reachability and cutover.

## Source verification and private custody

Fresh encrypted SQL sources under
`/Users/imac/Documents/ELcomputer/actual-vps-reinstall-preparation-20261020/`:

| Source | Authenticated encrypted SHA256 |
| --- | --- |
| `elcomputer-wordpress-current.sql.enc` — 466 schemas | `4c62f42b156e40cc45ccdf7ba43ef682ea7ab234362ecb53963f7e9a8ec7aefd` |
| `elcomputerold-wordpress-current.sql.enc` — 465 schemas | `2d415414ec29907d5f88d86205bd7370b33eed148cffc611687eedf75e7abcdb` |

Both plaintext/ciphertext pins passed. All 22 original WPvivid part pins passed;
bounded data reads inspected 43,949 relevant code/config files. Three encrypted
home archives under `clean-reinstall-backup-readiness-20261020` also authenticated
and matched their plaintext pins, with 65,809 bounded code/config reads. These are
scan counts with overlap, not unique files. Protected config candidates: 23 in the
original package and 61 in the home archives. No PHP/WordPress/SQL was executed.

Protected local directory, outside Git, mode0700/files0600:
`/Users/imac/Documents/ELcomputer/paymob-offline-recovery-20261021/`.

- `OWNER-RECOVERY-REPORT.md`: exact private profile/ID details, fingerprints,
  source qualifications and current-account confirmation instructions; no keys.
- `OWNER-BUSINESS-DETAILS.json`: structured private non-secret evidence; no keys.
- `owner-recovered-credentials.json.enc`: the six exact recovered credential
  values and provenance, authenticated AES-256-GCM using the separately retained
  recovery key. No new plaintext credential file exists.
- `owner-secret-copy.py`: personal selected-field clipboard helper, never echoes
  a credential. Only `--check` was used; no clipboard/credential entry occurred.
- Encrypted selected SQL, plugin/config and home evidence; no raw secret is in
  committed documentation, handoffs, chat or terminal output.

Nine new envelopes authenticated. Plaintext output scans found zero exact
recovered-credential values. Original sources were not modified or overwritten.
Existing unencrypted original backup ZIPs were preserved, not relabeled encrypted.

`RECOVERY-RECEIPT.json` SHA256:
`6a6dd45572e08369ff25d4e64dee02c597241fd4ea78d315ec6fd138260c5e0b`.

Documentation checks passed: 181 local links, diff whitespace, exact recovered-key
and private-ID exclusion, private evidence hashes/permissions and matching current
entries in both handoffs. No application code changed or production test ran.

## One next owner action

Privately compare the owner report with the **existing Paymob account in LIVE
mode**: profile/merchant reference, matching LIVE Secret/Public keys, current
HMAC and the owned active online EGP card integration. Confirm Intention/Pixel
compatibility and current mode/currency. Do not select the TEST ID by its label.
Report only **MATCHED / DIFFERENT / UNCLEAR** and field names, without values.

After confirmation, personally use the existing
[six-field protected server entry](pdc-connection-paymob-preparation.md#exact-next-owner-action-enter-paymob-privately-without-restarting).
Only LIVE Secret/Public, HMAC, confirmed LIVE card ID and both live modes belong
there. The recovered API key/TEST keys are retained historical material. Preserve
all other runtime settings/root0600 permissions and false gates. Save without
restart; no provider activation, live payment or production copy is authorized here.

PDC remains at the preceding GetProducts HTTP500 receipt; its one-run approval is
consumed and no retry occurred. Next mandatory workstream: WordPress customer
identities/old-login compatibility, private details, addresses and historical
orders into Supabase, preserving Auth UUIDs and preventing duplicates or financial/
commerce effects. Keep unrestricted signup and public purchasing disabled.

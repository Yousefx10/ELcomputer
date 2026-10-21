# Saved PDC verification and Paymob preparation — 2026-10-21

**PDC saved-state verification PASS. PDC CONNECTION BLOCKED.**
**Paymob owner entry pending. No provider request or production write occurred.**

The owner saved PDC personally and confirmed persistence after refresh. Protected,
metadata-only inspection at 09:37:38–09:38:57 UTC confirms production release
`d2d7a8029b473e4a`, schema87. The service remains active, PID25021, NRestarts0.
No deployment, restart, Dashboard save, Auth/inventory change or push ran here.

## Masked PDC results

| Check | Result |
| --- | --- |
| Production mode and exact approved API URL | PASS |
| Token and independent webhook secret | Both saved; versioned encrypted-envelope shapes valid; no plaintext/ciphertext selected |
| Company, product and pickup city | Saved values match the protected offline recovery report |
| Pickup city mapping | Exactly one match in the existing 382-city production mapping |
| Pickup contact and phone | Match recovery; phone format valid |
| Pickup address | Present, but differs from recovery beyond whitespace/punctuation; confirm the owner's current collection address privately |
| Parcel settings | Positive weight/template, Normal(1), Cairo timezone saved; actual measurements and contractual template remain owner acceptance facts |
| Provider, automatic booking, reverse pickup, COD eligibility | All false |
| Product/city caches | Both empty; no returned provider identifiers to compare |
| Shipping companies / current coverage / customer charges | None configured; no customer delivery option offered |
| Settings access | RLS enabled; anon/authenticated table SELECT denied |
| Orders, payment attempts, normal/reverse jobs, dispatches | All zero |

These checks establish saved configuration, not token validity or provider account
ownership. No secret was decrypted. Historical pickup phone ownership still needs
the owner's confirmation. The address difference is not assumed to be an error.
Do not copy a historical address over an intentional owner update.

All four disk/process outbound flags remain false. All five Dashboard payment
methods remain disabled. Public GETs for `/checkout`, `/signup` and the PDC webhook
return403. No signup, purchase or shipment was initiated.

## Why connection diagnostics stopped

The exact failed phase is **`pdc-read-access/operator-outbound-gate`**:
`shippingLiveRequestsEnabled` is false. No diagnostic request was attempted.

- Dashboard **Test connection** calls authenticated `GET GetProducts` only.
- **Sync cities/products** calls `GET GetProducts`, then `GET GetCities`.
- Both claim a local throttle and write a sanitized admin audit. Sync also writes
  bounded local caches/timestamps. They are provider-read-only, not database-read-only.
- The handler cannot create shipments or labels. It retains `settings.edit`,
  the global operator gate, exact URL/mode checks and encrypted credential handling.
- The API permits a disabled provider for diagnostics. The UI also requires
  `is_enabled=true`, an existing mismatch. Neither gate was bypassed or changed.

Do not enable the provider, edit runtime gates, call the API directly around its
guard, or redeploy to force a connection badge. Test does not fetch cities.

### Specific approval required for a lookup-only exception

The owner's current instruction requires stopping when existing gates block calls.
The private `lookup-approval-proposal.json` is a proposal, not an approved command
or an implemented alternate gate. Its requested scope is:

1. One isolated run against the pinned existing VPS, bound to this release/schema,
   the observed runtime hash and the saved-settings fingerprint. Recheck all holds.
2. Exactly one authenticated GET each to production `GetProducts` and `GetCities`.
   Reuse existing strict transport/decryption/normalization contracts. No redirects,
   pagination, automatic retries or credential-bearing command arguments.
3. Compare the saved product/city for one exact returned match. Use saved CompanyID
   as the authentication scope; responses without CompanyID cannot independently
   prove company ownership. Report counts/booleans only, never raw responses.
4. No POST, SaveShipmentEx, ExportPDF, shipment-status call, registration, settings/
   cache update, persistent gate change, runtime reload or deployment. Credentials
   may be decrypted only in VPS memory for the specifically approved GETs.
5. Stop on any changed precondition or failed response. No retry or fallback.

This requests an explicit one-run diagnostic exception to the false outbound gate;
it does not authorize charging, booking or permanent provider activation. Approval
has not been given. No executable bypass was created or used.

## PDC webhook still needs a controlled external cutover

The current receiver is **`POST https://elcomputer.net/api/webhooks/pdc`**.
It requires JSON and the independent **`X-Webhook-Secret`** header. The old WordPress
path is `/wp-json/elcomputer-pdc/v1/webhook`. PDC's registered URL/header must be
confirmed and updated before acceptance, through existing self-service controls
if available or PDC assistance otherwise. No registration was inspected or changed.

The receiver remains publicly held; GET403 is not POST callback acceptance. Its
tracking handler also requires provider enablement. Do not cut over while held.
The recovered secret has a compatible contract, but this task checked saved
presence only, not secret equality, current registration or successful delivery.

## Exact next owner action: enter Paymob privately, without restarting

Quick Setup → **Commerce & Payments → Paymob → Open payment settings** opens
`/dashboard/settings?tab=payments`. That screen controls Card/fee, not credentials.
Keep Card disabled. Use the existing private server console personally:

```sh
sudo stat -c '%U %a %n' /etc/storefront/runtime.env
sudo nano /etc/storefront/runtime.env
```

The metadata must show root/600. Stop if it differs. Edit the existing file;
do not replace it. Add or replace each of these six assignments once:

| Setting | Private owner input |
| --- | --- |
| `NUXT_PAYMOB_SECRET_KEY` | Existing live Intention Secret Key |
| `NUXT_PAYMOB_PUBLIC_KEY` | Matching live Public Key |
| `NUXT_PAYMOB_HMAC_SECRET` | Existing merchant HMAC secret |
| `NUXT_PAYMOB_CARD_INTEGRATION_ID` | Owned live online EGP card integration ID |
| `NUXT_PAYMOB_MODE` | `live` |
| `NUXT_PAYMOB_CARD_INTEGRATION_MODE` | `live` |

Use properly quoted single-line values. The current four credential/ID inputs are
absent on disk and in the process; both modes default to test. Preserve every
other line/value, origin, Supabase setting, shipping encryption key, private path,
wallet registry and file ownership/mode. All four effective runtime gates stay false:
`NUXT_PAYMOB_ENABLED`, `NUXT_PAYMOB_LIVE_REQUESTS_ENABLED`,
`NUXT_SHIPPING_LIVE_REQUESTS_ENABLED`, `PDC_LIVE_REQUESTS_ENABLED`.

Save with Ctrl+O, Enter, then exit Ctrl+X. Repeat the metadata-only stat check.
Do not restart, reload, deploy, test payment or change a callback. Reply only
**“Paymob file saved; not restarted.”** Masked verification must confirm modes,
presence, shapes, permissions and preservation of every other runtime setting
before a later separately controlled runtime reload. No reload is authorized here.

Never put credentials in commands, terminal recordings, screenshots, chat or Git.
Runtime storage is plaintext protected by root/0600, not Dashboard encryption.
The [account-entry guide](provider-configuration.md) supplies merchant-screen and
key/mode details. Existing nano availability passed this inspection.

## Retained evidence and roadmap

Protected local evidence, directory0700/files0600:
`/Users/imac/Documents/ELcomputer/pdc-saved-paymob-preparation-20261021/`.
It contains masked snapshots, runtime preservation hashes, the approval proposal,
private owner instructions and `TASK-RECEIPT.json`. No credential values, ciphertext
or private business identifiers were written there by these checks.

Receipt SHA256: `c35540c06129c444cd8c2791037471e5a75e5f7eeed29bd629f678b851378dde`.
Proposal SHA256: `f196e9f5d5895ea70795bfefb4ec673325ed8193fb439d4510e59f031f043da3`.
Saved masked evidence SHA256: `c889ffd18be964ca0540d7c18f07cac7ba27aec9236c5497bf0ab31dddef5994`.
Supplemental evidence SHA256: `5de2c140a77e8da6cdf9877ad0d85ab455869747899aca95030151633fc6def1`.

No SaveShipmentEx, ExportPDF, provider-side mutation, environment write, SQL write,
Auth change, inventory change, new transaction, restart, deployment or push occurred.
No existing secret, callback, media or historical data was modified.

Validation passed: diff whitespace, 169 local document links, evidence hashes,
private directory/file permissions and matching current entries in both handoffs.
No application code changed; no build or commerce test was needed.

Complete personal Paymob configuration and approved read-only PDC diagnostics.
The next mandatory workstream is
[WordPress migration](wordpress-customer-migration.md): customer identities,
old-login compatibility, private details, billing/shipping addresses and historical
orders into Supabase. Preserve existing Auth UUIDs, prevent duplicate identities
and prevent imports from triggering commerce or financial transactions. Complete
that work before unrestricted signup. Controlled payment/shipment acceptance and
public purchase activation retain their separate owner-approval gates.

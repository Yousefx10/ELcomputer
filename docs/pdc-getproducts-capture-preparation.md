# Bounded PDC GetProducts capture — preparation, 2026-10-21

**PREPARATION PASS. Approved attempt consumed; archive verification PASS.**

The owner executed the single GET: HTTP200, RESPONSE_SCHEMA_REJECTED. Independent
[archive analysis and complete Codex 1 handoff](pdc-getproducts-capture-analysis.md)
are complete. The exact rejected field remains UNKNOWN because redaction removed
row keys/values. **Never rerun pre/once or use this consumed approval again.**

The owner approved the final seal below. [Independent staging passed](pdc-getproducts-capture-staging-receipt.md)
at 13:42:42 UTC. The agent did not execute a provider request or the remote helper.
The preparation evidence below records the original local-only phase.

Paymob restart acceptance is closed and unchanged. This prepares one new,
separately approved PDC diagnostic. The earlier lookup approval is consumed;
never rerun its wrapper. The HTTP500 cause remains unknown until new evidence
is obtained. The helper is now staged; its execution remains owner-only.

## Exact scope

| Boundary | Proposed action |
| --- | --- |
| Provider request | At most **one authenticated GET** to `https://clientsapi.pdc-eg.com/api/ClientUsers/V6/GetProducts` |
| Credentials | Existing saved production AccessToken and CompanyID, opened only in VPS process memory; no owner secret entry or credential replacement |
| Transport | Native HTTPS, TLS validation, fresh connection, no proxy environment, no redirects followed, no retries, no request body |
| Limits | Eight-second total request/body deadline; 16 KiB header limit; 64 KiB captured body limit; at most 2,048 characters in the redacted body projection |
| Other PDC calls | **None**, including GetCities even after success, tracking, shipment creation, labels, COD, reverse pickup or callbacks |
| Other changes | No enablement, Dashboard save, cache update, Auth/data/inventory change, deployment, migration, service operation or Caddy change |

This is a standalone root-console exception for one lookup. All four saved/running
outbound gates and all five payment flags must stay false. Hosted signup and
public signup/checkout holds remain closed. PDC enablement, automatic booking,
reverse pickup and COD eligibility must remain false. No Paymob credential or
restart revalidation is included; only the required disablement guards are read.

Preflight uses bounded, fixed-target GETs only to the existing Supabase PDC settings
projection, payment booleans, Auth settings and existing EN/AR signup/checkout holds.
The PDC projection excludes the webhook secret, pickup contact/address and customers.
Runtime, service/unit loading, approved account-ID fingerprints and saved-token
envelope are checked. Shipping-secret decryption and evidence-encryption readiness
are checked in an isolated child without making a provider request.

Preflight records a root-only checkpoint, valid for 15 minutes. The actual attempt
rechecks state against that checkpoint, then exclusively creates a consumed marker
**before** dispatch. A crash or uncertain result consumes the attempt too. No
overwrite, reset, automatic retry or alternate endpoint is provided.

## Evidence and interpretation

The unmodified application lookup/header/decryption/normalization helpers are
reused in an isolated Node process. A restricted fetch wrapper permits only the
fixed GET and captures its response before the application's generic error mask.
No Dashboard lookup endpoint or Nuxt/Caddy proxy is invoked.

| Evidence | Safe interpretation |
| --- | --- |
| Direct upstream HTTP status | A received5xx originates upstream of this diagnostic, rather than the Nuxt public API's generic502. It does not prove the provider's internal cause. |
| HTTP401/403 | Authorization rejected for this request; do not automatically replace credentials. |
| 5xx with recognized authentication terms | Authentication hint only; cause remains unconfirmed. |
| 2xx with invalid JSON or unsupported shape | Separate response-parsing/schema classification, using the same captured bytes without a second request. |
| Valid product list | Compare the saved Product ID privately; any echoed CompanyID must match. Missing company echo does not prove account ownership. No city call/cache write follows. |
| Network/TLS failure, partial/oversized/encoded body | Report a bounded failure or unknown status. Never increase limits or retry automatically. |

The encrypted report contains HTTP status, classification/failure layer, safe
authentication/error hints, content-type category, truncation/incomplete-body flags,
and a bounded **redacted response-body structure**. Unknown keys and all free-form
values are removed. Only fixed exception types, redaction markers and the already
observed HTTP status can survive the body projection. Raw text, stack traces,
contacts, addresses, IDs, tokens and private configuration are not retained.

Only request/correlation header names are inspected: `x-request-id`,
`x-correlation-id`, `request-id`, `traceparent`, `x-ms-request-id`, `cf-ray`.
Recognized opaque formats are retained only inside encrypted owner evidence.
Private-value matches are redacted; unsupported formats are withheld with a
fingerprint. Cookies, authorization, redirect locations and arbitrary headers
are not retained. Console/chat output contains no correlation value or body.

This may establish the failing layer without establishing the exact underlying
cause. Do not report an outage, invalid token, account ownership or application
defect unless the captured evidence supports it.

## Temporary instrumentation and protected evidence

Preparation artifacts are LOCAL ONLY, outside Git, directory0700/files0600:

`/Users/imac/Documents/ELcomputer/pdc-getproducts-capture-preparation-20261021/`

The reviewed `run.py` embeds the standalone bundle and an evidence-recipient public
key. Its local diagnostic RSA3072 private key remains in that protected directory;
it is never staged or printed. This is a new evidence key, not a provider-key or
shipping-master-key rotation. Retain it: losing it cannot be fixed by another GET.

Only after separate approval, stage `run.py` as `/root/pdc-capture/run.py` with
root0600 inside an absent, exclusively created root0700 directory. Use pinned SSH,
exclusive/no-follow creation, then independent full-byte/hash/ownership/mode readback.
Stop on an existing target or mismatch; do not overwrite or repair it automatically.

The standalone child ends after its one bounded operation. It never instruments
the running app. Only encrypted `RESULT.enc` and fixed metadata receipts/markers
remain root0600. Encryption is RSA-OAEP-SHA256 wrapping an ephemeral AES256-GCM key.
No raw body or plaintext credential/evidence file is created.

After a reviewed result, independently copy/read back the encrypted artifact to
the protected local directory and authenticate it using `owner-report.mjs --verify`.
The reader's default summary prints fixed status/classification fields only.
Its optional owner view requires a personal Terminal TTY and shows only the
redacted body and permitted opaque IDs. Do not paste those IDs or private reports
into chat or Git.

Cleanup is explicit, after archive verification. A root0600 `ARCHIVED.json` must
bind the independently verified encrypted-file hash, authenticated envelope and
helper hash. The `retire` command then removes **only the standalone `run.py`**.
Consumed markers and encrypted evidence remain protected for audit. No service
restart, gate restoration or application rollback is needed. On failure, retain
everything and stop; cleanup is never automatic.

## Recorded owner approval/execution procedure — consumed

**Historical procedure only. Already executed; never repeat pre or once.**

The received owner approval identifies this exact seal:

`a453c1c120966eba492ebd0e394cae56f4562d744ca0d0271644e446a79f899a`

Recorded approval scope:

> I approve the sealed PDC capture: staging the verified helper and one authenticated
> GetProducts GET with existing saved credentials, all gates unchanged, no GetCities
> and no retry. Approval seal: a453c1c120966eba492ebd0e394cae56f4562d744ca0d0271644e446a79f899a.

After approval and verified staging, the owner used the following procedure with
Shipping edits paused. These recorded commands are not a new execution instruction.

```sh
python3 -I -S -B /root/pdc-capture/run.py pre
```

Expected: `PDC_CAPTURE_PREFLIGHT PASS`. This performs zero PDC requests.
Only after that PASS, within 15 minutes:

```sh
python3 -I -S -B /root/pdc-capture/run.py once --approved
```

Expected output structure: `ONE_GETPRODUCTS_ATTEMPT PASS`, `HTTP_STATUS` with a
number or UNAVAILABLE, `CLASSIFICATION` with a fixed code, `ENCRYPTED_EVIDENCE PASS`,
`STATE_PRESERVED PASS`, then `GETPRODUCTS PASS` or `GETPRODUCTS BLOCKED`.
For a captured500, the capture can complete while GETPRODUCTS remains BLOCKED.
Stop on BLOCKED, interruption, missing output or uncertainty. Do not repeat `pre`
or `once`, change credentials, run Test/Sync or proceed to GetCities.

If a consumed attempt needs metadata inspection, this reads files only:

```sh
python3 -I -S -B /root/pdc-capture/run.py status
```

Return only the fixed console output. The agent then verifies/archives the encrypted
evidence without contacting PDC again. After a separately reviewed archive/cleanup
acknowledgment, the short retirement command is:

```sh
python3 -I -S -B /root/pdc-capture/run.py retire
```

Expected: `INSTRUMENTATION_RETIRED PASS`. Never use retirement as automatic recovery
from a failed phase. The CLI `--approved` flag alone is not owner authorization.

## Evidence, references and roadmap

Eighty local safety cases PASS: 34 capture/privacy/native-transport cases,
41 runner/gate/custody cases, four evidence-reader cases and one actual isolated
Node-loader dry run. All used fixtures; real provider requests and production
connections were zero. Native production execution is not claimed.

Final private plan: `plan-reviewed-final.json`. Earlier unapproved local draft
`plan-reviewed.json` and its seal are superseded; do not stage or execute that draft.
Final helper SHA256:
`f3b098765c075a279ed39001293ee518587cefecea37b83623fc9518dcfacb8b`.
`PREPARATION-RECEIPT-final.json` SHA256:
`2353b9ce892489055de50c131afe4e3e506ae5fbe0ba321eaa5cd581067f2c60`.

The supplied **Customer Courier Integration Test V4-1.pdf**, page8, documents GET
GetProducts with AccessToken/CompanyID and id/name responses. The supplied
**Customer Webhook Integration-1.pdf** describes a separate callback contract.
Both references are pinned privately. Their shipment/label/testing/registration
instructions are protocol guidance, not permission to perform those actions.
No sample credential, account, contact, inventory or fee is adopted from them.

After diagnosis, prioritize controlled provider acceptance and mandatory WordPress
customer identity/old-login compatibility, private profiles, addresses and historical
orders. Preserve Auth UUIDs, avoid duplicates and prevent imported financial/commerce
effects. Checkout and unrestricted signup remain disabled until their separate
acceptance and migration prerequisites are met.

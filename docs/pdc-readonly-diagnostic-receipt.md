# Approved PDC read-only diagnostic — 2026-10-21

**BLOCKED at GetProducts: HTTP500. Stopped after one authenticated GET.**
Subsequent [local evidence review](pdc-http500-local-review.md) found no established
cause. No retry occurred. Paymob entry and the
[controlled restart](paymob-controlled-restart-receipt.md) subsequently completed;
the Paymob-entry next-step section below is historical, not a new instruction.
The [new bounded capture preparation](pdc-getproducts-capture-preparation.md) is
separate: its final seal is approved and [helper staging passed](pdc-getproducts-capture-staging-receipt.md).
Owner console execution is pending; it does not revive this consumed wrapper.
Production remains release `d2d7a8029b473e4a`, schema87, with PDC disabled.
The owner approved the specific one-run exception documented in the
[preparation record](pdc-connection-paymob-preparation.md). That approval is consumed.
Do not rerun the wrapper, repeat the failed request or continue to GetCities.

## Sanitized execution evidence

| Operation | Result |
| --- | --- |
| `GET https://clientsapi.pdc-eg.com/api/ClientUsers/V6/GetProducts` | One attempt; HTTP500 at 09:55:55 UTC; stopped |
| `GET https://clientsapi.pdc-eg.com/api/ClientUsers/V6/GetCities` | Not attempted after the first failure |
| Returned Product ID / Pickup City ID | Not validated; no accepted lookup response |
| Authentication validity / reason for HTTP500 | Not established; HTTP500 does not prove invalid credentials or a provider outage |
| Retries / shipment requests / label requests | Zero |

No raw response, Access Token, webhook secret, encryption key, private identifier
or credential-bearing header was printed. The transport rejected the non-success
response before normalizing a product list. No additional request investigated it.
Saved company/product/city still match recovery; that local match is not live
provider acceptance. Company ownership cannot be inferred from the error response.

The isolated diagnostic reused the existing lookup, encryption and normalization
helpers. Its wrapper allowed only the two exact GET operations, with normal TLS,
strict production URL/mode, redirects refused, existing 8-second/1MiB/5000-row
bounds and no retry. Token decryption happened only in VPS process memory. No
webhook secret was read or decrypted for the provider request.

Fifteen offline safety cases passed before execution: exact GET scope, immediate
stop on authentication/response/ID failure, malformed/duplicate/paginated/oversized
response rejection, credential envelope handling and refused preconditions.
These are diagnostic safety checks, not merchant acceptance tests.

## Preserved state

Fresh pinned SSH and read-only database preconditions matched the approved runtime
hash and saved-PDC fingerprint. The same values remained after the blocked run:

- Runtime root/0600; whole-file SHA256
  `437f42c9b5be10b906313e947f1020fb474c45935880c0dceb3814fe56fe1968`.
- Saved PDC row SHA256
  `dfa35b3d44bbf8dd15ff51fc77b5c0ce8a77999691fd91ea5063385305f7be61`.
- Service active, PID25021, NRestarts0; no restart or release activation.
- All four runtime outbound gates remain false. PDC provider, automatic booking,
  reverse pickup and COD eligibility remain false. All five payment methods remain off.
- Orders, payment attempts, normal/reverse shipping jobs and dispatches remain zero.
  Settings RLS and denied anon/authenticated SELECT remain intact.

No database, Dashboard setting, cache, environment, address, provider registration,
webhook activation, inventory, Auth, media, Caddy or application change occurred.
Local private diagnostic metadata and this documentation are the only task writes.
No SaveShipmentEx, ExportPDF, booking, COD/reverse operation or payment request ran.
No deployment, restart or Git push ran. The Dashboard connection/cache status was
not made green by this isolated check.

## Pickup address difference resolved

This is **Arabic spelling variation**, rather than whitespace/punctuation alone.
The historical address uses **HEH (`ه`)** where the saved address uses
**TEH MARBUTA (`ة`)**. Normalizing only that spelling variant makes the remaining
normalized address text identical. Numeric components are identical. No material
location change was found; neither address was changed by the agent.

The Dashboard save record is dated 09:27:33 UTC, with live/automatic flags false.
Its address validator accepts the entered string and trims outer whitespace only;
it does not translate, correct or substitute address details. Audit metadata does
not record why the owner chose the spelling. Exact intent and physical pickup
accuracy remain owner facts, not an inferred application correction.

Exact address strings and a private comparison are retained only in the owner-only
local `OWNER-PICKUP-ADDRESS-COMPARISON.md`; neither string is included in Git.

## Next priority: protected Paymob entry

The four Paymob credential/ID inputs remain absent; both modes still default to
test. The existing environment file and all other settings were preserved.
The owner should personally follow the
[six-field private entry instructions](pdc-connection-paymob-preparation.md#exact-next-owner-action-enter-paymob-privately-without-restarting):
live Secret/Public keys, HMAC, owned live online EGP card integration ID, and both
Paymob modes `live`, in existing root0600 `/etc/storefront/runtime.env`.

Keep all gates and Dashboard Card off. Save without restarting or deploying.
Reply only **“Paymob file saved; not restarted.”** Then check masked presence,
shapes, modes, permissions and preservation hashes before any controlled reload.
Do not send credential values, file contents or screenshots to Codex.

The PDC exception is exhausted. Further provider network investigation needs a
separate bounded authorization; this receipt supplies no retry permission.
PDC callback registration, reachability, parcel/template acceptance, actual delivery
coverage and customer prices remain outstanding. No webhook cutover was attempted.

## Evidence and roadmap

Protected local directory0700/files0600:
`/Users/imac/Documents/ELcomputer/pdc-approved-readonly-diagnostic-20261021/`.
Retained: offline checks, source/bundle hashes, exclusive run marker, masked
preflight, sanitized request receipt, database before/after evidence and private
address comparison. Existing preparation/recovery artifacts remain untouched.

`FINAL-RECEIPT.json` SHA256:
`0acf036aac3b0d3d37742c01ed40aae4e9cd5611118b3d2fba6443dd93ccc41f`.

Documentation validation passed: diff whitespace, 181 local links, private-address/
credential-pattern exclusion, evidence hashes/permissions, matching handoff entries
and exact database before/after equality. Only documentation changed in Git.

The next mandatory workstream remains WordPress customer identities and old-login
compatibility, private profiles/details, billing/shipping addresses and historical
orders into Supabase. Preserve existing Auth UUIDs; prevent duplicates and all
historical-import financial/commerce effects. Keep unrestricted signup disabled.
Controlled payment/shipment acceptance and public purchases need separate approval.

Current update: [Ramses ID10 is verified](pdc-ramses-egp101-readiness.md).
The encrypted capture is consumed; missing cityID/cityName aliases caused rejection.
The owner-authorized profile city update is complete; all other address fields remain.
Fresh actual-validator and both-line checks pass. EGP101 setup/access approval is next.
No additional provider GET, cache/rate/gate change or app deployment is required now.
Public purchasing remains closed. Earlier evidence below is historical.

# Single PDC city lookup consumed — 2026-10-23

**OWNER CHECKOUT BLOCKED. EGP101 remains the approved payable target.**

The owner approved one GetCities GET under this seal:
`60117c9bf0f9051e50c885f0cc41b3dca2cf2b8a3f20c5d89d6aacb41fe67379`.
It executed once. The approval is consumed; never rerun it.

| Observation | Result |
| --- | --- |
| Provider requests / retries | One / zero |
| HTTP response |200;28349 bytes |
| JSON reader | Completed before the recorded failure stage |
| Recorded rejection stage | `EXISTING_CITY_SCHEMA_AND_COMPLETENESS` |
| Exact cause | Unknown: stage also includes empty rows and company-echo checks |
| Verified destination name / ID | None |
| GetProducts | Not attempted |
| Database, profile, cache, gate changes | None |
| Orders, intentions, charges or bookings created by this operation | None |
| Runtime and PDC settings preservation | PASS |

Read-only remote status independently confirms one attempt, result and preservation marker.
No uncertain retry or additional provider request followed.
The approved receipt did not retain raw response or sufficient shape evidence.
Its shared rejection stage cannot identify the failed check offline.
Do not infer unsupported city aliases, bad credentials or an application defect.
The first instrument's receipt was too limited for this diagnosis.

## Exact next authorization

The [encrypted capture packet](/Users/imac/Documents/ELcomputer/owner-checkout-route-20261023/city-schema-capture-1/AUTHORIZATION-PACKET.md)
is prepared and unexecuted:

> Approve one PDC GetCities encrypted-response capture only.
> Seal: 4427582ccbde14541ee1362bdf6eda2d4525867cbb30f454a04b326f8131dde5

This permits at most one further GET and private encrypted response evidence.
It permits no retry, GetProducts, database/profile/cache write, gate change,
payment, shipment, credential change, restart, deployment or Git push.
The old approval cannot execute this new plan.

The body is bounded to1MiB and encrypted in memory before retention/output.
AES256-GCM evidence uses RSA3072-OAEP-SHA256 key wrapping.
The recipient private key remains local with0600 permissions.
This evidence key does not change provider credentials or production settings.
Only the public key reaches the VPS; no plaintext response is logged.
Request credentials remain in memory; no customer address is sent.
Transport retains exact URL, TLS verification, GET-only,8-second deadline,
redirect/cookie/body refusal and no automatic retry.

The new diagnostic separates JSON parsing, extraction, normalization, company echo,
pickup and destination checks. Unevaluated stages remain `NOT_EVALUATED`.
It retains encrypted evidence even when a later validation step fails.
A captured response is not an accepted city mapping.

Twelve new offline cases passed, including encryption/decryption and a malformed
company echo after successful normalization. They sent no network request.
Fresh read-only target preflight and independent seal/input/approval checks passed.
Neither the new capture nor a remote capture marker exists yet.
No completed application tests, build or deployment were repeated.

## Coordinated setup after city evidence

The actual destination remains Al Azbakeya, Cairo, Egypt.
The saved mobile, street and both lines need no change from this result.
No profile correction has been applied or justified.
Once authoritative coverage is established, prefer one exact shipping-city alias
for the saved destination, preserving its physical location and profile fields.
An alternative provider district name requires evidence of the same service area.
Never substitute a nearby district merely to pass validation.

Prepare one coordinated review with separate approvals for production setup
and restricted payment access; keep shipment authorization later.
The setup covers canonical city cache, accepted products36/40 cache, one exact
mapping row and the existing company's customer fee100/Cairo eligibility.
Reuse accepted GetProducts evidence; preserve all unrelated data and inactive tariffs.
No actual city ID or executable mapping delta is fabricated while evidence is missing.

Payment access binds selected `i***@elcomputer.net`, TESTproduct2026/Default,
quantity1, saved-address hash and10100 minor units for at most one hour.
Normal opening/closure Caddy policies already passed172 local proxy checks.
Public purchasing/signup stay off; only the owner performs normal checkout/card entry.
Retain signed late Paymob callbacks, verification keys and owned order/status reads
after outbound initiation closes. Do not manually mark paid or retry uncertain outcomes.

The approved total remains item1 + customer delivery100 + card fee0 = EGP101.
Carrier-cost uncertainty is deferred to the separately approved shipment.
It does not restart tariff work or block preparing the payment scope.
After real payment and Dashboard packing, confirm private parcel/value/carrier terms
before approving one REF/booking/AWB/private PDF/bounded poll. No refund/reverse.

Private consumed evidence remains in `../owner-checkout-route-20261023/`.
The unexecuted capture is isolated in `city-schema-capture-1/`.
Both original sealed instruments and all historical handoffs remain preserved.

No Git push was issued by this agent. Git recorded an external push of the prior
local branch at20:25:49 Riyadh time, before this operation; actor is not attributed.
This follow-up uses `local/owner-checkout-city-followup-20261023` without an upstream.

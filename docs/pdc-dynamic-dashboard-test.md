# Dynamic PDC Dashboard test — prepared boundary

Status: **NOT EXECUTABLE. NO BOOKING AUTHORIZATION ISSUED.**

The corrected client is deployed on release `2573cdf1504bf559`. Static production
booking already succeeded as AWB `EDC17983113EG`. Dynamic customer/pickup fields
and the normal Dashboard flow still require a separately authorized acceptance.

## Current blocker

A narrow, read-only database check after deployment found no paid, packed,
selected-PDC order without an existing job or dispatch. This is a candidate
check, not proof that every existing order has been fully assessed.

The original order `ORD-20261023-8C0C964CBD` remains paid and ready to deliver.
Its job and private dispatch remain `uncertain`, attempt_count1, with the original
reference and no local AWB. The owner-reported cancellation of the engineer's
static shipment does not authorize resetting this customer-order barrier.
Do not choose it for another booking, recover a dummy AWB as its fulfillment,
change its reference or repeat payment.

Private check: `../pdc-client-fix-release-20261024/dynamic-test-readiness.json`.
No PDC call or database write was made by this check.

## Required exact-order packet

The next action is to select another existing paid order for read-only eligibility
review. Do not create or charge a replacement order as part of this preparation.
The owner need provide only its order ID/number, not personal data in chat.

Once an eligible packed order is identified, prepare one concrete authorization:

1. Bind its saved payment, packing evidence, selected PDC service/city and absence
   of any earlier booking/dispatch. Preserve all other orders and incident history.
2. Load genuine recipient fields from that saved order and pickup fields from
   protected PDC settings through the normal application builder. Validate them
   privately; show only redacted fields and fingerprints in the review packet.
3. Keep Product40, weight-only fields and genuine saved monetary values. Any test
   weight/value override needs explicit approval; do not substitute static names,
   addresses or phones. No dimensions, cookies or pickup calls/flags.
4. Persist the fresh `ORD-<selected order UUID>` reference and one-use dispatch
   intent before exactly one `SaveShipmentEx`. Reject any conflicting reference,
   prior job, consumed intent or changed order/settings fingerprint.
5. Specify the minimum temporary Dashboard runtime/ingress scope and closure
   needed for that exact authenticated staff/order action. Existing public and
   provider gates remain closed until separate explicit authorization. Do not
   bypass RBAC/RLS or globally enable automatic queues.
6. Review one booking, matching-AWB persistence/private PDF and one explicitly
   dated status lookup as distinct budgets. The normal booking path retrieves
   its PDF after creation; include that operation in the authorization.
7. Capture protected request/response, HTTP status, trace ID, time, AWB and exact
   reference. Stop immediately on uncertainty, with no automatic booking retry.
   The owner verifies Dashboard visibility and manually cancels any diagnostic.

No live execution command or approval seal can be issued until the order,
genuine values and temporary access/closure scope are concrete. Application
deployment approval does not authorize this future provider operation.

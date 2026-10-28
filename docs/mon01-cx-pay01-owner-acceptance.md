# MON-01 and CX-PAY-01 scoped owner acceptance

Recorded 28 October 2026. Production `acfc97b72fe85237 / schema98`.

| Component | Acceptance | Evidence boundary |
| --- | --- | --- |
| MON-01 Dashboard operation/access | OWNER ACCEPTED | Owner says it works and reports no problems. Read-only API200 and fresh12:20:06Riyadh report independently support operation. |
| Understanding the monitoring panel | EXPLAINED; not assumed accepted | Owner requested an explanation. |
| Truthful unpaid-order wording | OWNER ACCEPTED, observed scope only | Owner saw Order awaiting payment and Payment is not confirmed. No Paid/Completed claim was reported. |
| CARD-field rendering / Paymob SDK | NOT EXERCISED / NOT ACCEPTED | Owner clarified the clicked button was Confirm checkout. The separate Open secure payment action was not confirmed. No renderer failure is established. |
| Successful payment / 3DS / callback delivery | NOT EXERCISED in this acceptance | Preserve earlier genuine payment evidence; do not create another charge. |
| Merchant Inquiry / Pay Again | NOT IMPLEMENTED / NOT ACCEPTED | Credential-independent preparation only. Owner confirms no Inquiry API key identified. |
| Customer order/payment email delivery | REQUIRED / NOT ACCEPTED | Separate CX-EMAIL-01 task. Preparation does not prove delivery. |

Confirm checkout saves an order. CARD fields require the separate Open secure
payment action. A page refresh is not evidence of success, failure or provider
nonpayment. Existing attempts remain held until qualified reconciliation.
No existing order was reopened, retried, charged, cancelled, refunded or fulfilled.

## What the monitoring panel means

MON-01 checks every five minutes; the visible panel refreshes approximately every
minute. Refresh reads the existing report and does not run a payment operation.

| Label | Meaning |
| --- | --- |
| Last successful check | Latest monitoring cycle that completed successfully. |
| New paid orders at last check | Newly detected paid-order staff alerts during that check; not the total number of paid orders. |
| Orders requiring staff | Paid orders with packing/shipping/fulfillment work still outstanding. |
| Unresolved exceptions | Payment or operational conditions requiring review. These are not automatically provider-declared failures. |
| Needs review | At least one warning exists, including an overdue payment whose provider outcome is unknown. |
| Critical | An integrity or operational problem requiring urgent staff investigation. |

At the read-only12:20Riyadh check, the two payment warnings are overdue2649 and
locally cancelled/abandoned3149, both provider-UNVERIFIED. The two staff backlog
rows are paid orders still needing staff work. Zero new paid alerts does not mean
there have never been successful payments. The panel never retries or refunds.

Acceptance does not remove those warnings or mark provider outcomes confirmed.
WOLF remains Processing; the older paid backlog remains open. Historical journal
gaps are not retroactively repaired. Optional MON email stays OFF; Auth SMTP is
separate and untouched. Original shared purchasing-close budget1 remains unused.

The owner authorizes preparation of the next P0 within these narrow accepted
components. No broader checkout/payment/recovery acceptance or production change
is inferred. No new deployment approval is requested or issued here.

Latest queued customer features: COD, homepage Add to Cart, saved checkout address,
LOC-01 checkout AND profile selectors, navbar username; MIG-04 remains later.
All original32/DTR-33/STOR-01/deferred work remains open.

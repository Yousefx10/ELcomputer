# Beta payment cancellation and manual refunds

No real refund, void or charge was issued during preparation.
Keep transaction559384846 and all existing orders unchanged.

Paymob documents Dashboard refunds against successful transactions. Full and
partial refunds return money to the original method, within the captured amount.
The Dashboard opens the transaction, then its Refund dialog. Void is a separate
pre-settlement card action when available. Merchant permissions and entitlement
must be checked read-only on this account before paid public beta.
Sources: [Refund](https://developers.paymob.com/paymob-docs/developers/manage-payment-apis/refund),
[Void](https://developers.paymob.com/paymob-docs/developers/manage-payment-apis/void),
[Dashboard permissions](https://developers.paymob.com/paymob-docs/getting-started/new-dashboard).

## Unpaid and uncertain orders

The expiry worker handles old, unpaid normal card orders only. It serializes
against settlement and releases real allocations once. Special orders with no
allocated stock never create returned units. Paid orders, completed packing,
existing dispatches and uncertain unpersisted intentions require review instead.

Review every15 minutes during beta. Match the original application order, attempt,
Paymob order and transaction in the merchant Dashboard. An expired browser page,
timeout or local failed status does not prove no money moved. Do not retry a charge
or create a replacement intention to resolve ambiguity. Record the decision and
evidence privately; close purchasing if unresolved exceptions cannot be staffed.

Late signed success for a cancelled order records review, without fulfillment.
Refund or otherwise reconcile that actual payment before closing the exception.
The application cancellation does not revoke an already issued provider session.

## Manual full refund procedure

1. Obtain approval for the exact order, transaction, full amount, EGP currency and
   reason. Put fulfillment on hold. Never choose the original acceptance payment
   as an incidental refund test. Partial refunds need a separate reviewed procedure.
2. Create one private operation record using the CSV fields below. Record original
   paid amount, prior refund total and evidence fingerprint. Check whether this
   operation or any previous full refund already succeeded.
3. In the LIVE merchant Dashboard, match transaction, provider order, amount and
   currency. Inspect its current payment/refund state and permission. The owner
   executes one approved Refund action, or the separately approved Void action
   if appropriate and available. Codex performs no money action in this milestone.
4. Record the provider operation/reference, amount, time, operator and outcome.
   A timeout or uncertain result stays `uncertain`. Inspect the original transaction
   before another action; do not resubmit automatically.
5. Reconcile the confirmed refund against the original payment and operation log.
   Only then set the application's final order status and record the verified
   provider reference in the existing admin audit/operational evidence. The original
   successful payment remains historical evidence. Changing an order status does
   not send money. Current callbacks do not process refund/void events automatically.
6. Confirm the outcome privately to the customer. Do not promise a bank posting
   date. Use existing Returns controls for actual allocated units when appropriate;
   an unallocated backorder has no physical stock to return.

Store the append-only operation log and provider evidence on private VPS storage,
outside public uploads and source control. Keep evidence hashes and reviewer signoff.
Do not store card numbers, security codes, keys, full callbacks or pasted credentials.
The separate manual log is required because the application has no refund API or
automatic refund ledger reconciliation. Daily finance review closes that boundary.

```csv
operation_id,order_id,original_transaction_id,currency,amount_minor,reason,status,provider_operation_id,provider_confirmed_at,operator,reviewer,evidence_sha256
```

Allowed operational states: `prepared`, `submitted`, `uncertain`, `confirmed`,
`reconciled`, `rejected`. Corrections append another record; preserve the earlier
evidence. Never label a refund complete from an application status alone.

## What the owner must verify manually now

1. Select LIVE mode and the intended merchant account. Open existing transaction
   559384846 read-only and match its original order, EGP amount and successful state.
   Do not create another payment or use this transaction as a refund test.
2. Confirm that your user role permits refunds and that the Refund action is
   available for that payment. Verify remaining refundable value from the current
   Dashboard, without pressing Refund or submitting any operation.
3. Inspect Void availability only when the payment is eligible before settlement.
   Its absence for an already settled payment does not imply refunds are unavailable.
   Report refund permission and any account restriction; no Refund/Void action runs.

Until those observations are supplied, LIVE merchant refund readiness remains
UNVERIFIED. Documentation establishes a supported process, not this account's access.

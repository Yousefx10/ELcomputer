# Paymob order640878234: merchant inquiry and Beta checkpoint — E94

**Provider outcome: STILL UNCERTAIN. PUBLIC BETA: WARNING.**
Local ledger checkpoint through **27 October2026,21:51:28 Riyadh**.
Order **ORD-20261027-A5FC5269EA**, EGP3149; owner-reported incomplete friend test.
It is not counted as a verified genuine public customer sale.

One read-only GET used the securely configured LIVE Secret Key against Paymob's
intention retrieval route documented by its own SDK. **HTTP405 Method Not Allowed**;
no transaction history or payment status was obtained. No raw response, credential,
customer/card data or client secret was exported. No SDK logging of headers or
responses was used. No payment, refund, void, capture, callback replay or initiation
request occurred.405 does not establish paid, unpaid, failed or invalid credentials.

The current runtime has LIVE Secret/Public/HMAC/integration configuration but no
legacy Inquiry API key. The checked private operator credential file, applicable
configured DB schema and named Paymob vault entries provide no such key. No
connected merchant browser is available; a local Chrome metadata probe timed out
without extracting credentials. This describes the checked locations; an existing
key may be stored elsewhere. A secure file/secret reference or authorized merchant
Dashboard history has been requested; never paste key/token/cookie into chat.

[Paymob's Inquiry reference](https://raw.githubusercontent.com/PaymobAccept/Paymob-AI-Integration-Skill/main/skills/paymob-integration/references/transaction-inquiry.md)
confirms the API-key/Auth-token flow is separate from Secret/Public intention keys.
With that existing secure access, authenticate read-only management access and
retrieve order640878234 and its entire transactions array/history, not only
[the last-transaction inquiry](https://developers.paymob.com/paymob-docs/developers/transaction-inquiry-apis/transaction-inquiry/by-order-id-or-reference).
Follow any scoped pagination and compare order ID, stored special_reference,
amount314900/currencyEGP/live mode/integration5904482, every transaction ID,
pending/success/failure/refund/void state and provider paid amount. No unrelated
order listing or speculative endpoint/key retries are authorized by this packet.

Local evidence remains one owned amount-matching durable command/attempt,
order pending_payment/pending, amount_paid0, no provider transaction row or signed
callback outcome. Current configured callback source/key/Caddy are unchanged;
late signed receipts/owned reads remain available. Expiry and the friend's report
are context, not independent merchant proof. A paid finding must use the existing
authenticated idempotent reconciliation path; no fabricated callback/manual paid.
A not-paid finding must exclude pending/earlier-success transactions before cleanup.

Cleanup was only inspected READ ONLY. No inventory serialized units or sale_out
movements are attached; stock fulfillment is untracked, packing/shipments0,
release marker NULL. The normal scoped admin cancellation is the conditional path
AFTER definitive nonpayment and exact approval: cancel only this order; existing
trigger cancels unsucceeded attempt, clears client secret, stamps once-only release.
It creates no inventory for this untracked order. Existing release grace/packing/
shipment guards apply; late success remains flagged for review, never silently
reopens released stock. Do not use the unscoped batch expiry endpoint. No cleanup
approval token is issued while provider proof is missing; nothing was changed.

Public checkpoint:0 new orders/attempts/transactions since20:40:47, no new successful
or failed payment, two prior LIVE successes still reconciled. The single known
expired friend test is the only overdue/uncertain payment flag. No duplicate,
orphan, paid/successful-unpaid, amount or command-owner exception. Prior paid WOLF
remains processing/untracked, packing incomplete, shipping jobs0; no dispatch or
delivery claim. Manual50 active/28 configured areas. Runtime/appa402/schema98/
PID55343/restarts0/Caddy/publicCARD/policy/callback configuration preserved; PDC PAUSED.
No matched checkout/callback failure pattern; generic logs remain warnings and
request-level access logging is absent. Do not infer all-request success.

Thirteen scheduled checkpoint receipts are historically missing: prior9 plus
20:51:18,21:06:18,21:21:18,21:36:18 Riyadh. Catch-up evidence does not prove
continuous staffing. Current scheduled21:51 checkpoint is documented; next
**22:06:18 Riyadh**. Public Beta remains open while staffed; kill is unchanged
and unconsumed. No established critical payment/privacy reason to disable/redeploy.

Owner priority **MON-01 / P0 NEXT**: automated READ ONLY exception checks, durable
UTC/Riyadh receipts and last-success heartbeat, missed-run detection and an
owner-approved alert channel/recipient. Separate reviewed scheduler activation;
no automatic payment/refund/stock-release/cancellation/shipment/replay. Keep
merchant reconciliation credential scope explicit. Implementation/deployment and
external messages are not started here; broader automation remains deferred.

Exact next action: provide the secure location of the existing merchant Inquiry
API key, or complete merchant Dashboard order640878234 transaction history, so
all available transactions can be reconciled before a financial/cleanup decision.
No credential disclosure, new payment or production change. All DTR-33/STOR-01/
original32 deferrals/location96/storage audit/Git/provider-incident work preserved.
Private evidence: `../paymob-order-640878234-inquiry-20261027/inquiry-final-receipt.json`.

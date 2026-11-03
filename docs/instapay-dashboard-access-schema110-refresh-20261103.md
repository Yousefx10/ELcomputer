> **COMPLETED/SUPERSEDED — E201,3November2026.** d702recovery deployed bec54ceb2fbfac72/schema110;owner Dashboard visibility accepted. All approval instructions below are spent/historical. Original ffd0STOP and missing receipts remain untouched. [Actual deployment and next boundary](instapay-dashboard-schema110-deployment-receipt-20261103.md).

> **SUPERSEDED — E200,3November2026.** ffd0a1c4 is CONSUMED_STOP after candidate upload;no cutover/restart. Do not replay earlier approval instructions. [Actual receipts and NEW existing-candidate recovery](instapay-dashboard-schema110-staging-stop-and-cutover-recovery-20261103.md).

# Dashboard access fix — refreshed approval READY / UNAPPROVED

Fresh sealed read-only preflight PASS 2026-11-03T09:35:01.121Z. Production remains
81f6206b393714ae/source7b33/schema110. CARD/COD/core,customer Email,bounded tracking
and MON are operational. Seven existing MON warnings/three gaps/no critical alert;
private CARD sessions0,all four integrity counts0,eligible AWBs0. InstaPay OFF.

The owner supplied the prior3c75de02 approval after its expiry:
3November2026,04:45:32.021Riyadh. Checked at12:25Riyadh. It was NOT executed,
not recorded by the mutating operator and no attempt was started. The old packet,
expiry and qualification evidence remain immutable. Expired approval does not
authorize this new seal. No deployment,restart,SQL,settings,timer or provider write.

## Exact same qualified correction and scope

Reuse clean candidate76b4db110d2fb8259771ddbf8b711fc0f3220f2b and artifact
bec54ceb2fbfac7276a4b1471a7c6a4ca5f7ba4150b3676faedc4b80d13c8e38 unchanged.
No rebuild,new application implementation or migration. One metadata line removes
nonexistent admin-auth middleware; unchanged global Dashboard session/active-admin/
payments.view plus server configure/review/verify and RLS contracts remain intact.
[Original defect and qualification](instapay-dashboard-access-schema110-review-20261103.md).

One upload/cutover/app restart; one bounded pause/resume per MON,Email,PDC timer,
letting current callers finish. Zero schema/SQL/settings/runtime/Caddy/unit/key/
manual-worker/provider/payment/order changes. No new payment method or shipment.
Preserve current Dashboard fees/configuration,original emergency fences/budgets,
existing orders and all historical evidence. General InstaPay OFF remains a
separate proposed configuration,not part of this application-only packet.

Reuse19browser/API+8guard tests,typecheck/build,4169served asset hashes,5201archive
entries and local rollback qualification. Operator hashes are identical. Fresh
checks validate old expiry rejection,missing-approval CLI rejection before any
connection/attempt,unchanged source/artifact inputs,read-only hosted state and
fresh encrypted database/full readback plus17protected configuration readbacks.
No old test,real payment,email or provider action was repeated.

One read-only preparation snapshot STOP is retained: MONITOR_TIMER_STOP at
09:30:07UTC occurred during the natural09:30:05–09:30:10MON run. Independent
systemd/report evidence confirms exit0/success,enabled active/waiting timer and
complete report with the original7warnings/3gaps/0critical. No guard was changed,
no timer manipulated and no mutating attempt existed. Fresh continuation keeps
the original strict guard; the final sealed preflight is separate evidence.

## Fresh one-use approval

```text
APPROVE INSTAPAY SCHEMA110 DASHBOARD ACCESS APP-ONLY FIX ffd0a1c42b1d78441077b3bdfab72de64220217ca0b49a7e1f4f61490f1e1e39
```

Execution must start before 2026-11-03T15:18:25.822Z
(3 November 2026 at 18:18:25 Riyadh).
Expires 2026-11-03T15:33:25.822Z (3 November 2026 at 18:33:25 Riyadh).
This new packet has a six-hour validity and fifteen-minute execution margin.
Mandatory fresh preflight immediately before execution still rejects any bound
source/schema/configuration/process/monitor/gate drift. Do not extend an old seal.

Private operator: instapay-dashboard-access-refresh-20261103/operator.mjs.
No approval/attempt marker exists yet. Consume attempt before preflight/mutation;
no retry,extra restart,automatic rollback or fabricated completion after STOP or
uncertain outcome. Previous81f6206b artifact remains available; restoration needs
inspection and a separate exact one-use approval. Original emergency budgets are
preserved,not renewed,using the unchanged lineage adapters.

After approved deployment: validate certificate/PID/schema/runtime/settings,
CARD/COD/core and private denials,all4169asset HTTP hashes and natural MON/Email/
PDC outcomes. Then obtain owner authenticated Payment activity acceptance while
leaving Enable OFF and without saving recipient details yet.

Hosted recipient/private proof-file canary/exact ingress and bank-credit review
remain separate qualification. No Supabase Storage or artificial order/transfer.
First genuine payment-first CARD acceptance remains pending. Apple actual merchant
offer remains unverified; Pixel/wallet/balance work stays preserved/gated,Google
disabled. No repeat support investigation,SEO work or other feature implementation.

ONE next action: owner approves the fresh exact application-only seal above.

# Measured staff PDC booking — proposed schema106

Local capability only. Production deployment and every real provider operation
need their own exact approvals. No pickup request or scheduling feature is added.

The existing staff flow used the provider's default parcel weight. Its narrow
runtime gate also allowed only Manual/PDC COD, although SQL already defined the
verified-live-CARD payment rule. This patch reuses that flow and its dispatch ledger.

Staff enter the measured packed-parcel weight and confirm it before booking.
The request accepts positive kilograms at the existing numeric(8,3) precision.
It accepts no client COD amount, provider identity, address override or AWB.
Each order pins its own weight before any dispatch. The provider default is unchanged.
Missing weight cannot fall back to a default, including through older queue callers.
Concurrent conflicting preparations fail; dispatched weights cannot change.

The additive migration adds one nullable weight column without updating old rows.
It retains historical uncertain dispatches and AWBs. One server-only measured
prepare RPC composes the existing authorization/eligibility/order lock. Existing
take gains a missing-weight guard and returns the saved value. A private trigger
protects dispatched weight. Original function owners/ACLs and all other policies
are preserved. Historical migration files stay unchanged.

Manual delivery explicitly fulfilled by PDC can use the same staff gate for
ordinary verified-paid CARD and eligible COD. CARD still needs a successful live
attempt for the full saved total and sends COD0. COD sends the full outstanding
balance in EGP major units and remains unpaid until verified collection. Packing,
video, destination/product/account, item/stock policy and one-dispatch guards remain.
Global shipping queues, reverse logistics, generic recovery and tracking stay gated.

The Dashboard form has no default weight. Opening another order clears weight,
confirmation and the prior courier notice. An uncertain response refreshes saved
state; HTTP booking retry remains0. Existing label retry uses only the saved AWB.

Qualification uses owned disposable PostgreSQL/HTTP/browser fixtures, never real
orders or PDC. It checks CARD/COD amounts, weight, actor/packing/city restrictions,
uncertainty, conflicts, immutable dispatches and native schema rollback. The actual
form is tested in EN/AR, RTL/LTR, desktop/mobile with all external traffic blocked.

Release preparation remains separate. Bind a fresh105→106 migration/application
packet to the current serving release, active Email worker, MON and original
emergency budgets before requesting deployment approval. Do not activate global
shipping, poll providers, resend private Email tests or use the uncertain shipment.

Labels still need View/Print and PDF/reference acceptance work. Tracking still
needs a separately gated bounded scheduler and current account-page browser
qualification. The documented authenticated webhook can remain unregistered while
polling is completed. Detailed merchant fees/settlement/ERP remain LAST.

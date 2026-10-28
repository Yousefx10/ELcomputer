> E126: owner includes multiple saved addresses. [Full Task1 release review](checkout-address-book-release-review.md) and [separate102 SQL review](checkout-address-book-migration-review.md) supersede the narrow E125 proposal. New2236497 extends the preserved summary; LOCAL/PREFLIGHT PASS, not deployed. The6922 single-address approval is rejected.

> E125: schema101 candidate0951137d/sourcefb824d4 qualified with the exact existing checkout page. [Current scoped review and approval](checkout-address-summary-approval.md). Single-address summary only; full multiple-address requirement is BLOCKED pending explicit owner scope choice. No deployment. Earlier evidence below is retained.

> E124 production is now615506cd7c047ca8/schema101. This address change is still local.
> Before release, carry its reviewed page delta onto currente47 lineage; preserve the COD bridge.

# Saved shipping-address summary — E123

28 October2026. **LOCAL PASS / NOT DEPLOYED.**
Production remains9c74cf4d2c22a267/schema100. No production write or restart.

The owner directed customer-facing work to continue if COD/PDC has a genuine
external blocker. [COD unit confirmation remains blocked](cod-pdc-schema101-deployment-review.md),
so this is the next single customer feature, independent from PDC connectivity.

## Behavior

Complete saved shipping addresses show a compact name/address/phone summary.
The existing **Edit** control expands the form and focuses the first field.
Incomplete/new addresses stay expanded, including missing/invalid phone details
and unsupported governorate values. Profile loading is neutral; fields and summary
do not display another customer's information.

Editing keeps the in-memory draft. **Hide details** is available only when the
address is complete. Delivery selection remains visible outside the collapsed
fields. Continue retains existing validation, quotes, fees, ownership and recovery.
A validation error expands the form. Address line2 and QA-marker guards remain.
No profile write, automatic saving, order/payment command or shipping operation
was added. Existing EN/AR copy, RTL, themes and responsive styles are reused.

## Qualification

**16 actual browser checks PASS**, zero skipped: EN/AR, desktop1440/mobile390,
light/dark, compact saved details, edit/focus/draft retention, unchanged delivery
selection, transition to payment, expanded incomplete/new addresses and account
change clearing. Browser network is restricted to the local fixture; no order or
payment-intention request was made. Auth/transport are fixtures, not hosted acceptance.
Typecheck, production build and `git diff --check` PASS.

Source is isolated under `../checkout-address-summary-20261028/source`, branch
`local/checkout-address-summary-20261028`, based on1615993, whose application code
matches deployed3911124. Only the checkout page and its focused browser test change.
The COD/PDC branch and all existing branches remain intact.

## Release boundary and next task

This UI correction needs no migration or live PDC dependency. It has not been
published. Before preparing its guarded application release, reconcile the exact
then-current deployed source: if schema101/COD code has been deployed, carry this
small reviewed change onto that lineage rather than deploying the older base over
it. No deployment or extra approval is implied by the local commit.

The next customer-facing feature is searchable governorate/city selection in
checkout AND `/account/profile`, reusing the preserved offline location branch
and mapping. Then navbar name, transactional email, Paymob reconciliation/retry,
remaining PDC, SEO/legacy redirects and deferred work, one feature at a time.

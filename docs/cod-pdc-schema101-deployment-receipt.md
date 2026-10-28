# Inactive COD/PDC schema101 deployment receipt — E124

28 October 2026. **DEPLOYED / POSTFLIGHT PASS / COD OFF.**

Production is **615506cd7c047ca8 / schema101**, source
`e47e9a7480a9cdcf855e9c003b5b01c085084a55`.
The owner approved the exact c82a5a… inactive release.
Approval is **CONSUMED_COMPLETE** and must never be replayed.

## Approved execution

- Seal: `c82a5a516edca3027b5c36391dee7ebc45b7f03223fea5cd2231436c65e8501f`.
- Archive SHA256: `615506cd7c047ca8af4701ee02bd9aa4a2aba613693a4f02be67a7e76ed7e8eb`.
- Approval recorded20:04:25.468Riyadh after fresh seal/schema100/CARD/MON preflight.
- Only `20261028200000_manual_cod_pdc_dispatch.sql` applied.
  Schema101 committed20:05:32.620Riyadh;145 protected original projections,
  Auth/history, permissions and existing CARD data checks passed.
- Application cutover20:05:59.848Riyadh, exactly **one application restart**.
  Runtime, Caddy, service configuration and credentials were unchanged.
  COD flags remain false; new collector remains default-manual.
  Narrow staff-COD and global PDC access remain OFF.
- No customer order, payment intention, card charge, PDC request, pickup,
  collection receipt, Treasury posting, email send or business-data write.
  Signup, CARD, Manual EGP50 and existing emergency purchasing-close budget1 remain.

## Production postflight

All **2698 browser assets** passed public HTTP200 and exact-SHA256 checks.
The installed archive certificate, inventory, schema101 and runtime matched.
Financial/configuration and10 anonymous EN/AR route checks passed.
CARD-only purchasing remains available; customer/staff access guards remain.
Manual delivery stays EGP50; the inactive cash-fee setting stays0.
Future activation separately sets the additional COD fee toEGP50.

The next automatic MON report completed20:10:05.847Riyadh.
Timer is enabled/active/waiting; report complete, **WARNING3**, no critical
payment/ownership mismatches. Overdue-unverified2 remain provider-unverified.
Final read-only installed match recorded20:10:32.674Riyadh.
No asset checks were repeated while waiting for that scheduled report.

Private evidence: `../cod-pdc-release-20261028/owner-approval.json`,
`execution-intent.json`, `migration-receipt.json`, `switched.json`,
`postflight-health.json`, `verification-1793207310545.json`,
`verification-1793207432676.json` and `completion.json`.
Opening29 worktree HEADs/statuses matched before continuity updates;
no Git push, merge, reset, cleanup or branch loss occurred.

## COD activation remains held

This deployment did not activate COD. Independent73e5df… activation remains
unapproved/unexecuted. Its expiry remains28October23:39:26.530Riyadh.
Written PDC confirmation that `shipments[].cod=200.35` means EGP200.35 is missing.
The successful inactive101 postflight now satisfies its deployment prerequisite.
No provider investigation was restarted; no booking was attempted.
Old972c77 employee-collection approval remains HELD and non-replayable.
See [activation scope and exact approval](cod-pdc-schema101-deployment-review.md).

Future approved fees remainEGP50 delivery +EGP50 COD, included in the full saved
customer payable amount sent to PDC. Placement/packing/booking do not mark Paid.
Provider collection and actual full remittance require evidence and reconciliation.

## Next customer-facing task

The saved-address summary4a3cd25 remains **LOCAL PASS / NOT DEPLOYED**.
Qualify its reviewed page change on the currente47e9a7/schema101 lineage before
preparing its guarded application release; do not publish its older schema100 base.
Then continue searchable offline governorate/city at checkout AND profile,
navbar name, transactional email, Paymob, remaining PDC and SEO/deferred work.
Preserve location4843754 and every deferred test and provider reference.
Hosted customer/staff/provider acceptance remains separate from technical postflight.

# Coupon activation deployment receipt — 6 November 2026

**DEPLOYED / CONSUMED_COMPLETE.** Exact owner seal `6a3e29a9ea04e3270e220634ef12f85fb53b8ada93df67ba7317aa90f04ae60c` was used once.
Commercial commit02:45:30Riyadh; configuration/restart02:45:38. App
`2a1fb3c96f391f40`, source`e2663eac1f66fecb7d942273b330433799bc12a6`, physical
schema121 are unchanged. New servicePID344894. No application build/migration.

- Exactly one fingerprinted unrestricted95% merchandise +EGP50delivery coupon
  changed `is_active:true→false`. Its record, every other field, all other coupons,
  eligibility/limits, usage counts and historical financial snapshots are preserved.
- Existing one-customer EGP74/minimumEGP10 offer stays active with its existing
  limits/6November22:29expiry. Expired coupons stay expired. The unrestricted
  offer needs separate explicit eligibility acceptance before any future re-enable.
- Two protected overlay files enable only Beta allow_coupons. Effective loaded
  policy matches the seal; all other Beta values and the base runtime are identical.
- One daemon-reload/restart; existing MON/email/PDC/SMS timers paused/resumed
  once within **2.41seconds** of180seconds.
- Immediate postflight and next naturalMON **02:50:12Riyadh PASS**. Hosted
  capabilities report couponsEnabled=true. Anonymous coupon/settings routes return
  private/no-store401; the existing generic account-orders edge denial stays403.
  No Caddy change was made to change an unrelated static response header.
- Final02:54Riyadh read-only snapshot: SMS pilot0/5, same19:02:25expiry,
  closed=false and unchanged runtime; Meta/marketingOFF. Financial observation
  remains17sessions/17attempts/11orders/0private funds/callbacks; no bank finality
  is inferred. No operator provider call, paid send, real order/payment, Git push,
  shipping/Daftra/PDC/Meta/runtime-base or other financial-policy change.

Local9native+9portable checks and4previous pricing/capacity checks remain evidence.
Encrypted current coupon preimages passed authenticated full readback. The two
supplemental diagnostic-script failures were corrected locally and retained in the
conversation: no production correction or installer replay occurred.

**Acceptance still open:** the eligible customer's positive hosted coupon preview
and displayed checkout total. No customer session, coupon use, payment or order
was fabricated for postflight. Do not replay this approval/operator.

Private evidence: logs/activation-register-20261106/coupons-safe/consumed-complete.json,
coupons-postflight/http.json and coupons-postflight/live-status.private.json.

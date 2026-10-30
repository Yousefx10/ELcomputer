> E137,29October2026: **unit question ANSWERED by owner-reported direct PDC confirmation**. `shipments[].cod:200.35` means EGP200.35. Do not resend the scale question or repeat its investigation. Preserve the draft below as historical unsent evidence. Remaining precision/limits, merchant fee/VAT/deduction and remittance evidence are separated in the [current readiness decision](commerce-takeover-20261029.md). No PDC request or activation is authorized.

# PDC final COD amount — provider confirmation draft

Prepared 29 October 2026 for CX-COD-01. **DRAFT / NOT SENT.**
No provider request, shipment, credential or customer data is included.

Subject: Confirm production SaveShipmentEx COD currency units

Please confirm the production contract for `shipments[].cod` on our configured
account and courier service, Product40 / shipmentTypeID1.

For a final customer cash balance of **EGP200.35**, which JSON value is correct?

- `"cod": 200.35` — decimal Egyptian pounds; or
- `"cod": 20035` — integer piastres.

Please state the currency, unit, accepted decimal precision and rounding rule.
Please confirm that this applies to the production endpoint and this account/service,
rather than only the supplied Test integration guide.

Our required collection is the **full final customer balance**: merchandise after
discounts, plus EGP50 delivery and EGP50 COD fee, less any verified payment already
received. For example, EGP100.35 net merchandise plus both fees is EGP200.35 cash.
Please confirm that the chosen `cod` value instructs PDC to collect that exact total,
without subtracting either fee or treating it as the declared goods value.

Please reply with the exact JSON `cod` value for the EGP200.35 example and a written
confirmation of the production account/service applicability. No test booking is
authorized by this request.

---

The supplied `Customer Courier Integration Test V4.pdf` and `V4-1.pdf` are identical
(SHA256 `8f2f5ae3047fb72ef8aebe495a2f48e1501b27b4c2df951c40cf6638e05fb186`).
Page3 §4.3 says number/cash-on-delivery amount. Page4 uses `cod:0`; neither establishes
the unit. Current code converts integer minor units with `codAmountMinor / 100`.
Local serialization checks do not prove PDC's production currency contract.

The previous uncertain booking remains a separate reconciliation incident. Its
original reference and protected trace details stay in the existing private support
packet. A currency answer does not authorize retrying or replacing that booking.

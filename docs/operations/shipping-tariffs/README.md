# Owner-supplied Last Mile draft — 2026-10-23

Import [last-mile-owner-draft-v1.json](last-mile-owner-draft-v1.json) through the
Shipping Company tariff manager after its separately approved release. Review
[location-review-v1.csv](location-review-v1.csv) alongside it. **No production import
or checkout activation has occurred.** This is deployment-specific configuration,
not reusable shipping logic or a merchant-independent seed.

| Zone | Base EGP, up to2kg | Additional EGP/kg | Owner-supplied coverage |
| --- | ---: | ---: | --- |
| 1 | 60.00 | 5.00 | Cairo; Giza, subject to unresolved suburb exclusions |
| 2 | 65.00 | 5.00 | Administrative Capital; designated Cairo/Giza suburbs; Alexandria |
| 3 | 75.00 | 5.00 | Qalyubia; Port Said; Suez; Ismailia; Gharbia; Menoufia; Daqahlia; Sharqia; Beheira; Kafr El Sheikh; Damietta |
| 4 | 85.00 | 5.00 | Fayoum; Beni Suef; Minya; Asyut |
| 5 | 95.00 | 5.00 | Sohag; Qena; Luxor; Aswan; Red Sea |
| 6 | 105.00 | 5.00 | Marsa Matruh; New Valley; South Sinai; North Sinai |

The0.5kg/2kg rows supplied have identical prices: one base rate through2kg.
VAT14%; COD0.5%; failed delivery50% of normal freight; optional insurance0.7%
of declared goods value (off); invoice14 days. Billable kg is the greater of actual
kg and centimetre L×W×H/5000. These figures come from the owner, not an API quote.

## Unresolved terms

- The sheet does not identify Product40 or distinguish High Value/General.40 is a
  draft selection only, with applicability explicitly false.
- No printed effective date. Both dates remain null. January1 is a review date;
  automatic increases are prohibited.
- Fractional additional-kg rounding is unspecified. No rounding was selected.
- Exact suburb boundaries, High Value insurance/surcharge treatment, fee calculation
  bases and VAT treatment of additional fees still require confirmation.
- An empty surcharge list is not confirmation that no surcharges exist.
- Existing aliases/city IDs do not establish current service/account coverage.
  Product/city caches were empty in the targeted read-only snapshot.

## Exact alias review

All382 rows come from current `shipping_city_mappings`, read under PostgreSQL
transaction_read_only=on after the inactive deployment. No PDC request, cache write,
alias edit or city-ID invention occurred. The private snapshot SHA256 is
`6f1bdd85bcdb9f28cdae0a9592b906720815bc6d62a858a8c18fe20918c80ca2`.

All mapping review states are **unverified**.93 Cairo/Giza/Cairo2/Giza2 rows retain
candidate zones1|2 with no selected zone; the group suffix2 is not interpreted as
tariff Zone2. The exact existing `Cairo 2 / New capital / العاصمة الإدارية الجديدة`
alias, city367, is a Zone2 candidate.20 Alexandria rows are also Zone2 candidates.
City98 (`Alexandria 2 / North Coast`) is unassigned because North Coast is not
explicitly zoned by the sheet. No suburb list was fabricated.

Exact existing governorate groups provide provisional candidates: Zone3=124,
Zone4=39, Zone5=53, Zone6=51; Zone2=21. Zone1's price is populated, while its
city assignments remain unresolved against possible suburb exceptions. This is
intentional. No candidate is a verified destination or checkout price.

Owner spelling versus saved PDC spelling remains visible: e.g. Asyut/Assiut,
Minya/El Menia, Beheira/Al Behaira and North Sinai/North Seina. Current storefront
governorate labels also differ from several aliases, and its selection list lacks
North Sinai. This package does not rewrite aliases or storefront addresses. Review
the exact real-order address independently before first controlled acceptance.

After the release, authorize one explicit company-bound draft import/diff. Keep
Product40, dates, rounding and ambiguous mappings unverified until confirmed. Any
later checkout pricing/activation requires its own implementation and approval.

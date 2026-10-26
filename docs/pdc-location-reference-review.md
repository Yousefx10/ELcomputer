# PDC owner workbooks — offline mapping review

2026-10-26. Owner-supplied files in `~/Downloads/PDC UPDATED FILE/` inspected
without modification or provider access. This report precedes local implementation.

| Workbook | Worksheets/data | Finding |
|---|---|---|
| Address Mapping.xlsx | Sheet1 and Sheet2,382 records each | Same unique CityID1–382;27 governorates after explicit alias reconciliation |
| Status.xlsx | Status,33 records/32 unique IDs | Operational status labels; ID97 repeats with conflicting descriptions |
| Templates IDS V3.xlsx | Sheet1,4 records | Print formats1/5/6 and reverse-only3; provider-account-specific template names |

Address columns:

- Sheet1: Governorate,CityID,City,City_Arabic.
- Sheet2: Governate_(English Name),CityID,City Arabic,City English.
- No official governorate IDs, zone/area identifiers, tariffs, fees, availability
 flags or coverage promise are present. CityID is a PDC mapping, not universal ID.

134 rows differ across sheets, almost all governorate aliases/grouping. Cairo2,
Giza2 and Alexandria2 are export groups, not extra governorates. Sohag casing,
NBSP in Beni Suef and spelling variants are retained as aliases. Existing UI's
North Coast entry is a city/area under Alexandria in this file, not a governorate.
Existing checkout spelling values can be retained as compatibility labels while
new neutral identities and bilingual display names are maintained separately.

Material conflicts and decisions:

1. ID21: Sheet1/cache English `Gesr el-Suez`, Arabic `جسر السويس`; Sheet2's English
 cell contains `باب`. Use corroborated Sheet1/cache text, recording the conflict.
 No provider ID is invented or changed.
2. IDs137/146 have distinct corroborated English names Meniat Al Nassr/Banbro, but
 both Arabic cells say `منية النصر`. Keep distinct IDs and bilingual option labels;
 flag the Arabic conflict for correction, without guessing a replacement.
3. ID366 `Others` appears in both sheets but is absent from retained API records.
 Preserve it as inactive reference; do not offer it as a typed-city workaround.

The retained2026-10-23 GetCities snapshot has411 unique records. All381 overlapping
English names match Sheet1 exactly. IDs383–412 are cache-only (30), with no new-file
parent governorate/Arabic evidence; keep existing cache untouched and do not infer
parents. This is an offline comparison, not a new API result/current coverage proof.
The original382-row SQL mapping agrees with Sheet1; it must not be overwritten.

Local implementation direction: provider-neutral governorate/city identities,
separate provider mapping, controlled reference import/update with revision checks,
searchable dependent EN/AR selectors, editable address lines and server-side ID/
parent validation. Preserve old profile strings and order snapshots. Stage this in
an additive branch/release; original schema95 candidate stays byte-identical.

Status.xlsx: descriptions explain transit,delivery,return,loss/damage/holds, but
ID97 describes both a courier return after attempt and receipt at hub. Do not
select an automatic order-state transition. Record mappings for later SHIP-10/
SHIP-11 review, with original ambiguity preserved. No callbacks or status changes.

Templates:1=10x15,5=one AWB per A4,6=two AWBs per A4,3=reverse label requiring a
reverse shipment. Purpose understood; installation/account binding, units and
actual output remain unaccepted. Defer integration under SHIP-06/SHIP-11. No PDF,
provider call, booking, pickup activation or HTTP500 incident action.

Original SHA256 values:

- Address Mapping.xlsx: `0201a05d3fb724e06c208b10379caecc5087fe9db4e98ec3d1bd64d97b25a04e`
- Status.xlsx: `821e91f443a91080e2b9086df5221f904f087aec254b13b780e4bd79cdaa26dc`
- Templates IDS V3.xlsx: `896bc2fff7b47c9e874e21e1dcf673b573b025503695358ccffb2fb36a4c6b8b`

Raw workbooks, extracted rows and private comparison evidence stay outside Git.
No shipping coverage/pricing/cache/production data/permissions changed. Signup
remains OPEN; purchasing and PDC remain paused. Secondary files do not gate Beta.

## Local implementation result

Separate branch `local/location-reference-20261026`, based on frozen95 source
`b37be43`. Migration96 is additive and defaults selection OFF. It creates neutral
governorate/city UUID identities and a separate provider-reference table. Neutral
codes/UUIDs are application identities, never invented official governorate IDs.
The original PDC mappings/cache, addresses, orders and all provider settings stay
unchanged. Data is not seeded or enabled by the migration.

The reviewed JSON reference has27 governorates/382 city records,381 selectable.
Others366 stays inactive. For the ambiguous Arabic labels137/146, the core Arabic
display fields are blank and the corroborated English labels are shown in either
locale; original Arabic cells remain in provenance. No corrected name was invented.
ID21 uses Sheet1/cache. All30 cache-only records remain outside this import until
a parent is evidenced. This is a partial supplied reference, not an exhaustive
list of every Egyptian locality or a carrier coverage promise. Missing locations
need controlled reference maintenance; no free-text or guessed provider-ID fallback.

Checkout and Profile reuse a searchable bilingual dependent selector when enabled.
Address lines remain editable. Canonical names and parent/active IDs are validated
server-side and again inside the checkout transaction. New selected IDs join the
durable intent and immutable order snapshot. Exact old/new command receipts can
recover after activation, rename or deactivation; no historical backfill occurs.
Profile phone-only edits preserve untouched legacy addresses. Selection mode is
explicit; old contracts remain when disabled.

Dashboard Commerce → Shipping adds a compact reference JSON review/apply control
under existing settings.view/settings.edit. Apply is bounded, revision-checked and
receipt-idempotent; stale confirmed rollback returns to review, uncertain replies
retain the same command. Omitted rows are preserved, parent/provider rebinding is
rejected, and mode activation is a separate checkbox. No PDC call, coverage/fee
edit, raw workbook retention or Storage upload is performed by reference import.

Evidence:8 native location tests PASS/no skips;7 existing default-mode transaction
tests PASS in an isolated regression;4 actual-component EN/AR/RTL/themes/320px/1280
browser scenarios PASS. Typecheck and production build PASS, with final receipts
in the private work directory. No hosted96 acceptance or production import/deploy.
The initial canonicalization/retry failure is preserved and fixed; qualified logs
govern. Auth/signup/CAPTCHA/real owner-payment tests were not repeated.

A96 deployment would require its own sealed app/migration/reference packet and
reviewed exact edge GET/POST routes, preserving signup OPEN and purchases/PDC held.
The original95 package is unchanged and can proceed independently; do not silently
include96 in its approval. Return to95 deployment/recovery qualification next.

## Governorate aliases and compatibility mapping

No provider governorate ID is supplied for any row. Arabic labels below reuse the
existing application translations; checkout_name retains existing delivery-matching
spelling. Canonical internal identity is separate from both display and provider ID.

| Reference governorate | Arabic display | Existing checkout value | City rows | Reviewed aliases |
|---|---|---|---|---|
| Cairo | القاهرة | Cairo | 56 | Cairo, Cairo 2 |
| Giza | الجيزة | Giza | 38 | Giza, Giza 2 |
| Alexandria | الإسكندرية | Alexandria | 21 | Alexandria, Alexandria 2 |
| Behaira | البحيرة | Behira | 17 | Al Behaira, Behaira, Behira |
| Mounofia | المنوفية | Monufia | 11 | Al Mounofia, Monufia, Mounofia |
| Gharbia | الغربية | Gharbia | 7 | Algharbia, Gharbia |
| Dakhahlia | الدقهلية | Dakahlia | 20 | Dakahlia, Dakhahlia |
| Dammitta | دمياط | Damietta | 11 | Damietta, Dammitta |
| Sharqia | الشرقية | Sharqia | 20 | Elsharqia, Sharqia |
| Ismalia | الإسماعيلية | Ismailia | 7 | Ismailia, Ismalia |
| Kafr Al Sheikh | كفر الشيخ | Kafr Alsheikh | 13 | Kafr Al Sheikh, Kafr Alsheikh, kafr Al Sheikh |
| Port Said | بورسعيد | Port Said | 3 | Port Said |
| Qalyubia | القليوبية | El Kalioubia | 12 | El Kalioubia, Qalyubia |
| Suez | السويس | Suez | 3 | Suez |
| Fayoum | الفيوم | Fayoum | 8 | Alfayoum, Fayoum |
| Assiut | أسيوط | Assuit | 13 | Assiut, Assuit |
| Beni Suef | بني سويف | Bani Suif | 8 | Bani Suif, Beni Suef |
| Menia | المنيا | Menya | 10 | El Menia, Menia, Menya |
| Aswan | أسوان | Aswan | 14 | Aswan |
| Luxor | الأقصر | Luxor | 9 | Luxor |
| Qena | قنا | Qena | 10 | Qena |
| Red Sea | البحر الأحمر | Red Sea | 8 | Red Sea |
| Sohag | سوهاج | Sohag | 12 | Sohag, Suhag, suhag |
| New Valley | الوادي الجديد | New Valley | 8 | New Valley |
| Matrouh | مطروح | Matrouh | 26 | Matrouh |
| North Sinai | شمال سيناء | North Sinai | 7 | North Seina, North Sinai |
| South Sinai | جنوب سيناء | South Sinai | 10 | South Seina, South Sinai |

The complete reviewed city/reference mapping is
[the versioned JSON](reference-data/egypt-delivery-locations-20261026.json) in the
location source branch. The offline preparation script requires the owner workbook
and retained cache, rejects unreviewed headers/conflicts, and performs0 network/DB
operations. Raw originals/cached incident evidence remain outside Git.

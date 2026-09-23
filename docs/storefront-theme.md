# Storefront theme

The public storefront uses a bright blue header, navy text, rounded search,
soft category tiles, and compact product cards. The supplied Walmart screenshot
informed the visual direction. The Lowe's screenshot informed department
navigation and shopping shortcuts.

Styles live in `app/assets/css/storefront.css`, under the `.storefront` layout
wrapper. The dashboard layout and its components are unchanged.

The header keeps search, account, and cart visible on phones. Department menus
support click, keyboard focus, Escape, and outside-click dismissal. Search
filters collapse on phones. Product rails have labeled controls. Cart buttons
retain stock and variant handling and announce successful additions.

Existing site settings still supply the logo, announcements, banners, offers,
links, and reviews. Custom background colors remain supported; the old default
gray becomes white. Template images from placehold.co and via.placeholder.com
use category icons, brand names, or empty-image layouts instead. Catalog prices,
stock, product data, authentication, and order processing are unchanged. Saved
carts restore after mounting to keep server and browser rendering consistent.

## Footer styles

The footer setting supports Classic and Modern styles. Classic remains the
default and retains the existing call to action, contact details, logo, link
columns, and copyright line.

Modern uses the existing enabled Footer Links and groups them by their saved
section titles. Its promotion card, community link, wide banner, and lower
details are editable in Footer content. Card and community images plus the
banner use the dashboard media uploader. External destinations open safely in
a new tab, while local destinations use storefront navigation.

The modern layout has separate desktop, tablet, and phone arrangements. Tablet
keeps the promotion and links side by side with the community row below. Phone
stacks the major sections, keeps link groups in two columns, and stacks the
lower details.

The current catalog includes many products without photos or available stock.
The design displays those states without inventing product imagery or availability.

## Hero artwork

Asset: `public/images/storefront/setup-hero.png`.
Generated using the built-in imagegen tool. This is decorative campaign artwork,
not a product listing image. Configured hero banners take precedence.

Final generation prompt:

> Use case: ads-marketing. Asset type: original background illustration for ELcomputer's public ecommerce homepage hero. Create a polished, photorealistic studio still life of unbranded computer peripherals: a compact ivory mechanical keyboard with a few royal-blue keycaps tilted diagonally, a matte ivory wireless mouse, and navy over-ear headphones, arranged on a light powder-blue tabletop with one softly rounded blue display plinth. Clean cheerful American retail campaign photography, natural soft shadows and beautiful material detail. Wide landscape composition around 3:2. Group ALL objects in the RIGHT HALF and bottom right, leaving the LEFT 50% completely empty pale-blue negative space for real HTML text. Background color near #dceafe, rich royal blue accents, neutral ivory. View at a high three-quarter angle. Objects substantial and attractive, no excessive decoration. This is generic brand campaign imagery, not a particular product listing. Absolutely no logos, no brand names, no words, no text, no watermark.

## Verification

- `npm run build` and `git diff --check`.
- Browser checks at 320, 390, 768, 1024, 1440, and 1920 pixels.
- Department navigation, keyboard dismissal, product rails, search, and mobile filters.
- Stock-disabled buttons and cart feedback, quantity changes, removal, and reload persistence.
- Customer sign-in/signup switching and labeled mobile inputs.
- Existing hero visibility, custom background, banner links, and reduced-motion settings.

Cart and content-setting checks used temporary browser fixtures. They did not
change database records or submit orders. The final cart regression run had no
runtime or hydration errors. Build output contains existing sourcemap warnings.

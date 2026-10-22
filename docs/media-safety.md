# Product Manager Task 2: media library and image safety

Packing videos now use [private VPS storage](private-packing-videos.md), outside
public uploads and the Media Library. References below describe the Task 2
baseline; other private-file adapters remain separate work.

Authorized baseline: `8c5256b9708b488e3022e756e8c9f85aaf8a96ae`.
This task extends the existing upload endpoint, public image route, library and
shared image field. Product listing, imports/exports, bulk actions, providers,
Quick Setup and production are outside scope. Stop after Task 2 review.

## Existing implementation reviewed

`/api/admin-uploads` writes public merchant images to the configured durable
`uploadsDir`; `/uploads/**` serves them. `/api/admin-gallery` lists/deletes those
files. These are separate from Supabase private document, customer/chat,
packing-video and claims-evidence resources. Those APIs, buckets, policies and
permissions are untouched. The shared field is reused by products, variant
pictures/galleries, categories, brands, SEO and store content.

Previously library browsing required `settings.view`, even inside the product
editor. Deletion required Settings edit but unlinked without checking database
references. Uploads trusted their declared MIME type, accepted SVG and did not
reject linked filesystem paths. There was no database/file deletion coordination.

## Permissions and access

Every management request verifies Supabase Auth and fetches the current active
staff record using the existing `requireAdminRequest` guard. No staff cache or
new role/permission catalog is introduced.

- Product add/edit permissions, with their existing Products access dependency,
  allow browsing/uploading product and product-gallery images.
- Category, brand and page editors can browse their respective image sections.
  Uploads continue to require the corresponding add/edit permission.
- Settings viewers retain the existing library of supported public image folders
  and legacy root images. Settings editing is still required to upload settings
  images or delete an image. Product editing alone does not grant deletion.
- Only named public image directories and raster/SVG image filenames are listed
  or delivered. Unknown directories, documents, attachments and links are excluded.
  Browser permissions and public media URLs do not grant private Storage access.
- Library responses use `private, no-store`; management operations disable implicit
  retries and have a 30-second client timeout. No raw database details or usage
  records are returned in deletion errors.

## Migration 73 and concurrent deletion

`20261013140000_media_reference_safety.sql` is necessary because product/content
references can also be written directly through existing authenticated database
APIs. An HTTP-only check followed by unlink would race those writes.

The additive migration uses the existing private `catalog_private` schema. Its
`media_paths` table stores only public paths, deletion state and a timestamp.
RLS is enabled; PUBLIC, anon, authenticated and service-role direct access is
revoked. There are no business-table foreign keys, data rewrites or new public
business tables. Existing ACL/RLS, inventory/ERP functions and reset preflights
remain intact. Native non-superuser execution and compatibility are tested.
Migrations **1–72 remain byte-identical**.

Reference guards cover products, variant definitions and galleries, product
specifications, categories, brands (including nested landing-page JSON), settings,
pages, hero banners, offer cards, links/top-bar content, help articles and customer
order-item image snapshots. They inspect string values, including markdown/HTML,
absolute upload URLs, query/fragment suffixes, ASCII URL escapes and dot segments.
Foreign origins containing the same upload path are conservatively protected too.
Filename case aliases share protection, including on case-insensitive disks;
case-sensitive disks conservatively protect lookalike filenames together. Stored
URLs and physical filenames are never rewritten.
Future reference-bearing tables must be added to both the guard and deletion scan.

`catalog_media_delete` is a service-only RPC. It independently checks the current
active actor's Settings view/edit permission under a lock. It requires Read
Committed isolation and bounds lock waits to five seconds. A per-path row lock
serializes deletion with reference writers. After acquiring that lock it scans
current references with fresh statement snapshots. Used images return HTTP 409:
“This image is in use. Remove its references first.” No file is removed.

An unused path follows `active → deleting → deleted`:

1. Commit the database reservation. Reference guards block adding that path.
2. Verify the regular file/path again, unlink it and sync its parent directory.
3. Confirm deletion through the same RPC. Retain the tombstone permanently.

Database and filesystem operations cannot share one transaction. This ordered
protocol prevents new broken references without claiming such a transaction.
A crash, filesystem failure or lost confirmation keeps the reservation/tombstone.
Refresh and retry deletion to finish; never automatically cancel an uncertain
reservation. Concurrent requests and already-absent files are idempotent. A file
that changed during deletion fails clearly. Upload filenames are never reused.
Unchanged historical references do not block ordinary inventory/content updates.

Pending files may remain visible until deletion is retried; saving a new reference
is rejected. A product save receives a clear EN/AR image-unavailable error and
rolls back its existing atomic transaction. Order snapshots also preserve media
until their references are gone; errors disclose no order/customer details.

## Upload and filesystem validation

No image-processing dependency is added. JPEG, PNG, WebP, GIF and AVIF are checked
against their actual signatures and container/marker boundaries, dimensions and
end-of-file structure. PNG additionally checks chunk CRCs, zlib data, scanline
lengths/filter bytes and interlace passes. AVIF requires image dimensions and AV1
configuration inside its metadata. Truncated files, mismatched MIME, HTML/script
masquerades and appended payloads are rejected in the acceptance fixtures.

These are bounded structural checks, not a complete codec decoder or malware
scanner. Image entropy is decoded by the browser; metadata is not stripped or
rewritten. Delivery forces the image MIME type with `nosniff` and a sandbox CSP.

The existing 8 MB file limit is enforced, including actual multipart stream bytes
before parsing (64 KB allowance for multipart overhead). Inputs contain one section
and one image. New raster images are limited to 40 million pixels / 16,384 pixels
per dimension; PNG inflation is bounded to 64 MB, GIF to 1,000 frames.

New SVG uploads are rejected. Existing SVG files/references remain unchanged and
previewable. Their delivery uses `sandbox; default-src 'none'; style-src
'unsafe-inline'` to block scripts, forms and external resources. SVGs depending on
external resources will not load those resources. This is containment of legacy
files, not a claim that their contents have been sanitized.

The original multipart filename never becomes a path. A 128-bit random filename
and verified format extension are generated; exclusive, no-follow creation avoids
collisions. A hidden `.pending` file is written and synced first, then an atomic
exclusive hard link publishes complete bytes; the staging link is removed. Pending
files cannot be listed or served. File and directory metadata are synced before
successful upload. Failed writes remove only their unpublished staging file; once
published, a valid image is preserved even if acknowledgement/sync fails. This
requires the existing local POSIX filesystem to support hard links. Root/ancestor/file
symlinks, traversal, malformed paths and unsafe configured roots are rejected;
browsing does not follow links. These checks assume the application OS account and
upload-directory ownership remain trusted. External filesystem/database restore,
manual deletion or disabling triggers requires its own operational review.

## UI and release boundaries

Existing typography, colors, spacing, forms, tables, previews and media components
are retained. Only file-format choices, submission guards, bounded requests,
selection validity and concise EN/AR errors/confirmation change. Controlled media
section labels use the existing locale adapter. The Media Library alone receives
a dark-surface contrast correction using the existing Dashboard palette. RTL, mobile and
Light/Dark/System behavior are preserved. Clearing an editor image removes its
reference; it does not delete the file. No product descriptions or media are invented.

Apply reviewed migrations 72 and 73 to an approved target before releasing these
APIs. This task applies them only in disposable local databases. The frozen
installer certifies exactly 1–71 and rejects newer source membership. Its engines,
bundles and certificates are unchanged; historical installer fixtures retain that
boundary. The 72/73 compatibility gap remains for separate release certification.
The separate owner System Reset/media-reset workflow and restore tools are not
extended or executed here; this guarantee covers normal management writes and
the guarded library deletion endpoint.

See [validation evidence](media-safety-validation.md) and
[product transaction contract](product-save-safety.md).

Product presentation metadata also uses the image reference guard and deletion
scan. Its video assets use a separate immutable VPS namespace, bounded MP4/WebM
validation and current publication/assignment checks. Private packing evidence is
excluded. See [Premium PDP](premium-product-page.md#operational-and-compatibility-details).

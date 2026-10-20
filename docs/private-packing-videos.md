# Private VPS packing videos

Implementation and guarded production release PASS on schema85.
Public checkout stays disabled. [Normal COD collection and reconciliation](cod-collections.md)
are deployed; business configuration and controlled acceptance remain.

The [foundation release receipt](commerce-foundation-release-receipt.md) records
the configured private directory, restricted decoder and systemd sandbox probes.
Real staff/browser camera, upload/download and packing completion remain pending.

## Existing workflow retained

The Orders confirmation screen still starts an operator work session, claims one
order, records the camera, verifies assigned-unit scans and completes packing.
Existing ownership, active-staff permissions, scan uniqueness, allocation,
every-scan recording coverage, financial and order-status guards remain.
Completion never marks COD paid. No provider, shipping-label or payment worker
is activated.

Migration84, `20261020160000_private_vps_packing_videos.sql`, adds VPS evidence
fields to the existing `order_packing_videos` table. It creates no business table,
seed data, Storage object or bucket. Migrations1–83 and installation certificates
are unchanged. The new application needs migration84 before packing can work;
the current COD application also needs migration83. This is not installer
recertification or hosted acceptance.

## Request and evidence contract

| Stage | Behavior |
| --- | --- |
| Prepare | Existing `POST .../video-upload` validates at most 8 KiB of recording metadata. A service-only RPC checks current staff permissions, claimed operator, active work/order session and eligible order. It creates one upload identity for that session. |
| Upload | Authenticated `PUT .../video-content?upload=<uuid>` streams bytes to a private 0600 staging file. Identity comes from Auth, not the body. The exact prepared session/order/operator and byte count must match. Chunked requests obey the same 500 MiB limit. |
| Validate | Server checks container signature, declared MIME, an actual video track and decoded video frames using `ffprobe`. Audio-only, truncated and mismatched files fail. Duration comes from decoded frames, including WebM without a duration header; client duration has no authority. |
| Persist | File and directories are synced. A generated immutable destination is published atomically without replacing existing bytes. SHA-256, actual duration, validation time and ready status are recorded through the service-only finish RPC. Permissions/session/order state are checked again after streaming. |
| Recover | `POST .../video-complete` verifies persisted bytes and can finish an interrupted metadata acknowledgement. Exact retries reuse the prepared identity; a changed recording requires release and a new packing session. The UI attempts this recovery before resending retained bytes. |
| Retrieve | Existing `GET .../video` requires a current active owner/staff account with Orders access. The server verifies binding, size and SHA-256, then streams an attachment with private/no-store, nosniff and single-range support. It issues no signed URL or redirect. |
| Complete | The HTTP handler opens and verifies the saved file before the existing completion RPC. An additional SQL trigger requires VPS/hash/validation evidence. The original video and every-scan timestamp coverage trigger remains unchanged. Existing completed-command retries retain their acknowledgement contract. |

SQL RPCs are executable only by `service_role`; their private helpers are not
directly callable by browser or service roles. Direct service-role INSERT/UPDATE
on the video table is revoked, retaining SELECT. Existing browser RLS/ACLs and
inventory permissions are not broadened. No HTTP caller chooses a path, actor,
order identity, digest or validated duration.

Files use generated keys:
`vps-v1/<operator UUID>/<order UUID>/<session UUID>/<upload UUID>.<extension>`.
Order numbers are sanitized display/download filenames only. The storage root
must be canonical, absolute, owned by the application user and outside both the
application tree and public uploads. Directories are 0700; files are 0600.
Symlinks, linked ancestors, hard-linked files, unsafe permissions and path
traversal fail closed. The Media Library and public image routes are unchanged.

The 500 MiB existing size limit remains. Uploads have a 60-second idle deadline
and 15-minute streaming deadline. Each verifier process is capped at 30 seconds,
one decoder thread, bounded output and a 64 MiB per-allocation limit; it uses no shell and only the
file protocol. Timed-out children are killed and reaped. Actual duration must
match the declared recording window within three seconds or five percent.
The database still requires every scan inside that window. These checks prove
file/evidence consistency, not what a camera visually witnessed.

## Failure, legacy and cleanup behavior

Ordinary failed/disconnected requests close handles and remove staging files.
Validated files survive an uncertain SQL/HTTP acknowledgement so the same session
can recover them. Ready bytes cannot be replaced through this workflow. Missing,
changed or unsafe files block new completion and retrieval; they never cause a
Storage fallback or payment/status override.

Releasing an order or closing its work session marks an unfinished VPS upload
failed and retains its metadata for cleanup. Existing reset dependency checks
remain. Orders/Commerce capture the existing video paths; Full additionally
captures VPS paths without relying on `storage.objects`. The existing cleanup
journal routes those keys to the private directory, syncs deletions and checkpoints
only afterward. Other files and legacy cleanup behavior retain their contracts.
Reset is still owner/password controlled and remains blocked at production ingress.

Historical Supabase video metadata is explicitly marked `supabase` and retained.
This feature does not read, upload, overwrite, transfer or delete those objects.
Active legacy recordings require release and a new recording/session, preserving
the old row. Historical downloads need a separately reviewed private-file transfer.
No automatic conversion or retention/deletion worker is added. A process/host
crash may leave private staging remnants; they cannot become ready evidence or
public downloads. Include private files in the approved backup/retention procedure.

## Deployment inputs

These are deployment inputs, not stock/shipping decisions:

| Input | Requirement |
| --- | --- |
| `NUXT_PACKING_VIDEOS_DIR` | Absolute canonical durable private directory, separate from the release/application tree and `NUXT_UPLOADS_DIR`. Empty fails closed. Keep the root stable; changing it requires moving existing files under a reviewed plan. |
| `NUXT_PACKING_VIDEO_PROBE_PATH` | Trusted server `ffprobe` executable; defaults to `ffprobe` on PATH. Install/provide FFmpeg before acceptance. Missing tooling fails closed. |
| Service filesystem access | Provision the private directory for the application user with 0700. Add that exact directory to the existing service's `ReadWritePaths`; preserve the current sandbox and public-uploads entry. The sealed installer/runtime configuration is unchanged by this task. |
| Backup and acceptance | Back up private bytes with their metadata. After an approved deployment, verify real camera upload/download/completion under the actual Linux service and authorized staff accounts. |

For example, a deployment can bind a private root beneath
`/srv/your-service/shared/private/packing-videos`. Never place it under public
uploads or add a static file-server mapping. No new public route exception,
Caddy redesign or checkout activation is required for these authenticated admin
endpoints. The original implementation task made no VPS change; the approved
foundation release later configured these inputs without changing Caddy.

## Isolated validation

`tests/private-packing-videos.test.mjs` runs actual migrations and compiled HTTP
handlers against a new disposable native PostgreSQL17 cluster, real private
filesystem and real FFmpeg/ffprobe. It accepts executable/driver paths, not a
hosted database URL. Fixtures use synthetic identities, products, procurement
receipts, orders, videos and shipping settings; original products are never used.
Auth token verification and Supabase transport are fixtures. New RPC calls run
through actual non-superuser `service_role` connections; this does not certify
hosted Auth/PostgREST/RLS or real webcam/browser acceptance.

With Node22.23.1, native PostgreSQL17 (including pg_trgm), FFmpeg and ffprobe
available locally, run from the checkout with executable paths:

```sh
EMAIL_REVIEW_PG_BIN=/absolute/path/to/postgresql/bin \
EMAIL_REVIEW_PG_DRIVER="$PWD/node_modules/pg/lib/index.js" \
node --test --test-concurrency=1 tests/private-packing-videos.test.mjs
```

The PostgreSQL distribution's local library path may also be required. Without
the native inputs these tests explicitly skip; a skipped run is not acceptance.

The 25 passing tests include:

- Received-stock COD purchase, actual assigned scans, durable private upload,
  authorized retrieval and one packing completion/replay; totals, payment state,
  inventory and ledger remain unchanged through packing.
- Anonymous/customer/inactive/unauthorized staff denial, other operator/nonce
  rejection, current authorization revocation, changed order/session binding,
  schema-before-application failure and unchanged historical evidence on upgrade.
- VP8/VP9 WebM, MediaRecorder-style WebM without duration, H.264 MP4 and QuickTime;
  actual decoding, audio-only/spoofed/truncated rejection, duration mismatch,
  size limits for chunked input and cancelled-stream cleanup.
- SQL failure after disk persistence, lost HTTP acknowledgement, simultaneous
  identical uploads, unavailable verifier and killed/reaped timeout child.
- Missing/tampered/symlinked/hard-linked files, unsafe roots/modes, authorized
  ranges, public-path 404s, two configured private roots and zero Storage calls.
- Release/close handling, retained reset dependencies, actual Full reset cleanup
  and durable checkpointing. Scope capture triggers are also checked in rollback
  fixtures where real inventory links correctly prohibit a narrower reset.

Native COD regression:17 PASS. Focused packing, reset, preorder, amount and public
media regressions:45 PASS, eight existing native opt-in skips. Typecheck and build
use the project's Node22.23.1/npm10.9.8. The later approved foundation release
passed actual Linux/systemd and production schema/HTTP checks. Authenticated
browser/camera and real packing acceptance remain pending. No real customer order,
provider activation or Git push occurred.

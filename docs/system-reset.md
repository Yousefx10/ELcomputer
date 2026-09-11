# Owner system reset

Open **Settings → Reset system**. Only active owners can see the entry or access its APIs. Each reset requires the current owner's password and the exact confirmation phrase. No reset runs on page load or when previewing a scope.

## Installation

Apply `supabase/migrations/20260911090000_owner_system_reset.sql` to the application's Supabase database through your normal migration process before using this feature. The screen reports that installation is required if the functions are missing. This migration only creates reset infrastructure; applying it does **not** erase application data.

The server uses its existing `supabaseServiceRoleKey` and `public.supabaseUrl` configuration. Do not expose the service role key to the client. Password verification uses a separate Supabase client and revokes only its temporary session.

## Scopes

- **Products:** catalog, brands, categories, reviews, variants and inventory records. Existing order snapshots remain; linked purchasing or serialized orders can block the reset.
- **Orders:** online orders, items, returns, packing, order messages and shipping job/webhook history. It does not restock products or erase manual sales. Serialized inventory dependencies can block this option.
- **Commerce:** online orders plus manual sales, purchasing, inventory, returns, packing, transfers and all treasury transactions. Product and variant quantities/cost projections become zero. Catalog definitions, customers, employees, warehouses and suppliers remain.
- **Documents:** all document folders, permissions, metadata and objects in the `admin-documents` bucket. The bucket remains available.
- **Media:** website-uploaded image files and their `/uploads/` references in supported catalog/content columns. Externally hosted images and application assets are preserved.
- **Store content:** store settings, banners, announcements, offers and navigation content. The application falls back to its installed defaults.
- **Analytics:** visitor sessions/events and NPS responses. Internal-user exclusions remain.
- **Full:** all allowlisted application data, other admin/customer accounts, document objects and uploaded images. Only the current owner's login, its internal-user exclusion, reset journal and password-attempt protection remain. A new activity log is written after completion. The installed code, environment variables, Supabase project, storage bucket definitions and external provider records/backups are not removed.

The server allowlist is `server/utils/systemResetScopes.js`. The SQL function `system_reset_tables` contains its matching database allowlist. Tests enforce that they match. Update both when adding tables. An unknown public table blocks full resets rather than silently leaving unreviewed data or deleting it.

## Transaction and recovery

The database phase locks application tables, rechecks owner access and dependencies, and deletes selected data in dependency order within one transaction. Foreign-key constraints remain enabled. Application triggers are temporarily suspended within that transaction and restored to their original states. A failure rolls back both deletions and trigger changes.

Account deletion and stored-file deletion use their existing APIs after the database phase. They cannot be part of the PostgreSQL transaction. A service-only journal retains the exact cleanup manifest. A failed cleanup is reported as **pending**, not completed; the owner can resume it with another password confirmation. The same request ID cannot erase newly created data when retried. A pending reset blocks additional resets until it completes.

Media cleanup unlinks only captured regular image files. It refuses unsafe roots, symlinks, paths outside the upload directory and files changed since the snapshot. If cleanup reports a filesystem problem, correct that problem and resume the existing request; do not start a fresh reset. New files/accounts created after the snapshot are outside that request.

The completion function inserts `settings.system_reset.completed` into `admin_activity_logs`, recording the owner's ID, name, email, scope, counts and timestamp. It then marks the journal complete and clears the cleanup manifest in the same transaction. Retrying completion does not create a duplicate log. The existing history shows the latest entry first.

Five reset/password attempts per owner are allowed within 15 minutes. Passwords and verification tokens are never written to the journal or activity log.

## Verification

Run `node --test tests/*.test.mjs` and `npm run build`. Database tests load the actual schema backup and all migrations into disposable PGlite PostgreSQL databases. They do not connect to the configured Supabase project. Auth and Storage API behavior is tested with mocks; production data is never reset by the test suite.

References: [Supabase password authentication](https://supabase.com/docs/guides/auth/passwords), [Supabase user deletion](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser).

// Explicit database-only authority. It cannot authorize publication or other sites.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

export const productionProjectRef = 'amighioggheqddyypgcl'
export const productionProfile = Object.freeze({
  id: 'elcomputer-production-82-metadata-only-v2',
  scope: 'database-installation-only',
  project_ref: productionProjectRef,
  api_url: `https://${productionProjectRef}.supabase.co`,
  site_origin: 'https://elcomputer.net',
  database_host: `db.${productionProjectRef}.supabase.co`,
  release_id: 'release-82-v1',
  certificate_sha256: 'f6a9d75166154f5c1c2bd91b306f7a61157857d5a5b41d6442f95fafa047eeae',
  file_backend: 'vps-only',
  storage_mode: 'empty-compatibility-buckets-only',
  production_application_activation: false,
  video_bucket: 'order-packing-videos',
  // Unused compatibility metadata, not a supported production video limit.
  // All Storage object operations are forbidden by this installation profile.
  compatibility_video_limit_bytes: 50_000_000,
  auto_rls_definition_sha256: 'b21d88816c445d14cef5032c3cd4abaebc1db2001fcb3435022ab6b496182ca4',
  auto_rls_destination: 'extensions',
})
export const productionProfileDigest = createHash('sha256').update(JSON.stringify(productionProfile, null, 2) + '\n').digest('hex')
export const productionBinding = () => ({ id: productionProfile.id, sha256: productionProfileDigest })

export function assertProductionTarget(target) {
  const binding = target.production_profile
  assert.deepEqual(binding, productionBinding(), 'Unknown production profile')
  assert.equal(target.profile, 'supabase-direct')
  assert.equal(target.project_ref, productionProjectRef)
  assert.equal(target.api_url, productionProfile.api_url)
  assert.equal(target.site_origin, productionProfile.site_origin)
  assert.equal(target.database.host, productionProfile.database_host)
  assert.equal(target.database.port, 5432)
  assert.equal(target.database.name, 'postgres')
  assert.equal(target.database.user, 'postgres')
  assert.equal(target.laboratory, undefined)
  assert.ok(target.excluded_project_refs.includes('zsqhuwgoasrexdnamlks'))
  assert.ok(target.reservation_policy, 'Production requires protected exclusions')
}

export function assertProductionSource(target, source) {
  if (!target.production_profile) return
  assertProductionTarget(target)
  assert.equal(source.release?.id, productionProfile.release_id)
  assert.equal(source.release?.certificate_sha256, productionProfile.certificate_sha256)
  assert.equal(source.release?.last_migration, 82)
}

export function storageBucketsFor(target, original) {
  if (!target?.production_profile) return original
  assertProductionTarget(target)
  assert.equal(original.length, 6)
  assert.equal(original.filter(bucket => bucket.id === productionProfile.video_bucket).length, 1)
  return original.map(bucket => bucket.id === productionProfile.video_bucket
    ? { ...bucket, file_size_limit: productionProfile.compatibility_video_limit_bytes }
    : bucket)
}

export function productionApiOperationAllowed(target, path, method = 'GET', mutating = false) {
  if (!target?.production_profile) return true
  assertProductionTarget(target)
  method = method.toUpperCase()
  const reading = method === 'GET' || method === 'HEAD'
  // Storage is metadata-only, even for the service/secret key. No object read,
  // upload, signed-upload token, copy, move, deletion, or resumable/S3 route.
  if (path.startsWith('/storage/v1')) {
    if (reading) return /^\/storage\/v1\/bucket(?:\/[a-z0-9-]+)?$/.test(path)
    return mutating && method === 'POST' && path === '/storage/v1/bucket'
  }
  if (reading) return true
  return mutating && method === 'POST' && path === '/auth/v1/admin/users'
}

// This exact dashboard helper is platform infrastructure, never application data.
// Pin its complete body, privileges, owner, configuration and active trigger.
// No generic existing function is accepted by this exception.
export async function productionHelper(db, target) {
  if (!target?.production_profile) return null
  assertProductionTarget(target)
  const rows = (await db.query(`select n.nspname location,pg_get_functiondef(p.oid) definition,
    p.proacl::text acl,p.proconfig configuration,pg_get_userbyid(p.proowner) owner,
    l.lanname language,p.prorettype::regtype::text returns,p.prosecdef security_definer
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
    where p.oid in (to_regprocedure('public.rls_auto_enable()'),to_regprocedure('extensions.rls_auto_enable()'))`)).rows
  assert.equal(rows.length, 1, 'Expected exactly one reviewed auto-RLS helper')
  const {location,definition,...metadata} = rows[0]
  const canonical = definition.replace('FUNCTION extensions.rls_auto_enable()', 'FUNCTION public.rls_auto_enable()')
  const triggers = (await db.query(`select e.evtname name,e.evtevent event,pg_get_userbyid(e.evtowner) owner,e.evtenabled enabled,e.evttags tags
    from pg_event_trigger e join pg_proc p on p.oid=e.evtfoid join pg_namespace n on n.oid=p.pronamespace
    where p.proname='rls_auto_enable' and n.nspname in ('public','extensions') order by e.evtname`)).rows
  const identity = {...metadata,definition_sha256:createHash('sha256').update(canonical).digest('hex'),triggers}
  assert.deepEqual(identity, {
    acl:null,configuration:['search_path=pg_catalog'],owner:'postgres',language:'plpgsql',returns:'event_trigger',security_definer:true,
    definition_sha256:productionProfile.auto_rls_definition_sha256,
    triggers:[{name:'ensure_rls',event:'ddl_command_end',owner:'postgres',enabled:'O',tags:['CREATE TABLE','CREATE TABLE AS','SELECT INTO']}],
  }, 'Reviewed auto-RLS helper changed')
  return {location,identity}
}

export async function productionFreshGuard(db, target, guard) {
  const helper = await productionHelper(db, target)
  if (helper?.location !== 'public') return guard
  const original = "EXISTS(SELECT FROM pg_proc WHERE pronamespace='public'::regnamespace)"
  assert.equal(guard.split(original).length, 2)
  // Planning only: every other fresh-target predicate remains identical.
  // The original frozen SQL guard runs unchanged after the transactional move.
  return guard.replace(original, "EXISTS(SELECT FROM pg_proc WHERE pronamespace='public'::regnamespace AND oid<>'public.rls_auto_enable()'::regprocedure)")
}

export async function prepareProductionBaseline(db, target) {
  const helper = await productionHelper(db, target)
  if (!helper) return
  if (helper.location === 'public') await db.query('ALTER FUNCTION public.rls_auto_enable() SET SCHEMA extensions')
  assert.equal((await productionHelper(db, target)).location, 'extensions')
}

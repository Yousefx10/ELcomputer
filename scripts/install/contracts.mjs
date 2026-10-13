import { createHash } from 'node:crypto'
import { readFile, readdir, lstat } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { resolve, relative, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { verifyBundle, hash, json } from '../lib/cleanBaseline.mjs'
import { assertPolicyTarget } from '../lib/targetPolicy.mjs'

export const sourceRoot = fileURLToPath(new URL('../../', import.meta.url))
export const migration71 = '20261012160000_quick_setup_installation_bootstrap.sql'
export const cliVersion = '2.109.1'
export const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
// Public references, already recorded in PROJECT_STATE and the staging runner.
export const protectedProjectRefs = ['zsqhuwgoasrexdnamlks']
const messages = {
  policy_invalid: 'Supply the protected additional reservation policy and review record.',
  policy_changed: 'The approved additional policy changed. Preserve the frozen installation.',
  invalid_input: 'Use the documented strict manifest and command options.',
  protected_target: 'This target is excluded. Select a genuinely new project.',
  ambient_credentials: 'Use a clean environment; provide credentials through a protected file.',
  unsafe_file: 'Use an absolute, owned path without symlinks and private permissions.',
  source_changed: 'The frozen source or artifact changed. Stop and review the installation.',
  target_changed: 'The target identity or TLS evidence changed. Stop and investigate.',
  target_occupied: 'The target is occupied or ambiguous. Never reset or overwrite it.',
  platform_unavailable: 'The approved platform capability is unavailable. Check the prerequisites.',
  lock_busy: 'Another installer holds this target or workspace lock.',
  lock_uncertain: 'The previous lock cannot be proven stale. Investigate before continuing.',
  checkpoint_changed: 'The protected checkpoint chain is invalid. Do not infer ownership from tables.',
  confirmation_required: 'Confirm the exact project, installation UUID and frozen plan digest.',
  stage_uncertain: 'The stage outcome is uncertain. Use resume for exact reconciliation.',
  history_uncertain: 'Migration history is inconsistent. Stop; do not repair unknown versions.',
  bootstrap_uncertain: 'Owner creation is unresolved. Preserve the identity and exact request.',
  installation_complete: 'This installation is complete. Use verify; apply cannot run again.',
  owner_unavailable: 'The accepted owner is unavailable. Bootstrap remains permanently sealed.'
}
export class InstallationError extends Error {
  constructor(code) { const safe=Object.hasOwn(messages,code)?code:'stage_uncertain';super(messages[safe]);this.code = safe }
}
export const fail = code => { throw new InstallationError(code) }
export const ensure = (condition, code = 'invalid_input') => { if (!condition) fail(code) }
export const digest = value => hash(json(value))
export function object(value, keys, required = keys) {
  ensure(value && typeof value === 'object' && !Array.isArray(value))
  ensure(Object.keys(value).every(key => keys.includes(key)) && required.every(key => Object.hasOwn(value,key)))
}
export function safeEnvironment(environment = process.env) {
  ensure(!Object.keys(environment).some(key => /^(PG[A-Z_]*|DATABASE_URL|SUPABASE(?:_.*)?|NUXT_.*(?:KEY|SECRET|TOKEN|PASSWORD)|NODE_OPTIONS|NODE_TLS_REJECT_UNAUTHORIZED|NODE_EXTRA_CA_CERTS|SSLKEYLOGFILE)$/.test(key) && environment[key]),'ambient_credentials')
}
export function validateTarget(target) {
  object(target,['format','profile','installation_id','project_ref','api_url','site_origin','database','api_ca_file','excluded_project_refs','laboratory','reservation_policy'],['format','profile','installation_id','project_ref','api_url','site_origin','database','excluded_project_refs'])
  ensure(target.format===1 && ['supabase-direct','owned-laboratory'].includes(target.profile))
  ensure(uuid.test(target.installation_id) && /^[a-z0-9]{20}$/.test(target.project_ref))
  ensure(Array.isArray(target.excluded_project_refs) && target.excluded_project_refs.every(ref=>/^[a-z0-9]{20}$/.test(ref)))
  ensure(![...protectedProjectRefs,...target.excluded_project_refs].includes(target.project_ref),'protected_target')
  let site,api
  try { site=new URL(target.site_origin);api=new URL(target.api_url) } catch { fail('invalid_input') }
  ensure(site.protocol==='https:' && !site.username && !site.password && site.origin===target.site_origin && site.pathname==='/' && !site.search && !site.hash)
  ensure(target.site_origin.length<=253 && /^https:\/\/[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:[1-9][0-9]{0,4})?$/.test(target.site_origin) && !/\.\.|(^https:\/\/|\.)-|-(\.|:|$)/.test(target.site_origin))
  ensure(!/(^|\.)elcomputer\.net$/i.test(site.hostname),'protected_target')
  ensure(api.protocol==='https:' && !api.username && !api.password && !api.search && !api.hash)
  object(target.database,['host','port','name','user','ca_file'])
  ensure(target.database.name==='postgres' && target.database.user==='postgres' && isAbsolute(target.database.ca_file))
  ensure(target.api_ca_file==null || isAbsolute(target.api_ca_file))
  if(target.profile==='supabase-direct') {
    ensure(target.api_url===`https://${target.project_ref}.supabase.co` && target.database.host===`db.${target.project_ref}.supabase.co` && target.database.port===5432)
    ensure(!target.laboratory)
  } else {
    object(target.laboratory,['instance_id','identity_file'])
    ensure(uuid.test(target.laboratory.instance_id) && isAbsolute(target.laboratory.identity_file))
    ensure(api.hostname==='127.0.0.1' && api.port && api.pathname===`/projects/${target.project_ref}`)
    ensure(target.database.host==='127.0.0.1' && Number.isInteger(target.database.port) && target.database.port>=1024 && target.database.port<=65535 && target.api_ca_file)
  }
  assertPolicyTarget(target)
  return target
}
export function validateCredentials(credentials,target) {
  object(credentials,['project_ref','database_password','service_role_key','anon_key'])
  ensure(credentials.project_ref===target.project_ref,'target_changed')
  ensure(typeof credentials.database_password==='string' && credentials.database_password.length>0 && credentials.database_password.length<=4096 && !/[\r\n\0]/.test(credentials.database_password))
  for(const [key,role,prefix] of [['service_role_key','service_role','sb_secret_'],['anon_key','anon','sb_publishable_']]) {
    const value=credentials[key]
    ensure(typeof value==='string' && value.length<=4096 && !/[\s\x00-\x1f]/.test(value))
    if(value.startsWith(prefix)) { ensure(/^[A-Za-z0-9_-]+$/.test(value) && value.length>=32);continue }
    let header,claims
    try { const parts=value.split('.');ensure(parts.length===3);header=JSON.parse(Buffer.from(parts[0],'base64url'));claims=JSON.parse(Buffer.from(parts[1],'base64url')) } catch { fail('invalid_input') }
    // Decoding is only a routing/role check. Named TLS APIs authenticate keys.
    ensure(header.alg==='HS256' && claims.ref===target.project_ref && claims.role===role && claims.exp>Date.now()/1000,'target_changed')
  }
  return credentials
}
export function validateOwner(input) {
  object(input,['email','password','full_name'],['email','password'])
  ensure(typeof input.email==='string' && input.email.length<=320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email))
  ensure(typeof input.password==='string' && input.password.length>=16 && input.password.length<=1024 && !/[\r\n\0]/.test(input.password))
  ensure(input.full_name==null || typeof input.full_name==='string' && input.full_name.length<=120 && !/[\x00-\x1f\x7f]/.test(input.full_name))
  return input
}
export async function frozenSource() {
  for(const path of ['supabase/.temp/project-ref','supabase/.branches/_current_branch']){
    try{await lstat(resolve(sourceRoot,path));fail('source_changed')}catch(error){if(error.code!=='ENOENT')throw error}
  }
  const git=async args=>(await promisify(execFile)('git',['-c','core.fsmonitor=false',...args],{cwd:sourceRoot,env:{PATH:process.env.PATH,LANG:'C',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0'},maxBuffer:4*1024*1024})).stdout
  ensure(!(await git(['status','--porcelain','--untracked-files=all'])).trim(),'source_changed')
  const commit=(await git(['rev-parse','HEAD'])).trim(),names=(await git(['ls-files','-z'])).split('\0').filter(Boolean).sort()
  ensure(/^[0-9a-f]{40}$/.test(commit) && names.length>0,'source_changed')
  const tree=createHash('sha256')
  for(const name of names) {
    ensure(!/^(\.env|\.deploy\.env)$/.test(name) && !isAbsolute(name) && !relative(sourceRoot,resolve(sourceRoot,name)).startsWith('..'),'source_changed')
    tree.update(name+'\t'+hash(await readFile(resolve(sourceRoot,name)))+'\n')
  }
  const {manifest,inventory}=await verifyBundle(),follow=JSON.parse(await readFile(new URL('../../supabase/bootstrap/portability-v1/manifest.json',import.meta.url)))
  const migration=await readFile(new URL('../../supabase/migrations/'+migration71,import.meta.url))
  ensure(JSON.stringify((await readdir(new URL('../../supabase/migrations/',import.meta.url))).filter(name=>name.endsWith('.sql')).sort())===JSON.stringify([...inventory.map(row=>row.filename),migration71].sort()),'source_changed')
  ensure(follow.migration.sha256===hash(migration),'source_changed')
  for(const [name,expected] of Object.entries(follow.artifacts)) ensure(hash(await readFile(new URL('../../supabase/bootstrap/portability-v1/'+name,import.meta.url)))===expected,'source_changed')
  return {commit,tree_sha256:tree.digest('hex'),baseline_manifest_sha256:hash(json(manifest)),baseline_inventory_sha256:manifest.migration_inventory_sha256,migration71_sha256:hash(migration),follow_on_manifest_sha256:hash(json(follow)),covered_versions:inventory.map(row=>row.version),cli_version:cliVersion}
}

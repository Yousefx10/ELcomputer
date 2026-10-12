import { createHash } from 'node:crypto'

// Operator library only. No CLI, endpoint, dotenv, logger or automatic target
// selection. Milestone 3 must validate/lock the target and collect private input.
const digest = value => createHash('sha256').update(value).digest('hex')
const stop = code => { const error = Error('Installation bootstrap stopped: ' + code); error.code = code; throw error }
export function ownerBinding(target, email) {
  const keys = ['installation_id','request_id','target_digest','project_ref','site_origin']
  if (!target || Object.keys(target).length !== keys.length || keys.some(key => typeof target[key] !== 'string')) stop('invalid_target')
  if (typeof email !== 'string' || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) stop('invalid_owner')
  return { ...target, owner_email_digest: digest(email.trim().toLowerCase()) }
}
export const bootstrapMarker = binding => ({ version: 1, installation_id: binding.installation_id, request_id: binding.request_id, target_digest: binding.target_digest, project_ref: binding.project_ref })

export async function bootstrapFirstOwner({ db, authAdmin, target, email, password, fullName = '', confirmOwner = false }) {
  const binding = ownerBinding(target, email)
  // Deliberate operator confirmation; no default password or email dispatch.
  if (!confirmOwner || typeof password !== 'string' || password.length < 16 || password.length > 1024 || typeof fullName !== 'string' || fullName.length > 120 || /[\x00-\x1f\x7f]/.test(fullName)) stop('invalid_owner')
  const sql = async (name, args = []) => (await db.query('select private.' + name + '($1::jsonb' + args.map((_, i) => ',$' + (i + 2)).join('') + ') result', [binding, ...args])).rows[0].result
  const record = async code => { try { await sql('installation_record_error', [code]) } catch { /* Never expose underlying database diagnostics. */ } }
  let journal
  try { journal = await sql('installation_register') } catch { stop('binding_conflict') }
  if (journal.phase === 'complete') return journal
  let created = null
  if (journal.phase === 'registered') {
    try { journal = await sql('installation_start_auth', [journal.revision]) } catch { stop('competing_request') }
    // Durable checkpoint precedes Auth HTTP. Never repeat creation on resume.
    try {
      const response = await authAdmin.createUser({ email: email.trim().toLowerCase(), password, email_confirm: true, user_metadata: { full_name: fullName }, app_metadata: { elcomputer_bootstrap: bootstrapMarker(binding) } })
      if (!response.error) created = response.data?.user?.id || null
    } catch { /* Lost response: reconcile without repeating HTTP creation. */ }
  }
  // A bounded Auth Admin listing checks exact server-controlled request markers.
  // SQL repeats all identity checks against authoritative Auth rows under lock.
  let users
  try {
    const response = await authAdmin.listUsers({ page: 1, perPage: 2 })
    if (response.error || !Array.isArray(response.data?.users)) throw Error()
    users = response.data.users
  } catch { await record('auth_unresolved'); stop('auth_unresolved') }
  const marker = bootstrapMarker(binding)
  const exact = user => {
    const value = user.app_metadata?.elcomputer_bootstrap
    return value && Object.keys(value).length === Object.keys(marker).length && Object.entries(marker).every(([key, expected]) => value[key] === expected) && user.email?.trim().toLowerCase() === email.trim().toLowerCase()
  }
  if (users.length !== 1 || !exact(users[0]) || (created && created !== users[0].id)) {
    const code = users.length ? 'identity_conflict' : 'auth_unresolved'
    await record(code); stop(code)
  }
  try { return await sql('installation_link_owner', [users[0].id]) } catch {
    // A commit acknowledgement can be lost. A sealed receipt confirms success.
    try { journal = await sql('installation_register'); if (journal.phase === 'complete' && journal.auth_subject === users[0].id) return journal } catch { /* Preserve subject; resume exact request later. */ }
    await record('promotion_failed'); stop('promotion_failed')
  }
}

import { createHmac, timingSafeEqual } from 'node:crypto'
import { createError } from 'h3'
import { readQuickSetupStatus } from './quickSetup.js'
import { setupItemIds, setupOptionalIntegrations, setupAcceptanceChecks, setupAcceptanceDomains, setupVerificationDomains } from '../../app/utils/quickSetup.js'

const fail = (statusCode = 400) => { throw createError({ statusCode, statusMessage: 'Setup request could not continue.' }) }
const outcomes = ['selected', 'excluded', 'verified', 'unverified', 'failed', 'stale', 'unavailable', 'acknowledged', 'revoked']
const sources = ['owner_selection', 'existing_check', 'configuration_snapshot', 'owner_report']
const integer = value => Number.isSafeInteger(value) && value >= 0
const token = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null
const ordered = value => Array.isArray(value) ? value.map(ordered) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])])) : value
const canonical = value => JSON.stringify(ordered(value))
const equalToken = (a, b) => token(a) && token(b) && timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))

// Private runtime values enter only an installation-scoped HMAC binding.
// Neither values nor plaintext credential hashes are stored or returned.
const runtimeBasis = (runtime, domains) => {
  const context = {}
  const include = (domain, names) => { if (domains.includes(domain)) for (const name of names) context[name] = runtime[name] ?? null }
  if (domains.some(d => ['application', 'authentication', 'infrastructure', 'oauth', 'live_chat'].includes(d))) context.public = {
    origin: runtime.public?.siteUrl ?? null, project: runtime.public?.supabaseUrl ?? null, key: runtime.public?.supabase?.key ?? null
  }
  include('daftra', ['daftraAccountUrl', 'daftraApiKey', 'daftraClientId', 'credentialsEncryptionKey', 'erpWorkerSecret'])
  include('vodafone', ['credentialsEncryptionKey', 'smsWorkerSecret'])
  include('brevo', ['credentialsEncryptionKey', 'emailWorkerSecret'])
  include('shipping', ['shippingCredentialsEncryptionKey', 'shippingWorkerSecret', 'shippingLiveRequestsEnabled', 'shippingDocumentsDir'])
  include('paymob', ['paymobEnabled', 'paymobLiveRequestsEnabled', 'paymobMode', 'paymobSecretKey', 'paymobPublicKey', 'paymobHmacSecret', 'paymobCardIntegrationId', 'paymobCardIntegrationMode', 'paymobIntegrationIds'])
  if (domains.includes('paymob')) context.paymentOrigin = runtime.public?.siteUrl ?? null
  include('payment_methods', ['paymobEnabled', 'paymobLiveRequestsEnabled', 'paymobMode'])
  return context
}
const domainsFor = (action, key) => action === 'acknowledge' ? setupAcceptanceDomains[key] : setupVerificationDomains[key]
export const setupBasisToken = (snapshot, runtime, action, key) => {
  if (typeof runtime.supabaseServiceRoleKey !== 'string' || runtime.supabaseServiceRoleKey.length < 12) return null
  const domains = domainsFor(action, key)
  return createHmac('sha256', runtime.supabaseServiceRoleKey).update(canonical({ version: 2, installation: snapshot.installationId,
    action, key, revisions: Object.fromEntries(domains.map(d => [d, snapshot.revisions[d]])),
    selection: Object.fromEntries(setupOptionalIntegrations.filter(k => domains.includes(k === 'pdc' ? 'shipping' : k)).map(k => [k, snapshot.selections[k]])), runtime: runtimeBasis(runtime, domains)
  })).digest('hex')
}
const normalizeSnapshot = raw => {
  const revision = typeof raw?.revision === 'string' && /^\d+$/.test(raw.revision) ? Number(raw.revision) : raw?.revision
  if (!raw || !/^[a-f0-9-]{36}$/i.test(raw.installation_id) || !integer(revision) || !raw.selections || !raw.revisions || !Array.isArray(raw.latest) || !Array.isArray(raw.history)) return null
  if (Object.keys(raw.selections).some(k => !setupOptionalIntegrations.includes(k) || typeof raw.selections[k] !== 'boolean') || setupItemIds.some(k => !integer(raw.revisions[k])) || Object.keys(raw.revisions).some(k => !setupItemIds.includes(k)) || raw.history.length > 50 || raw.latest.length > 32) return null
  const events = rows => rows.map(row => {
    const keys = row.action === 'selection' ? setupOptionalIntegrations : row.action === 'capture' ? setupItemIds : row.action === 'acknowledge' ? setupAcceptanceChecks : []
    if (!keys.includes(row.key) || !outcomes.includes(row.outcome) || !sources.includes(row.source) || !integer(row.state_revision) || !date(row.created_at)) throw Error('Invalid setup metadata.')
    if (row.action !== 'selection' && !token(row.basis_token)) throw Error('Invalid setup binding.')
    if (row.outcome === 'verified' && (row.key !== 'daftra' || row.source !== 'existing_check')) throw Error('Unsupported setup verification.')
    return { action: row.action, key: row.key, outcome: row.outcome, source: row.source, revision: row.state_revision,
      basisToken: row.basis_token, checkedAt: date(row.checked_at), expiresAt: date(row.expires_at), createdAt: date(row.created_at) }
  })
  try { return { installationId: raw.installation_id, revision,
    selections: Object.fromEntries(setupOptionalIntegrations.map(key => [key, raw.selections[key] === true])),
    revisions: Object.fromEntries(setupItemIds.map(k => [k, raw.revisions[k]])), latest: events(raw.latest), history: events(raw.history), updatedAt: date(raw.updated_at) } } catch { return null }
}
const readSnapshot = async db => {
  try {
    const { data, error } = await db.from('quick_setup_snapshot').select('installation_id,revision,selections,updated_at,revisions,latest,history').eq('singleton', true).maybeSingle().abortSignal(AbortSignal.timeout(4000))
    return error ? null : normalizeSnapshot(data)
  } catch { return null }
}
const unavailableMetadata = () => ({ available: false, revision: null, selections: [], acknowledgements: [], history: [], verificationProgress: null, ownerReviewProgress: null })
const stateFor = (record, currentToken, now, available = true) => {
  if (!available || !currentToken) return 'unavailable'
  if (!record) return 'unverified'
  if (!equalToken(record.basisToken, currentToken) || !record.expiresAt || Date.parse(record.expiresAt) <= now || !record.checkedAt || Date.parse(record.checkedAt) > now) return 'stale'
  return record.outcome
}
export const applySetupMetadata = (status, snapshot, runtime, now = Date.now()) => {
  if (!snapshot) return { ...status, setup: unavailableMetadata() }
  const latest = (action, key) => snapshot.latest.find(row => row.action === action && row.key === key)
  const items = status.items.map(entry => {
    const basisToken = setupBasisToken(snapshot, runtime, 'capture', entry.id), record = latest('capture', entry.id)
    const available = !entry.notes.includes('settings_unavailable') && entry.configuration !== 'unsupported'
    return { ...entry, evidence: { state: stateFor(record, basisToken, now, available), source: record?.source || null,
      checkedAt: record?.checkedAt || null, expiresAt: record?.expiresAt || null, basisToken, configurationRevision: snapshot.revisions[entry.id] } }
  })
  const acknowledgements = setupAcceptanceChecks.map(key => {
    const basisToken = setupBasisToken(snapshot, runtime, 'acknowledge', key), record = latest('acknowledge', key)
    return { key, state: stateFor(record, basisToken, now), checkedAt: record?.checkedAt || null, expiresAt: record?.expiresAt || null, basisToken }
  })
  const count = (values, completeState) => ({ complete: values.filter(v => v.state === completeState).length, total: values.length })
  return { ...status, items, selection: 'saved_configuration_and_owner_choices', setup: {
    available: true, installationId: snapshot.installationId, revision: snapshot.revision, updatedAt: snapshot.updatedAt,
    selections: setupOptionalIntegrations.map(key => ({ key, selected: snapshot.selections[key], inUse: status.configuredSelections[key] })), acknowledgements,
    history: snapshot.history.map(row => ({ action: row.action, key: row.key, outcome: row.outcome, source: row.source, revision: row.revision,
      createdAt: row.createdAt, checkedAt: row.checkedAt, expiresAt: row.expiresAt,
      currentState: row.action === 'selection' ? row.outcome : stateFor(row, setupBasisToken(snapshot, runtime, row.action, row.key), now) })),
    verificationProgress: count(items.filter(i => i.required).map(i => i.evidence), 'verified'), ownerReviewProgress: count(acknowledgements, 'acknowledged')
  } }
}
const sameSnapshot = (a, b) => a && b && a.installationId === b.installationId && a.revision === b.revision && canonical(a.revisions) === canonical(b.revisions)
export const readQuickSetupProgress = async (db, runtime, now = Date.now(), internal = false) => {
  for (let attempt = 0; attempt < 2; attempt++) {
    const before = await readSnapshot(db), status = await readQuickSetupStatus(db, runtime, now, before?.selections || {})
    if (!before) return internal ? { status: applySetupMetadata(status, null, runtime, now), snapshot: null } : applySetupMetadata(status, null, runtime, now)
    const after = await readSnapshot(db)
    if (sameSnapshot(before, after)) {
      const enriched = applySetupMetadata(status, after, runtime, now)
      return internal ? { status: enriched, snapshot: after } : enriched
    }
  }
  fail(503)
}
export const validateSetupMutation = body => {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Buffer.byteLength(JSON.stringify(body)) > 2048 || !integer(body.revision) || !['selection', 'capture', 'acknowledge'].includes(body.action)) fail()
  const allowed = { selection: ['action', 'key', 'revision', 'selected'], capture: ['action', 'key', 'revision', 'basisToken'], acknowledge: ['action', 'key', 'revision', 'basisToken', 'acknowledged'] }[body.action]
  const keys = body.action === 'selection' ? setupOptionalIntegrations : body.action === 'capture' ? setupItemIds : setupAcceptanceChecks
  if (!allowed || Object.keys(body).some(k => !allowed.includes(k)) || !keys.includes(body.key)) fail()
  if (body.action === 'selection' ? typeof body.selected !== 'boolean' : !token(body.basisToken) || body.action === 'acknowledge' && typeof body.acknowledged !== 'boolean') fail()
  return body
}
export const mutateQuickSetup = async (db, runtime, ownerId, input) => {
  const body = validateSetupMutation(input), { status, snapshot } = await readQuickSetupProgress(db, runtime, Date.now(), true)
  if (!snapshot || !status.setup.available) fail(503)
  if (body.revision !== snapshot.revision) fail(409)
  const command = { revision: body.revision, action: body.action, key: body.key }
  if (body.action === 'selection') command.selected = body.selected
  else {
    const basisToken = setupBasisToken(snapshot, runtime, body.action, body.key)
    if (!equalToken(body.basisToken, basisToken)) fail(409)
    command.basis_token = basisToken
    command.revisions = Object.fromEntries(domainsFor(body.action, body.key).map(k => [k, snapshot.revisions[k]]))
    if (body.action === 'acknowledge') command.acknowledged = body.acknowledged
    else {
      const entry = status.items.find(i => i.id === body.key), existing = body.key === 'daftra' && entry.lastCheckedAt
      command.source = existing ? 'existing_check' : 'configuration_snapshot'
      command.outcome = entry.notes.includes('settings_unavailable') || entry.configuration === 'unsupported' ? 'unavailable'
        : existing ? ({ verified: 'verified', failed: 'failed', stale: 'stale' }[entry.connection] || 'unverified') : 'unverified'
      const previous = snapshot.latest.find(row => row.action === 'capture' && row.key === body.key)
      // An unchanged old test cannot refresh evidence after invalidation.
      if (command.outcome === 'verified' && previous?.checkedAt === entry.lastCheckedAt &&
        (!equalToken(previous.basisToken, basisToken) || previous.outcome === 'stale')) command.outcome = 'stale'
    }
  }
  const { data, error } = await db.rpc('quick_setup_mutate', { p_owner: ownerId, p_input: command })
  if (error) fail(error.code === '40001' ? 409 : error.code === '42501' ? 403 : error.code === '54000' ? 429 : error.code === '22023' ? 400 : 503)
  if (!integer(data?.revision)) fail(503)
  return { revision: data.revision }
}

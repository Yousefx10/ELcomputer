import { createHash } from 'node:crypto'
import { getHeader, send, setHeader } from 'h3'
import { requireCustomerRequest } from './customerRequest.js'
import { requireAdminRequest } from './adminRequest.js'
import { readPaymentCallbackBody } from './payments/body.js'
import { parseChatMultipart, validateChatAttachmentFile, CHAT_ATTACHMENT_TYPES } from './chatAttachmentValidation.js'
import { claimTypes, claimActionPermissions } from '../../app/utils/afterSalesClaims.js'
import { hasAdminPermission } from '../../app/utils/adminPermissions.js'

export const CLAIM_EVIDENCE_BUCKET = 'after-sales-evidence'
export const CLAIM_EVIDENCE_POLICY = Object.freeze({ enabled: true, allowedMimes: Object.keys(CHAT_ATTACHMENT_TYPES), maxBytes: 5242880 })
import { claimError, claimUuid, exact } from './afterSalesClaimValidation.js'

export const requireClaimActor = async (event, staff = false, permission = 'claims.view') => {
  const actor = staff ? await requireAdminRequest(event, { permission }) : await requireCustomerRequest(event)
  return { id: staff ? actor.adminUser.id : actor.authUser.id, db: actor.supabaseAdmin, staff, admin: actor.adminUser }
}
export const requireClaimActionPermission = (actor, action) => {
  if (!hasAdminPermission(actor.admin, claimActionPermissions[action])) claimError('forbidden', 403)
}
export const readClaimBody = async event => {
  try { return JSON.parse(await readPaymentCallbackBody(event, 32768, 10000)) }
  catch (error) { if ([408, 413].includes(error.statusCode)) throw error; claimError('input') }
}
const rpcMessages = {
  'Claim eligibility denied.': 'eligibility', 'Claim transition denied.': 'transition', 'Claim resolution denied.': 'resolution',
  'Claim serial review required.': 'serialRequired', 'Claim evidence disabled.': 'evidenceDisabled', 'Claim evidence limit.': 'evidenceLimit',
  'Claim evidence unavailable.': 'evidence', 'Claim retry conflict.': 'conflict', 'Invalid claim input.': 'input'
}
export const claimRpc = async (db, name, args) => {
  const { data, error } = await db.rpc(name, args)
  if (error) {
    if (error.code === 'P0002') claimError('notFound', 404)
    if (error.code === '42501') claimError('forbidden', 403)
    if (error.code === '23505') claimError('duplicate', 409)
    if (error.code === '40001') claimError('conflict', 409)
    if (rpcMessages[error.message]) claimError(rpcMessages[error.message], error.code === '23514' ? 409 : 400)
    claimError('unavailable', 503)
  }
  return data
}
export const claimHandler = handler => async event => {
  setHeader(event, 'Cache-Control', 'private, no-store')
  try { return await handler(event) } catch (error) {
    if (error.statusCode && error.statusCode < 500) throw error
    claimError('unavailable', 503)
  }
}
const safeEvidence = row => ({ id: row.id, original_name: row.original_name, mime_type: row.mime_type, size_bytes: row.size_bytes })
const discardStage = async (actor, id) => {
  // Tombstone under the item lock before deleting bytes. A submitted file is
  // denied here, including a racing submit after upload completion.
  const row = await claimRpc(actor.db, 'after_sales_claim_finish_evidence', { p_customer: actor.id, p_id: id, p_remove: true })
  const { error } = await actor.db.storage.from(CLAIM_EVIDENCE_BUCKET).remove([row.storage_path])
  if (error) claimError('unavailable', 503)
  return { removed: true }
}
export const removeClaimEvidence = (actor, id) => discardStage(actor, claimUuid(id))
export const uploadClaimEvidence = async (event, actor, itemId) => {
  const maximum = CLAIM_EVIDENCE_POLICY.maxBytes + 32768
  const declared = Number(getHeader(event, 'content-length') || 0)
  if (declared > maximum) claimError('size', 413)
  const chunks = []; let size = 0; let timedOut = false
  const timer = setTimeout(() => { timedOut = true; event.node.req.destroy() }, 30000)
  let parsed
  try {
    for await (const chunk of event.node.req) { size += chunk.length; if (size > maximum) claimError('size', 413); chunks.push(chunk) }
    parsed = parseChatMultipart(Buffer.concat(chunks), getHeader(event, 'content-type'))
  } catch (error) { if (timedOut) claimError('input', 408); if (error.statusCode) throw error; claimError('file') }
  finally { clearTimeout(timer) }
  const { fields, file } = parsed
  // Browsers encode multipart filenames as UTF-8; preserve Arabic filenames.
  try { file.filename = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.from(file.filename, 'latin1')) } catch {}
  exact(fields, ['attachmentId', 'type', 'reasonKey', 'claimId'])
  const id = claimUuid(fields.attachmentId)
  if (!claimTypes.includes(fields.type)) claimError('input')
  let checked
  try { checked = validateChatAttachmentFile(file, CLAIM_EVIDENCE_POLICY) } catch (error) { claimError(error.message === 'CHAT_ATTACHMENT_SIZE' ? 'size' : 'file') }
  const reservation = await claimRpc(actor.db, 'after_sales_claim_reserve_evidence', { p_customer: actor.id, p_item: claimUuid(itemId), p_type: fields.type, p_id: id, p_reason: fields.reasonKey || null, p_target: fields.claimId ? claimUuid(fields.claimId) : null,
    p_metadata: { original_name: checked.originalName, mime_type: checked.mime, size_bytes: checked.bytes.length, content_sha256: checked.sha256 } })
  if (!reservation.ready) {
    const stored = await actor.db.storage.from(CLAIM_EVIDENCE_BUCKET).upload(reservation.storage_path, checked.bytes, { contentType: checked.mime, upsert: false })
    if (stored.error) {
      const existing = await actor.db.storage.from(CLAIM_EVIDENCE_BUCKET).download(reservation.storage_path)
      if (existing.error || !existing.data || createHash('sha256').update(Buffer.from(await existing.data.arrayBuffer())).digest('hex') !== checked.sha256) {
        try { await discardStage(actor, id) } catch {}
        claimError('file', 409)
      }
    }
  }
  const row = await claimRpc(actor.db, 'after_sales_claim_finish_evidence', { p_customer: actor.id, p_id: id, p_remove: false })
  return { item: safeEvidence(row) }
}
export const downloadClaimEvidence = async (event, actor, id) => {
  const row = await claimRpc(actor.db, 'after_sales_claim_read_evidence', { p_actor: actor.id, p_id: claimUuid(id), p_staff: actor.staff })
  const { data, error } = await actor.db.storage.from(CLAIM_EVIDENCE_BUCKET).download(row.storage_path)
  if (error || !data) claimError('notFound', 404)
  const bytes = Buffer.from(await data.arrayBuffer())
  if (bytes.length !== row.size_bytes || createHash('sha256').update(bytes).digest('hex') !== row.content_sha256) claimError('notFound', 404)
  const filename = row.original_name.replace(/["\\\r\n]/g, '_')
  setHeader(event, 'Content-Type', 'application/octet-stream')
  setHeader(event, 'Content-Length', String(bytes.length))
  setHeader(event, 'Content-Disposition', `attachment; filename="${filename.replace(/[^a-z0-9._ -]/gi, '_')}"; filename*=UTF-8''${encodeURIComponent(filename).replace(/'/g, '%27')}`)
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  setHeader(event, 'Content-Security-Policy', "sandbox; default-src 'none'")
  return send(event, bytes)
}

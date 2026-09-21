import { createHash } from 'node:crypto'
import { createError, getHeader, getRouterParam, send, setHeader } from 'h3'
import { chatActorHash, chatError, chatUuid, loadChatConversation, requireChatStaff, requireChatVisitor } from './liveChat'
import { parseChatMultipart, validateChatAttachmentFile } from './chatAttachmentValidation'
import { enforceChatNetworkLimit } from './liveChatRateLimit'

export const CHAT_ATTACHMENT_BUCKET = 'chat-attachments'
export const chatAttachmentFields = 'id,message_id,original_name,mime_type,size_bytes,created_at'

export const loadChatAttachmentPolicy = async actor => {
  const { data, error } = await actor.supabase.from('chat_settings')
    .select('attachments_enabled,allowed_attachment_mimes,max_attachment_bytes,max_attachments_per_message')
    .eq('singleton', true).maybeSingle()
  if (error) chatError(error, 'Could not load attachment settings.')
  return {
    enabled: data?.attachments_enabled === true && Number(data.max_attachments_per_message) > 0,
    allowedMimes: data?.allowed_attachment_mimes || [],
    maxBytes: Number(data?.max_attachment_bytes || 0),
    maxPerMessage: Number(data?.max_attachments_per_message || 0)
  }
}

const attachmentError = error => {
  const messages = {
    CHAT_ATTACHMENTS_DISABLED: [409, 'Attachments are unavailable.'],
    CHAT_ATTACHMENT_TYPE: [400, 'Use a valid JPG, PNG, WebP, or PDF file.'],
    CHAT_ATTACHMENT_NAME: [400, 'Filename is invalid.'],
    CHAT_ATTACHMENT_SIZE: [400, 'The attachment exceeds the allowed size.'],
    CHAT_MULTIPART: [400, 'Choose one valid attachment.']
  }
  const found = messages[error?.message]
  if (found) throw createError({ statusCode: found[0], statusMessage: found[1] })
  throw error
}

const readLimitedMultipart = async (event, maximum) => {
  const declared = Number(getHeader(event, 'content-length') || 0)
  if (declared > maximum) throw createError({ statusCode: 413, statusMessage: 'Attachment request is too large.' })
  let size = 0
  const chunks = []
  for await (const chunk of event.node.req) {
    size += chunk.length
    if (size > maximum) throw createError({ statusCode: 413, statusMessage: 'Attachment request is too large.' })
    chunks.push(chunk)
  }
  try { return parseChatMultipart(Buffer.concat(chunks), getHeader(event, 'content-type')) }
  catch (error) { return attachmentError(error) }
}

const safeAttachment = row => ({ id: row.id, message_id: row.message_id,
  original_name: row.original_name, mime_type: row.mime_type,
  size_bytes: row.size_bytes, created_at: row.created_at })

const cleanupStaleReservations = async (supabase, conversationId) => {
  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const stale = await supabase.from('chat_attachments').select('id,storage_path')
    .eq('conversation_id', conversationId).eq('is_ready', false)
    .lt('created_at', cutoff).limit(10)
  if (stale.error || !stale.data?.length) return
  const removed = await supabase.storage.from(CHAT_ATTACHMENT_BUCKET)
    .remove(stale.data.map(item => item.storage_path))
  if (removed.error) return
  await supabase.from('chat_attachments').delete()
    .in('id', stale.data.map(item => item.id)).eq('is_ready', false)
}

export const handleChatAttachmentUpload = async (event, staff = false) => {
  const actor = staff ? await requireChatStaff(event, 'support.reply') : await requireChatVisitor(event)
  const conversationId = chatUuid(getRouterParam(event, 'id'))
  await loadChatConversation(actor, conversationId, staff)
  if (!staff) await enforceChatNetworkLimit(event, actor, 'attachment')
  await cleanupStaleReservations(actor.supabase, conversationId)
  const policy = await loadChatAttachmentPolicy(actor)
  if (!policy.enabled) throw createError({ statusCode: 409, statusMessage: 'Attachments are unavailable.' })
  const { fields, file } = await readLimitedMultipart(event, policy.maxBytes + 32768)
  const messageId = chatUuid(fields.messageId, 'Message')
  const attachmentId = chatUuid(fields.attachmentId, 'Attachment')
  let checked
  try { checked = validateChatAttachmentFile(file, policy) }
  catch (error) { return attachmentError(error) }
  const storagePath = `${conversationId}/${messageId}/${attachmentId}.${checked.extension}`
  const reserved = await actor.supabase.rpc('chat_reserve_attachment', {
    p_attachment_id: attachmentId, p_conversation_id: conversationId,
    p_message_id: messageId, p_actor_id: actor.id,
    p_actor_kind: staff ? 'staff' : actor.kind, p_original_name: checked.originalName,
    p_storage_path: storagePath, p_mime_type: checked.mime,
    p_size_bytes: checked.bytes.length, p_content_sha256: checked.sha256,
    p_subject_hash: chatActorHash(actor.id)
  })
  if (reserved.error) chatError(reserved.error, 'Could not reserve attachment.', event)
  if (reserved.data?.ready === true) {
    const existing = await actor.supabase.from('chat_attachments').select(chatAttachmentFields)
      .eq('id', attachmentId).eq('is_ready', true).single()
    if (existing.error) chatError(existing.error, 'Could not load attachment.')
    return { item: safeAttachment(existing.data) }
  }
  const uploaded = await actor.supabase.storage.from(CHAT_ATTACHMENT_BUCKET)
    .upload(storagePath, checked.bytes, { contentType: checked.mime, upsert: false })
  if (uploaded.error) {
    const existing = await actor.supabase.storage.from(CHAT_ATTACHMENT_BUCKET).download(storagePath)
    if (existing.error || !existing.data) {
      await actor.supabase.storage.from(CHAT_ATTACHMENT_BUCKET).remove([storagePath])
      await actor.supabase.from('chat_attachments').delete()
        .eq('id', attachmentId).eq('is_ready', false)
      throw createError({ statusCode: 500, statusMessage: 'Could not upload the attachment.' })
    }
    const bytes = Buffer.from(await existing.data.arrayBuffer())
    try {
      const verified = validateChatAttachmentFile({ data: bytes, type: checked.mime,
        filename: checked.originalName }, policy)
      if (verified.sha256 !== checked.sha256) throw new Error('mismatch')
    } catch {
      await actor.supabase.storage.from(CHAT_ATTACHMENT_BUCKET).remove([storagePath])
      await actor.supabase.from('chat_attachments').delete()
        .eq('id', attachmentId).eq('is_ready', false)
      throw createError({ statusCode: 409, statusMessage: 'Attachment retry does not match the saved file.' })
    }
  }
  const completed = await actor.supabase.rpc('chat_complete_attachment', {
    p_attachment_id: attachmentId, p_actor_id: actor.id,
    p_content_sha256: checked.sha256
  })
  if (completed.error) {
    const current = await actor.supabase.from('chat_attachments').select(chatAttachmentFields)
      .eq('id', attachmentId).eq('is_ready', true).maybeSingle()
    if (!current.data) {
      await actor.supabase.storage.from(CHAT_ATTACHMENT_BUCKET).remove([storagePath])
      await actor.supabase.from('chat_attachments').delete()
        .eq('id', attachmentId).eq('is_ready', false)
      chatError(completed.error, 'Could not finish attachment.')
    }
    return { item: safeAttachment(current.data) }
  }
  const saved = await actor.supabase.from('chat_attachments').select(chatAttachmentFields)
    .eq('id', attachmentId).eq('is_ready', true).single()
  if (saved.error) chatError(saved.error, 'Could not load attachment.')
  return { item: safeAttachment(saved.data) }
}

export const downloadChatAttachment = async (event, staff = false) => {
  const actor = staff ? await requireChatStaff(event) : await requireChatVisitor(event)
  const id = chatUuid(getRouterParam(event, 'id'), 'Attachment')
  const result = await actor.supabase.from('chat_attachments')
    .select('id,conversation_id,message_id,original_name,storage_path,mime_type,size_bytes,content_sha256')
    .eq('id', id).eq('is_ready', true).maybeSingle()
  if (result.error) chatError(result.error, 'Could not load attachment.')
  if (!result.data) throw createError({ statusCode: 404, statusMessage: 'File not found.' })
  try {
    await loadChatConversation(actor, result.data.conversation_id, staff)
    if (!staff) {
      const message = await actor.supabase.from('chat_messages').select('is_internal')
        .eq('id', result.data.message_id).eq('conversation_id', result.data.conversation_id)
        .maybeSingle()
      if (message.error || !message.data || message.data.is_internal) throw new Error('hidden')
    }
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'File not found.' })
  }
  const file = await actor.supabase.storage.from(CHAT_ATTACHMENT_BUCKET)
    .download(result.data.storage_path)
  if (file.error || !file.data) throw createError({ statusCode: 404, statusMessage: 'File not found.' })
  const buffer = Buffer.from(await file.data.arrayBuffer())
  if (buffer.length !== Number(result.data.size_bytes)
    || (result.data.content_sha256 && createHash('sha256').update(buffer).digest('hex') !== result.data.content_sha256)) {
    throw createError({ statusCode: 404, statusMessage: 'File not found.' })
  }
  const filename = result.data.original_name.replace(/["\\\r\n]/g, '_')
  setHeader(event, 'Content-Type', 'application/octet-stream')
  setHeader(event, 'Content-Length', String(buffer.length))
  const encodedName = encodeURIComponent(filename).replace(/'/g, '%27')
  setHeader(event, 'Content-Disposition', `attachment; filename="${filename.replace(/[^a-z0-9._ -]/gi, '_')}"; filename*=UTF-8''${encodedName}`)
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  setHeader(event, 'Content-Security-Policy', "sandbox; default-src 'none'")
  setHeader(event, 'Cache-Control', 'private, no-store')
  return send(event, buffer)
}

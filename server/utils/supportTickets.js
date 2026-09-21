import { randomUUID } from 'node:crypto'
import { createError, getHeader, getRouterParam, readMultipartFormData, send, setHeader } from 'h3'
import { hasAdminPermission } from '~/utils/adminPermissions'
import { getSupabaseAdminClient } from './supabaseAdmin'
import { requireAdminRequest } from './adminRequest'
import { requireCustomerRequest } from './customerRequest'

export const SUPPORT_BUCKET = 'support-attachments'
export const ticketFields = 'id, reference_number, customer_id, customer_email, customer_mobile, customer_name, order_id, category_id, subject, status, priority, assigned_admin_id, created_at, updated_at, last_reply_at, closed_at'
export const customerTicketFields = 'id, reference_number, order_id, category_id, subject, status, created_at, updated_at, last_reply_at, closed_at'
export const messageFields = 'id, ticket_id, sender_id, sender_type, sender_name, body, is_internal, customer_read_at, created_at'
export const attachmentFields = 'id, ticket_id, message_id, original_name, mime_type, size_bytes, created_at'
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const requireSupportUuid = (value, label = 'Ticket') => {
  const id = String(value || '').trim()
  if (!UUID_PATTERN.test(id)) throw createError({ statusCode: 400, statusMessage: `${label} is invalid.` })
  return id
}

export const supportText = (value, label, maximum, required = true) => {
  const text = String(value || '').trim()
  if ((required && !text) || text.length > maximum) {
    throw createError({ statusCode: 400, statusMessage: `${label} must be ${required ? '1–' : 'at most '}${maximum} characters.` })
  }
  return text
}

export const supportIdempotencyKey = (value) => {
  if (value === undefined || value === null || value === '') return randomUUID()
  return requireSupportUuid(value, 'Submission key')
}

export const throwSupportError = (error, fallback = 'Could not complete the request.') => {
  if (['42P01', '42703', 'PGRST202', 'PGRST205'].includes(error?.code)) {
    throw createError({ statusCode: 503, statusMessage: 'Support is not installed yet.' })
  }
  if (error?.code === '23505') throw createError({ statusCode: 409, statusMessage: 'This request was already saved.' })
  if (error?.code === '22023' || error?.code === '23503' || error?.code === '23514') {
    throw createError({ statusCode: 409, statusMessage: 'Ticket details changed. Refresh and try again.' })
  }
  throw createError({ statusCode: 500, statusMessage: fallback })
}

export const requireCustomerTicket = async (supabase, customerId, id) => {
  const { data, error } = await supabase.from('support_tickets')
    .select(customerTicketFields).eq('id', requireSupportUuid(id))
    .eq('customer_id', customerId).maybeSingle()
  if (error) throwSupportError(error, 'Could not load ticket.')
  if (!data) throw createError({ statusCode: 404, statusMessage: 'Ticket not found.' })
  return data
}

export const requireStaffTicket = async (supabase, id) => {
  const { data, error } = await supabase.from('support_tickets')
    .select(ticketFields).eq('id', requireSupportUuid(id)).maybeSingle()
  if (error) throwSupportError(error, 'Could not load ticket.')
  if (!data) throw createError({ statusCode: 404, statusMessage: 'Ticket not found.' })
  return data
}

export const loadTicketThread = async (supabase, ticket, forStaff = false) => {
  let request = supabase.from('support_ticket_messages').select(messageFields)
    .eq('ticket_id', ticket.id).order('created_at').order('id').limit(500)
  if (!forStaff) request = request.eq('is_internal', false)
  const { data: messages, error: messageError } = await request
  if (messageError) throwSupportError(messageError, 'Could not load conversation.')
  const messageIds = (messages || []).map(message => message.id)
  let attachments = []
  if (messageIds.length) {
    const result = await supabase.from('support_ticket_attachments')
      .select(attachmentFields).eq('ticket_id', ticket.id).in('message_id', messageIds)
      .order('created_at')
    if (result.error) throwSupportError(result.error, 'Could not load attachments.')
    attachments = result.data || []
  }
  return { messages: messages || [], attachments }
}

export const loadTicketOrder = async (supabase, ticket, forStaff = false) => {
  if (!ticket.order_id) return null
  const fields = forStaff
    ? 'id, order_number, status, payment_status, payment_method, shipping_method, total_amount, currency, created_at'
    : 'id, order_number, status, created_at'
  const { data, error } = await supabase.from('customer_orders').select(fields)
    .eq('id', ticket.order_id).eq('user_id', ticket.customer_id).maybeSingle()
  if (error) throwSupportError(error, 'Could not load order.')
  return data || null
}

export const loadTicketSourceChat = async (supabase, ticket, forStaff = false) => {
  let request = supabase.from('chat_conversations')
    .select('id,reference_number,status,created_at').eq('ticket_id', ticket.id)
  if (!forStaff) request = request.eq('customer_id', ticket.customer_id)
  const { data, error } = await request.maybeSingle()
  if (error) throwSupportError(error, 'Could not load source chat.')
  if (!data) return null
  if (!forStaff) return data
  const { count, error: attachmentError } = await supabase.from('chat_attachments')
    .select('id', { count: 'exact', head: true }).eq('conversation_id', data.id).eq('is_ready', true)
  if (attachmentError) throwSupportError(attachmentError, 'Could not load source chat files.')
  return { ...data, attachmentCount: count || 0 }
}

export const handleSupportUpload = async (event, actorType) => {
  const actor = actorType === 'staff'
    ? await requireAdminRequest(event, { permission: 'support.reply' })
    : await requireCustomerRequest(event)
  const supabase = actor.supabaseAdmin
  const actorId = actorType === 'staff' ? actor.adminUser.id : actor.authUser.id
  const ticketId = requireSupportUuid(getRouterParam(event, 'id'))
  if (actorType === 'staff') await requireStaffTicket(supabase, ticketId)
  else await requireCustomerTicket(supabase, actorId, ticketId)

  const contentLength = Number(getHeader(event, 'content-length') || 0)
  if (contentLength > 6 * 1024 * 1024) {
    throw createError({ statusCode: 413, statusMessage: 'Attachment must be 5 MB or smaller.' })
  }

  const parts = await readMultipartFormData(event)
  const messageId = requireSupportUuid(parts?.find(part => part.name === 'messageId')?.data?.toString(), 'Message')
  const file = parts?.find(part => part.name === 'file' && part.filename)
  if (!file?.data?.length || file.data.length > 5 * 1024 * 1024) {
    throw createError({ statusCode: 400, statusMessage: 'Choose a file up to 5 MB.' })
  }
  const { data: message, error: messageError } = await supabase.from('support_ticket_messages')
    .select('id, sender_id, sender_type, is_internal').eq('id', messageId)
    .eq('ticket_id', ticketId).maybeSingle()
  if (messageError) throwSupportError(messageError)
  if (!message || message.sender_id !== actorId || message.sender_type !== actorType) {
    throw createError({ statusCode: 403, statusMessage: 'Attach files to your own message.' })
  }

  const mime = String(file.type || '').toLowerCase()
  const bytes = file.data
  const signatures = {
    'image/jpeg': bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
    'image/png': bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    'image/webp': bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP',
    'application/pdf': bytes.subarray(0, 5).toString() === '%PDF-',
    'text/plain': !bytes.includes(0) && (() => {
      try { new TextDecoder('utf-8', { fatal: true }).decode(bytes); return true }
      catch { return false }
    })()
  }
  if (!signatures[mime]) throw createError({ statusCode: 400, statusMessage: 'Use PDF, TXT, JPG, PNG, or WebP.' })

  const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf', 'text/plain': 'txt' }[mime]
  const originalName = String(file.filename || 'attachment')
    .replace(/[/\\\r\n\x00-\x1f]/g, '_').trim().slice(0, 180)
  if (!originalName) throw createError({ statusCode: 400, statusMessage: 'Filename is invalid.' })
  const storagePath = `${ticketId}/${messageId}/${randomUUID()}.${extension}`
  const { error: uploadError } = await supabase.storage.from(SUPPORT_BUCKET)
    .upload(storagePath, bytes, { contentType: mime, upsert: false })
  if (uploadError) throw createError({ statusCode: 500, statusMessage: 'Could not upload the file.' })
  const { data, error } = await supabase.from('support_ticket_attachments').insert({
    ticket_id: ticketId, message_id: messageId, uploaded_by: actorId,
    original_name: originalName, storage_path: storagePath,
    mime_type: mime, size_bytes: bytes.length
  }).select(attachmentFields).single()
  if (error) {
    await supabase.storage.from(SUPPORT_BUCKET).remove([storagePath])
    throwSupportError(error, 'Could not save attachment.')
  }
  return { item: data }
}

export const downloadSupportAttachment = async (event) => {
  const authorization = getHeader(event, 'authorization')
  if (!authorization?.startsWith('Bearer ')) {
    throw createError({ statusCode: 401, statusMessage: 'Sign in to download this file.' })
  }
  const supabase = getSupabaseAdminClient()
  const { data: authData, error: authError } = await supabase.auth.getUser(authorization.slice(7))
  if (authError || !authData.user) throw createError({ statusCode: 401, statusMessage: 'Session expired.' })
  const id = requireSupportUuid(getRouterParam(event, 'id'), 'Attachment')
  const { data: attachment, error } = await supabase.from('support_ticket_attachments')
    .select('id, ticket_id, message_id, original_name, storage_path, mime_type')
    .eq('id', id).maybeSingle()
  if (error) throwSupportError(error)
  if (!attachment) throw createError({ statusCode: 404, statusMessage: 'File not found.' })
  const { data: ticket } = await supabase.from('support_tickets')
    .select('customer_id').eq('id', attachment.ticket_id).maybeSingle()
  const { data: adminRecord } = await supabase.from('admin_users').select('*')
    .eq('id', authData.user.id).maybeSingle()
  const staffAllowed = hasAdminPermission(adminRecord, 'support.view')
  if (!staffAllowed) {
    if (!ticket || ticket.customer_id !== authData.user.id) {
      throw createError({ statusCode: 404, statusMessage: 'File not found.' })
    }
    const { data: customer, error: customerError } = await supabase.from('customer_profiles')
      .select('is_active').eq('id', authData.user.id).maybeSingle()
    if (customerError) throwSupportError(customerError, 'Could not check file access.')
    if (!customer || customer.is_active !== true) {
      throw createError({ statusCode: 404, statusMessage: 'File not found.' })
    }
    const { data: message } = await supabase.from('support_ticket_messages')
      .select('is_internal').eq('id', attachment.message_id)
      .eq('ticket_id', attachment.ticket_id).maybeSingle()
    if (!message || message.is_internal) throw createError({ statusCode: 404, statusMessage: 'File not found.' })
  }
  const { data: blob, error: downloadError } = await supabase.storage.from(SUPPORT_BUCKET)
    .download(attachment.storage_path)
  if (downloadError || !blob) throw createError({ statusCode: 404, statusMessage: 'File not found.' })
  const buffer = Buffer.from(await blob.arrayBuffer())
  const filename = attachment.original_name.replace(/["\\\r\n]/g, '_')
  setHeader(event, 'Content-Type', 'application/octet-stream')
  setHeader(event, 'Content-Length', String(buffer.length))
  setHeader(event, 'Content-Disposition', `attachment; filename="${filename.replace(/[^a-z0-9._ -]/gi, '_')}"; filename*=UTF-8''${encodeURIComponent(filename)}`)
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  setHeader(event, 'Cache-Control', 'private, no-store')
  return send(event, buffer)
}

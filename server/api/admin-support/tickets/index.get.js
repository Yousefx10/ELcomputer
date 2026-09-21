import { createError, getQuery } from 'h3'
import { requireAdminRequest } from '../../../utils/adminRequest'
import { requireSupportUuid, ticketFields, throwSupportError } from '../../../utils/supportTickets'

export default defineEventHandler(async (event) => {
  const { supabaseAdmin } = await requireAdminRequest(event, { permission: 'support.view' })
  const query = getQuery(event)
  const page = Math.max(1, Math.min(1000, Number.parseInt(String(query.page || 1), 10) || 1))
  const pageSize = 30
  let request = supabaseAdmin.from('support_tickets')
    .select(ticketFields, { count: 'exact' })
    .order('updated_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)
  if (query.status && query.status !== 'all') request = request.eq('status', String(query.status))
  if (query.priority && query.priority !== 'all') request = request.eq('priority', String(query.priority))
  if (query.category) request = request.eq('category_id', requireSupportUuid(query.category, 'Category'))
  if (query.assignee === 'unassigned') request = request.is('assigned_admin_id', null)
  else if (query.assignee) request = request.eq('assigned_admin_id', requireSupportUuid(query.assignee, 'Assignee'))
  if (query.order) request = request.eq('order_id', requireSupportUuid(query.order, 'Order'))
  if (query.customer) {
    const customer = String(query.customer).trim().slice(0, 120)
      .replace(/[^\p{L}\p{N}@+._ ()-]/gu, '')
    if (!customer) throw createError({ statusCode: 400, statusMessage: 'Customer search is invalid.' })
    request = request.or(`customer_email.ilike."%${customer}%",customer_mobile.ilike."%${customer}%"`)
  }
  if (query.subject) {
    const subject = String(query.subject).trim().slice(0, 120).replace(/[%_]/g, '')
    request = request.ilike('subject', `%${subject}%`)
  }
  if (query.reference) {
    const reference = String(query.reference).replace(/^SUP-/i, '').trim()
    if (!/^\d{1,15}$/.test(reference)) throw createError({ statusCode: 400, statusMessage: 'Reference is invalid.' })
    request = request.eq('reference_number', Number(reference))
  }
  if (query.from) {
    const date = Date.parse(String(query.from))
    if (!Number.isFinite(date)) throw createError({ statusCode: 400, statusMessage: 'Start date is invalid.' })
    request = request.gte('created_at', new Date(date).toISOString())
  }
  if (query.to) {
    const date = Date.parse(String(query.to))
    if (!Number.isFinite(date)) throw createError({ statusCode: 400, statusMessage: 'End date is invalid.' })
    request = request.lt('created_at', new Date(date + 24 * 60 * 60 * 1000).toISOString())
  }
  const [listResult, attentionResult] = await Promise.all([
    request,
    supabaseAdmin.from('support_tickets').select('id', { count: 'exact', head: true })
      .in('status', ['open', 'waiting_for_support'])
  ])
  const { data, count, error } = listResult
  if (error) throwSupportError(error, 'Could not load tickets.')
  if (attentionResult.error) throwSupportError(attentionResult.error, 'Could not load support attention count.')
  return { items: data || [], total: count || 0, needsAttentionCount: attentionResult.count || 0, page, pageSize }
})

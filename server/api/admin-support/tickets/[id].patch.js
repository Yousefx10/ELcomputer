import { createError, getRouterParam, readBody } from 'h3'
import { requireAdminRequest } from '../../../utils/adminRequest'
import { requireStaffTicket, requireSupportUuid, throwSupportError } from '../../../utils/supportTickets'

export default defineEventHandler(async (event) => {
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, { permission: 'support.manage' })
  const ticket = await requireStaffTicket(supabaseAdmin, getRouterParam(event, 'id'))
  const body = await readBody(event)
  const statuses = ['open', 'in_progress', 'waiting_for_customer', 'waiting_for_support', 'resolved', 'closed']
  const priorities = ['low', 'normal', 'high', 'urgent']
  const status = body?.status === undefined ? null : String(body.status)
  const priority = body?.priority === undefined ? null : String(body.priority)
  const changeAssignment = Object.hasOwn(body || {}, 'assignedAdminId')
  const assignee = body?.assignedAdminId ? requireSupportUuid(body.assignedAdminId, 'Assignee') : null
  if (status !== null && !statuses.includes(status)) throw createError({ statusCode: 400, statusMessage: 'Status is invalid.' })
  if (priority !== null && !priorities.includes(priority)) throw createError({ statusCode: 400, statusMessage: 'Priority is invalid.' })
  if (status === null && priority === null && !changeAssignment) throw createError({ statusCode: 400, statusMessage: 'Choose a change.' })
  const { error } = await supabaseAdmin.rpc('support_update_ticket', {
    p_ticket_id: ticket.id, p_actor_id: adminUser.id, p_actor_type: 'staff',
    p_status: status, p_priority: priority, p_assignee_id: assignee,
    p_change_assignment: changeAssignment
  })
  if (error) throwSupportError(error, 'Could not update ticket.')
  return { item: await requireStaffTicket(supabaseAdmin, ticket.id) }
})

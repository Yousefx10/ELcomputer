import { createError, getRouterParam, readBody } from 'h3'
import { requireCustomerRequest } from '../../../utils/customerRequest'
import { requireCustomerTicket, throwSupportError } from '../../../utils/supportTickets'

export default defineEventHandler(async (event) => {
  const { authUser, supabaseAdmin } = await requireCustomerRequest(event)
  const ticket = await requireCustomerTicket(supabaseAdmin, authUser.id, getRouterParam(event, 'id'))
  const body = await readBody(event)
  if (!['closed', 'open'].includes(body?.status)) {
    throw createError({ statusCode: 400, statusMessage: 'Choose close or reopen.' })
  }
  const { error } = await supabaseAdmin.rpc('support_update_ticket', {
    p_ticket_id: ticket.id, p_actor_id: authUser.id, p_actor_type: 'customer',
    p_status: body.status, p_priority: null, p_assignee_id: null, p_change_assignment: false
  })
  if (error) throwSupportError(error, 'Could not update ticket.')
  return { item: await requireCustomerTicket(supabaseAdmin, authUser.id, ticket.id) }
})

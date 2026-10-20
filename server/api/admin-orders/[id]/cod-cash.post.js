import { getRouterParam, readBody } from 'h3'
import { requireAdminRequest } from '../../../utils/adminRequest'
import { codCashCommand, codCashResponse, throwCodCashError } from '../../../utils/codCollections'

export default defineEventHandler(async event => {
  codCashResponse(event)
  const { adminUser, supabaseAdmin } = await requireAdminRequest(event, { permission: 'dashboard.orders' })
  const orderId = getRouterParam(event, 'id')
  const command = codCashCommand(orderId, await readBody(event))
  const request = supabaseAdmin.rpc('commerce_cod_cash_command', {
    p_actor_id: adminUser.id, p_command_id: command.command_id, p_order_id: orderId,
    p_action: command.action, p_collection_id: command.collection_id, p_amount: command.amount,
    p_reference: command.reference, p_received_on: command.received_on, p_confirmed: command.confirmed
  })
  let result
  try { result = await (request.abortSignal ? request.abortSignal(AbortSignal.timeout(60000)) : request) }
  catch { throwCodCashError({}) }
  const { data, error } = result
  if (error) throwCodCashError(error)
  if (data?.status !== 'committed' || data.command_id !== command.command_id || !data.entry_id || !data.audit_id) throwCodCashError({})
  return data
})
